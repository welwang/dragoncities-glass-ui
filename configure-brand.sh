#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PANEL_DIR="$(cd "${PANEL_DIR:-/var/www/pterodactyl}" && pwd -P)"
export PANEL_DIR
if ! command -v node >/dev/null && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
[ -f "$PANEL_DIR/resources/views/partials/panel-brand.php" ] || { echo 'Install DragonCities UI first.' >&2; exit 1; }
backup="${BACKUP_DIR:-$HOME}/ptero-brand-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$backup" -C "$PANEL_DIR" public/branding
echo "Brand backup: $backup"
node "$HERE/tools/configure-brand.cjs"
