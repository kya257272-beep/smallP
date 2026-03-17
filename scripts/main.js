/* scripts/main.js - 主题/模态/交互逻辑（含改进版天气系统） */

const themeColors = {
  pink:   { topbar:"#f8cbd0", icon: "linear-gradient(135deg,#ff9a9e 0%,#fad0c4 100%)", bg: "images/pink.jpg" },
  blue:   { topbar:"#a7c8f2", icon: "linear-gradient(135deg,#9fd3ff 0%,#cfe9ff 100%)", bg: "images/blue.jpg" },
  green:  { topbar:"#b8d6a2", icon: "linear-gradient(135deg,#c6f6d5 0%,#eafde4 100%)", bg: "images/green.jpg" },
  yellow: { topbar:"#f7d26d", icon: "linear-gradient(135deg,#ffed9e 0%,#ffdcb0 100%)", bg: "images/yellow.jpg" },
  purple: { topbar:"#c3b0e6", icon: "linear-gradient(135deg,#e7d9ff 0%,#f6efff 100%)", bg: "images/purple.jpg" },
  black:  { topbar:"#333333", icon: "linear-gradient(135deg,#ffffff 0%,#f0f0f0 100%)", bg: "images/black.jpg" }
};

function shadeColor(hex, percent) {
  try {
    if (!hex) return hex;
    if (hex.length === 4) hex = '#' + hex[1]+hex[1] + hex[2]+hex[2] + hex[3]+hex[3];
    const r = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(1,3),16) * (100 + percent) / 100)));
    const g = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(3,5),16) * (100 + percent) / 100)));
    const b = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(5,7),16) * (100 + percent) / 100)));
    return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
  } catch(e){ return hex; }
}

/* ========== applyTheme 检查自定义设置 ========== */
function applyTheme(themeName) {
  const t = themeColors[themeName] || themeColors.pink;
  
  document.documentElement.style.setProperty('--topbar-color', t.topbar);
  
  const customBtnColor = localStorage.getItem('buttonColor');
  if (customBtnColor) {
    document.documentElement.style.setProperty('--btn-color', customBtnColor);
    document.documentElement.style.setProperty('--btn-hover', shadeColor(customBtnColor, -12));
    document.documentElement.style.setProperty('--btn-active', shadeColor(customBtnColor, -22));
  } else {
    document.documentElement.style.setProperty('--btn-color', t.topbar);
    document.documentElement.style.setProperty('--btn-hover', shadeColor(t.topbar, -12));
    document.documentElement.style.setProperty('--btn-active', shadeColor(t.topbar, -22));
  }
  
  if (!customBtnColor) {
    document.querySelectorAll('.icon-wrapper').forEach(el => el.style.background = t.icon || '');
  } else {
    const lighterColor = shadeColor(customBtnColor, 25);
    document.querySelectorAll('.icon-wrapper').forEach(el => {
      el.style.background = `linear-gradient(135deg, ${customBtnColor} 0%, ${lighterColor} 100%)`;
    });
  }

  const customWpId = localStorage.getItem('customWallpaperId');
  const customWpURL = localStorage.getItem('customWallpaperURL');
  if (!customWpId && !customWpURL && t.bg) {
    if (/^url\(/i.test(t.bg)) document.body.style.backgroundImage = t.bg;
    else document.body.style.backgroundImage = `url("${t.bg}")`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
  }
  
  // 通知桌面模块重新应用主题
  if (typeof window.applyCurrentTheme === 'function') {
    setTimeout(() => window.applyCurrentTheme(), 50);
  }
}

/* ========== IndexedDB 壁纸加载 ========== */
const WP_DB_NAME = 'WallpaperDB';
const WP_DB_VERSION = 2;
const WP_STORE_NAME = 'wallpapers';
const ICON_STORE_NAME = 'customIcons';

let mainWpDB = null;
const mainBlobURLs = {};
const iconBlobURLs = {};

function openMainWallpaperDB() {
  return new Promise((resolve, reject) => {
    if (mainWpDB) { resolve(mainWpDB); return; }
    const request = indexedDB.open(WP_DB_NAME, WP_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { mainWpDB = request.result; resolve(mainWpDB); };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(WP_STORE_NAME)) {
        db.createObjectStore(WP_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(ICON_STORE_NAME)) {
        db.createObjectStore(ICON_STORE_NAME, { keyPath: 'appName' });
      }
    };
  });
}

async function getWallpaperById(id) {
  const db = await openMainWallpaperDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WP_STORE_NAME, 'readonly');
    const store = tx.objectStore(WP_STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadCustomWallpaper() {
  const savedWpId = localStorage.getItem('customWallpaperId');
  if (!savedWpId) return;
  
  try {
    const wp = await getWallpaperById(savedWpId);
    if (wp && wp.blob) {
      if (!mainBlobURLs[wp.id]) {
        mainBlobURLs[wp.id] = URL.createObjectURL(wp.blob);
      }
      
      const bgUrl = `url("${mainBlobURLs[wp.id]}")`;
      
      let protectStyle = document.getElementById('wallpaper-protect-css');
      if (!protectStyle) {
        protectStyle = document.createElement('style');
        protectStyle.id = 'wallpaper-protect-css';
        document.head.appendChild(protectStyle);
      }
      
      protectStyle.textContent = `
        body {
          background-image: ${bgUrl} !important;
          background-size: cover !important;
          background-position: center !important;
          background-attachment: fixed !important;
        }
      `;
      
      document.body.style.setProperty('background-image', bgUrl, 'important');
      document.body.style.setProperty('background-size', 'cover', 'important');
      document.body.style.setProperty('background-position', 'center', 'important');
      document.body.style.setProperty('background-attachment', 'fixed', 'important');
    }
  } catch (e) {
    console.warn('加载自定义壁纸失败:', e);
  }
}

/* ========== 加载自定义按钮颜色 ========== */
function loadCustomButtonColor() {
  const savedColor = localStorage.getItem('buttonColor');
  if (savedColor) {
    document.documentElement.style.setProperty('--btn-color', savedColor);
    document.documentElement.style.setProperty('--btn-hover', shadeColor(savedColor, -12));
    document.documentElement.style.setProperty('--btn-active', shadeColor(savedColor, -22));
    
    const lighterColor = shadeColor(savedColor, 25);
    document.querySelectorAll('.icon-wrapper').forEach(el => {
      el.style.background = `linear-gradient(135deg, ${savedColor} 0%, ${lighterColor} 100%)`;
    });
  }
  
  // 通知桌面模块重新应用主题
  if (typeof window.applyCurrentTheme === 'function') {
    setTimeout(() => window.applyCurrentTheme(), 50);
  }
}

/* ========== 加载自定义 CSS ========== */
function loadCustomCSS() {
  let styleEl = document.getElementById('custom-user-css');
  if (styleEl) {
    styleEl.remove();
  }
  
  const enabled = localStorage.getItem('customCSSEnabled');
  if (enabled !== 'true') {
    return;
  }
  
  const savedCSS = localStorage.getItem('customCSS');
  if (savedCSS && savedCSS.trim()) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-user-css';
    styleEl.textContent = savedCSS;
    document.head.appendChild(styleEl);
  }
}

/* ========== 加载自定义图标 ========== */
async function getAllCustomIconsFromDB() {
  const db = await openMainWallpaperDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ICON_STORE_NAME, 'readonly');
    const store = tx.objectStore(ICON_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function loadCustomIcons() {
  try {
    const customIcons = await getAllCustomIconsFromDB();
    const iconStyle = localStorage.getItem('iconStyle') || 'cover';
    
    customIcons.forEach(icon => {
      const appIconEl = document.querySelector(`.app-icon[data-app="${icon.appName}"] .main-icon`);
      if (appIconEl) {
        let src = '';
        if (icon.url) {
          src = icon.url;
        } else if (icon.blob) {
          if (iconBlobURLs[icon.appName]) {
            URL.revokeObjectURL(iconBlobURLs[icon.appName]);
          }
          iconBlobURLs[icon.appName] = URL.createObjectURL(icon.blob);
          src = iconBlobURLs[icon.appName];
        }
        
        if (src) {
          appIconEl.innerHTML = `<img src="${src}" alt="${icon.appName}" style="width: 100%; height: 100%; object-fit: ${iconStyle}; border-radius: inherit;">`;
        }
      }
    });
  } catch (e) {
    console.warn('加载自定义图标失败:', e);
  }
}

// 暴露给桌面模块使用
window.loadCustomIcons = loadCustomIcons;

/* ========== 初始化主题 ========== */
async function initTheme() {
  const saved = localStorage.getItem('theme') || 'pink';
  
  applyTheme(saved);
  loadCustomButtonColor();
  loadCustomCSS();
  await loadCustomWallpaper();
  await loadCustomIcons();
  
  document.querySelectorAll('.theme-item').forEach(item => {
    if (item.dataset.theme === saved) item.classList.add('active');
    else item.classList.remove('active');
  });
}

/* ========== 模态通用打开/关闭 ========== */
function openModalById(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('active');
  m.setAttribute('aria-hidden','false');
  document.body.classList.add('in-app');
}

function closeModalById(id){
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('active');
  m.setAttribute('aria-hidden','true');
  document.body.classList.remove('in-app');
}

/* ========== DOM Ready ========== */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = btn.closest('.app-modal');
      if (modal && modal.id) closeModalById(modal.id);
    });
  });

  document.querySelectorAll('.theme-item').forEach(item => {
    item.addEventListener('click', () => {
      const theme = item.dataset.theme;
      if (!theme) return;
      localStorage.setItem('theme', theme);
      applyTheme(theme);
      document.querySelectorAll('.theme-item').forEach(i=>i.classList.remove('selected'));
      item.classList.add('selected');
      closeModalById('app-wallpaper');
    });
  });

  const saveApiBtn = document.getElementById('save-api');
  if (saveApiBtn) {
    saveApiBtn.addEventListener('click', ()=> {
      const provider = document.getElementById('api-provider').value.trim();
      const key = document.getElementById('api-key').value.trim();
      if (!provider || !key) { alert('请填写 API 服务商 和 API 密钥'); return; }
      localStorage.setItem('apiConfig', JSON.stringify({provider, key, name: document.getElementById('api-name').value||''}));
      const status = document.getElementById('api-status');
      if (status) status.textContent = '配置已保存（localStorage）';
      alert('已保存（示例）');
    });
  }

  const fetchModelsBtn = document.getElementById('fetch-models');
  if (fetchModelsBtn) {
    fetchModelsBtn.addEventListener('click', () => {
      const provider = document.getElementById('api-provider').value.trim();
      const key = document.getElementById('api-key').value.trim();
      if (!provider || !key) { alert('请填写 API 服务商 和 API 密钥'); return; }
      const status = document.getElementById('api-status');
      if (status) status.textContent = '模拟拉取模型中（请把这里替换为真实 API 请求）';
    });
  }
});

/* ========== 跨标签同步 ========== */
window.addEventListener('storage', async (e) => {
  if (e.key === 'theme') {
    applyTheme(e.newValue || 'pink');
  }
  if (e.key === 'buttonColor') {
    loadCustomButtonColor();
  }
  if (e.key === 'customCSS' || e.key === 'customCSSEnabled') {
    loadCustomCSS();
    await loadCustomWallpaper();
  }
  if (e.key === 'customWallpaperId') {
    if (e.newValue) {
      await loadCustomWallpaper();
    } else {
      const protectStyle = document.getElementById('wallpaper-protect-css');
      if (protectStyle) protectStyle.remove();
      
      document.body.style.removeProperty('background-image');
      document.body.style.removeProperty('background-size');
      document.body.style.removeProperty('background-position');
      document.body.style.removeProperty('background-attachment');
      
      const theme = localStorage.getItem('theme') || 'pink';
      const t = themeColors[theme] || themeColors.pink;
      if (t.bg) {
        document.body.style.backgroundImage = t.bg;
      }
    }
  }
  
  if (e.key && e.key.startsWith('customIcons_')) {
    await loadCustomIcons();
  }
  
  if (e.key === 'iconStyle') {
    await loadCustomIcons();
  }
  
  if (e.key === 'cssToggleSync') {
    loadCustomCSS();
    await loadCustomWallpaper();
  }
  
  // 监听天气变化
  if (e.key === 'weatherType' && window.weatherEngine) {
    window.weatherEngine.setWeather(e.newValue);
    updateWeatherDisplay(e.newValue);
  }
  
  // 监听天气开关变化
  if (e.key === 'weatherEnabled') {
    if (e.newValue === 'false' && window.weatherEngine) {
      window.weatherEngine.stop();
    } else if (e.newValue !== 'false' && window.weatherEngine) {
      window.weatherEngine.start();
    }
  }
  
  // 监听性能模式变化
  if (e.key === 'weatherPerformance' && window.weatherEngine) {
    const currentType = localStorage.getItem('weatherType') || 'sunny';
    window.weatherEngine.setWeather(currentType);
  }
});

/* ===========================
   WeatherEngine — 全屏天气特效（改进版）
   =========================== */

class WeatherEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = 0; 
    this.h = 0;
    this.resize();

    this.type = 'sunny';
    this.particles = [];
    this.splashes = [];
    this.snow = [];
    this.clouds = [];
    this.flares = [];
    this.running = false;
    this.animationId = null;

    this.lastTs = 0;
    this.resizeHandler = () => this.resize();
    window.addEventListener('resize', this.resizeHandler);
    this.loop = this.loop.bind(this);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w; 
    this.h = h;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.canvas.style.display = 'block';
    this.canvas.style.opacity = '1';
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    this.canvas.style.opacity = '0';
    setTimeout(() => {
      if (!this.running) {
        this.canvas.style.display = 'none';
      }
    }, 300);
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.resizeHandler);
  }

  getPerformanceMultiplier() {
    const mode = localStorage.getItem('weatherPerformance') || 'normal';
    switch(mode) {
      case 'low': return 0.4;
      case 'high': return 1.5;
      default: return 1;
    }
  }

  setWeather(type) {
    this.type = type;
    this.particles.length = 0;
    this.splashes.length = 0;
    this.snow.length = 0;
    this.clouds.length = 0;
    this.flares.length = 0;

    if (type === 'none') return;

    const area = this.w * this.h;
    const base = Math.max(30, Math.round(area / 5000));
    const isMobile = this.w < 500;
    const perfMult = this.getPerformanceMultiplier();

    if (type === 'sunny') {
      const count = Math.round((base / 4) * perfMult);
      for (let i = 0; i < count; i++) {
        this.flares.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h * 0.6,
          r: 15 + Math.random() * 60,
          v: 0.1 + Math.random() * 0.5,
          alpha: 0.05 + Math.random() * 0.15,
          phase: Math.random() * Math.PI * 2
        });
      }
    } else if (type === 'cloudy') {
      const count = Math.round((base / 5) * perfMult);
      for (let i = 0; i < count; i++) {
        this.clouds.push({
          x: Math.random() * this.w * 1.5 - this.w * 0.25,
          y: Math.random() * this.h * 0.7,
          w: 150 + Math.random() * 400,
          h: 80 + Math.random() * 200,
          vx: (Math.random() * 0.4 + 0.08) * (Math.random() < 0.5 ? -1 : 1),
          alpha: 0.08 + Math.random() * 0.18
        });
      }
    } else if (type === 'rain-light' || type === 'rain-heavy') {
      const mult = (type === 'rain-heavy') ? 2.2 : 1;
      const count = Math.round(base * (isMobile ? 0.6 : 1.2) * mult * perfMult);
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: Math.random() * this.w * 1.2,
          y: Math.random() * this.h * 1.2 - this.h * 0.2,
          len: 10 + Math.random() * 15 * (type === 'rain-heavy' ? 2 : 1),
          vy: 300 + Math.random() * 500 * (type === 'rain-heavy' ? 1.5 : 0.8),
          vx: -30 + Math.random() * -80,
          width: (type === 'rain-heavy' ? 2 : 1.2),
          alpha: 0.2 + Math.random() * 0.35
        });
      }
    } else if (type === 'fog') {
      const layers = Math.round((6 + (this.w / 600)) * perfMult);
      for (let i = 0; i < layers; i++) {
        this.clouds.push({
          x: Math.random() * this.w * 1.5 - this.w * 0.25,
          y: Math.random() * this.h,
          w: this.w * 0.5 + Math.random() * this.w * 0.8,
          h: 100 + Math.random() * 300,
          vx: (Math.random() * 0.25 + 0.03) * (Math.random() < 0.5 ? -1 : 1),
          alpha: 0.04 + Math.random() * 0.1,
          blur: 40 + Math.random() * 50
        });
      }
    } else if (type === 'snow') {
      const count = Math.round(base * (isMobile ? 0.4 : 0.8) * perfMult);
      const flakes = ['❄', '❅', '❆', '✻', '＊', '·'];
      for (let i = 0; i < count; i++) {
        this.snow.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h * 1.2 - this.h * 0.2,
          vy: 25 + Math.random() * 50,
          vx: -15 + Math.random() * 30,
          size: 6 + Math.random() * 22,
          char: flakes[Math.floor(Math.random() * flakes.length)],
          angle: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.03,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02 + Math.random() * 0.03
        });
      }
    } else if (type === 'rainbow') {
      const count = Math.round((base / 5) * perfMult);
      for (let i = 0; i < count; i++) {
        this.flares.push({
          x: this.w * 0.7 + Math.random() * this.w * 0.25,
          y: Math.random() * this.h * 0.4,
          r: 12 + Math.random() * 45,
          v: 0.08 + Math.random() * 0.3,
          alpha: 0.04 + Math.random() * 0.12,
          phase: Math.random() * Math.PI * 2
        });
      }
    } else if (type === 'stars') {
      const count = Math.round(base * 1.5 * perfMult);
      for (let i = 0; i < count; i++) {
        this.flares.push({
          x: Math.random() * this.w,
          y: Math.random() * this.h,
          r: 1 + Math.random() * 3,
          v: 0,
          alpha: 0.3 + Math.random() * 0.7,
          phase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.5 + Math.random() * 2
        });
      }
    }
  }

  loop(ts) {
    if (!this.running) return;
    
    this.animationId = requestAnimationFrame(this.loop);
    
    const dt = Math.min((ts - this.lastTs) / 1000, 0.1) || 0;
    this.lastTs = ts;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    // 晴天/彩虹光晕效果
    if (this.type === 'sunny' || this.type === 'rainbow') {
      const gx = this.w * 0.85, gy = this.h * 0.1;
      const radius = Math.min(this.w, this.h) * 0.35;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
      g.addColorStop(0, 'rgba(255,245,200,0.5)');
      g.addColorStop(0.3, 'rgba(255,230,160,0.2)');
      g.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalCompositeOperation = 'source-over';
    }

    // 多云背景遮罩
    if (this.type === 'cloudy') {
      ctx.fillStyle = 'rgba(100,100,110,0.08)';
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // 星空背景
    if (this.type === 'stars') {
      ctx.fillStyle = 'rgba(10,15,30,0.3)';
      ctx.fillRect(0, 0, this.w, this.h);
    }

    // 渲染云朵/雾气
    if (this.clouds && this.clouds.length) {
      for (let c of this.clouds) {
        c.x += (c.vx || 0) * dt * 60;
        if (c.x < -c.w * 1.5) c.x = this.w + c.w * 0.5;
        if (c.x > this.w + c.w * 1.5) c.x = -c.w * 0.5;
        
        ctx.save();
        ctx.globalAlpha = c.alpha || 0.12;
        if (c.blur) {
          ctx.filter = `blur(${c.blur}px)`;
        } else {
          ctx.filter = 'blur(25px)';
        }
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w * 0.5, c.h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
      }
    }

    // 渲染光斑/星星
    if (this.flares && this.flares.length) {
      for (let f of this.flares) {
        if (f.v) {
          f.y += f.v * dt * 10;
          if (f.y > this.h * 0.7) f.y = -f.r;
        }
        
        f.phase = (f.phase || 0) + dt * (f.twinkleSpeed || 0.8);
        const flicker = 0.5 + 0.5 * Math.sin(f.phase);
        
        ctx.save();
        ctx.globalAlpha = Math.max(0.02, f.alpha * flicker);
        
        if (this.type === 'stars') {
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalCompositeOperation = 'lighter';
          const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
          grad.addColorStop(0, 'rgba(255,240,200,0.8)');
          grad.addColorStop(0.5, 'rgba(255,220,150,0.3)');
          grad.addColorStop(1, 'rgba(255,200,100,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // 渲染雨滴
    if ((this.type === 'rain-light' || this.type === 'rain-heavy') && this.particles.length) {
      ctx.lineCap = 'round';
      for (let p of this.particles) {
        p.x += (p.vx || -50) * dt;
        p.y += (p.vy || 300) * dt;
        
        if (p.y > this.h + 50) {
          if (this.type === 'rain-heavy' && Math.random() < 0.3) {
            this.splashes.push({
              x: p.x,
              y: this.h - 5 - Math.random() * 10,
              r: 3 + Math.random() * 10,
              life: 0.25,
              t: 0
            });
          }
          p.y = -20 - Math.random() * 100;
          p.x = Math.random() * this.w * 1.2;
        }
        if (p.x < -50) {
          p.x = this.w + 50;
        }
        
        ctx.strokeStyle = `rgba(180,210,255,${p.alpha})`;
        ctx.lineWidth = p.width;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + (p.vx || -40) * 0.025, p.y - p.len);
        ctx.stroke();
      }
      
      for (let i = this.splashes.length - 1; i >= 0; i--) {
        const s = this.splashes[i];
        s.t += dt;
        const progress = s.t / s.life;
        ctx.globalAlpha = Math.max(0, 1 - progress);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (progress * 0.5 + 0.5), Math.PI, 0);
        ctx.strokeStyle = 'rgba(200,230,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (s.t > s.life) this.splashes.splice(i, 1);
      }
    }

    // 渲染雪花
    if (this.type === 'snow' && this.snow.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      for (let f of this.snow) {
        f.wobble += f.wobbleSpeed;
        const wobbleX = Math.sin(f.wobble) * 20;
        
        f.x += (f.vx + wobbleX * 0.1) * dt;
        f.y += f.vy * dt;
        f.angle += f.rotSpeed;
        
        if (f.y > this.h + 20) {
          f.y = -20;
          f.x = Math.random() * this.w;
        }
        if (f.x < -20) f.x = this.w + 20;
        if (f.x > this.w + 20) f.x = -20;
        
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.angle);
        ctx.font = `${f.size}px serif`;
        ctx.globalAlpha = 0.7 + Math.sin(f.wobble) * 0.3;
        ctx.fillText(f.char, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // 渲染彩虹
    if (this.type === 'rainbow') {
      const cx = this.w * 0.5;
      const baseY = this.h * 0.15;
      const radius = Math.min(this.w * 0.45, this.h * 0.5);
      const colors = [
        'rgba(255,80,80,0.32)',
        'rgba(255,140,50,0.30)',
        'rgba(255,210,60,0.28)',
        'rgba(100,210,130,0.26)',
        'rgba(80,200,210,0.24)',
        'rgba(100,130,250,0.22)',
        'rgba(170,90,210,0.20)'
      ];
      
      ctx.save();
      for (let i = 0; i < colors.length; i++) {
        ctx.beginPath();
        ctx.strokeStyle = colors[i];
        ctx.lineWidth = 22 - i * 2.5;
        ctx.arc(cx, baseY + radius, radius - i * 15, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

/* ========== 天气系统初始化与控制 ========== */
const weatherTextMap = {
  sunny: '晴朗 · 阳光明媚',
  cloudy: '多云 · 天空灰白',
  'rain-light': '小雨 · 轻风细雨',
  'rain-heavy': '大雨 · 急风暴雨',
  fog: '雾天 · 薄雾弥漫',
  snow: '下雪 · 白雪皑皑',
  rainbow: '雨后 · 彩虹高挂',
  stars: '夜晚 · 繁星点点',
  none: '无特效'
};

const weatherIconMap = {
  sunny: '☀️',
  cloudy: '☁️',
  'rain-light': '🌦️',
  'rain-heavy': '🌧️',
  fog: '🌫️',
  snow: '❄️',
  rainbow: '🌈',
  stars: '🌙',
  none: '🚫'
};

function updateWeatherDisplay(type) {
  const descEl = document.querySelector('#weather-desc');
  const tempEl = document.querySelector('#weather-temp');
  const iconEl = document.querySelector('#weather-icon');

  if (descEl) descEl.textContent = weatherTextMap[type] || '';
  if (iconEl) iconEl.textContent = weatherIconMap[type] || '';
  
  if (tempEl) {
    let temp;
    switch(type) {
      case 'snow': temp = Math.round(Math.random() * 5 - 5); break;
      case 'rain-heavy': temp = Math.round(Math.random() * 8 + 12); break;
      case 'sunny': temp = Math.round(Math.random() * 10 + 22); break;
      case 'stars': temp = Math.round(Math.random() * 8 + 10); break;
      default: temp = Math.round(Math.random() * 10 + 18);
    }
    tempEl.textContent = `${temp}°C`;
  }
}

// 全局天气切换函数
window.setWeatherType = function(type) {
  if (!type) return;
  
  localStorage.setItem('weatherType', type);
  
  if (window.weatherEngine) {
    if (type === 'none') {
      window.weatherEngine.stop();
    } else {
      window.weatherEngine.setWeather(type);
      const enabled = localStorage.getItem('weatherEnabled');
      if (enabled !== 'false') {
        window.weatherEngine.start();
      }
    }
  }
  
  updateWeatherDisplay(type);
};

// 初始化天气模块
(function initWeatherModule() {
  const canvas = document.getElementById('weather-canvas');
  if (!canvas) return;

  const engine = new WeatherEngine(canvas);
  window.weatherEngine = engine;

  const savedType = localStorage.getItem('weatherType') || 'sunny';
  const enabled = localStorage.getItem('weatherEnabled');
  
  engine.setWeather(savedType);
  updateWeatherDisplay(savedType);
  
  if (enabled !== 'false' && savedType !== 'none') {
    engine.start();
  }

  const autoSwitch = localStorage.getItem('weatherAutoSwitch') === 'true';
  if (autoSwitch) {
    const weatherList = ['sunny', 'cloudy', 'rain-light', 'fog', 'rain-heavy', 'snow', 'rainbow', 'stars'];
    const INTERVAL = 4 * 60 * 60 * 1000;
    setInterval(() => {
      const idx = Math.floor(Math.random() * weatherList.length);
      const next = weatherList[idx];
      window.setWeatherType(next);
      console.log('[Weather] 自动切换为', next);
    }, INTERVAL);
  }
})();

/* ========== 时钟更新 ========== */
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const clockEl = document.querySelector('#clock');
  if (clockEl) clockEl.textContent = `${hours}:${minutes}`;

  const weekdays = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  const dateEl = document.querySelector('#date');
  if (dateEl) dateEl.textContent = `${weekdays[now.getDay()]}，${now.getMonth()+1}月${now.getDate()}日`;
}

updateClock();
setInterval(updateClock, 1000);
