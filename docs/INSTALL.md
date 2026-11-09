# 安裝、品牌設定與還原

**繁體中文** | [English](INSTALL.en.md)

本文件適用於 DragonCities Glass UI **1.1.0**，目標面板為 **Pterodactyl v1.15.2**。

委託助手操作請先閱讀 [AI 安裝指令、注意事項與最低能力需求](AI-INSTALL.md)。

## 先了解安裝範圍

你需要先有能正常登入、連線及管理伺服器的 Pterodactyl 面板。本工具只安裝前端介面與品牌設定，不會替你建立面板、Wings、資料庫或遊戲伺服器。

整合安裝器會核對來源，備份將修改的介面檔案與原編譯結果，套用原始基礎主題，再加入整合元件及品牌設定，最後執行前端建置、TypeScript 檢查及 view cache 清除。

它不會修改 `.env`、資料庫、Wings 或 nginx，不會執行 migrate、composer update、面板升級，也不會重啟服務。建置期間前端檔案會重新產生，請安排在面板使用量較低的時間進行，避免同時安裝其他擴充。

## 系統需求

| 項目 | 需求 |
| --- | --- |
| 作業系統 | Linux，需有 Bash 與標準 GNU 系統工具 |
| 面板 | 已正常運作的 Pterodactyl Panel v1.15.2 |
| Node.js | 22 以上 |
| Yarn | Classic 1.x，建議 1.22.22 |
| PHP | 面板使用的 PHP CLI，執行帳號能執行 `php artisan view:clear` |
| 系統工具 | git、tar、sha256sum、free、awk、cut、realpath、mktemp、cp；解壓 ZIP 另需 unzip |
| 記憶體 | RAM＋swap 至少 2 GiB，建議 4 GiB 以上，並保留實際可用記憶體 |
| 磁碟 | 能容納完整介面備份、前端依賴及新編譯檔 |
| 權限 | 面板目錄與備份位置可寫入，PHP 執行帳號可讀取安裝後的來源與公開資產 |

預設面板目錄為 `/var/www/pterodactyl`。若你的路徑不同，每次都使用正確的 `PANEL_DIR`。

建置、日常執行與瀏覽器繪圖的用量不同，請參閱 [資源評估](RESOURCES.md)。2 GiB 是安裝器最低門檻，不是足夠容量的保證；依本機建置參考，建議在既有系統與遊戲負載之外，另預留約 3～4 GiB 可用記憶體餘裕。

先確認工具：

```bash
node -v
yarn -v
php -v
git --version
free -h
```

Node.js 請從 [官方下載與安裝說明](https://nodejs.org/en/download) 取得適合系統的版本。若已裝 Node.js／npm 但沒有 Yarn Classic，可依權限環境執行：

```bash
npm install --global yarn@1.22.22
```

使用 nvm 時，請先切到正確的 Node.js 版本。工具不會自動安裝或升級你的系統執行環境。記憶體加 swap 未達門檻時會直接停止，請先調整主機資源再安裝。

## 可接受的原始碼狀態

安裝器只接受以下三種來源：

1. 乾淨的官方 v1.15.2 前端：以 SHA256 核對既有檔案，確認新增檔案尚不存在，再以 `git apply --check --whitespace=error` 檢查基礎 patch。
2. 可完整核對的既有 DragonCities UI：Liquid Glass v9、銀白 Logo、雙排 Bar、全局動畫速度及切頁修正的指定整合版本。
3. 可完整核對的 DragonCities Glass UI 已發行版本（`known-states/` 內列出的 1.0.1／1.0.2、1.0.3 固定來源），且品牌設定檔存在；自訂品牌名稱與 Logo 會保留。安裝器會印出辨識到的版本。

第二、三種來源會直接加入本版整合檔案，不重複套用基礎 patch。如果已經是相同的固定來源版本，工具會提示已安裝；更換名稱或 Logo 請使用品牌設定入口。1.0.3 移除 Logo 外層的圓形背景與內陰影，不裁切圖片。1.1.0 新增點陣深淺色開關、外觀選單與淺色模式的彩虹泡泡主題。

其他舊版、第三方主題或手動修改過的檔案不保證可直接升級。若來源無法核對，安裝器會停止並列出差異，請使用原主題的還原功能或安裝前備份回復；不要使用 force、`--reject`、`--3way` 或手動修改 patch 來跳過來源核對。

官方 v1.15.2 tag 的 `config/app.php` 版本欄位可能顯示 `canary`，因此本工具以對應的前端檔案指紋核對相容性；這不表示支援其他 canary 或其他面板版本。

## 下載方式一：Git

在主機上的家目錄等位置下載，請勿將安裝器直接放進面板目錄：

```bash
cd ~
git clone https://github.com/welwang/dragoncities-glass-ui.git
cd dragoncities-glass-ui
git checkout v1.1.0
sha256sum -c SHA256SUMS
```

使用固定 tag 可避免下載到日後尚未發行的變更。執行安裝前請先閱讀來源碼及本文件。

## 下載方式二：Release ZIP

到 [GitHub Releases](https://github.com/welwang/dragoncities-glass-ui/releases) 下載 `DragonCities-Glass-UI-v1.1.0.zip` 與對應 `.sha256`，上傳到主機。以連接埠 23 為例，請替換帳號、IP 與本機檔案位置：

```powershell
scp -P 23 .\DragonCities-Glass-UI-v1.1.0.zip 帳號@主機IP:~/
scp -P 23 .\DragonCities-Glass-UI-v1.1.0.zip.sha256 帳號@主機IP:~/
ssh -p 23 帳號@主機IP
```

在 Linux 主機驗證並解壓：

```bash
cd ~
sha256sum -c DragonCities-Glass-UI-v1.1.0.zip.sha256
mkdir -p ~/dragoncities-ui-release
unzip DragonCities-Glass-UI-v1.1.0.zip -d ~/dragoncities-ui-release
cd ~/dragoncities-ui-release/dragoncities-glass-ui-1.1.0
sha256sum -c SHA256SUMS
```

ZIP 校驗碼用於確認下載內容一致；包內校驗碼用於確認檔案未損壞。它們不是作者的數位簽章，也不能代替檢查下載來源。

## 執行安裝前檢查

```bash
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh --check
```

`--check` 會確認環境、套件版本、記憶體、安裝包完整性與來源相容性，不會修改面板檔案。看到 `Preflight passed` 才繼續；若提示相同 UI 已安裝，可直接使用品牌設定工具。

如果仍有早期獨立玻璃模組 `public/themes/liquid-glass/`，請先按該模組原本的移除方式處理，確認來源回復一致。工具不會擅自刪除未知主題檔案。

## 安裝

使用預設名稱與隨附 Logo：

```bash
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh
```

或在第一次安裝時就指定你自己的品牌：

```bash
PANEL_DIR=/var/www/pterodactyl \
BRAND_NAME='我的伺服器面板' \
BRAND_LOGO='/root/my-logo.png' \
bash install-dragoncities-ui.sh
```

| 設定 | 說明 |
| --- | --- |
| `PANEL_DIR` | 面板目錄；預設 `/var/www/pterodactyl` |
| `BRAND_NAME` | 1～48 個字元，不含控制字元；建議名稱簡短，方便手機排版 |
| `BRAND_LOGO` | 主機上的 PNG 檔案絕對路徑；建議透明背景、正方形、至少 256×256 |
| `BACKUP_DIR` | 選填，需已存在且可寫入；預設為執行帳號的家目錄 |

`BRAND_LOGO` 不是圖片網址，也不是你電腦上尚未上傳的 Windows 路徑。若使用自己的 Logo，請確認有權使用及公開提供該圖片。

安裝順序：

1. 校驗安裝包與來源版本。
2. 建立介面備份，記錄哪些目標檔案是本次新增。
3. 必要時以標準 git apply 套用原始基礎 patch，不修改 patch 內容。
4. 複製整合元件，核對最終固定來源。
5. 寫入品牌設定與圖片版本網址。
6. 執行 `yarn install --frozen-lockfile --ignore-engines`。
7. 執行 `yarn build:production` 與 `yarn tsc`。
8. 執行 `php artisan view:clear`，印出還原指令。

`--frozen-lockfile` 用於遵照既有鎖定版本；`--ignore-engines` 由本工具先行檢查 Node.js 版本後使用，不表示可使用不符需求的執行環境。

成功後按 Ctrl+F5，必要時關閉舊分頁再重新開啟面板。原本已開啟的頁面可能仍持有前一版的資產網址。

## 備份內容與位置

安裝器會印出：

```text
FRONTEND_BACKUP=/root/ptero-ui-backup-YYYYMMDD-HHMMSS-dragoncities.tar.gz
```

備份包含安裝前已存在的目標前端檔案、會修改的模板與品牌檔案、`public/assets`、`yarn.lock`，以及本次新增檔案的清單。請把它保存到安全位置。

這是介面還原備份，不包含資料庫、`.env`、遊戲資料或 `node_modules`；面板本身與遊戲資料的日常備份仍需依你的維運方式管理。安裝器也不會刪除先前的備份。

## 安裝後更改名稱與 Logo

回到同一份安裝包資料夾。只改名稱：

```bash
PANEL_DIR=/var/www/pterodactyl BRAND_NAME='新的面板名稱' bash configure-brand.sh
```

只改 Logo：

```bash
PANEL_DIR=/var/www/pterodactyl BRAND_LOGO='/root/new-logo.png' bash configure-brand.sh
```

同時更改：

```bash
PANEL_DIR=/var/www/pterodactyl \
BRAND_NAME='新的面板名稱' BRAND_LOGO='/root/new-logo.png' \
bash configure-brand.sh
```

省略的項目會保留目前值。品牌設定保存在 `public/branding/brand.json`，PNG 圖片為 `public/branding/panel-logo.png`，工具會同步更新 manifest、圖示設定與圖片版本網址。

這些設定供頂部導覽、登入頁、頁面標題、後台品牌區、網站圖示和通知郵件模板共用，不需要重新編譯前端或重啟服務。重新整理後會讀取新設定；網站圖示可能需要關閉舊分頁後重開。

品牌名稱不是伺服器名稱；它也不會修改 `.env` 的 APP_NAME、寄件地址或 Pterodactyl 版權文字。請優先使用設定工具，避免手動寫入無效的 JSON。

修改前會備份整個 `public/branding` 到 `ptero-brand-backup-日期.tar.gz`。只回復一次品牌更改時可使用自己的實際路徑：

```bash
tar -xzf /root/ptero-brand-backup-YYYYMMDD-HHMMSS.tar.gz -C /var/www/pterodactyl
```

## 深淺色開關、外觀選單與彩虹主題

- **導覽列的點陣開關**：切換淺色／深色。切換時點陣的太陽／月亮會散開再重組，圓鈕邊緣的光跟著游標。
- **旁邊的 ▾** 打開「外觀」選單：
  - **跟隨系統**：跟隨作業系統；關掉時維持目前的模式。
  - **彩虹**：淺色模式的彩虹泡泡主題。在深色模式打開會一起切到淺色；切回深色時設定保留但暫停，回到淺色就恢復。

選擇只記在各自的瀏覽器，不影響其他使用者。開關、設定開關與彩虹的外觀在 `resources/scripts/system-theme/appearance.css`（彩虹規則以 `[data-theme='light'][data-accent='rainbow']` 開頭），點陣圖示與邊緣光在 `resources/scripts/components/elements/PixelIcon.tsx`；修改後需要重新建置前端。

## 完整還原

使用整合安裝器產生的實際備份檔：

```bash
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh \
  --revert /root/ptero-ui-backup-YYYYMMDD-HHMMSS-dragoncities.tar.gz
```

工具會回復原檔案與原編譯資產，移除本次新增的目標檔案，再清除 view cache。由於備份已包含原編譯資產，這一步不需要重新安裝依賴或重建前端，也不會重啟服務。

如果安裝前是指定的舊 DragonCities UI，還原會回到那一版；安裝前是原版，就回到原版。請勿在面板已升級或另裝其他擴充後，直接拿舊版本的介面備份覆蓋新版本。

`--revert` 只支援本工具建立、檔名為 `*-dragoncities.tar.gz` 且內含新增檔案紀錄的備份，不適用其他主題安裝器的任意壓縮檔。

## 失敗時的處理

工具會在錯誤處停止並保留原始訊息；已完成備份的安裝會印出可用的還原指令。請先保存錯誤、確認備份，再決定處理原因或還原。不要為了讓安裝通過而修改原 patch 或跳過來源核對。

| 現象 | 處理方式 |
| --- | --- |
| `Package integrity check failed` | 重新從同一 tag／Release 下載，確認沒有手動改過包內檔案 |
| `Unrecognized frontend modifications` | 面板來源不相符；先用原主題或備份還原，保留列出的差異 |
| `Missing command`、找不到 Node／Yarn | 確認執行帳號的 PATH；使用 nvm 時先載入並切換正確版本 |
| Node 或 Yarn 版本不符 | 使用 Node.js 22 以上及 Yarn Classic 1.x，不要直接使用 Yarn Berry |
| 記憶體不足、建置被系統終止 | 確認實際可用記憶體與主機資源，調整後再處理；不要在失敗來源上反覆疊裝 |
| `BRAND_LOGO must be a valid PNG` | 確認檔案已上傳、格式確實為 PNG，且不是只把其他副檔名改成 .png |
| `php: command not found` | 使用面板對應的 PHP CLI；恢復正確 PATH 後依印出的指令還原，或完成快取清除 |
| 檔案權限錯誤 | 以具備面板寫入權限的帳號處理，並確認 PHP 可讀；不要整個面板 chmod 777 |
| 更新後仍顯示舊介面 | Ctrl+F5 或重開分頁，檢查瀏覽器是否仍使用舊資產；圖示另有瀏覽器快取 |

本工具的 shell 邏輯以 Linux 為執行環境；Windows 適合下載、上傳與閱讀來源，不用 PowerShell 直接執行 Linux 安裝器。

## 修改來源與產生發行包

請保留 `vendor/` 原檔與上游授權，將本專案整合修改放在 `overlay/`。自行修改介面後，應在對應的面板開發副本重新建置，並同步維護 `final-source.sha256` 等核對表；單純更改品牌則使用設定工具即可。

維護者可在乾淨、已審閱的 Git 工作目錄執行：

```bash
python3 tools/build-release.py
```

需要 Python 3.10 以上與 Git。此命令使用 Git 追蹤檔案產生包內 `SHA256SUMS`、`dist/DragonCities-Glass-UI-v1.1.0.zip` 及 ZIP 的校驗碼，不會操作面板或連線主機。

## 授權與署名

Copyright (c) 2026 小黑柴（dc_id: 小黑柴）。新增程式與文件採 MIT；Pterodactyl 上游 MIT 版權必須保留，銀白龍 Logo 另適用品牌素材說明。詳見 [LICENSE](../LICENSE)、[NOTICE.md](../NOTICE.md) 與 [ASSETS-LICENSE.md](../ASSETS-LICENSE.md)。
