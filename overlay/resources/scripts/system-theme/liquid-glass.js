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

  /* 依元素尺寸產生兩張圖：位移圖（R,G = 方向）與鏡面圖（白光，alpha = 亮度） */
  function buildMaps(w, h, radius, bezel, spec, lens) {
    /* 依螢幕倍率產生，長邊最多 2400px：低解析度貼圖放大是邊緣鋸齒的主因 */
    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var k = Math.min(dpr, 2400 / Math.max(w, h));
    var W = Math.max(2, Math.round(w * k)), H = Math.max(2, Math.round(h * k));
    var dc = document.createElement('canvas'), sc = document.createElement('canvas');
    dc.width = sc.width = W; dc.height = sc.height = H;
    var dctx = dc.getContext('2d'), sctx = sc.getContext('2d');
    var di = dctx.createImageData(W, H), si = sctx.createImageData(W, H);
    var D = di.data, S = si.data;
    var hw = w / 2, hh = h / 2, r = Math.min(radius, hw, hh);

    for (var y = 0; y < H; y++) {
      var py = (y + 0.5) / H * h - hh, sy = py < 0 ? -1 : 1, qy = Math.abs(py) - (hh - r);
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
          m = profile(t);
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
        S[i] = S[i + 1] = S[i + 2] = 255; S[i + 3] = Math.round(a * 255);
      }
    }
    dctx.putImageData(di, 0, 0); sctx.putImageData(si, 0, 0);
    return { disp: dc.toDataURL(), spec: sc.toDataURL() };
  }

  function mk(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function makeFilter(key, w, h, o) {
    var id = 'lg' + (++seq);
    var maps = buildMaps(w, h, o.radius, o.bezel, o.spec, o.lens);
    var f = mk('filter', {
      id: id, x: '0', y: '0', width: w, height: h,
      filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB'
    }, ensureSvg());
    mk('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: o.blur, edgeMode: 'duplicate', result: 'b' }, f);
    mk('feImage', { href: maps.disp, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'd' }, f);
    mk('feDisplacementMap', { in: 'b', in2: 'd', scale: o.scale, xChannelSelector: 'R', yChannelSelector: 'G', result: 'r' }, f);
    mk('feImage', { href: maps.spec, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 's' }, f);
    mk('feComposite', { in: 's', in2: 'r', operator: 'over' }, f);
    var rec = { id: id, node: f, refs: 0 };
    filters.set(key, rec);
    return rec;
  }

  /* ---------- 內容折射：玻璃列「自己的」文字和圖示，靠近左右圓弧時被玻璃邊緣折彎 ----------
   * 只做水平方向、只作用在兩端的圓弧；中間區域位移為 0，文字保持清晰。
   * 位移圖依整條玻璃列產生，每個子元素用自己的偏移對齊同一張圖。 */
  var contentMaps = new Map();       // key -> { url, ready }
  var contentFilters = new Map();    // key -> { id, node, refs }
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
  function updateContent(bar, w, h, radius) {
    var strength = parseFloat(getComputedStyle(bar).getPropertyValue('--lg-content')) || 0;
    var kids = Array.prototype.filter.call(bar.children, function (c) { return !c.classList.contains('sys-lens'); });
    kids.forEach(function (kid) {
      var prev = kid.__lgContent;
      /* 一般解析度螢幕（倍率 < 1.5）不做：濾鏡會讓整條列的字失去次像素反鋸齒（ClearType），變軟 */
      if (!strength || !SUPPORTED || reduceMotion.matches || (global.devicePixelRatio || 1) < 1.5) {
        if (prev) { prop(kid, 'filter', ''); releaseContent(prev); kid.__lgContent = null; }
        return;
      }
      var bezel = Math.round(Math.min(Math.min(w, h) * 0.7, 40)), exp = 1.6;
      /* 不摺疊的上限：位移的斜率 < 1；strength 0–1 再乘上去 */
      var S = +(strength * 2 * bezel / exp).toFixed(2);
      var ox = kid.offsetLeft, oy = kid.offsetTop, cw = kid.offsetWidth, ch = kid.offsetHeight;
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
        mk('feImage', { href: map.url, x: -ox, y: -oy, width: w, height: h, preserveAspectRatio: 'none', result: 'm' }, f);
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

  function release(key) {
    var rec = filters.get(key);
    if (rec && --rec.refs <= 0) { rec.node.remove(); filters.delete(key); }
  }

  function update(node) {
    if (node.classList.contains('lg-morphing')) return;                  // 變形動畫中先用模糊，結束再算
    var w = node.offsetWidth, h = node.offsetHeight;                       // 不含 transform，縮放動畫不會重算
    if (w < 8 || h < 8) return;
    var radius = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
    /* 厚邊寬度與折射強度：元素屬性 → CSS 變數 --lg-bezel / --lg-strength → 預設 */
    var cs = getComputedStyle(node);
    var bezel = attrNum(node, 'bezel', parseFloat(cs.getPropertyValue('--lg-bezel')) || Math.min(28, Math.min(w, h) * 0.32));
    bezel = Math.max(4, Math.min(bezel, Math.min(w, h) * 0.45));
    var strength = Math.max(0, Math.min(1, attrNum(node, 'strength', parseFloat(cs.getPropertyValue('--lg-strength')) || 0.9)));
    /* 位移量 = scale × 0.5 × profile；斜率 < 0.85 才不會摺疊出雜訊 */
    var scale = strength * 0.85 * bezel / (0.5 * MAX_SLOPE);
    var o = {
      radius: radius, bezel: Math.round(bezel), scale: +scale.toFixed(2),
      /* 霧化程度：元素屬性優先，否則讀 CSS 變數 --lg-frost（深色 / 淺色各自設定） */
      blur: attrNum(node, 'blur', parseFloat(getComputedStyle(node).getPropertyValue('--lg-frost')) || 1.2),
      /* 高光強度：元素屬性優先，否則讀 CSS 變數 --lg-spec（深色 / 淺色各自設定） */
      spec: Math.max(0, Math.min(1, attrNum(node, 'spec', parseFloat(getComputedStyle(node).getPropertyValue('--lg-spec')) || 0.55)))
    };
    /* data-glass-magnify > 1：透鏡（放大 + 邊緣折射），用於選取膠囊移動時 */
    var mag = attrNum(node, 'magnify', 1);
    if (mag > 1) {
      var eo = strength * 0.85 * bezel / MAX_SLOPE;
      var S = 2 * (Math.max(w, h) / 2 * (1 - 1 / mag) + eo);
      o.scale = +S.toFixed(2);
      o.lens = { mag: mag, eo: eo, S: S };
    }
    var key = [w, h, radius, o.bezel, o.scale, o.blur, o.spec, mag].join('|');
    if (tracked.get(node) === key) { if (node.classList.contains('sys-bar')) updateContent(node, w, h, radius); return; }
    var rec = filters.get(key) || makeFilter(key, w, h, o);
    rec.refs++;
    if (tracked.has(node)) release(tracked.get(node));
    tracked.set(node, key);
    prop(node, '--lg-filter', 'url(#' + rec.id + ') saturate(var(--lg-sat, 1.65)) brightness(var(--lg-bright, 1))');
    cls(node, 'lg-live', true);
    if (node.classList.contains('sys-bar')) updateContent(node, w, h, radius);
  }

  var pending = new Set(), raf = 0;
  function schedule(node) { pending.add(node); if (!raf) raf = requestAnimationFrame(flush); }
  function flush() {
    raf = 0;
    pending.forEach(function (n) { if (n.isConnected) update(n); });
    pending.clear();
  }
  var ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(function (es) { es.forEach(function (e) { schedule(e.target); }); }) : null;

  /* 觸控光暈：按下時，光從手指位置在玻璃裡擴散 */
  function glow(e) {
    var n = e.currentTarget, r = n.getBoundingClientRect();
    n.style.setProperty('--lg-px', (e.clientX - r.left) + 'px');
    n.style.setProperty('--lg-py', (e.clientY - r.top) + 'px');
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
    var key = 'lens|' + [w, h, bezel, S].join('|');
    var rec = contentFilters.get(key);
    var map = contentMap(w, h, h / 2, bezel, exp);
    if (!rec) {
      var id = 'lgl' + (++seq), pad = Math.ceil(S / 2) + 4;
      var f = mk('filter', { id: id, x: -pad, y: 0, width: w + pad * 2, height: h, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, ensureSvg());
      mk('feImage', { href: map.url, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'm' }, f);
      mk('feDisplacementMap', { in: 'SourceGraphic', in2: 'm', scale: S, xChannelSelector: 'R', yChannelSelector: 'G' }, f);
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
    var dt = Math.min(0.05, Math.max(0.001, (now - st.last) / 1000)) * speed; st.last = now;
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
      bar.querySelectorAll('.lg-ind').forEach(function (p) { if (!act || act.parentElement !== p) prop(p, '--ind-o', '0'); });
      if (!act || !act.parentElement) return;
      var host = act.parentElement;
      var first = !host.classList.contains('lg-ind');
      cls(host, 'lg-ind', true);
      if (first) cls(host, 'lg-ind-still', true);                 // 第一次出現時不要從 0 滑進來
      prop(host, '--ind-x', act.offsetLeft + 'px');
      prop(host, '--ind-y', act.offsetTop + 'px');
      prop(host, '--ind-w', act.offsetWidth + 'px');
      prop(host, '--ind-h', act.offsetHeight + 'px');
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
        var tnow = performance.now(), btop = bar.getBoundingClientRect().top, ar = act.getBoundingClientRect();
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
          var target = act.offsetLeft - (host.clientWidth - act.offsetWidth) / 2;
          host.scrollTo({ left: Math.max(0, target), behavior: firstTime || reduceMotion.matches ? 'auto' : 'smooth' });
        }
      }
      host.__lgLast = { left: act.offsetLeft, width: act.offsetWidth };
      var rr = act.getBoundingClientRect();
      if (rr.width) rowSet(bar.getBoundingClientRect().top, rr);
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
  function luminanceAt(x, y, self) {
    var stack = document.elementsFromPoint(x, y);
    for (var i = 0; i < stack.length; i++) {
      var el = stack[i];
      if (self.contains(el) || (el.closest && el.closest(skipSel))) continue;
      var m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (!m || (m.length > 3 && +m[3] < 0.5)) continue;
      return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
    }
    return 1;
  }
  function paintAdapt() {
    adaptRaf = 0;
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    document.querySelectorAll(adaptSel).forEach(function (bar) {
      if (!light) { cls(bar, 'lg-over-dark', false); return; }
      var r = bar.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
      var y = r.top + r.height / 2, dark = 0;
      /* 捲動邊緣淡出區（高度 = --sys-edge-h）裡，玻璃後面看到的是淡出的底色，不是內容 */
      var edge = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sys-edge-h')) || 0;
      if (document.documentElement.classList.contains('lg-scrolled') && y < edge * 0.85) { cls(bar, 'lg-over-dark', false); return; }
      [0.15, 0.5, 0.85].forEach(function (f) { if (luminanceAt(r.left + r.width * f, y, bar) < 0.4) dark++; });
      cls(bar, 'lg-over-dark', dark >= 2);
    });
  }
  function adapt() { if (!adaptRaf) adaptRaf = requestAnimationFrame(paintAdapt); }

  /* ---------- 玻璃列裡可左右滑動的內容：依捲動位置在邊緣加漸隱，取代硬切 ---------- */
  var edgeRaf = 0;
  function paintEdges() {
    edgeRaf = 0;
    document.querySelectorAll('.sys-bar, .sys-bar > *').forEach(function (el) {
      var ox = getComputedStyle(el).overflowX;
      if (ox !== 'auto' && ox !== 'scroll') return;
      if (!el.__lgEdge) { el.__lgEdge = true; el.addEventListener('scroll', edges, { passive: true }); }
      var max = el.scrollWidth - el.clientWidth;
      var state = max <= 1 ? 'none' : el.scrollLeft <= 1 ? 'start' : el.scrollLeft >= max - 1 ? 'end' : 'middle';
      if (el.getAttribute('data-lg-scroll') !== state) el.setAttribute('data-lg-scroll', state);
    });
  }
  function edges() { if (!edgeRaf) edgeRaf = requestAnimationFrame(paintEdges); }

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
    addEventListener('resize', edges, { passive: true });
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
    addEventListener('scroll', adapt, { passive: true, capture: true });
    addEventListener('resize', adapt, { passive: true });
    /* 深色 / 淺色切換時：高光強度不同要重算，並重新判斷背景明暗 */
    new MutationObserver(function () { global.LiquidGlass.refresh(); adapt(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
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
