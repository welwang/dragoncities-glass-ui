/*!
 * Liquid Glass v2 — 曲面折射 + 曲面鏡面高光 + 觸控光暈
 * 用法：元素加 class="lg"（材質）與 data-glass（啟用折射）。
 * Chromium（Chrome / Edge）完整效果；Safari / Firefox 自動退回模糊材質。
 *
 * data 屬性（皆可省略）：
 *   data-glass-bezel     玻璃厚邊寬度 px（預設：短邊的 32%，最多 28）
 *   data-glass-strength  折射強度 0–1（預設 0.9，會自動限制避免影像摺疊）
 *   data-glass-blur      玻璃內的模糊 px（預設 1.2）
 *   data-glass-spec      鏡面高光強度 0–1（預設 0.55）
 */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var ua = navigator.userAgent;
  var isChromium = /Chrome\/|Chromium\/|Edg\//.test(ua) && !/Firefox\//.test(ua);
  var SUPPORTED = isChromium && CSS.supports('backdrop-filter', 'url(#x)');
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* 光源：左上方（與 iOS 相同的固定光） */
  var LX = -0.55, LY = -0.83;

  var svg = null, seq = 0;
  var filters = new Map();      // key -> { id, node, refs }
  var tracked = new Map();      // element -> key
  var selectors = ['[data-glass]'];

  function ensureSvg() {
    if (svg) return svg;
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;';
    document.body.appendChild(svg);
    return svg;
  }

  /* 只在狀態真的改變時才寫入 class：classList.add/remove/toggle 即使沒變也會觸發 MutationObserver，
     引擎自己又在監聽，會形成每一幀都重畫的迴圈 */
  function cls(el, name, on) {
    if (el.classList.contains(name) !== !!on) el.classList.toggle(name, !!on);
  }
  function prop(el, name, value) {
    if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
  }

  function attrNum(el, name, fallback) {
    var v = parseFloat(el.getAttribute('data-glass-' + name));
    return isFinite(v) ? v : fallback;
  }

  /* 折射曲線：x = 0（最外緣）到 1（厚邊內側），值 = 位移比例 */
  function profile(x) { var u = 1 - x; return u * u * Math.sqrt(u); }      // (1-x)^2.5
  var MAX_SLOPE = 2.5;                                                     // profile 在 x=0 的斜率

  /* 依元素尺寸產生兩張圖的像素：位移圖（R,G = 方向）與鏡面圖（白光，alpha = 亮度）。
     film = true（泡泡主題）：整片玻璃再疊一層薄膜干涉色——中間極淡、越靠近邊緣越明顯（掠射角反射較強），
     白色鏡面高光仍在最上層。
     這是不碰 DOM 的純函式，所有輔助計算都寫在裡面：同一份程式可以拿到背景執行緒（Worker）執行，
     打包壓縮後也不會缺少外部的函式。主執行緒與 Worker 算出的像素完全相同。 */
  function computeMaps(p) {
    var w = p.w, h = p.h, W = p.W, H = p.H, k = p.k, bezel = p.bezel, spec = p.spec, lens = p.lens, film = p.film > 0, gain = p.film || 0;
    var LX = -0.55, LY = -0.83;                                            // 光源：左上方（與 iOS 相同的固定光）
    var D = new Uint8ClampedArray(W * H * 4), S = new Uint8ClampedArray(W * H * 4);
    var hw = w / 2, hh = h / 2, r = Math.min(p.radius, hw, hh);

    /* 泡泡主題：肥皂泡的薄膜干涉色。
       - 膜厚 d（奈米）在表面上緩慢流動（用 CSS 像素當單位，寬的玻璃列不會被拉長），越往下越厚（像泡泡的膜往下流）
       - 反射光強度 I = sin²(2π·n·d / λ)，紅綠藍各用自己的波長 → 金、洋紅、藍、綠交替的泡泡色
       - 只取三色之間的差（色相），加在淡淡的白上，所以是透明的虹彩，不是塗上去的顏色
       顏色變化很慢（一個週期約 150–400 CSS px），所以先在每 2 CSS px 的格點上算好，再用雙線性內插取值：
       和逐點計算的差異小於一個色階，但三角函數的計算量少了十幾倍 */
    var G = 2, gw = 0, FT = null;
    if (film) {
      gw = Math.ceil(w / G) + 2;
      var gh = Math.ceil(h / G) + 2;
      FT = new Float32Array(gw * gh * 4);
      for (var gy = 0; gy < gh; gy++) {
        for (var gx = 0; gx < gw; gx++) {
          var fx = gx * G - hw, fy = gy * G - hh;
          var d = 430 + 120 * Math.sin(fx / 260 + 1.1 * Math.sin(fy / 90 + fx / 520))
            + 80 * Math.sin(fy / 70 - fx / 430 + 0.7) + 70 * (fy / hh);
          var o = 2 * Math.PI * 1.33 * d;
          var sr = Math.sin(o / 650), sg = Math.sin(o / 540), sb = Math.sin(o / 450);
          var ir = sr * sr, ig = sg * sg, ib = sb * sb, im = (ir + ig + ib) / 3;
          var j = (gy * gw + gx) * 4;
          FT[j] = Math.max(0, Math.min(1, 0.76 + 0.8 * (ir - im)));
          FT[j + 1] = Math.max(0, Math.min(1, 0.76 + 0.8 * (ig - im)));
          FT[j + 2] = Math.max(0, Math.min(1, 0.76 + 0.8 * (ib - im)));
          FT[j + 3] = Math.max(Math.abs(ir - im), Math.abs(ig - im), Math.abs(ib - im));
        }
      }
    }

    for (var y = 0; y < H; y++) {
      var py = (y + 0.5) / H * h - hh, sy = py < 0 ? -1 : 1, qy = Math.abs(py) - (hh - r);
      var tyf = (py + hh) / G, ty0 = Math.floor(tyf), tv = tyf - ty0;
      for (var x = 0; x < W; x++) {
        var px = (x + 0.5) / W * w - hw, sx = px < 0 ? -1 : 1, qx = Math.abs(px) - (hw - r);
        var dist, nx, ny;
        if (qx > 0 && qy > 0) {
          var L = Math.sqrt(qx * qx + qy * qy) || 1e-6;
          dist = r - L; nx = qx / L * sx; ny = qy / L * sy;
        } else if (qx > qy) { dist = r - qx; nx = sx; ny = 0; }
        else { dist = r - qy; nx = 0; ny = sy; }

        var i = (y * W + x) * 4, m = 0, a = 0;
        if (dist >= 0 && dist < bezel) {
          var t = dist / bezel;
          var u = 1 - t;
          m = u * u * Math.sqrt(u);                                        // 折射曲線 (1-t)^2.5
          /* 鏡面：外緣一條細亮線 + 往內漸淡的寬光，強度取決於法線是否朝向光源 */
          var facing = nx * LX + ny * LY;                                  // 1 = 正對光源
          var lit = facing > 0 ? Math.pow(facing, 1.5) : 0.38 * Math.pow(-facing, 2);   // 背光側有較弱的反射
          var rim = Math.exp(-dist / 1.4);                                 // 約 1.5 CSS px 的亮線
          var sheen = Math.pow(1 - t, 3) * 0.45;                           // 曲面上的寬光
          var cover = Math.min(1, dist * k + 0.5);                         // 最外圈像素的覆蓋率：抗鋸齒
          a = Math.min(1, (rim * 0.85 + sheen) * lit * spec) * cover;
        }
        if (lens && dist >= 0) {
          /* 透鏡：整片往中心取樣（放大 lens.mag 倍）＋邊緣再往內折 */
          var half = lens.S / 2;
          var ox = (-px * (1 - 1 / lens.mag) - nx * m * lens.eo) / half;
          var oy = (-py * (1 - 1 / lens.mag) - ny * m * lens.eo) / half;
          D[i] = 128 + Math.max(-1, Math.min(1, ox)) * 127;
          D[i + 1] = 128 + Math.max(-1, Math.min(1, oy)) * 127;
        } else {
          D[i] = 128 - nx * m * 127; D[i + 1] = 128 - ny * m * 127;
        }
        D[i + 2] = 128; D[i + 3] = 255;
        if (film && dist >= 0) {
          /* 薄膜色：格點雙線性內插 */
          var txf = (px + hw) / G, tx0 = Math.floor(txf), tu = txf - tx0;
          var j00 = (ty0 * gw + tx0) * 4, j10 = j00 + 4, j01 = j00 + gw * 4, j11 = j01 + 4;
          var w00 = (1 - tu) * (1 - tv), w10 = tu * (1 - tv), w01 = (1 - tu) * tv, w11 = tu * tv;
          var c0 = FT[j00] * w00 + FT[j10] * w10 + FT[j01] * w01 + FT[j11] * w11;
          var c1 = FT[j00 + 1] * w00 + FT[j10 + 1] * w10 + FT[j01 + 1] * w01 + FT[j11 + 1] * w11;
          var c2 = FT[j00 + 2] * w00 + FT[j10 + 2] * w10 + FT[j01 + 2] * w01 + FT[j11 + 2] * w11;
          var c3 = FT[j00 + 3] * w00 + FT[j10 + 3] * w10 + FT[j01 + 3] * w01 + FT[j11 + 3] * w11;
          /* 薄膜：中間約 2%（幾乎透明），靠近邊緣 28px 內往外增強到約 30%（泡泡邊緣顏色最濃）；顏色越飽和的地方越看得到 */
          var e1 = Math.max(0, 1 - dist / Math.min(28, hh)), edge = e1 * e1;
          var fa = (0.02 + 0.28 * edge) * gain * (0.5 + 0.8 * c3) * Math.min(1, dist * k + 0.5);
          fa = Math.min(0.32 * gain, fa);
          /* 白色高光（a）疊在薄膜（fa）上面 */
          var oa = a + fa * (1 - a);
          S[i] = Math.round(255 * (a + c0 * fa * (1 - a)) / (oa || 1));
          S[i + 1] = Math.round(255 * (a + c1 * fa * (1 - a)) / (oa || 1));
          S[i + 2] = Math.round(255 * (a + c2 * fa * (1 - a)) / (oa || 1));
          S[i + 3] = Math.round(oa * 255);
        } else {
          S[i] = S[i + 1] = S[i + 2] = 255;
          S[i + 3] = Math.round(a * 255);
        }
      }
    }
    return { D: D, S: S };
  }

  /* ---------- 在背景執行緒產生貼圖 ----------
   * 大片玻璃（例如整條導覽列）的貼圖在高解析度螢幕上要算幾十萬個像素，泡泡主題更多。
   * 放在主執行緒會讓頁面卡住一下（換頁、改視窗大小、切換彩虹時最明顯），所以交給 Worker 計算與壓縮成 PNG；
   * 瀏覽器不允許建立 Worker（例如網站的安全政策）時，退回主執行緒計算，結果完全相同。 */
  var worker = null, workerBroken = false, jobs = new Map(), jobSeq = 0;
  function mapWorker() {
    if (worker || workerBroken) return worker;
    try {
      if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') throw new Error('unsupported');
      var src = 'var computeMaps = ' + computeMaps.toString() + ';\n' +
        'function png(buf, W, H) { var c = new OffscreenCanvas(W, H); c.getContext("2d").putImageData(new ImageData(buf, W, H), 0, 0); return c.convertToBlob({ type: "image/png" }); }\n' +
        'onmessage = function (e) { var p = e.data; try { var out = computeMaps(p);' +
        ' Promise.all([png(out.D, p.W, p.H), png(out.S, p.W, p.H)]).then(function (b) { postMessage({ id: p.id, disp: b[0], spec: b[1] }); },' +
        ' function () { postMessage({ id: p.id, error: 1 }); }); } catch (err) { postMessage({ id: p.id, error: 1 }); } };';
      var url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      worker = new Worker(url);
      URL.revokeObjectURL(url);
      worker.onmessage = function (e) {
        var job = jobs.get(e.data.id); if (!job) return;
        jobs.delete(e.data.id);
        if (e.data.error) job.fallback();
        else job.done({ disp: URL.createObjectURL(e.data.disp), spec: URL.createObjectURL(e.data.spec), blob: true });
      };
      worker.onerror = function () {
        workerBroken = true; worker = null;
        var waiting = Array.from(jobs.values()); jobs.clear();
        waiting.forEach(function (job) { job.fallback(); });
      };
    } catch (err) { workerBroken = true; worker = null; }
    return worker;
  }
  function mapsOnMainThread(p) {
    var out = computeMaps(p);
    function url(buf) {
      var c = document.createElement('canvas'); c.width = p.W; c.height = p.H;
      c.getContext('2d').putImageData(new ImageData(buf, p.W, p.H), 0, 0);
      return c.toDataURL();
    }
    return { disp: url(out.D), spec: url(out.S), blob: false };
  }
  /* 貼圖解碼完成才算好：套上還沒載入的貼圖，玻璃會閃一下沒有折射的畫面 */
  function decoded(maps) {
    function one(src) { var im = new Image(); im.src = src; return im.decode ? im.decode().catch(function () {}) : new Promise(function (res) { im.onload = im.onerror = res; }); }
    return Promise.all([one(maps.disp), one(maps.spec)]).then(function () { return maps; });
  }
  function buildMaps(w, h, radius, bezel, spec, lens, film) {
    /* 依螢幕倍率產生，長邊最多 2400px：低解析度貼圖放大是邊緣鋸齒的主因 */
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var k = Math.min(dpr, 2400 / Math.max(w, h));
    var p = { w: w, h: h, W: Math.max(2, Math.round(w * k)), H: Math.max(2, Math.round(h * k)), k: k,
      radius: radius, bezel: bezel, spec: spec, lens: lens || null, film: +film || 0 };
    return new Promise(function (resolve) {
      var wk = mapWorker();
      var fallback = function () { resolve(decoded(mapsOnMainThread(p))); };
      if (!wk) { fallback(); return; }
      p.id = ++jobSeq;
      jobs.set(p.id, { done: function (maps) { resolve(decoded(maps)); }, fallback: fallback });
      wk.postMessage(p);
    });
  }
  function revokeMaps(maps) {
    if (maps && maps.blob) { URL.revokeObjectURL(maps.disp); URL.revokeObjectURL(maps.spec); }
  }

  function mk(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* 色散：紅、綠、藍三個通道各自用不同的折射量位移，再合回一張圖。
     折射越強的地方（玻璃厚邊、透鏡邊緣）三色分得越開，就出現像稜鏡一樣的彩虹邊；中間位移為 0，影像不受影響。
     amount = 綠、藍比紅色少折的比例（0.3 = 綠 85%、藍 70%）。
     任何一個通道都不會比原本折得多：原本的強度上限（避免字被折疊）仍然成立 */
  function disperse(f, input, map, scale, amount, out) {
    var ch = [['R', 1, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'],
              ['G', 1 - amount / 2, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'],
              ['B', 1 - amount, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']];
    ch.forEach(function (c) {
      mk('feDisplacementMap', { in: input, in2: map, scale: +(scale * c[1]).toFixed(2), xChannelSelector: 'R', yChannelSelector: 'G', result: out + c[0] + 'd' }, f);
      mk('feColorMatrix', { in: out + c[0] + 'd', type: 'matrix', values: c[2], result: out + c[0] }, f);
    });
    mk('feComposite', { in: out + 'R', in2: out + 'G', operator: 'arithmetic', k1: 0, k2: 1, k3: 1, k4: 0, result: out + 'RG' }, f);
    mk('feComposite', { in: out + 'RG', in2: out + 'B', operator: 'arithmetic', k1: 0, k2: 1, k3: 1, k4: 0, result: out }, f);
  }

  /* 濾鏡在貼圖準備好之後才建立（貼圖在背景執行緒產生）；rec.ready 完成時 rec.node 才存在 */
  function makeFilter(key, w, h, o) {
    var id = 'lg' + (++seq);
    var rec = { id: id, node: null, refs: 0, maps: null, ready: null };
    filters.set(key, rec);
    rec.ready = buildMaps(w, h, o.radius, o.bezel, o.spec, o.lens, o.iris).then(function (maps) {
      if (filters.get(key) !== rec) { revokeMaps(maps); return false; }  // 等待中已經沒有人要用
      rec.maps = maps;
      var f = mk('filter', {
        id: id, x: '0', y: '0', width: w, height: h,
        filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
        'color-interpolation-filters': 'sRGB'
      }, ensureSvg());
      mk('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: o.blur, edgeMode: 'duplicate', result: 'b' }, f);
      mk('feImage', { href: maps.disp, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'd' }, f);
      if (o.disperse > 0) disperse(f, 'b', 'd', o.scale, o.disperse, 'r');
      else mk('feDisplacementMap', { in: 'b', in2: 'd', scale: o.scale, xChannelSelector: 'R', yChannelSelector: 'G', result: 'r' }, f);
      mk('feImage', { href: maps.spec, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 's' }, f);
      mk('feComposite', { in: 's', in2: 'r', operator: 'over' }, f);
      rec.node = f;
      return true;
    });
    return rec;
  }

  /* ---------- 內容折射：玻璃列「自己的」文字和圖示，靠近左右圓弧時被玻璃邊緣折彎 ----------
   * 只做水平方向、只作用在兩端的圓弧；中間區域位移為 0，文字保持清晰。
   * 位移圖依整條玻璃列產生，每個子元素用自己的偏移對齊同一張圖。 */
  var contentMaps = new Map();       // key -> { url, ready }
  var contentFilters = new Map();    // key -> { id, node, refs }
  /* 位移圖放進濾鏡：先鋪一層中性灰（128 = 不位移）再疊上位移圖。
     濾鏡範圍比位移圖寬（左右留空間給被推出去的字）；沒有這層底的話，超出位移圖的地方會被當成 0，
     也就是「往左上各位移半個強度」，透鏡裡的字會被複製到透鏡右下角外面（殘字 bug） */
  function mapImage(f, href, x, y, w, h, result) {
    mk('feFlood', { 'flood-color': 'rgb(128,128,128)', 'flood-opacity': 1, result: result + 'n' }, f);
    mk('feImage', { href: href, x: x, y: y, width: w, height: h, preserveAspectRatio: 'none', result: result + 'i' }, f);
    mk('feComposite', { in: result + 'i', in2: result + 'n', operator: 'over', result: result }, f);
  }

  function contentMap(w, h, radius, bezel, exp) {
    var key = [w, h, radius, bezel, exp].join('|');
    if (contentMaps.has(key)) return contentMaps.get(key);
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var k = Math.min(dpr, 2400 / Math.max(w, h));
    var W = Math.max(2, Math.round(w * k)), H = Math.max(2, Math.round(h * k));
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d'), img = ctx.createImageData(W, H), D = img.data;
    var hw = w / 2, hh = h / 2, rr = Math.min(radius, hw, hh);
    for (var y = 0; y < H; y++) {
      var py = (y + 0.5) / H * h - hh, dy = Math.max(0, Math.abs(py) - (hh - rr));
      var xEdge = hw - rr + Math.sqrt(Math.max(0, rr * rr - dy * dy));    // 這一列玻璃左右邊界（跟著圓弧走）
      for (var x = 0; x < W; x++) {
        var px = (x + 0.5) / W * w - hw, dist = xEdge - Math.abs(px), m = 0;
        if (dist >= 0 && dist < bezel) m = Math.pow(1 - dist / bezel, exp);
        var i = (y * W + x) * 4;
        D[i] = 128 - (px < 0 ? -1 : 1) * m * 127;                            // 往內取樣：邊緣的字被拉伸、彎曲
        D[i + 1] = 128; D[i + 2] = 128; D[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    var rec = { url: c.toDataURL() };
    rec.ready = new Promise(function (res) { var im = new Image(); im.onload = im.onerror = function () { res(); }; im.src = rec.url; });
    contentMaps.set(key, rec);
    return rec;
  }
  /* 量測階段：子元素的位置與大小先讀完（只讀），套用階段才寫入。
     原本是「讀座標 → 寫濾鏡 → 讀下一個座標」，中間的寫入會讓下一次讀取再強制一次版面 */
  function measureContent(bar) {
    var strength = parseFloat(getComputedStyle(bar).getPropertyValue('--lg-content')) || 0;
    /* 一般解析度螢幕（倍率 < 1.5）不做：濾鏡會讓整條列的字失去次像素反鋸齒（ClearType），變軟 */
    var need = !!strength && SUPPORTED && !reduceMotion.matches && (global.devicePixelRatio || 1) >= 1.5;
    var kids = [];
    Array.prototype.forEach.call(bar.children, function (c) {
      if (c.classList.contains('sys-lens')) return;
      kids.push(need
        ? { el: c, ox: c.offsetLeft, oy: c.offsetTop, cw: c.offsetWidth, ch: c.offsetHeight }
        : { el: c, ox: 0, oy: 0, cw: 0, ch: 0 });
    });
    return { strength: strength, need: need, kids: kids };
  }
  function updateContent(w, h, radius, measured) {
    var strength = measured.strength;
    measured.kids.forEach(function (k) {
      var kid = k.el, prev = kid.__lgContent;
      if (!measured.need) {
        if (prev) { prop(kid, 'filter', ''); releaseContent(prev); kid.__lgContent = null; }
        return;
      }
      var bezel = Math.round(Math.min(Math.min(w, h) * 0.7, 40)), exp = 1.6;
      /* 不摺疊的上限：位移的斜率 < 1；strength 0–1 再乘上去 */
      var S = +(strength * 2 * bezel / exp).toFixed(2);
      var ox = k.ox, oy = k.oy, cw = k.cw, ch = k.ch;
      if (cw < 4 || ch < 4) return;
      var key = [w, h, radius, bezel, exp, S, ox, oy, cw, ch].join('|');
      if (prev === key) return;
      var map = contentMap(w, h, radius, bezel, exp);
      var rec = contentFilters.get(key);
      if (!rec) {
        var id = 'lgc' + (++seq);
        /* 濾鏡範圍往左右各多留一段：被推向邊緣的字可以畫到元素外面，不會被切掉 */
        var pad = Math.ceil(S / 2) + 4;
        var f = mk('filter', { id: id, x: -pad, y: 0, width: cw + pad * 2, height: ch, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, ensureSvg());
        mapImage(f, map.url, -ox, -oy, w, h, 'm');
        mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'm', scale: S, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
        rec = { id: id, node: f, refs: 0 };
        contentFilters.set(key, rec);
      }
      rec.refs++;
      if (prev) releaseContent(prev);
      kid.__lgContent = key;
      /* 位移圖解碼完成才套上，否則載入中的空白圖會讓文字整個偏移一下 */
      map.ready.then(function () { if (kid.__lgContent === key) prop(kid, 'filter', 'url(#' + rec.id + ')'); });
    });
  }
  function releaseContent(key) {
    var rec = contentFilters.get(key);
    if (rec && --rec.refs <= 0) { rec.node.remove(); contentFilters.delete(key); }
  }

  /* ---------- 換頁時把剛空下來的濾鏡留著 ----------
   * 面板各頁的內容卡片尺寸大同小異，換頁時經常又出現同一種尺寸。
   * 以前只要沒有元素引用就立刻移除濾鏡節點、釋放貼圖，下次同樣尺寸要再等 Worker 算一次
   * （這段時間那片玻璃沒有折射，看起來會閃一下）。現在把它留在 SVG 裡：
   * 沒有元素引用就不參與繪製，不花合成成本；只保留最近幾份，超過就丟掉最舊的，
   * 貼圖記憶體有上限，而重複使用時濾鏡內容與重新算出來的完全一樣。 */
  var PARK = 3, parked = [];
  function park(key, rec) {
    if (rec.parked) return;
    rec.parked = true;
    parked.push(key);
    while (parked.length > PARK) {
      var old = parked.shift(), gone = filters.get(old);
      if (!gone || gone.refs > 0) continue;                            // 又有人用了：不能用
      if (gone.node) gone.node.remove();
      revokeMaps(gone.maps);                                            // 還在等貼圖的：讓它回來時自己放棄
      filters.delete(old);
    }
  }
  function release(key) {
    var rec = filters.get(key);
    if (rec && --rec.refs <= 0) {
      if (rec.node) park(key, rec);
      else { revokeMaps(rec.maps); filters.delete(key); }
    }
  }

  /* 把已經準備好的濾鏡套到元素上（換掉舊的） */
  function applyFilter(node, key, rec) {
    if (tracked.has(node)) release(tracked.get(node));
    tracked.set(node, key);
    node.__lgWant = null;
    prop(node, '--lg-filter', 'url(#' + rec.id + ') saturate(var(--lg-sat, 1.65)) brightness(var(--lg-bright, 1))');
    cls(node, 'lg-live', true);
  }

  /* ---------- 一幀只量一次版面 ----------
   * update() 原本邊讀尺寸邊寫入（CSS 變數、濾鏡屬性）。寫入會讓樣式失效，
   * 下一片玻璃讀 offsetWidth 時就再強制一次版面；同一幀要處理的玻璃越多就越慢
   * （切換深淺色、換頁、改視窗大小、導覽列展開後重算時最明顯）。
   * 現在拆成兩段：measure() 只讀、update() 只算與寫，一幀的版面計算固定只有一次，
   * 讀到的數值與原本逐片讀取的完全相同（兩段之間沒有任何會改變版面的事）。 */
  function measure(node) {
    var m = { w: 0, h: 0 };
    if (node.classList.contains('lg-morphing')) return m;                // 變形動畫中先用模糊，結束再算
    m.w = node.offsetWidth; m.h = node.offsetHeight;                      // 不含 transform，縮放動畫不會重算
    if (m.w < 8 || m.h < 8) return m;
    var cs = getComputedStyle(node);
    m.radius = parseFloat(cs.borderTopLeftRadius) || 0;
    /* 厚邊寬度與折射強度：元素屬性 → CSS 變數 --lg-bezel / --lg-strength → 預設 */
    m.bezel = attrNum(node, 'bezel', parseFloat(cs.getPropertyValue('--lg-bezel')) || Math.min(28, Math.min(m.w, m.h) * 0.32));
    m.strength = attrNum(node, 'strength', parseFloat(cs.getPropertyValue('--lg-strength')) || 0.9);
    /* 霧化程度：元素屬性優先，否則讀 CSS 變數 --lg-frost（深色 / 淺色各自設定） */
    m.blur = attrNum(node, 'blur', parseFloat(cs.getPropertyValue('--lg-frost')) || 1.2);
    /* 高光強度：元素屬性優先，否則讀 CSS 變數 --lg-spec（深色 / 淺色各自設定） */
    m.spec = attrNum(node, 'spec', parseFloat(cs.getPropertyValue('--lg-spec')) || 0.55);
    /* 泡泡主題（appearance.css 設定，見該檔說明）：
       --lg-iris      > 0 = 玻璃本身帶肥皂泡的薄膜干涉色，數值是濃淡（1 = 標準；只改高光圖，不增加每幀的成本）
       --lg-disperse  紅綠藍分開折射的比例（稜鏡色散；每多一個元素多兩次位移運算，只給導覽列） */
    m.iris = Math.max(0, Math.min(3, parseFloat(cs.getPropertyValue('--lg-iris')) || 0));
    m.disperse = Math.max(0, Math.min(0.6, parseFloat(cs.getPropertyValue('--lg-disperse')) || 0));
    /* data-glass-magnify > 1：透鏡（放大 + 邊緣折射），用於選取膠囊移動時 */
    m.mag = attrNum(node, 'magnify', 1);
    if (node.classList.contains('sys-bar')) m.content = measureContent(node);
    return m;
  }

  function update(node, m) {
    if (node.classList.contains('lg-morphing')) return;
    var w = m.w, h = m.h;
    if (w < 8 || h < 8) return;
    var radius = m.radius;
    var bezel = Math.max(4, Math.min(m.bezel, Math.min(w, h) * 0.45));
    var strength = Math.max(0, Math.min(1, m.strength));
    /* 位移量 = scale × 0.5 × profile；斜率 < 0.85 才不會摺疊出雜訊 */
    var scale = strength * 0.85 * bezel / (0.5 * MAX_SLOPE);
    var o = {
      radius: radius, bezel: Math.round(bezel), scale: +scale.toFixed(2),
      blur: m.blur,
      spec: Math.max(0, Math.min(1, m.spec)),
      iris: m.iris,
      disperse: m.disperse
    };
    var mag = m.mag;
    if (mag > 1) {
      var eo = strength * 0.85 * bezel / MAX_SLOPE;
      var S = 2 * (Math.max(w, h) / 2 * (1 - 1 / mag) + eo);
      o.scale = +S.toFixed(2);
      o.lens = { mag: mag, eo: eo, S: S };
    }
    var key = [w, h, radius, o.bezel, o.scale, o.blur, o.spec, mag, o.iris, o.disperse].join('|');
    if (m.content) updateContent(w, h, radius, m.content);
    /* 已經套用、或正在等同一份貼圖 */
    if (tracked.get(node) === key) { if (node.__lgWant) { release(node.__lgWant); node.__lgWant = null; } return; }
    if (node.__lgWant === key) return;
    var rec = filters.get(key) || makeFilter(key, w, h, o);
    rec.refs++;
    rec.parked = false;                                                  // 又被用到了：之後再空下來要重新排隊
    if (node.__lgWant) release(node.__lgWant);                            // 換掉還在等的那一份
    if (rec.node) { applyFilter(node, key, rec); return; }               // 同尺寸的玻璃已經算過：立刻套用
    /* 新尺寸：貼圖在背景產生，期間保留目前的樣子，好了再換上 */
    node.__lgWant = key;
    rec.ready.then(function (ok) {
      if (ok && node.__lgWant === key && node.__lg && node.isConnected) applyFilter(node, key, rec);
    });
  }

  var pending = new Set(), raf = 0;
  function schedule(node) { pending.add(node); if (!raf) raf = requestAnimationFrame(flush); }
  function flush() {
    raf = 0;
    var list = [];
    pending.forEach(function (n) { if (n.isConnected) list.push(n); });
    pending.clear();
    /* 先把這一幀要處理的玻璃全部量完，再開始寫入：中間沒有任何讀取，版面只算一次 */
    var measured = list.map(measure);
    list.forEach(function (n, i) { update(n, measured[i]); });
  }
  /* ---------- 尺寸變化中的玻璃（例如導覽列展開分頁列、改視窗大小） ----------
   * 以前每一幀的新尺寸都重新產生一次貼圖：展開動畫的每一幀都卡住。
   * 現在：尺寸變化中先把現有的貼圖拉伸到新尺寸（只改幾個屬性，不重算），
   * 尺寸停止變化 140ms 後才產生正確尺寸的貼圖、換上。 */
  function stretch(node) {
    var key = tracked.get(node), rec = key && filters.get(key);
    if (!rec || !rec.node || rec.refs !== 1) return false;               // 還沒有濾鏡、或和別的元素共用：不拉伸
    var w = node.offsetWidth, h = node.offsetHeight;
    if (w < 8 || h < 8) return false;
    var f = rec.node;
    /* 值沒變就不寫：屬性的寫入（即使同值）都會讓這個濾鏡失效、下一幀整片重畫 */
    var W = String(w), H = String(h);
    if (f.getAttribute('width') !== W || f.getAttribute('height') !== H) { f.setAttribute('width', w); f.setAttribute('height', h); }
    f.querySelectorAll('feImage').forEach(function (im) {
      if (im.getAttribute('width') === W && im.getAttribute('height') === H) return;
      im.setAttribute('width', w); im.setAttribute('height', h);
    });
    /* 拉伸過的濾鏡已經不是原本尺寸：換一個專用的名字，別的元素就不會拿到它 */
    if (!rec.stretched) {
      rec.stretched = true;
      var own = key + '|stretched|' + (++seq);
      filters.delete(key); filters.set(own, rec); tracked.set(node, own);
    }
    return true;
  }
  function resized(node) {
    /* 還沒有濾鏡（第一次出現）：立刻產生；已經有濾鏡：能拉伸就拉伸，等尺寸穩定再重算
       （和別的同尺寸元素共用濾鏡時不拉伸，暫時沿用，例如改視窗大小時一整排伺服器卡片） */
    if (!tracked.has(node)) { schedule(node); return; }
    stretch(node);
    clearTimeout(node.__lgSettle);
    node.__lgSettle = setTimeout(function () { node.__lgSettle = 0; schedule(node); }, 140);
  }
  var ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(function (es) { es.forEach(function (e) { resized(e.target); }); }) : null;

  /* 觸控光暈與邊緣亮線：記下游標在玻璃上的位置。高回報率滑鼠一幀會送好幾次移動，合併成每幀只寫一次（少做多餘的樣式重算） */
  var glowQueue = new Map(), glowRaf = 0;
  function flushGlow() {
    glowRaf = 0;
    glowQueue.forEach(function (pt, n) {
      var r = n.getBoundingClientRect();
      /* 同值不寫：游標沒動（或在同一點震動）時，寫入會讓整片玻璃的折射重算一次 */
      prop(n, '--lg-px', (pt.x - r.left) + 'px');
      prop(n, '--lg-py', (pt.y - r.top) + 'px');
    });
    glowQueue.clear();
  }
  function glow(e) {
    glowQueue.set(e.currentTarget, { x: e.clientX, y: e.clientY });
    /* 按下要立刻有光；移動則合併到下一幀 */
    if (e.type === 'pointerdown') { if (glowRaf) cancelAnimationFrame(glowRaf); flushGlow(); }
    else if (!glowRaf) glowRaf = requestAnimationFrame(flushGlow);
  }

  function attach(node) {
    if (node.__lg) return;
    node.__lg = true;
    cls(node, 'lg', true);
    node.addEventListener('pointerdown', glow, { passive: true });
    node.addEventListener('pointermove', glow, { passive: true });
    if (SUPPORTED && node.hasAttribute('data-glass')) { if (ro) ro.observe(node); schedule(node); }
  }
  function detach(node) {
    node.__lg = false;
    if (ro) ro.unobserve(node);
    if (tracked.has(node)) { release(tracked.get(node)); tracked.delete(node); }
    if (node.__lgWant) { release(node.__lgWant); node.__lgWant = null; }
    clearTimeout(node.__lgSettle);
  }

  function scan(root) {
    if (!root.querySelectorAll) return;
    var sel = selectors.join(',');
    if (root.matches && root.matches(sel)) attach(root);
    if (root.firstElementChild) root.querySelectorAll(sel).forEach(attach);
    if ((root.matches && root.matches(barSel)) || (root.querySelector && root.querySelector(barSel))) { indicators(); edges(); }
    /* 新出現的玻璃列 / 浮動列（例如勾選檔案後的操作列）：立刻判斷下方背景明暗 */
    if ((root.matches && root.matches(adaptSel)) || (root.querySelector && root.querySelector(adaptSel))) adapt();
  }

  /* ---------- 選取膠囊：導覽列 / 分頁列裡的 .active 項目，膠囊用彈簧滑過去 ----------
   * 不插入任何節點（避免和 React 衝突），只在「選項的父層」設定 CSS 變數，
   * 由 CSS 的 ::before 畫出膠囊。 */
  var barSel = '.sys-bar';
  var indRaf = 0;
  /* ---------- 透鏡：選取膠囊移動時，變成一片放大鏡滑過去（iOS 26 分頁列） ----------
   * 做法和 iOS 一樣：透鏡裡放一份玻璃列內容的「副本」，用 transform 以矢量放大，字永遠清晰；
   * 透鏡邊緣再用一張很小的位移圖把放大的字彎進去。移動時只改 transform，不重跑背景濾鏡。 */
  var MAG = 1.28;                                   // 放大倍率
  /* 結構：lens（只平移，獨立圖層，移動不掉幀）→ pill（玻璃外觀，鼓起的縮放在這層，每幀重畫所以字清晰）
   *       → ink（裁成膠囊形 + 邊緣彎曲濾鏡）→ 副本 */
  var lens = null, lensPill = null, lensView = null, lensRun = null, lensRaf = 0;
  function ensureLens() {
    if (lens) return lens;
    lens = document.createElement('div');
    lens.className = 'sys-lens';
    lens.setAttribute('aria-hidden', 'true');
    lensPill = document.createElement('div');
    lensPill.className = 'sys-lens-view';
    lensView = document.createElement('div');
    lensView.className = 'sys-lens-ink';
    lensPill.appendChild(lensView);
    lens.appendChild(lensPill);
    document.body.appendChild(lens);
    return lens;
  }
  function lensSize(tab) { return { w: Math.round(tab.offsetWidth + 10), h: Math.round(tab.offsetHeight + 10) }; }

  /* 透鏡邊緣的彎曲：沿用內容折射的位移圖（只在左右圓弧），大小 = 透鏡 */
  function lensEdgeFilter(w, h) {
    var bezel = Math.round(Math.min(h * 0.6, 30)), exp = 1.6;
    var S = +(0.55 * 2 * bezel / exp).toFixed(2);
    /* 彩虹主題：透鏡邊緣的字分出紅綠藍三色（彩虹色散），讀 <html> 上的 --lg-lens-disperse */
    var D = Math.max(0, Math.min(0.8, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lg-lens-disperse')) || 0));
    var key = 'lens|' + [w, h, bezel, S, D].join('|');
    var rec = contentFilters.get(key);
    var map = contentMap(w, h, h / 2, bezel, exp);
    if (!rec) {
      var id = 'lgl' + (++seq), pad = Math.ceil(S / 2) + 4;
      var f = mk('filter', { id: id, x: -pad, y: 0, width: w + pad * 2, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, ensureSvg());
      mapImage(f, map.url, 0, 0, w, h, 'm');
      if (D > 0) disperse(f, 'SourceGraphic', 'm', S, D, 'o');
      else mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'm', scale: S, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
      rec = { id: id, node: f, refs: 1, map: map };
      contentFilters.set(key, rec);
    }
    return rec;
  }
  /* 預熱：分頁列出現後，閒置時把每個分頁尺寸的透鏡邊緣圖先建好 */
  function warmLens(host) {
    if (!SUPPORTED || reduceMotion.matches || host.__lgWarm) return;
    host.__lgWarm = true;
    var idle = global.requestIdleCallback || function (fn) { return setTimeout(fn, 150); };
    idle(function () {
      if (!host.isConnected) return;
      host.querySelectorAll('a, button, [aria-selected]').forEach(function (tab) {
        if (!tab.offsetWidth) return;
        var sz = lensSize(tab);
        lensEdgeFilter(sz.w, sz.h);
      });
    }, { timeout: 1500 });
  }

  /* 玻璃列的副本：保留元件自己的 class（樣式才對），拿掉玻璃、濾鏡、遮罩和選取膠囊 */
  var STRIP = ['lg', 'sys-bar', 'lg-live', 'lg-over-dark', 'lg-ind', 'lg-ind-still', 'lg-ind-traveling', 'lg-ind-land'];
  function cloneBar(bar, host) {
    var c = bar.cloneNode(true);
    var all = [c].concat(Array.prototype.slice.call(c.querySelectorAll('*')));
    all.forEach(function (el) {
      STRIP.forEach(function (k) { if (el.classList) el.classList.remove(k); });
      el.removeAttribute('id');
      el.removeAttribute('data-glass');
      el.removeAttribute('data-lg-scroll');
      if (el.style) { el.style.filter = ''; el.style.maskImage = ''; el.style.webkitMaskImage = ''; }
      if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      if (el.matches('input, select, textarea')) el.disabled = true;
    });
    c.classList.add('sys-lens-clone');
    c.removeAttribute('style');
    var br = bar.getBoundingClientRect();
    c.style.cssText = 'position:absolute;left:0;top:0;margin:0;width:' + br.width + 'px;height:' + br.height + 'px;transform-origin:0 0;';
    /* 找到副本裡對應 host 的那一層，之後同步它的捲動位置 */
    var path = [], n = host;
    while (n && n !== bar) { path.unshift(Array.prototype.indexOf.call(n.parentElement.children, n)); n = n.parentElement; }
    var cHost = c;
    path.forEach(function (i) { cHost = cHost.children[i]; });
    return { el: c, host: cHost, rect: br };
  }

  function travel(host, from, to, pressed) {
    var b0 = host.closest && host.closest(barSel);
    var why = !SUPPORTED ? 'not-supported' : reduceMotion.matches ? 'reduced-motion' : !to ? 'no-target' : null;
    if (b0) b0.__lgTravel = { at: Math.round(performance.now()), result: why || 'started', from: pressed ? 'press/prev' : from && from.isConnected ? 'old-active' : host.__lgLast ? 'last-position' : 'none' };
    if (why) return false;
    var bar = host.closest(barSel);
    if (!bar) return false;
    /* 起點的優先順序：按下分頁那一刻記下的位置 → 舊的選取項目 → 上次畫膠囊的位置 */
    var hr = host.getBoundingClientRect(), sx, sw;
    if (pressed) {
      sx = pressed.left + pressed.width / 2; sw = pressed.width;
    } else if (from && from.isConnected && from.getBoundingClientRect().width) {
      var a = from.getBoundingClientRect(); sx = a.left + a.width / 2; sw = a.width;
    } else if (host.__lgLast) {
      sx = hr.left + host.__lgLast.left - host.scrollLeft + host.__lgLast.width / 2; sw = host.__lgLast.width;
    } else {
      if (b0) b0.__lgTravel.result = 'no-start-position';
      return false;
    }
    var el = ensureLens();
    var sz = lensSize(to);
    el.style.width = sz.w + 'px'; el.style.height = sz.h + 'px';
    var edge = lensEdgeFilter(sz.w, sz.h);
    lensView.style.filter = '';
    edge.map.ready.then(function () { if (lensRun && lensRun.edge === edge) lensView.style.filter = 'url(#' + edge.id + ')'; });

    var clone = cloneBar(bar, host);
    lensView.textContent = '';
    lensView.appendChild(clone.el);
    clone.host.scrollLeft = host.scrollLeft;

    var keep = lensRun && lensRun.st;
    var st = keep || { x: sx, w: sw, vx: 0, vw: 0, m: 1, vm: 0, s: 1, vs: 0, jelly: 0 };
    st.last = performance.now();
    st.phase = 'go';
    if (lensRun && lensRun.host !== host) lensRun.host.classList.remove('lg-ind-traveling');
    var tr = to.getBoundingClientRect();
    lensRun = { st: st, host: host, to: to, bar: bar, clone: clone, edge: edge, sz: sz, ty: tr.top + tr.height / 2, elapsed: 0 };
    clearTimeout(el.__fade);
    host.classList.add('lg-ind-traveling');
    el.classList.add('on');
    if (!lensRaf) lensRaf = requestAnimationFrame(stepLens);
    return true;
  }

  /* 臨界阻尼附近的彈簧，依實際經過時間計算，任何幀率手感一致 */
  function spring(st, key, vkey, target, K, zeta, dt) {
    var C = 2 * Math.sqrt(K) * zeta, n = Math.ceil(dt / 0.004), h = dt / n;
    for (var i = 0; i < n; i++) { st[vkey] += (-K * (st[key] - target) - C * st[vkey]) * h; st[key] += st[vkey] * h; }
  }

  function stepLens(now) {
    lensRaf = 0;
    var run = lensRun; if (!run) return;
    var st = run.st, el = lens;
    var b = run.to.getBoundingClientRect();
    var tx = b.left + b.width / 2;
    var speed = global.PanelMotion.getSpeed();
    /* 每幀最多推進 0.12 秒：彈簧每 4ms 細分一步，大步長也穩定；
       低幀率（例如省電或軟體繪圖）時透鏡仍照真實時間抵達，不會變成慢動作拖很久 */
    var dt = Math.min(0.12, Math.max(0.001, (now - st.last) / 1000)) * speed; st.last = now;
    run.elapsed += dt * 1000;

    /* 位置與寬度：剛度 230、阻尼比 0.86，略有過衝但不晃 */
    spring(st, 'x', 'vx', tx, 230, 0.86, dt);
    spring(st, 'w', 'vw', b.width, 230, 0.9, dt);
    var near = Math.abs(tx - st.x) < 6 && Math.abs(st.vx) < 120;
    if (st.phase === 'go' && near) st.phase = 'land';
    /* 放大倍率與透鏡大小：出發時鼓起，抵達時縮回 1 倍（和底下的字完全重合），交接才不會跳 */
    var lifted = st.phase === 'go';
    spring(st, 'm', 'vm', lifted ? MAG : 1, 320, 0.95, dt);
    spring(st, 's', 'vs', lifted ? 1.1 : 1, 320, 0.8, dt);

    /* 水滴感：減速時沿著移動方向壓扁（依加速度，平滑處理） */
    var acc = (st.vx - (st.pvx || 0)) / dt; st.pvx = st.vx;
    var along = st.vx === 0 ? 0 : -acc * (st.vx > 0 ? 1 : -1);
    st.jelly = st.jelly * 0.8 + Math.max(-0.08, Math.min(0.08, along / 90000)) * 0.2;
    if (!lifted) st.jelly *= 0.6;

    var lw = run.sz.w, lh = run.sz.h;
    var lx = st.x - lw / 2, ly = run.ty - lh / 2;
    var sx = ((st.w + 10) / lw) * (st.s + st.jelly), sy = st.s - st.jelly * 0.6;
    el.style.transform = 'translate3d(' + lx.toFixed(2) + 'px,' + ly.toFixed(2) + 'px,0)';
    lensPill.style.transform = 'scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')';

    /* 副本：讓透鏡中心底下那一點正好出現在透鏡中心，再以中心放大 m 倍 */
    var cx = lw / 2, cy = lh / 2, br = run.clone.rect;
    run.clone.el.style.transform = 'translate(' + cx + 'px,' + cy + 'px) scale(' + st.m.toFixed(4) + ') translate(' +
      (br.left - lx - cx).toFixed(2) + 'px,' + (br.top - ly - cy).toFixed(2) + 'px)';

    var done = st.phase === 'land' && Math.abs(tx - st.x) < 0.3 && Math.abs(st.vx) < 4 &&
      Math.abs(st.m - 1) < 0.004 && Math.abs(st.s - 1) < 0.004 && Math.abs(b.width - st.w) < 0.3;
    if (!done && run.elapsed < 2000) { lensRaf = requestAnimationFrame(stepLens); return; }

    /* 交接：透鏡已經和膠囊同大小、同位置、字也是 1 倍，兩者交叉淡換 */
    run.host.classList.remove('lg-ind-traveling');
    el.classList.remove('on');
    el.__fade = setTimeout(function () { if (!lensRun) { lensView.textContent = ''; lensView.style.filter = ''; } }, 300 / speed);
    lensRun = null;
  }

  /* 記在引擎裡（不記在元素上）的位置：React 切頁時可能把整條列換成新元素，元素上的記錄會跟著消失。
   * rows：每一條列（以畫面上的高度位置辨識）上次選取膠囊的位置；press / prev：最近一次按下 / 取消選取的位置 */
  var rows = [], lastPress = null, lastPrev = null;
  function sameRow(a, top) { return a && Math.abs(a.top - top) < 12; }
  function rowGet(top) { for (var i = 0; i < rows.length; i++) if (sameRow(rows[i], top)) return rows[i]; return null; }
  function rowSet(top, rect) {
    var row = rowGet(top);
    if (!row) { row = {}; rows.push(row); if (rows.length > 8) rows.shift(); }
    row.top = top; row.left = rect.left; row.width = rect.width;
  }

  function paintIndicators() {
    indRaf = 0;
    document.querySelectorAll(barSel).forEach(function (bar) {
      var act = bar.querySelector('a.active, [aria-current="page"], [aria-selected="true"]');
      var pills = bar.querySelectorAll('.lg-ind');
      if (!act || !act.parentElement) {
        pills.forEach(function (p) { prop(p, '--ind-o', '0'); });
        return;
      }
      var host = act.parentElement;
      var first = !host.classList.contains('lg-ind');
      /* .lg-ind 會讓 host 成為定位基準（position: relative），分頁的 offsetLeft / offsetTop 是相對它量的：
         一定要先加上 class 再讀位置（只有第一次會多一次版面計算，之後 class 已經在了，cls() 不會寫入） */
      cls(host, 'lg-ind', true);
      if (first) cls(host, 'lg-ind-still', true);                 // 第一次出現時不要從 0 滑進來
      /* 先把這一條列要用到的位置與尺寸讀完，再開始寫入：
         中間只要寫了一次 CSS 變數，後面的 getBoundingClientRect 就會再強制一次版面
         （這個函式在每次 DOM 變化、resize、字型載入完成時都會跑） */
      var ox = act.offsetLeft, oy = act.offsetTop, ow = act.offsetWidth, oh = act.offsetHeight;
      var btop = bar.getBoundingClientRect().top, ar = act.getBoundingClientRect();
      pills.forEach(function (p) { if (p !== host) prop(p, '--ind-o', '0'); });
      prop(host, '--ind-x', ox + 'px');
      prop(host, '--ind-y', oy + 'px');
      prop(host, '--ind-w', ow + 'px');
      prop(host, '--ind-h', oh + 'px');
      prop(host, '--ind-o', '1');
      /* 同一個分頁被 React 換成新的元素（href 相同，例如權限載入後重建）時，不算切換 */
      var same = host.__lgActive && host.__lgActive !== act && !host.__lgActive.isConnected &&
        host.__lgActive.getAttribute('href') === act.getAttribute('href');
      if (same) host.__lgActive = act;
      /* 選到的分頁如果在可滑動區的邊緣，平滑捲到中間（像 iOS 的分段選單） */
      if (host.__lgActive !== act) {
        var firstTime = !host.__lgActive && !host.__lgLast;
        /* 剛剛在這條列上按過分頁：不管引擎之前有沒有畫過膠囊，都從按下時的位置出發 */
        /* 起點：按下時記下的位置 → 剛被取消選取的那一顆（從 DOM 變化讀出）→ 引擎上次畫膠囊的位置 */
        var tnow = performance.now();
        var fresh = function (rec) { return rec && tnow - rec.t < 2000 && sameRow(rec, btop) ? rec.rect : null; };
        var row = rowGet(btop);
        var moved = row && Math.abs(row.left - ar.left) > 1 ? { left: row.left, width: row.width } : null;
        var pressed = (bar.__lgPress && tnow - bar.__lgPress.t < 2000 ? bar.__lgPress.rect : null) ||
          (bar.__lgPrev && tnow - bar.__lgPrev.t < 2000 ? bar.__lgPrev.rect : null) ||
          fresh(lastPress) || fresh(lastPrev) ||
          (firstTime ? moved : null);                                       // 整條列被換掉：用引擎記住的上次位置
        bar.__lgPress = null; bar.__lgPrev = null;
        if (pressed) { lastPress = null; lastPrev = null; }
        if (pressed || !firstTime) travel(host, host.__lgActive, act, pressed);   // __lgLast 尚未更新，仍是上一個位置
        else bar.__lgTravel = { at: Math.round(tnow), result: 'skipped', from: 'none', reason: row ? 'same-position' : 'first-paint-of-this-row' };
        if (pressed) firstTime = false;
        host.__lgActive = act;
        if (host.scrollWidth > host.clientWidth + 1) {
          var target = ox - (host.clientWidth - ow) / 2;
          var instant = firstTime || reduceMotion.matches;
          host.scrollTo({ left: Math.max(0, target), behavior: instant ? 'auto' : 'smooth' });
          /* 立即捲動（不是平滑捲動）會馬上改變分頁在畫面上的位置：記錄位置要用捲動後的值 */
          if (instant) ar = act.getBoundingClientRect();
        }
      }
      host.__lgLast = { left: ox, width: ow };
      if (ar.width) rowSet(btop, ar);
      warmLens(host);
      if (first) requestAnimationFrame(function () { requestAnimationFrame(function () { cls(host, 'lg-ind-still', false); }); });
    });
  }
  function indicators() { if (!indRaf) indRaf = requestAnimationFrame(paintIndicators); }

  /* 按下玻璃列裡的分頁時，記下「目前選取項目」的位置，當作透鏡的起點 */
  function rememberPress(e) {
    var item = e.target.closest && e.target.closest('.sys-bar a, .sys-bar button');
    if (!item) return;
    var bar = item.closest('.sys-bar');
    var cur = bar.querySelector('a.active, [aria-current="page"], [aria-selected="true"]');
    if (!cur || cur === item) return;
    var r = cur.getBoundingClientRect();
    if (r.width) {
      bar.__lgPress = { rect: { left: r.left, width: r.width }, t: performance.now() };
      lastPress = { rect: bar.__lgPress.rect, t: bar.__lgPress.t, top: bar.getBoundingClientRect().top };
    }
    indicators();
  }

  /* ---------- 自適應：淺色模式下，玻璃列浮在深色內容（例如終端機）上方時自動轉成深色玻璃 ----------
   * 取玻璃列正下方三個點，找出最上層有實心背景的元素，依亮度決定。 */
  var adaptSel = '.sys-nav-shell, .sys-bar:not(.sys-nav-row), .sys-float';
  var skipSel = '.sys-nav-shell, .sys-bar, .sys-float, .sys-sheet, .sys-menu, .sys-tip';
  var adaptRaf = 0;
  /* 同一次判斷裡，同一個元素的底色只解析一次：三個取樣點常常落在同一批容器上
     （捲動時的每一幀都要判斷，這裡省下的是每幀重複的樣式解析） */
  var bgCache = null;
  function bgOf(el) {
    var hit = bgCache && bgCache.get(el);
    if (hit !== undefined) return hit;
    var bg = getComputedStyle(el).backgroundColor;
    if (bgCache) bgCache.set(el, bg);
    return bg;
  }
  function luminanceAt(x, y, self) {
    var stack = document.elementsFromPoint(x, y);
    for (var i = 0; i < stack.length; i++) {
      var el = stack[i];
      if (self.contains(el) || (el.closest && el.closest(skipSel))) continue;
      var m = bgOf(el).match(/[\d.]+/g);
      if (!m || (m.length > 3 && +m[3] < 0.5)) continue;
      return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
    }
    return 1;
  }
  function paintAdapt() {
    adaptRaf = 0;
    var root = document.documentElement;
    var light = root.getAttribute('data-theme') === 'light';
    bgCache = new Map();                                                  // 每次判斷重新開始（底色可能已被改掉）
    if (!light) {
      document.querySelectorAll(adaptSel).forEach(function (bar) { cls(bar, 'lg-over-dark', false); });
      bgCache = null;
      return;
    }
    /* 這兩個值在整次判斷裡都一樣：只讀一次，不要每一條列都重新解析一次根元素的樣式 */
    var edge = parseFloat(getComputedStyle(root).getPropertyValue('--sys-edge-h')) || 0;
    var scrolled = root.classList.contains('lg-scrolled');
    var points = [0.15, 0.5, 0.85];
    document.querySelectorAll(adaptSel).forEach(function (bar) {
      var r = bar.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
      var y = r.top + r.height / 2, dark = 0;
      /* 捲動邊緣淡出區（高度 = --sys-edge-h）裡，玻璃後面看到的是淡出的底色，不是內容 */
      if (scrolled && y < edge * 0.85) { cls(bar, 'lg-over-dark', false); return; }
      /* 兩點就確定是深色（2/3）時，第三點不用再測：結果相同，少一次命中測試 */
      for (var i = 0; i < points.length && dark < 2; i++) {
        if (luminanceAt(r.left + r.width * points[i], y, bar) < 0.4) dark++;
      }
      cls(bar, 'lg-over-dark', dark >= 2);
    });
    bgCache = null;
  }
  function adapt() { if (!adaptRaf) adaptRaf = requestAnimationFrame(paintAdapt); }

  /* ---------- 玻璃列裡可左右滑動的內容：依捲動位置在邊緣加漸隱，取代硬切 ---------- */
  var edgeRaf = 0, edgeFull = true, edgeOnly = new Set(), edgeGen = 0;
  /* overflow-x 只會因為 class、版面或視窗大小改變而變：記在元素上，捲動時不必每一幀重新解析樣式；
     DOM 變動與 resize 時（全部重新檢查）一定重算 */
  function scrollable(el) {
    if (el.__lgOxGen !== edgeGen) {
      var ox = getComputedStyle(el).overflowX;
      el.__lgOx = ox === 'auto' || ox === 'scroll';
      el.__lgOxGen = edgeGen;
    }
    return el.__lgOx;
  }
  function onEdgeScroll(e) { edges(e.currentTarget); }
  function paintEdges() {
    edgeRaf = 0;
    var full = edgeFull, only = edgeOnly;
    edgeFull = false; edgeOnly = new Set();
    if (!full && !only.size) return;
    var list = full ? document.querySelectorAll('.sys-bar, .sys-bar > *') : only;
    list.forEach(function (el) {
      if (!el.isConnected || !scrollable(el)) return;
      if (!el.__lgEdge) { el.__lgEdge = true; el.addEventListener('scroll', onEdgeScroll, { passive: true }); }
      var max = el.scrollWidth - el.clientWidth;
      var state = max <= 1 ? 'none' : el.scrollLeft <= 1 ? 'start' : el.scrollLeft >= max - 1 ? 'end' : 'middle';
      if (el.getAttribute('data-lg-scroll') !== state) el.setAttribute('data-lg-scroll', state);
    });
  }
  /* 捲動時只更新正在捲動的那幾個（其他元素的狀態不會變）；DOM 變動或 resize 才全部重新檢查 */
  function edges(target) {
    if (target) { if (!edgeFull) edgeOnly.add(target); }
    /* 全部重新檢查（DOM 變動、resize）：class 改變也可能改變 overflow，換一代讓快取重算 */
    else { edgeFull = true; edgeOnly.clear(); edgeGen++; }
    if (!edgeRaf) edgeRaf = requestAnimationFrame(paintEdges);
  }

  function start() {
    document.documentElement.classList.add(SUPPORTED ? 'lg-refraction' : 'lg-fallback');
    scan(document.body);
    indicators();
    new MutationObserver(function (list) {
      var bars = false;
      list.forEach(function (m) {
        if (m.type === 'attributes') {
          /* 只理會「選取項目」的變化（React 換 active / aria），引擎自己加的 class 不算 */
          var t = m.target;
          if (m.attributeName === 'hidden') { if (t.matches && (t.matches(adaptSel) || t.querySelector(adaptSel))) adapt(); return; }
          if (t.closest && t.closest(barSel) && !(t.classList.contains('lg') || t.classList.contains('lg-ind'))) {
            bars = true;
            /* 從變化本身讀出「剛被取消選取的是哪一顆」：透鏡的起點不依賴引擎之前有沒有記錄過 */
            var wasOn = m.attributeName === 'class' ? /(^|\s)active(\s|$)/.test(m.oldValue || '')
              : m.attributeName === 'aria-current' ? m.oldValue === 'page' : m.oldValue === 'true';
            var isOn = m.attributeName === 'class' ? t.classList.contains('active')
              : m.attributeName === 'aria-current' ? t.getAttribute('aria-current') === 'page' : t.getAttribute('aria-selected') === 'true';
            if (wasOn && !isOn) {
              var pr = t.getBoundingClientRect(), pb = t.closest(barSel);
              if (pr.width) {
                pb.__lgPrev = { rect: { left: pr.left, width: pr.width }, t: performance.now() };
                lastPrev = { rect: pb.__lgPrev.rect, t: pb.__lgPrev.t, top: pb.getBoundingClientRect().top };
              }
            }
          }
          return;
        }
        if (m.target.closest && m.target.closest('.xterm')) return;      // 終端機輸出量大，直接略過
        if (m.addedNodes.length && m.target.closest && m.target.closest(barSel)) bars = true;
        m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); });
        m.removedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.__lg) detach(n);
          if (n.querySelectorAll) n.querySelectorAll('.lg').forEach(function (c) { if (c.__lg) detach(c); });
        });
      });
      if (bars) { indicators(); edges(); adapt(); }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'aria-current', 'aria-selected', 'hidden'] });
    addEventListener('resize', indicators, { passive: true });
    /* 版面變了，overflow 可能跟著改變：edges() 不帶參數時會換一代編號，讓快取的判斷重算 */
    addEventListener('resize', function () { edges(); }, { passive: true });
    document.addEventListener('pointerdown', rememberPress, { capture: true, passive: true });
    document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest(barSel); if (b && !b.__lgPress) rememberPress(e); }, { capture: true, passive: true });
    document.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') rememberPress(e); }, { capture: true, passive: true });
    edges();
    /* 捲動邊緣效果：頁面離開頂端時加上 .lg-scrolled */
    var scrolled = null;
    function onScroll() {
      var on = (window.scrollY || document.documentElement.scrollTop) > 4;
      if (on !== scrolled) { scrolled = on; document.documentElement.classList.toggle('lg-scrolled', on); }
    }
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    /* 任何可捲動區域捲動都可能改變玻璃底下的背景，但終端機每印一行就捲一次、而且捲的是終端機自己的內容（底色不變），略過 */
    addEventListener('scroll', function (e) {
      var t = e.target;
      if (t && t.nodeType === 1 && t.closest && t.closest('.xterm')) return;
      adapt();
    }, { passive: true, capture: true });
    addEventListener('resize', adapt, { passive: true });
    /* 深色 / 淺色、彩虹切換時：高光強度、色散不同要重算，並重新判斷背景明暗 */
    new MutationObserver(function () { global.LiquidGlass.refresh(); adapt(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });
    adapt();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { indicators(); global.LiquidGlass.refresh(); });
    addEventListener('load', indicators);
  }

  global.LiquidGlass = {
    supported: SUPPORTED,
    reducedMotion: reduceMotion,
    /** 額外指定要變成玻璃的選擇器（不改 React 原始碼也能套用） */
    watch: function (selector) { selectors.push(selector); if (document.body) scan(document.body); },
    attach: attach,
    detach: detach,
    /** 手動重新計算選取膠囊位置（一般不需要，會自動偵測 .active 變化） */
    indicators: indicators,
    /** 手動重新判斷玻璃列下方背景的明暗 */
    adapt: adapt,
    /** 除錯：每條玻璃列目前記下的選取狀態（回報問題時在 DevTools Console 執行 LiquidGlass.debug()） */
    debug: function () {
      return Array.prototype.map.call(document.querySelectorAll(barSel), function (bar) {
        var act = bar.querySelector('a.active, [aria-current="page"], [aria-selected="true"]');
        var host = act && act.parentElement;
        return {
          bar: bar.className,
          active: act ? (act.textContent || act.getAttribute('aria-label') || '').trim() : null,
          engineActive: host && host.__lgActive ? (host.__lgActive.textContent || '').trim() : null,
          engineActiveConnected: !!(host && host.__lgActive && host.__lgActive.isConnected),
          lastPosition: host ? host.__lgLast || null : null,
          recentPress: bar.__lgPress ? Math.round(performance.now() - bar.__lgPress.t) + 'ms ago' : null,
          lastTravel: bar.__lgTravel || null,
          lens: lens ? { exists: true, on: lens.classList.contains('on') } : { exists: false },
          supported: SUPPORTED,
          reducedMotion: reduceMotion.matches
        };
      });
    },
    /** 尺寸或參數改變後重算（不帶參數 = 全部） */
    refresh: function (node) {
      (node ? [node] : Array.from(tracked.keys())).forEach(schedule);
    },
    /** 變形動畫：動畫期間暫用模糊，結束後重算折射 */
    morph: function (node, fn, ms) {
      node.classList.add('lg-morphing');
      fn();
      clearTimeout(node.__lgMorph);
      node.__lgMorph = setTimeout(function () {
        node.classList.remove('lg-morphing');
        schedule(node);
      }, ms || 600);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(window);
