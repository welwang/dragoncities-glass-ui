import React from 'react';
import ReactDOM from 'react-dom';
import App from '@/components/App';
import { setConfig } from 'react-hot-loader';

// Enable language support.
import './i18n';
import '../../public/branding/motion-speed';
import '../../public/branding/motion-speed.css';

// 系統主題：液態玻璃材質與折射引擎（元素加上 className="lg" + data-glass 即生效）
import '@/system-theme/liquid-glass.css';
import '@/system-theme/roles.css';
import '@/system-theme/liquid-glass';
import { initThemeMode } from '@/system-theme/theme-mode';

// 深色 / 淺色：在第一次渲染前套用，避免閃一下另一種顏色
initThemeMode();

// Prevents page reloads while making component changes which
// also avoids triggering constant loading indicators all over
// the place in development.
//
// @see https://github.com/gaearon/react-hot-loader#hook-support
setConfig({ reloadHooks: false });

ReactDOM.render(<App />, document.getElementById('app'));
