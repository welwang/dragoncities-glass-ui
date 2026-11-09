# 更新紀錄 / Changelog

## 1.2.0

**繁體中文**

- **效能（畫面不變）**
  - 玻璃的折射貼圖改在背景執行緒（Web Worker）產生與壓縮。以前換頁、改視窗大小、切換彩虹時，主執行緒會被卡住 0.1–0.4 秒（彩虹模式在高解析度螢幕最久）；現在主執行緒不再被這項工作佔用，切換動畫不會停頓。瀏覽器不允許 Worker 時自動退回原本的做法，結果完全相同。
  - 泡泡薄膜色先在 2px 格點上計算再平滑內插，計算量少了十幾倍；與逐點計算的差異小於一個色階。
  - 導覽列展開／收起分頁列（進出伺服器頁面時）、改視窗大小時：以前玻璃的每一個中間尺寸都重新產生一次貼圖，動畫每一幀都卡住（彩虹模式每次展開或收起有四次 110–210ms 的停頓）。現在尺寸變化中先把現有貼圖拉伸到新尺寸，停止變化 140ms 後才產生正確尺寸的貼圖，停頓降為 0。
  - 全域動畫速度：每個動畫只調整一次速度，新動畫開始時只處理那個元素，不再掃描整個子樹；很多動畫同時開始時（例如切換深淺色）不再重複同步。
  - 游標在玻璃上移動時，同一幀內的多次移動合併成一次更新（高回報率滑鼠不再重複計算樣式）。
  - 控制台持續輸出時，終端機自己的捲動不再觸發玻璃的背景明暗判斷。
  - 所有效果對每個人都一樣：沒有依裝置效能降低畫質的模式；動畫以實際時間計算，較慢的裝置只會少畫幾幀，速度與路徑不變。新增的彩虹效果全部用 CSS／canvas 畫，不下載圖片，網路快慢看到的都一樣。
- **彩虹世界**（淺色模式 + 彩虹）
  - 泡泡天空桌布：粉彩極光，玻璃折射它，整個畫面帶著彩虹的光。
  - 玻璃的泡泡薄膜色更明顯（中間仍然清透）；導覽列保留稜鏡色散。
  - 卡片（內容框、設定框、列表列、控制台的數值與圖表卡片）變成珍珠色：半透明白，四角淡淡的虹彩。
  - 光譜色的光：深淺色開關與設定開關的邊緣光、玻璃邊緣的亮線都是彩虹色；點陣圖示的每顆像素依位置取光譜色，重組時飛行中的光點會跟著變色。
  - 開啟的設定開關軌道、頂端載入條（一條光譜）、選取文字也換上彩虹色。
  - 進入彩虹世界時（打開彩虹，或彩虹開著時切回淺色）播放約 2.7 秒的開場（跟著全域動畫速度）：
    - 從點擊位置噴出點陣光點與肥皂泡，泡泡往上飄後破掉
    - 一道大彩虹從左到右畫過天空，停一下再淡出；一道稜鏡光帶從左上斜掃到右下
    - 玻璃與卡片由近到遠依序輕輕鼓起再回彈（像果凍的波），邊上閃出四角星光
    - 所有點陣圖示的像素從四周飛進來重新組成（由近到遠依序）
    - 動畫每次都一樣（固定的亂數種子），播完即移除
  - 之後按按鈕、連結、開關、核取方塊時，按下的地方會冒出幾顆小肥皂泡，往上飄一小段後破掉（畫在按下位置附近的小畫布上，約 1 秒後移除）。
  - 沒有一直在播放的動畫：只有被觸發時才播，播完就停。一直在動的東西只要靠近玻璃，玻璃的折射每一幀都要重算，會讓整個面板變卡。
  - 系統「減少動態效果」時不播放慶祝動畫與泡泡；所有動畫跟著全域動畫速度。

**English**

- **Performance (no visual change)**
  - Glass refraction maps are now generated and encoded on a background thread (Web Worker). Previously, page changes, window resizes, and switching to rainbow blocked the main thread for 0.1–0.4 s (longest for rainbow on high-density screens); that work no longer runs on the main thread, so transitions do not stall. If the browser does not allow a worker, the previous method is used with identical results.
  - The bubble film colour is computed on a 2 px grid and smoothly interpolated, cutting the work by more than ten times; it differs from per-pixel computation by less than one colour step.
  - When the navigation expands or collapses its tab row (entering or leaving a server page) and when the window is resized, the glass used to regenerate its maps for every intermediate size, stalling every frame (in rainbow mode, four 110–210 ms stalls per expand or collapse). The existing maps are now stretched while the size changes, and exact maps are generated 140 ms after the size settles; the stalls are now 0.
  - Global animation speed: each animation's speed is set only once, and a starting animation only processes its own element instead of scanning the whole subtree, so many animations starting together (for example on a theme switch) no longer resynchronize repeatedly.
  - Several pointer moves within one frame are merged into a single update (high-polling-rate mice no longer trigger repeated style work).
  - While the console streams output, the terminal's own scrolling no longer triggers the glass background-brightness check.
  - Everyone gets the same effects: there is no reduced-quality mode for slower devices. Animations are timed in real time, so slower devices only draw fewer frames with the same speed and paths. All new rainbow effects are drawn with CSS or canvas and download no images, so connection speed does not change what people see.
- **Rainbow world** (light mode + rainbow)
  - Bubble-sky wallpaper: a pastel aurora that the glass refracts, tinting the whole screen with rainbow light.
  - Stronger soap-bubble film on the glass (the centre stays clear); the navigation keeps its prismatic dispersion.
  - Cards (content boxes, settings boxes, list rows, console stat and chart cards) become pearl: translucent white with faint iridescence in each corner.
  - Spectrum light: the edge light on the light/dark toggle and settings switches and the glass rim light are rainbow-coloured; each dot of a pixel icon takes its spectrum colour from its position, and flying dots change colour as they move.
  - Enabled switch tracks, the top loading bar (a spectrum), and text selection are rainbow-coloured too.
  - Entering the rainbow world (turning rainbow on, or returning to light mode with rainbow on) plays an opening of about 2.7 seconds (scaled by the global animation speed):
    - dot-matrix sparks and soap bubbles burst from the click point; the bubbles float up and pop
    - a large rainbow draws across the sky from left to right, holds, and fades; a prism light band sweeps diagonally from top left to bottom right
    - glass and cards gently swell and settle in a jelly-like wave from nearest to farthest, with four-point star glints on their edges
    - every pixel icon flies in from around it and reassembles (nearest first)
    - the animation is identical every time (fixed random seed) and is removed when it finishes
  - Afterwards, pressing a button, link, switch, or checkbox releases a few small soap bubbles from that spot; they float up briefly and pop (drawn on a small canvas around the press point and removed after about a second).
  - Nothing animates continuously: effects play only when triggered and then stop. Anything that keeps moving near glass forces the glass refraction to be recomputed every frame, which would slow the whole panel.
  - With the system's reduced-motion setting, the burst and bubbles do not play; all animations follow the global animation speed.

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
