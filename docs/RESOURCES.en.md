# Resource usage assessment and explanation

[繁體中文](RESOURCES.md) | **English**

Source version: DragonCities Glass UI 1.0.2. Assessment date: 2026-11-03.

## Summary

**The larger additional host load occurs during installation builds; real-time glass rendering runs in the visitor's browser.** The host still handles the existing panel's PHP, APIs, WebSocket infrastructure, and static-file traffic. A frontend theme does not mean zero host cost.

| Phase | Main resources | Assessment |
| --- | --- | --- |
| Installation/rebuild | Host CPU, memory, disk I/O | Briefly substantial; a local webpack sample reached approximately 2.27 GiB aggregate process-tree RSS |
| Server runtime | Existing panel services, branding JSON reads, static transfers | Little new server logic and no added persistent Node.js service; the CPU/RAM delta against stock has not been measured |
| Visitor's browser | JavaScript, CPU/graphics work, textures, rendering buffers | Refraction, blur, lenses, scrolling, and size changes are the main sources |
| Cold-cache downloads | Host outbound traffic and visitor download time | Scales with new clients; the default logo is a significant individual asset |

## Scope of the figures

The figures below distinguish file measurements, a sampled local build, and code-based calculations. There was no load test on the target Linux host, controlled stock-versus-theme A/B measurement, or cross-device GPU/battery measurement. These results cannot establish a fixed CPU increase, frame rate, or resident-memory requirement.

This public update changes documentation and release material; its interface sources match the previously built integration. Raw measurement records and measurement utilities are excluded from the public installation package.

## 1. Installation builds: why memory usage is higher

One production webpack build of the same interface sources was sampled on Windows with Node.js v24.14.0, directly monitoring Node and its descendant processes:

| Metric | Observation |
| --- | --- |
| Result | Successful, exit code 0 |
| Elapsed time | Approximately 29.69 seconds |
| Sampled peak aggregate process-tree RSS | 2323.46 MiB, approximately 2.27 GiB |
| Sampled peak aggregate private commit | 2520.51 MiB, approximately 2.46 GiB |
| CPU time captured by sampling | Approximately 52.78 CPU seconds |
| Samples | 43, with a nominal 500ms wait plus process-query overhead |

This is a **Windows webpack reference**, not a fixed Linux requirement. It excludes yarn install, a separate tsc run, backups, PHP, the OS, and Minecraft. Summed RSS can count shared pages more than once; private commit is not physical RAM. Sampling may miss intermediate peaks and the final portion of CPU time.

About 53 CPU seconds over about 30 elapsed seconds represents roughly 1.8 CPU cores' equivalent average work in this run. It is not a prediction of your host's CPU percentage.

Webpack parses modules, builds a dependency graph, transforms TypeScript/JSX and CSS, and minifies JavaScript. The upstream configuration enables parallel Terser minification; workers and intermediate syntax trees increase memory demand. A few megabytes of output do not imply a few megabytes of build RAM. Stock Pterodactyl also performs this build work: the observed 2.27 GiB is not an isolated theme-only increase.

**Capacity recommendation:** the installer's 2 GiB RAM-plus-swap check is a minimum gate, not an assurance of sufficient capacity. Based on this reference, plan approximately **3–4 GiB of available memory headroom for the build**, in addition to existing PHP, OS, and game workloads. Swap can help with memory pressure but may add disk waits. A build sharing a host with Minecraft can still compete for CPU, RAM, or I/O and affect the game.

## 2. Server runtime: why it is usually lighter than building

- The theme adds no persistent Node.js service, background renderer, or service that computes glass frames for visitors. Node is mainly used for builds and manual branding configuration.
- Branding templates read `public/branding/brand.json` when rendering HTML or email. The default file is **82 bytes**, but PHP file-reading and decoded-object costs are neither 82 bytes nor zero. Per-request time and memory increments have not been measured.
- Branding, appearance, speed, and privacy-blur interactions do not send frame-by-frame host requests. Speed preferences are stored in browser localStorage.
- Dashboard resource polling retains stock behavior: every applicable server card polls every **30 seconds**. The approximate average rate is the total simultaneously displayed cards divided by 30 seconds. Ten clients viewing three cards each average about one request per second, plus initial loads. That is existing panel work, not new glass-animation polling.
- Static transfers, on-the-fly compression, and existing API requests still share host resources with games when colocated. Without host measurements, no promise of zero game impact can be made.

Comparing the official and integrated `package.json` files showed no additions or changes to `dependencies` or `devDependencies`. Existing dependencies must still be installed correctly; `node_modules` and package caches still require disk space.

## 3. Disk and network: measured file sizes

The following approximate sizes come from one matching integration build snapshot:

| Item | Size | Interpretation |
| --- | --- | --- |
| Main JavaScript bundle | About 843 KiB; about 260 KiB with local gzip level 6 | Includes the panel and theme; not the theme-only increase |
| All 16 JavaScript files in the manifest | About 2.64 MiB; about 758 KiB combined when each is gzipped at level 6 | Includes lazy-loaded chunks, not necessarily all downloaded on each page's first visit |
| One default PNG logo | 1,413,109 bytes, about 1.35 MiB | Normally served as `panel-logo.png`; the same URL can reuse browser caching |
| Both default logo paths | About 2.70 MiB on disk | Compatibility and branding paths do not imply every page downloads both |
| The 85 target source files | About 3.01 MiB total; roughly 2.80 MiB net growth over clean sources | Most added bytes are logos; excludes compiled assets, dependencies, caches, and backups |

The gzip figures are local calculations, not production HTTP measurements. Compression/cache configuration and pages visited change actual traffic. If a cold-cache visitor eventually loads every JS chunk using similar gzip compression plus one full-size logo, the total is approximately **2.09 MiB**, excluding HTML, fonts, APIs, and protocol overhead. One hundred such visitors imply about 209 MiB. This is a conditional capacity calculation, not a fixed cost per login.

Backup disk usage depends on existing `public/assets`, affected sources, `yarn.lock`, and compression. Each full installation or branding change may retain another backup. Account for retention separately; ZIP size is not the full installation's disk requirement.

## 4. Browser costs: why glass is more demanding

### Texture generation and dimensions

`buildMaps()` in `liquid-glass.js` calculates displacement and highlights pixel by pixel on the main thread, creates two RGBA ImageData buffers, then encodes PNG data URLs. SVG filters combine blur, displacement, and highlights. Browsers may use the GPU, CPU, or both; this is not guaranteed to be free work offloaded entirely to the graphics processor.

The code caps DPR at 2 and the texture's longest edge at 2400px. For a glass element sized `w × h` CSS pixels:

```text
k = min(devicePixelRatio, 2, 2400 / max(w, h))
W = round(w × k), H = round(h × k)
Pixel data for two ImageData buffers ≈ W × H × 4 bytes × 2
```

A 1296×117px element at DPR 2 produces approximately 2400×217 textures: about **3.97 MiB** for those two pixel arrays. This excludes canvases, encoded strings, decoded images, SVG filters, DOM, and compositing buffers. It is not a measurement of the entire tab's memory.

Equal-sized cards with equal parameters share filter textures, reducing duplicate generation. Each card still has rendering and compositing costs. Ordinary filters release references when unused; content/lens size caches have no explicit capacity limit, so repeated geometry changes over a long session can accumulate cached entries. Memory growth cannot be ruled out.

### Operations that increase work

- First display, window resizing, navigation-height changes, font loading, and appearance changes may regenerate textures. The two-row bar's height transition can trigger ResizeObserver and create textures for changing dimensions.
- Scrolling updates edge states and background-brightness checks. Changing terminal, chart, or other content behind glass may also require filtering and compositing updates.
- The moving lens uses requestAnimationFrame with position and scale updates. It does not rebuild the entire background texture every frame, but still requires scripting and rendering work.
- More visible glass cards, larger areas, overlapping layers, and high-refresh displays generally increase the available workload. The actual effect depends on the device, browser, and driver.

Updates are event-driven and coalesced per frame rather than running a permanent lens loop. High-frequency terminal child-node mutations are skipped by the scan. These measures reduce duplicate work but do not guarantee a particular FPS on every device.

### Slower animations are not a power-saving mode

The slider changes playback rate and spring simulation time, not the display's update rate. requestAnimationFrame normally continues to follow display scheduling. At 0.25×, the lens may compute more frames before finishing, so total energy use is not necessarily lower.

For example, the code's 2000ms simulation-time cutoff can correspond to about eight seconds at 0.25× with normal frame intervals; stalls can make it longer, while normal convergence ends it sooner. The slider controls visibility and preference, not an energy-saving mode.

### Glass maps generated on a background thread (1.2.0)

- Each piece of glass needs two maps for its size (refraction direction and specular highlight), computed pixel by pixel. A full-width navigation bar on a 2× screen is about 600,000 pixels, and the rainbow film adds trigonometry per pixel.
- Before 1.2.0 this ran on the main thread, so the page froze when a new page showed glass of a new size, when the window was resized, and when switching to rainbow. Measured (headless Chromium without GPU, 2× density, same test page), the longest main-thread block was **334 ms** turning rainbow on, **311 ms** when a new page's glass appeared, and **227 ms** on resize.
- In 1.2.0 a Web Worker computes the maps and encodes them as PNG; the main-thread block is **0 ms** in all three cases. New maps are swapped in when ready, keeping the current look meanwhile. If the browser does not allow a worker, the maps are computed on the main thread with identical results.
- The rainbow film is computed on a 2 CSS px grid and bilinearly interpolated; it differs from per-pixel computation by less than one colour step (largest screenshot difference 4/255) at more than ten times less work.

### Browser hardware acceleration must be on

Glass refraction (SVG displacement filter plus blur) is cheap on a GPU and very slow on the CPU: in the GPU-less test browser, redrawing one navigation glass takes tens of milliseconds, and scrolling or animating can take 50–170 ms per frame. If the panel is unusually slow on one computer, check:

- Chrome or Edge: Settings → System → "Use graphics acceleration when available" must be on; restart the browser after changing it
- Open `chrome://gpu` (`edge://gpu` in Edge): Canvas, Compositing, and Rasterization under Graphics Feature Status should say Hardware accelerated
- Remote desktop, some virtual machines, and outdated drivers can make the browser fall back to software rendering

### Rainbow world (light mode) costs

- **Prismatic dispersion on the navigation**: the navigation's refraction filter displaces red, green, and blue separately and recombines them, about three times the displacement work. Only the navigation uses it; other glass only adds thin-film colour to its highlight map (computed once per size, with no extra per-frame cost). Measured (no GPU, CPU software rendering, 2.5 s of scrolling): median frame about 33 ms for the standard light theme versus about 50 ms for rainbow, almost entirely from dispersion. This is a worst-case relative comparison, not a frame rate for GPU-accelerated browsers.
- **Wallpaper, pearl cards, spectrum lights**: static CSS gradients with no per-frame cost after the first paint and no new backdrop-filter.
- **Nothing animates continuously**: the entry opening (sparks, bubbles, rainbow, prism light, jelly wave, star glints, icon reassembly; about 2.7 s) and the press bubbles play only when triggered and remove their canvas afterwards. During the opening, glass on screen is redrawn every frame at the same cost as scrolling, only at the moment of switching. Whenever something keeps changing near glass (or the browser repaints the whole screen), the glass refraction must be recomputed every frame. Continuously drifting side bubbles and a flowing loading bar were tried during development and dropped: on the test page they cut frames during pointer movement from about 117 to about 25–36.
- **Everyone sees the same thing**: there is no reduced-quality mode for slower devices. Animations use real time, so slower devices draw fewer frames with the same speed, paths, and length. All new effects are drawn with CSS or canvas without downloading images, and animations use a fixed random seed, so everyone sees the same animation every time.

### Pixel icons and edge light

- **Pixel icons** (light/dark toggle, settings switches, console frost button) are small 13 × 13 canvases. Only the moment of switching plays a pixel-reassembly animation of about 0.7 seconds (scaled by the global animation speed); otherwise they are static and add no per-frame cost. When the theme changes, they repaint for a few frames so their colour follows the transition.
- **The edge light** is a CSS gradient and mask; the script only writes the angle and position when the pointer moves (coalesced to at most once per frame). The navigation toggle follows the pointer across the page; settings switches only follow it while the pointer is near them, so pages with many switches do not recompute all of them on every move.
- **The thin rim on glass** reuses the pointer position the glass already tracks; no new listeners are added.
- With the system's reduced-motion setting, icons switch instantly and the edge light stays at a fixed angle.

### Logo decoding

The default logo is 1254×1254. One full-resolution RGBA buffer is `1254 × 1254 × 4`, approximately **6.00 MiB**, even if displayed as a small navigation icon. A browser may downsample, share the image, or retain additional copies, so this is not a guarantee of actual memory use.

Prefer an appropriately sized 256×256 or 512×512 custom PNG. One 256×256 RGBA pixel buffer is only 0.25 MiB; actual download size still depends on image content and compression.

## Recommendations and limits

1. Include existing panel, game, and OS workloads in build planning. Reserve memory and disk space rather than treating the 2 GiB gate as a safety guarantee.
2. Prefer a smaller, clear logo and review static caching/compression through normal operational procedures. This document does not automatically change nginx.
3. On weaker devices, use the OS reduced-motion preference. The current code suppresses some motion and lenses; this is not a switch that removes all glass rendering costs.
4. Avoid displaying excessive large glass surfaces at once. Investigate actual main-thread and rendering time on affected devices before changing effects.
5. Without controlled stock comparisons and Linux RSS/CPU measurements, do not claim a fixed overhead percentage, supported user count, or browser RAM/GPU budget.

## Sources

- Project code: [glass engine](../overlay/resources/scripts/system-theme/liquid-glass.js), [animation speed](../overlay/public/branding/motion-speed.js), [branding template](../overlay/resources/views/partials/panel-brand.php), and [Dashboard polling](../overlay/resources/scripts/components/dashboard/ServerRow.tsx).
- Upstream: [webpack configuration](https://github.com/pterodactyl/panel/blob/v1.15.2/webpack.config.js) and [stock Dashboard polling](https://github.com/pterodactyl/panel/blob/v1.15.2/resources/scripts/components/dashboard/ServerRow.tsx).
- [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame): callbacks generally follow display scheduling and are paused in background tabs by most browsers.
- [MDN ImageData.data](https://developer.mozilla.org/en-US/docs/Web/API/ImageData/data): RGBA pixel representation; this code uses the default 8-bit channels.
- [web.dev backdrop-filter](https://web.dev/articles/backdrop-filter): backdrop filtering can affect rendering performance.
