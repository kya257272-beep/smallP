// scripts/theme.js
// 通用主题控制：顶栏、按钮颜色、自定义CSS

const themeColors = {
  pink:   { topbar:"#f8cbd0", bg:'url("https://iili.io/KYiqrVj.webp")' },
  blue:   { topbar:"#a7c8f2", bg:'url("images/blue.jpg")' },
  green:  { topbar:"#b8d6a2", bg:'url("images/green.jpg")' },
  yellow: { topbar:"#f7d26d", bg:'url("images/yellow.jpg")' },
  purple: { topbar:"#c3b0e6", bg:'url("images/purple.jpg")' },
  black:  { topbar:"#333333", bg:'url("images/black.jpg")' }
};

function shadeColor(hex, percent) {
  if (!hex) return hex;
  if (hex.length === 4) hex = '#' + hex[1]+hex[1] + hex[2]+hex[2] + hex[3]+hex[3];
  const r = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(1,3),16) * (100 + percent) / 100)));
  const g = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(3,5),16) * (100 + percent) / 100)));
  const b = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(5,7),16) * (100 + percent) / 100)));
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

// 获取当前应该使用的颜色（优先级：自定义按钮颜色 > 预设主题）
function getCurrentColor() {
  const customBtnColor = localStorage.getItem('buttonColor');
  if (customBtnColor) {
    return customBtnColor;
  }
  const themeName = localStorage.getItem('theme') || 'pink';
  const t = themeColors[themeName] || themeColors.pink;
  return t.topbar;
}

// 应用颜色到页面
function applyColorToPage(color) {
  const root = document.documentElement;
  root.style.setProperty('--topbar-color', color);
  root.style.setProperty('--btn-color', color);
  root.style.setProperty('--btn-hover', shadeColor(color, -12));
  root.style.setProperty('--btn-active', shadeColor(color, -22));
  
  // 立即更新顶栏背景色
  const topbar = document.querySelector('.topbar');
  const header = document.querySelector('.header');
  if (topbar) topbar.style.background = color;
  if (header) header.style.background = color;
}

function applyTheme(themeName) {
  const t = themeColors[themeName] || themeColors.pink;
  const root = document.documentElement;
  
  // 获取当前应该使用的颜色
  const color = getCurrentColor();
  
  applyColorToPage(color);
  root.style.setProperty('--bg-image', t.bg || 'none');
}

function loadCustomButtonColor() {
  const savedColor = localStorage.getItem('buttonColor');
  if (savedColor) {
    applyColorToPage(savedColor);
  }
}

function loadCustomCSS() {
  // 先移除旧的自定义样式
  let styleEl = document.getElementById('custom-user-css');
  if (styleEl) {
    styleEl.remove();
  }
  
  // 检查是否启用
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

// 重置按钮颜色（恢复到预设主题颜色）
function resetButtonColor() {
  localStorage.removeItem('buttonColor');
  const themeName = localStorage.getItem('theme') || 'pink';
  const t = themeColors[themeName] || themeColors.pink;
  applyColorToPage(t.topbar);
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'pink';
  applyTheme(savedTheme);
  loadCustomButtonColor();
  loadCustomCSS();
});

// 跨页面同步
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') {
    applyTheme(e.newValue || 'pink');
  }
  if (e.key === 'buttonColor') {
    if (e.newValue) {
      loadCustomButtonColor();
    } else {
      // buttonColor被删除，恢复到预设主题颜色
      const theme = localStorage.getItem('theme') || 'pink';
      applyTheme(theme);
    }
  }
  if (e.key === 'customCSS' || e.key === 'customCSSEnabled') {
    loadCustomCSS();
  }
  if (e.key === 'cssToggleSync') {
    loadCustomCSS();
  }
});
