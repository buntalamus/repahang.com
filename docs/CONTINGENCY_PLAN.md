# Contingency Plan: Jika Masih Gagal Selepas Deploy

## Langkah 1: Diagnostic

Tunggu 24-48 jam selepas deploy. Jika API masih mati:

1. Akses: `https://refpahang.com/api/connection-debug.php`
   - Ini akan return JSON dengan detail connection pool status
   - Lihat:
     - `max_connections` MySQL (berapa besar?)
     - `total_connections` current (sudah sampai puncak?)
     - `migration_lock_exists` (YES atau NO?)

2. Check error log:
   ```
   https://refpahang.com/storage/logs/app.log
   ```
   Cari error string:
   - "Too many connections" → MySQL kehabisan slot
   - "Connection timeout" → Hanging connections
   - "Class PDO not found" → PHP-FPM crash

---

## Langkah 2: Solution A — Increase MySQL Connections

**Jika diagnosis menunjukkan:** `max_connections = 151` dan `total_connections = 149`

**Hubungi hosting**, minta:
```sql
SET GLOBAL max_connections = 1000;
```

Atau dalam cPanel → MySQL Settings → Max Connections.

**Verify:**
```bash
mysql -u refpahan_admin -p -e "SHOW VARIABLES LIKE 'max_connections';"
```

---

## Langkah 3: Solution B — Enable Persistent Connections

**Jika** `max_connections` sudah 1000 tapi masih gagal → Connection leak masih ada.

Ubah `config/db.php` untuk enable persistent:

```php
$options = [
    // ... existing options ...
    PDO::ATTR_PERSISTENT => true,  // ENABLE ini
];
```

**Kesan:** Connections reused across requests, tidak close & open setiap saat.

**Risk:** Jika ada query hang, akan "stuck" sampai timeout.

---

## Langkah 4: Solution C — Connection Pooling (Nuclear Option)

Jika masih gagal, server perlu **connection pooling middleware**. Host harus install:

- **ProxySQL** (recommended) — sits between app & MySQL
- **MaxScale** — MariaDB official pooler
- **PgBouncer** (if using PostgreSQL)

Konfigurasi: App → ProxySQL (localhost:6032) → MySQL (actual server)

ProxySQL maintain pool of 100-200 connections ke MySQL, app buat banyak virtual connections.

**Cost:** Require server-level changes, hosting terpaksa configure.

---

## Langkah 5: Fallback — Temporary Workaround

Jika hosting tidak cooperate:

**Option A: Reduce Traffic**
- Rate limit per IP (nginx)
- Close sessions older than 30 min
- Disable heavy features temporarily

**Option B: Cache Heavy Queries**
- Add Redis caching layer
- Cache API responses 5-10 minutes
- Reduce database hits

**Option C: Maintenance Mode**
- Set `APP_DEBUG=false`
- Return maintenance page untuk reduce load
- Manual restart PHP-FPM setiap 4 jam via cron

---

## Langkah 6: Long-term Fix

Kalau masalah persist, **suggest migration ke VPS/Cloud:**
- AWS RDS (managed MySQL, auto-scaling)
- DigitalOcean App Platform (built-in pooling)
- Linode (dedicated instance, full control)

Cost: ~$10-20/month vs current shared hosting.

---

## Execution Order

1. **Deploy** → include connection-debug.php
2. **Wait 24 hours** → check if problem persists
3. **No error?** → Solution kerja ✅
4. **Got error?** → Run connection-debug.php → identify issue → apply Solution A/B/C accordingly
5. **Still fail?** → Escalate to hosting support with debug.php output

---

## Quick Reference Commands (For Hosting SSH)

```bash
# Check current connections
mysql -u refpahan_admin -p refpahan_refpahang -e "SHOW PROCESSLIST;"

# Kill sleep connections (zombie)
mysql -u refpahan_admin -p refpahan_refpahang -e "SHOW PROCESSLIST \G" | grep -B 1 "Sleep" | grep "Id:" | awk '{print $4}' | while read id; do mysql -u refpahan_admin -p refpahan_refpahang -e "KILL $id;"; done

# Restart PHP-FPM
sudo systemctl restart php-fpm
sudo systemctl restart php8.3-fpm

# Monitor live connections
watch -n 5 "mysql -u refpahan_admin -p refpahan_refpahang -e 'SHOW PROCESSLIST;' | wc -l"

# Check migration lock
cat /home/refpahan/public_html/storage/.migration_done

# Tail error log
tail -f /home/refpahan/public_html/storage/logs/app.log
```
