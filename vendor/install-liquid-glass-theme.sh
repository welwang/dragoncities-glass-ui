#!/usr/bin/env bash
# Liquid Glass 系統主題 — Pterodactyl Panel v1.15.2
#
# 用法（在伺服器上，以 root 或面板擁有者執行）：
#   bash install-liquid-glass-theme.sh            安裝
#   bash install-liquid-glass-theme.sh --revert   還原成原版
#
# 需要：liquid-glass-theme-v1.15.2.patch 與此腳本放在同一個資料夾；Node.js 22 以上與 yarn。
set -euo pipefail

PANEL="${PANEL_DIR:-/var/www/pterodactyl}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PATCH="$HERE/liquid-glass-theme-v1.15.2.patch"
STAMP="$(date +%Y%m%d-%H%M%S)"

say() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31m錯誤：\033[0m%s\n' "$*" >&2; exit 1; }

[ -f "$PATCH" ] || die "找不到 $PATCH"
[ -f "$PANEL/artisan" ] || die "$PANEL 不是 Pterodactyl 面板目錄（可用 PANEL_DIR=/路徑 指定）"
cd "$PANEL"

build() {
  command -v node >/dev/null || die "沒有安裝 Node.js"
  command -v yarn >/dev/null || die "沒有安裝 yarn（npm i -g yarn）"
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$NODE_MAJOR" -ge 22 ] || die "Node.js 需要 22 以上，目前是 $(node -v)"
  say "安裝前端套件（已安裝會很快跳過）"
  yarn install --frozen-lockfile --ignore-engines
  say "編譯前端（約 1～3 分鐘，記憶體不足時請先加 swap）"
  yarn build:production
  php artisan view:clear >/dev/null
}

if [ "${1:-}" = "--revert" ]; then
  say "還原原版介面"
  git apply -R --check "$PATCH" 2>/dev/null || die "目前的檔案和主題版本不一致，無法自動還原；請用安裝時的備份還原"
  git apply -R "$PATCH"
  build
  say "已還原成原版介面"
  exit 0
fi

grep -q "'version' => '1.15.2'" config/app.php || printf '\n\033[1;33m注意：\033[0m這個主題是針對 v1.15.2 製作的，你的版本是 %s\n' "$(grep "'version'" config/app.php)"

say "檢查原始碼是否為未修改的原版"
if ! git apply --check "$PATCH" 2>/tmp/lg-check.txt; then
  cat /tmp/lg-check.txt
  die "有檔案已經被改過（例如先前手動加的玻璃樣式），主題無法套上。請先把上面列出的檔案還原成原版再執行。"
fi

say "備份目前的前端原始碼與編譯結果 → ~/ptero-ui-backup-$STAMP.tar.gz"
tar -czf ~/ptero-ui-backup-"$STAMP".tar.gz resources/scripts tailwind.config.js package.json public/assets

say "套用主題"
git apply "$PATCH"

build

say "完成。用 Chrome 或 Edge 重新整理面板（Ctrl+F5）即可看到新介面。"
echo "    還原：bash $(basename "$0") --revert"
