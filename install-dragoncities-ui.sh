#!/usr/bin/env bash
set -euo pipefail
umask 022
HERE="$(cd "$(dirname "$0")" && pwd)"
PANEL_DIR="$(cd "${PANEL_DIR:-/var/www/pterodactyl}" && pwd -P)"
export PANEL_DIR
cd "$PANEL_DIR"
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
[ -f artisan ] && [ -f config/app.php ] || die 'PANEL_DIR is not a Pterodactyl panel.'
[ "$PANEL_DIR" != / ] || die 'Invalid panel directory.'
(cd "$HERE" && sha256sum -c SHA256SUMS) || die 'Package integrity check failed.'

if [ "${1:-}" = --revert ]; then
    [ "$#" = 2 ] || die 'Usage: bash install-dragoncities-ui.sh --revert /path/to/backup.tar.gz'
    backup="$(realpath "$2")"
    temporary="$(mktemp -d)"
    tar -xzf "$backup" -C "$temporary" __dragoncities_backup__/added-files.txt
    while IFS= read -r file; do
        grep -Fxq "$file" "$HERE/target-files.txt" || die "Unexpected restore path: $file"
    done < "$temporary/__dragoncities_backup__/added-files.txt"
    while IFS= read -r file; do rm -f -- "$PANEL_DIR/$file"; done < "$temporary/__dragoncities_backup__/added-files.txt"
    tar -xzf "$backup" --exclude='__dragoncities_backup__' -C "$PANEL_DIR"
    rm -f "$temporary/__dragoncities_backup__/added-files.txt"
    rmdir "$temporary/__dragoncities_backup__" "$temporary"
    php artisan view:clear
    echo 'Restored frontend source and compiled assets. No services restarted.'
    exit 0
fi
case "${1:-}" in
    ''|--check) [ "$#" -le 1 ] || die 'Too many arguments.' ;;
    *) die 'Supported options: --check, --revert BACKUP' ;;
esac
if ! command -v node >/dev/null && [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh"; fi
for tool in node yarn git tar sha256sum; do command -v "$tool" >/dev/null || die "Missing command: $tool"; done
node -v
yarn -v
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || die 'Node.js 22 or newer is required.'
[ "$(yarn -v | cut -d. -f1)" = 1 ] || die 'Use Yarn Classic 1.x (validated with 1.22.22).'
free -h
[ "$(free -b | awk '/^Mem:/ {m=$2} /^Swap:/ {s=$2} END {printf "%.0f",m+s}')" -ge 2147483648 ] || die 'RAM plus swap is below 2 GiB. Add capacity before installing.'
echo 'Target: official v1.15.2 frontend (verified by source checksums below).'
[ ! -e public/themes/liquid-glass ] || die 'Remove the previous standalone Liquid Glass module through its original uninstall procedure first.'
check_absent() {
    while IFS= read -r file; do [ ! -e "$file" ] || return 1; done < "$1"
}
if sha256sum -c "$HERE/final-source.sha256" >/dev/null 2>&1 && [ -f public/branding/brand.json ]; then
    echo 'This UI version is already installed. Use configure-brand.sh to change its name or logo.'
    exit 0
elif sha256sum -c "$HERE/baseline.sha256" >/dev/null 2>&1 && check_absent "$HERE/baseline-absent.txt"; then
    install_mode=clean
    git -c core.autocrlf=false apply --check --whitespace=error "$HERE/vendor/liquid-glass-theme-v1.15.2.patch"
elif sha256sum -c "$HERE/upgrade.sha256" >/dev/null 2>&1 && check_absent "$HERE/upgrade-absent.txt"; then
    install_mode=upgrade
else
    # 已發行的舊版本（known-states/*.sha256）：每個檔案都要完全符合其中一個版本，才允許直接升級
    install_mode=
    if [ -f public/branding/brand.json ]; then
        for state in "$HERE"/known-states/*.sha256; do
            if sha256sum -c "$state" >/dev/null 2>&1; then
                install_mode=upgrade
                echo "Recognized previous release: $(basename "$state" .sha256)"
                break
            fi
        done
    fi
    if [ -z "$install_mode" ]; then
        echo 'Official v1.15.2 source comparison:' >&2
        sha256sum -c "$HERE/baseline.sha256" >&2 || true
        echo 'Previous DragonCities UI source comparison:' >&2
        sha256sum -c "$HERE/upgrade.sha256" >&2 || true
        for state in "$HERE"/known-states/*.sha256; do
            echo "Packaged release $(basename "$state" .sha256) comparison:" >&2
            sha256sum -c "$state" >&2 || true
        done
        die 'Unrecognized frontend modifications. Restore the previous theme backup first; no forced patching was attempted.'
    fi
fi
echo "Install mode: $install_mode"
if [ "${1:-}" = --check ]; then echo 'Preflight passed. No panel files changed.'; exit 0; fi

temporary="$(mktemp -d)"
mkdir "$temporary/__dragoncities_backup__"
existing_files=()
: > "$temporary/__dragoncities_backup__/added-files.txt"
while IFS= read -r file; do
    if [ -e "$file" ]; then existing_files+=("$file");
    else printf '%s\n' "$file" >> "$temporary/__dragoncities_backup__/added-files.txt"; fi
done < "$HERE/target-files.txt"
backup="${BACKUP_DIR:-$HOME}/ptero-ui-backup-$(date +%Y%m%d-%H%M%S)-dragoncities.tar.gz"
tar -czf "$backup" -C "$PANEL_DIR" "${existing_files[@]}" public/assets yarn.lock -C "$temporary" __dragoncities_backup__/added-files.txt
echo "FRONTEND_BACKUP=$backup"
trap 'printf "\nInstallation stopped. Restore with:\nPANEL_DIR=%q bash %q --revert %q\n" "$PANEL_DIR" "$HERE/install-dragoncities-ui.sh" "$backup" >&2' ERR
branding_files=()
if [ -f public/branding/brand.json ]; then
    for file in brand.json panel-logo.png manifest.json browserconfig.xml; do
        [ ! -f "public/branding/$file" ] || branding_files+=("public/branding/$file")
    done
fi
if [ "$install_mode" = clean ]; then git -c core.autocrlf=false apply "$HERE/vendor/liquid-glass-theme-v1.15.2.patch"; fi
cp -a "$HERE/overlay/." "$PANEL_DIR/"
if [ "${#branding_files[@]}" -gt 0 ]; then tar -xzf "$backup" -C "$PANEL_DIR" "${branding_files[@]}"; fi
sha256sum -c "$HERE/final-source.sha256"
node "$HERE/tools/configure-brand.cjs"
yarn install --frozen-lockfile --ignore-engines
yarn build:production
yarn tsc
php artisan view:clear
trap - ERR
rm -f "$temporary/__dragoncities_backup__/added-files.txt"
rmdir "$temporary/__dragoncities_backup__" "$temporary"
echo 'DragonCities UI installed. Press Ctrl+F5 in the browser. No services restarted.'
printf 'Restore: PANEL_DIR=%q bash %q --revert %q\n' "$PANEL_DIR" "$HERE/install-dragoncities-ui.sh" "$backup"
