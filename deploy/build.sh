#!/bin/bash
# =============================================================
# RefPahang Deploy Script
# Builds Angular frontend and packages everything into a
# deployment zip for upload to shared hosting (cPanel/FTP).
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEPLOY_DIR="$PROJECT_ROOT/deploy"
BUILD_DIR="$DEPLOY_DIR/.build-staging"
ZIP_NAME="refpahang-deploy-${TIMESTAMP}.zip"
ZIP_PATH="$DEPLOY_DIR/$ZIP_NAME"

echo "============================================"
echo " RefPahang Deploy Builder"
echo " $(date)"
echo "============================================"

# ---- Step 1: Build Angular ----
echo ""
echo "[1/4] Building Angular frontend..."
cd "$PROJECT_ROOT/frontend"
npx ng build 2>&1 | tail -5
BROWSER_DIR="$PROJECT_ROOT/frontend/dist/frontend/browser"
if [ ! -f "$BROWSER_DIR/index.html" ]; then
    echo "ERROR: Angular build failed — index.html not found."
    exit 1
fi
echo "  ✓ Angular build complete"

# ---- Step 2: Prepare staging directory ----
echo ""
echo "[2/4] Preparing staging directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy Angular build output (flattened to root for shared hosting)
cp -r "$BROWSER_DIR"/* "$BUILD_DIR/"

# Copy PHP backend
cp -r "$PROJECT_ROOT/api" "$BUILD_DIR/api"
cp -r "$PROJECT_ROOT/config" "$BUILD_DIR/config"
cp -r "$PROJECT_ROOT/includes" "$BUILD_DIR/includes"

# Copy vendor (Composer dependencies)
if [ -d "$PROJECT_ROOT/vendor" ]; then
    cp -r "$PROJECT_ROOT/vendor" "$BUILD_DIR/vendor"
else
    echo "  ⚠ vendor/ not found — run 'composer install' first"
fi

# Ensure uploads directory structure exists for security policies
mkdir -p "$BUILD_DIR/uploads/profile_images"
mkdir -p "$BUILD_DIR/uploads/receipts"

# Security: block PHP execution in uploads
cat > "$BUILD_DIR/uploads/.htaccess" << 'UPLOADSHT'
# Block PHP execution in uploads directory
<IfModule mod_php.c>
    php_flag engine off
</IfModule>
<FilesMatch "\.(php|php[0-9]|phtml|pht|phps|cgi|pl|py|sh|bash)$">
    <IfModule mod_authz_core.c>
        Require all denied
    </IfModule>
    <IfModule !mod_authz_core.c>
        Order allow,deny
        Deny from all
    </IfModule>
</FilesMatch>
Options -Indexes
UPLOADSHT

# Copy storage directory structure
mkdir -p "$BUILD_DIR/storage/logs"
mkdir -p "$BUILD_DIR/storage/preview"

# Copy standalone pages
[ -f "$PROJECT_ROOT/penilaian-borang.html" ] && cp "$PROJECT_ROOT/penilaian-borang.html" "$BUILD_DIR/"

# Copy frontend source (backup/reference)
if [ -d "$PROJECT_ROOT/frontend/src" ]; then
    mkdir -p "$BUILD_DIR/frontend"
    cp -r "$PROJECT_ROOT/frontend/src" "$BUILD_DIR/frontend/src"
    cp -r "$PROJECT_ROOT/frontend/public" "$BUILD_DIR/frontend/public" 2>/dev/null || true
    for f in angular.json package.json tsconfig.json tsconfig.app.json tailwind.config.js proxy.conf.json; do
        [ -f "$PROJECT_ROOT/frontend/$f" ] && cp "$PROJECT_ROOT/frontend/$f" "$BUILD_DIR/frontend/"
    done
fi

# NOTA: config.ini (credentials production) TIDAK disertakan dalam zip.
# Server admin mesti kekalkan config.ini terus di public_html/ pada server.
# Ini mengelakkan credentials production ditimpa oleh credentials local semasa deploy.
[ -f "$PROJECT_ROOT/.env.example" ] && cp "$PROJECT_ROOT/.env.example" "$BUILD_DIR/config.ini.example"

# Copy migration docs
mkdir -p "$BUILD_DIR/docs"
cp "$PROJECT_ROOT/docs"/*.sql "$BUILD_DIR/docs/" 2>/dev/null || true

# Copy templates
[ -d "$PROJECT_ROOT/api/templates" ] && cp -r "$PROJECT_ROOT/api/templates" "$BUILD_DIR/api/templates"

echo "  ✓ Staging directory ready"

# ---- Step 3: Create .htaccess files ----
echo ""
echo "[3/4] Creating .htaccess files..."

cat > "$BUILD_DIR/.htaccess" << 'HTACCESS'
RewriteEngine On
RewriteBase /

# Don't rewrite files or directories that exist
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Don't rewrite API requests
RewriteRule ^api/ - [L]

# Don't rewrite upload files
RewriteRule ^uploads/ - [L]

# Don't rewrite storage files
RewriteRule ^storage/ - [L]

# Don't rewrite vendor files
RewriteRule ^vendor/ - [L]

# Don't rewrite config files
RewriteRule ^config/ - [L]

# Rewrite everything else to index.html (Angular SPA)
RewriteRule ^ index.html [L]

# Security: block access to sensitive files
<FilesMatch "^(\.env|config\.ini|env\.ini|composer\.(json|lock))$">
    <IfModule mod_authz_core.c>
        Require all denied
    </IfModule>
    <IfModule !mod_authz_core.c>
        Order allow,deny
        Deny from all
    </IfModule>
</FilesMatch>
HTACCESS

cat > "$BUILD_DIR/api/.htaccess" << 'APIHTACCESS'
# Security headers
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type, Accept, X-Requested-With"
    Header set Access-Control-Allow-Origin "https://refpahang.com"
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "DENY"
</IfModule>
APIHTACCESS

echo "  ✓ .htaccess files created"

# ---- Step 3b: Fix file permissions ----
echo ""
echo "  Setting file permissions (644 files, 755 dirs)..."
find "$BUILD_DIR" -type f -exec chmod 644 {} \;
find "$BUILD_DIR" -type d -exec chmod 755 {} \;
echo "  ✓ Permissions set"

# ---- Step 4: Create zip ----
echo ""
echo "[4/4] Creating deployment zip..."

# Keep older deployment packages as rollback artifacts. ZIP names already carry
# a timestamp, so a new build does not need to delete a known-good package.

cd "$BUILD_DIR"
zip -r -q "$ZIP_PATH" . \
    -x "*.DS_Store" \
    -x "__MACOSX/*" \
    -x "api/test-*.php" \
    -x "api/diagnose.php" \
    -x "api/connection-debug.php"
cd "$PROJECT_ROOT"

# Cleanup staging
rm -rf "$BUILD_DIR"

# Stats
ZIP_SIZE=$(du -sh "$ZIP_PATH" | cut -f1)
FILE_COUNT=$(unzip -l "$ZIP_PATH" 2>/dev/null | tail -1 | awk '{print $2}')

echo ""
echo "============================================"
echo " Deploy package ready!"
echo "  File:  $ZIP_NAME"
echo "  Size:  $ZIP_SIZE"
echo "  Files: $FILE_COUNT"
echo "  Path:  $ZIP_PATH"
echo "============================================"
echo ""
echo "Deployment steps:"
echo "  1. Back up the production database"
echo "  2. Before extracting the new code, run these schema migrations once:"
echo "     docs/migration_status_perlawanan_lantikan.sql"
echo "     docs/migration_pengadil_luar_daerah_penilai.sql"
echo "  3. Upload the zip and extract it to public_html/"
echo "  4. Keep the existing production .env/config.ini credentials"
echo "  5. Delete old api/diagnose.php and api/connection-debug.php from the server"
echo "  6. Preview, confirm, then run: docs/recover_mssp_late_auto_reject.sql"
echo "  7. Preview, confirm, then run: docs/recover_mssp_accepted_history.sql"
echo "  8. Complete the missing district values listed by the new migration"
echo "  9. Verify: https://refpahang.com/api/check-maintenance.php"
echo ""
