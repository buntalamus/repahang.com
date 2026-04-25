# Server Connection Timeout Fix

## Problem
API works fine at first, but fails after 1-2 days with "PDO not found" error.

**Root cause:** Auto-migration running on every request creates new connections without proper cleanup, exhausting MySQL connection pool.

## Server Actions Required (cPanel / SSH)

### 1. Create Migration Lock (One-time)
```bash
mkdir -p /home/refpahan/public_html/storage
touch /home/refpahan/public_html/storage/.migration_done
echo "$(date)" >> /home/refpahan/public_html/storage/.migration_done
```

### 2. Check MySQL Connection Status
```bash
mysql -u refpahan_admin -p refpahan_refpahang -e "SHOW PROCESSLIST;" | wc -l
mysql -u refpahan_admin -p refpahan_refpahang -e "SHOW VARIABLES LIKE 'max_connections';"
```

If `max_connections` is low (default 151), ask hosting to increase to **500-1000**.

### 3. Kill Zombie Connections (if needed)
```bash
mysql -u refpahan_admin -p refpahan_refpahang -e "SHOW PROCESSLIST;" | grep Sleep | awk '{print "KILL "$1";"}' | mysql -u refpahan_admin -p refpahan_refpahang
```

### 4. Restart PHP-FPM (if available)
```bash
sudo systemctl restart php-fpm
# OR
sudo systemctl restart php8.3-fpm
```

### 5. Set File Permissions
```bash
chmod 775 /home/refpahan/public_html/storage
chmod 644 /home/refpahan/public_html/storage/.migration_done
```

## Code Changes (Already Applied)

- `api/bootstrap.php`: Migration now uses single connection, not separate
- `config/db.php`: Added 10-second timeout + session sql_mode setting

## Deploy Steps

1. Build: `ng build --configuration production`
2. Run: `bash deploy/build.sh`
3. Upload new zip to hosting
4. Extract to `public_html/`
5. Run **Server Actions** above
6. Test API: `https://refpahang.com/api/check-maintenance.php`

## Monitoring

Monitor app.log for connection warnings:
```bash
tail -f /home/refpahan/public_html/storage/logs/app.log | grep -i "connection\|timeout\|error"
```

If "Too many connections" errors appear → Increase MySQL max_connections or enable connection pooling (ProxySQL/MaxScale).
