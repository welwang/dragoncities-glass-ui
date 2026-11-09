# DragonCities Glass UI

**繁體中文** | [English](README.en.md)

**Pterodactyl Panel v1.15.2 的玻璃介面主題與品牌設定工具。**

A glass-style interface and configurable branding for Pterodactyl Panel v1.15.2. Independent community project. Source code: MIT; bundled logo: separate asset terms.

作者：**小黑柴（dc_id: 小黑柴）**。

## 功能

- 深色／淺色玻璃介面。導覽列的點陣深淺色開關：切換時像素散開再重組成太陽／月亮，圓鈕邊緣的光跟著游標轉動；旁邊的 ▾ 可選跟隨系統與彩虹，並記住各瀏覽器的選擇。
- 同款點陣特效也用在所有設定開關（✓／○）與控制台的霧化按鈕（眼睛）；玻璃在游標經過時邊緣亮起細光。
- **彩虹世界（淺色模式）**：玻璃像肥皂泡（薄膜干涉色、導覽列稜鏡色散），泡泡天空桌布、珍珠色卡片、光譜色的邊緣光與點陣圖示；進入時從點擊位置噴出點陣光點與泡泡，之後按按鈕、開關時會冒出小泡泡。全部用 CSS／canvas 畫，不下載圖片。
- **效能**：玻璃的折射貼圖在背景執行緒產生，換頁、改視窗大小、切換主題時不會卡住頁面；所有人看到的畫質都一樣，沒有降級模式。
- 統一的雙排導覽列：上排品牌與操作，下排伺服器分頁；一排／兩排之間平滑切換。
- 分頁透鏡動畫、玻璃伺服器卡片、選單與對話框。
- 全局動畫速度拉桿：0.25×～1.5×，預設 0.5×。
- IP 與連線位址的防劇透霧化，點擊後顯示，20 秒後自動隱藏。
- 控制台霧面開關；更換頁面時保留可見內容。
- 可自訂面板名稱、PNG Logo、網站圖示及通知郵件模板的品牌顯示。
- 安裝前來源核對、自動介面備份、明確的還原指令。

## 適用範圍

需要已正常運作的 **Linux Pterodactyl Panel v1.15.2**、Node.js 22 以上、Yarn Classic 1.x、PHP CLI，以及至少 2 GiB 的 RAM＋swap。

此包提供介面與安裝工具，不包含面板本體、Wings、資料庫或 Minecraft 伺服器。它不執行資料庫遷移、不更新 Composer 套件、不升級面板，也不修改 `.env`、Wings 或 nginx 設定，且不重啟服務。

使用者端包含完整主題。`/admin` 保留原本 AdminLTE 版型，僅統一品牌與動畫速度控制。

## 安裝入口

先閱讀 **[完整安裝、設定、疑難排解與還原說明](docs/INSTALL.md)**。

```bash
git clone https://github.com/welwang/dragoncities-glass-ui.git
cd dragoncities-glass-ui
git checkout v1.2.0
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh --check
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh
```

建議將此儲存庫放在家目錄等面板以外的位置。公開版本與安裝包可從 [Releases](https://github.com/welwang/dragoncities-glass-ui/releases) 取得。

若已裝其他主題，請先閱讀來源相容性說明；不要直接將檔案拖進面板覆蓋。安裝器只接受可核對的來源版本，不提供強制套用選項。

## 交給 AI 安裝

請使用 **[可直接複製的 AI 安裝指令、注意事項與最低能力需求](docs/AI-INSTALL.md)**；另有 [English](docs/AI-INSTALL.en.md)。填入你的 SSH 連線資料、面板路徑及品牌設定即可，密碼與金鑰內容不要貼進聊天。

AI 必須具備終端機／SSH 工具，才能代為安裝；純聊天只能提供操作指引。本主題不需要在面板主機上運行 AI 模型。主機仍需符合 Node.js、Yarn、PHP 及建置資源需求，請勿把「AI 模型規格」與「面板主機規格」混為一談。

## 自訂名稱與 Logo

安裝時指定：

```bash
PANEL_DIR=/var/www/pterodactyl \
BRAND_NAME='我的伺服器面板' \
BRAND_LOGO='/root/my-logo.png' \
bash install-dragoncities-ui.sh
```

安裝完成後再更換：

```bash
PANEL_DIR=/var/www/pterodactyl \
BRAND_NAME='新的面板名稱' \
BRAND_LOGO='/root/new-logo.png' \
bash configure-brand.sh
```

名稱支援 1～48 個字元；Logo 支援 PNG，建議透明背景、正方形。省略某個設定會保留目前值。安裝後更改品牌不需要重新編譯，重新整理瀏覽器即可。品牌圖像的使用範圍請見下方素材說明。

## 資源消耗

日常執行時，主題新增的主機端工作主要是送出靜態檔案與讀取小型品牌 JSON；沒有新增常駐 Node.js 服務。主機較高的 CPU／記憶體需求集中在安裝建置階段，玻璃折射與動畫主要消耗使用者瀏覽器的 CPU、繪圖資源與記憶體。

請閱讀 **[資源評估與原因分析](docs/RESOURCES.md)**，其中區分實測值、檔案大小與推算，並說明高解析度、卡片數量、捲動及慢速動畫的影響。資源門檻不是固定的執行時用量保證。

## 還原

安裝時會印出 `FRONTEND_BACKUP=` 與完整還原指令。使用你自己的實際備份路徑：

```bash
PANEL_DIR=/var/www/pterodactyl bash install-dragoncities-ui.sh \
  --revert /root/ptero-ui-backup-YYYYMMDD-HHMMSS-dragoncities.tar.gz
```

請保留對應版本的安裝資料夾與備份。還原範圍及失敗處理詳見安裝文件。

## 專案結構

```text
install-dragoncities-ui.sh  安裝、來源檢查與還原入口
configure-brand.sh         安裝後的品牌設定入口
tools/configure-brand.cjs  品牌設定與 PNG 檢查
tools/build-release.py     產生發行壓縮檔與校驗碼
overlay/                  整合介面來源與預設品牌圖像
vendor/                   原始基礎主題 patch、腳本與說明
docs/INSTALL.md            完整安裝文件
FILES.json                面板目標檔案清單
*.sha256 / *-absent.txt    安裝來源與完整性核對表
known-states/             可直接升級的已發行版本指紋
CHANGELOG.md              更新紀錄
```

原始基礎 patch 與腳本保留原內容。請使用整合入口安裝與還原，不要另行執行 `vendor/` 內的腳本。

## 授權、版權與商標

- 本專案新增程式與文件：**MIT License，Copyright (c) 2026 小黑柴（dc_id: 小黑柴）**。
- Pterodactyl 上游部分：保留 **Dane Everitt 與 contributors** 的 MIT 版權與授權文字。
- 銀白龍 Logo：[獨立品牌素材使用說明](ASSETS-LICENSE.md)，不在程式 MIT 授權範圍內。
- 完整來源、依賴與商標說明：[NOTICE.md](NOTICE.md)。

本專案不是 Pterodactyl 或 Apple 的官方產品；名稱與商標歸各自權利人。MIT 授權不會把原作者的著作權轉給使用者，也不代表對第三方名稱、標誌或素材取得商標授權。程式按授權條款以現狀提供，未承諾適用於所有面板版本或客製環境。

請勿在公開 issue 中張貼密碼、API Token、`.env`、完整備份或包含私人資料的紀錄。提出問題時可附上面板版本、安裝步驟及已遮蔽敏感資料的錯誤內容。
