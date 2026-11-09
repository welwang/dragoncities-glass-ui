# 更新紀錄 / Changelog

## 1.1.0

**繁體中文**

- 導覽列新增 **點陣深淺色開關**：凹陷軌道上的玻璃方塊圓鈕，圖示是點陣的太陽／月亮，切換時像素散開成光點、沿弧線飛到新位置重組成另一個圖示。圓鈕邊緣有一道跟著游標轉動的光（淺色暖橘、深色藍紫），游標離開時回到固定角度。
- 開關旁的 ▾ 打開「外觀」選單：跟隨系統、彩虹（淺色模式）。
- 同樣的特效套用到整個面板：
  - 所有設定開關（例如排程、建立備份、啟動參數，以及管理員首頁的「顯示其他伺服器」）改成同款凹陷軌道 + 玻璃圓鈕，圓鈕上是點陣 ✓／○，切換時像素重組；開啟時圓鈕邊緣有跟著游標的光。
  - 控制台的霧化（防劇透）按鈕改成點陣眼睛，切換時像素重組。
  - 所有玻璃（卡片、選單、導覽列）在游標經過時，靠近游標的邊緣會亮起一圈細光。
  - 動畫時間跟著全域動畫速度；系統「減少動態效果」時直接換圖、不追游標。
- 新增淺色模式專用的 **彩虹泡泡玻璃**：只改玻璃材質，不加任何彩虹元素。
  - 玻璃像肥皂泡：薄膜干涉色畫進玻璃本身，中間幾乎透明、越靠邊緣顏色越明顯，膜厚緩慢流動。
  - 導覽列玻璃有輕微稜鏡色散：背後的內容滑到玻璃厚邊時分出彩色邊。
  - 選取膠囊與分頁透鏡也是通透的泡泡玻璃；導覽列浮在深色內容上時照常轉成深色玻璃。
  - 在深色模式打開彩虹會一起切到淺色；切回深色時彩虹設定保留但不生效。
- 控制台的 CPU／記憶體／網路圖表重新排版：標題下顯示目前數值（大字），網路顯示入站／出站與對應顏色；圖表內縮在卡片圓角內，刻度移到右側並改為虛線格線，折線平滑並有淡出填色；記憶體刻度改用 GiB，網路刻度不再出現重複的 0 Bytes。
- 伺服器列表右側的狀態燈改成卡片內側、垂直置中的細膠囊，不再碰到或凸出圓角。
- 修正：分頁透鏡滑動時，透鏡右下角外面會出現殘字（位移圖範圍外被當成位移；所有主題都有）。
- 修正：淺色模式下導覽列浮在深色內容（例如控制台）上轉成深色玻璃時，品牌名稱、伺服器說明、動畫速度數值仍是深色字，幾乎看不見。
- 修正：畫面幀率低時（省電、軟體繪圖）分頁透鏡變成慢動作、拖很久才抵達。
- 安裝器可從 `known-states/` 列出的任何已發行版本直接升級，並印出辨識到的版本；仍然沒有強制套用選項。

**English**

- New **pixel light/dark toggle** in the navigation: a glass knob in a recessed track with a dot-matrix sun or moon. When it flips, the pixels scatter into sparks, fly along curved paths, and reassemble into the other icon. A thin light on the knob's edge turns toward the pointer (warm amber in light mode, violet in dark mode) and returns to a resting angle when the pointer leaves.
- The ▾ next to the toggle opens the Appearance menu: Follow system and Rainbow (light mode).
- The same effect is applied across the panel:
  - Every settings switch (for example in schedules, backup creation, startup variables, and the administrator dashboard toggle for showing other servers) uses the same recessed track and glass knob with a dot-matrix ✓ or ○ that reassembles when toggled; switches that are on show the pointer-following edge light.
  - The console frost (spoiler) button is a dot-matrix eye that reassembles when toggled.
  - All glass (cards, menus, navigation) lights a thin rim on the edge nearest the pointer on hover.
  - Timing follows the global animation speed; with the system's reduced-motion setting, icons switch instantly and the light does not track the pointer.
- New light-mode **rainbow bubble glass**: only the glass material changes; no rainbow elements are added.
  - Soap-bubble glass: thin-film interference colour is rendered into the glass itself, nearly clear in the middle and strongest toward the edges, with slowly varying film thickness.
  - Subtle prismatic dispersion on the navigation glass splits content into coloured fringes at the thick edge.
  - The selection pill and tab lens are clear bubble glass too; the navigation still turns into dark glass over dark content.
  - Enabling rainbow in dark mode also switches to light; switching back to dark keeps the setting but pauses it.
- Console CPU, memory, and network charts are redesigned: the current value appears under each title, the network card shows inbound and outbound values with matching colours, charts are inset inside the rounded card with right-side labels and dashed gridlines, lines are smoothed with a fading fill, memory ticks use GiB, and network ticks no longer repeat 0 Bytes.
- The server list status light is now a slim, vertically centred capsule inside the card that no longer touches or overflows the rounded corners.
- Fix: stray glyph fragments appeared just outside the bottom-right of the tab lens while it moved (out-of-range displacement-map pixels were treated as a shift; affected every theme).
- Fix: when the navigation turns into dark glass over dark content in light mode (for example the console), the brand name, server caption, and animation-speed value stayed dark and were nearly invisible.
- Fix: at low frame rates (power saving, software rendering) the tab lens ran in slow motion and took far too long to arrive.
- The installer upgrades directly from any published release listed in `known-states/` and prints the recognized release; there is still no force option.
