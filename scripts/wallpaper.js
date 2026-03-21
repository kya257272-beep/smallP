// 壁纸管理模块：自定义壁纸上传、颜色选择、CSS自定义、图标自定义

/* ========== IndexedDB 配置 ========== */
const WP_DB_NAME = 'WallpaperDB';
const WP_DB_VERSION = 2;
const WP_STORE_NAME = 'wallpapers';
const ICON_STORE_NAME = 'customIcons';

let wpDB = null;

// 打开数据库
function openWallpaperDB() {
  return new Promise((resolve, reject) => {
    if (wpDB) { resolve(wpDB); return; }
    const request = indexedDB.open(WP_DB_NAME, WP_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { wpDB = request.result; resolve(wpDB); };
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

// 保存壁纸
async function saveWallpaperToDB(id, blob, name) {
  const db = await openWallpaperDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WP_STORE_NAME, 'readwrite');
    const store = tx.objectStore(WP_STORE_NAME);
    store.put({ id, blob, name, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 获取所有壁纸
async function getAllWallpapers() {
  const db = await openWallpaperDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WP_STORE_NAME, 'readonly');
    const store = tx.objectStore(WP_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// 获取单个壁纸
async function getWallpaperFromDB(id) {
  const db = await openWallpaperDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WP_STORE_NAME, 'readonly');
    const store = tx.objectStore(WP_STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 删除壁纸
async function deleteWallpaperFromDB(id) {
  const db = await openWallpaperDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WP_STORE_NAME, 'readwrite');
    const store = tx.objectStore(WP_STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 保存自定义图标
async function saveCustomIcon(appName, blob, url) {
  const db = await openWallpaperDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ICON_STORE_NAME, 'readwrite');
    const store = tx.objectStore(ICON_STORE_NAME);
    store.put({ appName, blob, url, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// 获取自定义图标
async function getCustomIcon(appName) {
  const db = await openWallpaperDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ICON_STORE_NAME, 'readonly');
    const store = tx.objectStore(ICON_STORE_NAME);
    const request = store.get(appName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 获取所有自定义图标
async function getAllCustomIcons() {
  const db = await openWallpaperDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ICON_STORE_NAME, 'readonly');
    const store = tx.objectStore(ICON_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// 删除自定义图标
async function deleteCustomIcon(appName) {
  const db = await openWallpaperDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ICON_STORE_NAME, 'readwrite');
    const store = tx.objectStore(ICON_STORE_NAME);
    store.delete(appName);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ========== 壁纸 Blob URL 缓存 ========== */
const wallpaperBlobURLs = {};

function getWallpaperBlobURL(id, blob) {
  if (!wallpaperBlobURLs[id]) {
    wallpaperBlobURLs[id] = URL.createObjectURL(blob);
  }
  return wallpaperBlobURLs[id];
}

function revokeWallpaperBlobURL(id) {
  if (wallpaperBlobURLs[id]) {
    URL.revokeObjectURL(wallpaperBlobURLs[id]);
    delete wallpaperBlobURLs[id];
  }
}

/* ========== 工具函数 ========== */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function shadeColor(hex, percent) {
  if (!hex || hex[0] !== '#') return hex;
  let h = hex.length === 4 ? '#' + hex[1]+hex[1] + hex[2]+hex[2] + hex[3]+hex[3] : hex;
  const r = Math.min(255, Math.max(0, Math.round(parseInt(h.slice(1,3),16) * (100 + percent) / 100)));
  const g = Math.min(255, Math.max(0, Math.round(parseInt(h.slice(3,5),16) * (100 + percent) / 100)));
  const b = Math.min(255, Math.max(0, Math.round(parseInt(h.slice(5,7),16) * (100 + percent) / 100)));
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

// 主题颜色映射
const themeColorMap = {
  pink:   "#f8cbd0",
  blue:   "#a7c8f2",
  green:  "#b8d6a2",
  yellow: "#f7d26d",
  purple: "#c3b0e6",
  black:  "#333333"
};

/* ========== 应用按钮颜色 ========== */
function applyButtonColor(color) {
  const root = document.documentElement;
  root.style.setProperty('--topbar-color', color);
  root.style.setProperty('--btn-color', color);
  root.style.setProperty('--btn-hover', shadeColor(color, -12));
  root.style.setProperty('--btn-active', shadeColor(color, -22));
  
  // 保存到 localStorage
  localStorage.setItem('buttonColor', color);
  
  // 直接更新顶栏背景色
  const topbar = document.querySelector('.topbar');
  if (topbar) topbar.style.background = color;
}

// 重置按钮颜色（恢复到预设主题颜色）
function resetButtonColorLocal() {
  localStorage.removeItem('buttonColor');
  
  const themeName = localStorage.getItem('theme') || 'pink';
  const color = themeColorMap[themeName] || themeColorMap.pink;
  
  const root = document.documentElement;
  root.style.setProperty('--topbar-color', color);
  root.style.setProperty('--btn-color', color);
  root.style.setProperty('--btn-hover', shadeColor(color, -12));
  root.style.setProperty('--btn-active', shadeColor(color, -22));
  
  // 更新顶栏
  const topbar = document.querySelector('.topbar');
  if (topbar) topbar.style.background = color;
  
  // 更新颜色选择器显示
  document.querySelectorAll('.color-item').forEach(el => el.classList.remove('active'));
  const picker = document.getElementById('custom-color-picker');
  const hexInput = document.getElementById('custom-color-hex');
  if (picker) picker.value = color;
  if (hexInput) hexInput.value = color;
}

// 重置壁纸（恢复到预设主题壁纸）
function resetWallpaper() {
  localStorage.removeItem('customWallpaperId');
  localStorage.removeItem('customWallpaperURL');
  
  // 更新UI
  document.querySelectorAll('.wp-saved-item').forEach(el => el.classList.remove('active'));
  
  // 标记当前主题为活跃
  const currentTheme = localStorage.getItem('theme') || 'pink';
  document.querySelectorAll('.theme-item').forEach(el => {
    if (el.dataset.theme === currentTheme) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

// 应用自定义CSS（仅当启用时）
function applyCustomCSS(css) {
  let styleEl = document.getElementById('custom-user-css');
  if (styleEl) styleEl.remove();
  
  if (css && css.trim()) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-user-css';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }
  
  ensureWallpaperPriorityLocal();
}

// 本地确保壁纸优先级
function ensureWallpaperPriorityLocal() {
  const customWpId = localStorage.getItem('customWallpaperId');
  if (!customWpId) return;
  
  let protectStyle = document.getElementById('wallpaper-protect-css');
  if (!protectStyle) {
    protectStyle = document.createElement('style');
    protectStyle.id = 'wallpaper-protect-css';
    document.head.appendChild(protectStyle);
  }
  
  protectStyle.textContent = `
    body {
      background-size: cover !important;
      background-position: center !important;
      background-attachment: fixed !important;
    }
  `;
}


/* ========== 渲染已保存的壁纸列表 ========== */
async function renderSavedWallpapers() {
  const listEl = document.getElementById('wp-saved-list');
  const emptyHint = document.getElementById('wp-empty-hint');
  if (!listEl) return;

  const wallpapers = await getAllWallpapers();
  const currentWpId = localStorage.getItem('customWallpaperId');

  listEl.innerHTML = '';

  if (wallpapers.length === 0) {
    if (emptyHint) emptyHint.style.display = 'block';
    return;
  }

  if (emptyHint) emptyHint.style.display = 'none';

  wallpapers.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  wallpapers.forEach(wp => {
    const div = document.createElement('div');
    div.className = 'wp-saved-item' + (currentWpId === wp.id ? ' active' : '');
    div.dataset.id = wp.id;

    const img = document.createElement('img');
    img.src = getWallpaperBlobURL(wp.id, wp.blob);
    img.alt = wp.name || '壁纸';

    const delBtn = document.createElement('button');
    delBtn.className = 'wp-delete';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('确定要删除这张壁纸吗？')) {
        await deleteWallpaperFromDB(wp.id);
        revokeWallpaperBlobURL(wp.id);
        if (localStorage.getItem('customWallpaperId') === wp.id) {
          localStorage.removeItem('customWallpaperId');
          localStorage.removeItem('customWallpaperURL');
        }
        renderSavedWallpapers();
      }
    });

    div.addEventListener('click', () => {
      const blobURL = getWallpaperBlobURL(wp.id, wp.blob);
      localStorage.setItem('customWallpaperId', wp.id);
      localStorage.removeItem('customWallpaperURL');
      document.querySelectorAll('.wp-saved-item').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      document.querySelectorAll('.theme-item').forEach(el => el.classList.remove('active'));
      alert('壁纸已设置！返回主页查看效果。');
    });

    div.appendChild(img);
    div.appendChild(delBtn);
    listEl.appendChild(div);
  });
}

/* ========== 图标自定义相关 ========== */
function getDefaultIcons() {
  const defaultMap = {
    'api': { name: 'API配置', emoji: '🎀' },
    'chat': { name: '聊天', emoji: '💬' },
    'music': { name: '音乐', emoji: '🎶' },
    'wallpaper': { name: '壁纸', emoji: '🎨' },
    'momo': { name: 'MoMo', emoji: '🌸' },
    'offline': { name: '线下', emoji: '🍀' },
    'terminal': { name: '终端', emoji: '🖥️' },
    'worldbook': { name: '世界书', emoji: '📚' },
    'diary': { name: '日记', emoji: '🗓' }
  };
  try {
    const layout = JSON.parse(localStorage.getItem('desktopAppsLayout') || '[]');
    if (layout.length > 0) {
      return layout.map(app => ({
        app: app.id,
        name: app.name || defaultMap[app.id]?.name || app.id,
        emoji: app.icon || defaultMap[app.id]?.emoji || '📱'
      }));
    }
  } catch (e) {}
  return Object.entries(defaultMap).map(([id, v]) => ({ app: id, name: v.name, emoji: v.emoji }));
}
const defaultIcons = getDefaultIcons();

let selectedIconApp = null;

async function renderIconGrid() {
  const gridEl = document.getElementById('icon-grid');
  if (!gridEl) return;
  
  gridEl.innerHTML = '';
  const customIcons = await getAllCustomIcons();
  const iconMap = {};
  customIcons.forEach(ic => { iconMap[ic.appName] = ic; });
  
  const iconStyle = localStorage.getItem('iconStyle') || 'cover';
  
  defaultIcons.forEach(icon => {
    const div = document.createElement('div');
    div.className = 'icon-edit-item';
    div.dataset.app = icon.app;
    
    const custom = iconMap[icon.app];
    let previewContent = '';
    
    if (custom && (custom.blob || custom.url)) {
      const src = custom.url || (custom.blob ? URL.createObjectURL(custom.blob) : '');
      previewContent = `<img src="${src}" style="object-fit: ${iconStyle === 'contain' ? 'contain' : 'cover'};" />`;
    } else {
      previewContent = icon.emoji;
    }
    
    div.innerHTML = `
      <div class="preview">${previewContent}</div>
      <div class="name">${icon.name}</div>
    `;
    
    div.addEventListener('click', () => {
      document.querySelectorAll('.icon-edit-item').forEach(el => el.style.borderColor = 'transparent');
      div.style.borderColor = 'var(--topbar-color, #f8cbd0)';
      selectedIconApp = icon.app;
      document.getElementById('icon-file-input').click();
    });
    
    gridEl.appendChild(div);
  });
}

async function handleIconUpload(file) {
  if (!selectedIconApp) return;
  
  try {
    await saveCustomIcon(selectedIconApp, file, null);
    localStorage.setItem('customIcons_' + selectedIconApp, 'blob');
    await renderIconGrid();
    alert('图标已更新！返回主页查看效果。');
  } catch (e) {
    console.error('保存图标失败:', e);
    alert('保存图标失败，请重试');
  }
}

async function applyIconURL() {
  const url = document.getElementById('icon-url-input')?.value.trim();
  if (!url) {
    alert('请输入图片URL');
    return;
  }
  if (!selectedIconApp) {
    alert('请先点击选择一个图标');
    return;
  }
  
  try {
    await saveCustomIcon(selectedIconApp, null, url);
    localStorage.setItem('customIcons_' + selectedIconApp, 'url:' + url);
    await renderIconGrid();
    alert('图标已更新！返回主页查看效果。');
  } catch (e) {
    console.error('保存图标失败:', e);
    alert('保存图标失败');
  }
}

async function resetAllIcons() {
  if (!confirm('确定要重置所有图标吗？')) return;
  
  for (const icon of defaultIcons) {
    await deleteCustomIcon(icon.app);
    localStorage.removeItem('customIcons_' + icon.app);
  }
  await renderIconGrid();
  alert('所有图标已重置！');
}

/* ========== 处理壁纸上传 ========== */
async function handleWallpaperUpload(file) {
  try {
    const id = uid();
    await saveWallpaperToDB(id, file, file.name);
    
    localStorage.setItem('customWallpaperId', id);
    localStorage.removeItem('customWallpaperURL');
    
    document.querySelectorAll('.theme-item').forEach(el => el.classList.remove('active'));
    
    await renderSavedWallpapers();
    alert('壁纸已保存！返回主页查看效果。');
    
  } catch (e) {
    console.error('保存壁纸失败:', e);
    alert('保存壁纸失败，请重试');
  }
}

/* ========== CSS预设管理 ========== */
const CSS_PRESETS_KEY = 'customCSSPresets';
const CSS_ENABLED_KEY = 'customCSSEnabled';
const ACTIVE_CSS_PRESET_KEY = 'activeCSSPresetId';

let cssPresets = [];
let editingPresetId = null;

function loadCSSPresets() {
  try {
    const saved = localStorage.getItem(CSS_PRESETS_KEY);
    if (saved) {
      cssPresets = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('加载CSS预设失败:', e);
    cssPresets = [];
  }
}

function saveCSSPresets() {
  localStorage.setItem(CSS_PRESETS_KEY, JSON.stringify(cssPresets));
}

function renderCSSPresetsList() {
  const listEl = document.getElementById('css-presets-list');
  if (!listEl) return;

  const activeId = localStorage.getItem(ACTIVE_CSS_PRESET_KEY);

  if (cssPresets.length === 0) {
    listEl.innerHTML = '<div class="no-presets">暂无保存的预设，点击「新建预设」创建</div>';
    return;
  }

  listEl.innerHTML = cssPresets.map(preset => `
    <div class="css-preset-card ${preset.id === activeId ? 'active' : ''}" data-id="${preset.id}">
      <div class="css-preset-card-info">
        <div class="css-preset-card-name">${escapeHtmlCSS(preset.name || '未命名预设')}</div>
        <div class="css-preset-card-preview">${escapeHtmlCSS(preset.css.substring(0, 50))}...</div>
      </div>
      <div class="css-preset-card-actions">
        <button class="btn-small" data-action="use" data-id="${preset.id}">
          ${preset.id === activeId ? '✓ 使用中' : '使用'}
        </button>
        <button class="btn-small btn-secondary" data-action="edit" data-id="${preset.id}">编辑</button>
        <button class="btn-small btn-delete" data-action="delete" data-id="${preset.id}">删除</button>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      
      if (action === 'use') {
        activateCSSPreset(id);
      } else if (action === 'edit') {
        startEditCSSPreset(id);
      } else if (action === 'delete') {
        deleteCSSPreset(id);
      }
    });
  });
}

function escapeHtmlCSS(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function activateCSSPreset(id) {
  const preset = cssPresets.find(p => p.id === id);
  if (!preset) return;

  localStorage.setItem(ACTIVE_CSS_PRESET_KEY, id);
  localStorage.setItem('customCSS', preset.css);
  
  if (localStorage.getItem(CSS_ENABLED_KEY) === 'true') {
    applyCustomCSS(preset.css);
  }
  
  renderCSSPresetsList();
}

function startEditCSSPreset(id) {
  const preset = cssPresets.find(p => p.id === id);
  if (!preset) return;

  editingPresetId = id;
  document.getElementById('css-preset-name').value = preset.name || '';
  document.getElementById('custom-css-input').value = preset.css || '';
  document.getElementById('css-editor-box').classList.add('active');
}

function startNewCSSPreset() {
  editingPresetId = null;
  document.getElementById('css-preset-name').value = '';
  document.getElementById('custom-css-input').value = '';
  document.getElementById('css-editor-box').classList.add('active');
}

function saveCurrentCSSPreset() {
  const name = document.getElementById('css-preset-name').value.trim();
  const css = document.getElementById('custom-css-input').value.trim();

  if (!name) {
    alert('请输入预设名称');
    return;
  }

  if (!css) {
    alert('请输入CSS代码');
    return;
  }

  let presetId;
  
  if (editingPresetId) {
    const idx = cssPresets.findIndex(p => p.id === editingPresetId);
    if (idx !== -1) {
      cssPresets[idx].name = name;
      cssPresets[idx].css = css;
      presetId = editingPresetId;
    }
  } else {
    presetId = uid();
    const newPreset = {
      id: presetId,
      name,
      css,
      createdAt: Date.now()
    };
    cssPresets.push(newPreset);
  }

  saveCSSPresets();
  
  localStorage.setItem(ACTIVE_CSS_PRESET_KEY, presetId);
  localStorage.setItem('customCSS', css);
  
  if (localStorage.getItem(CSS_ENABLED_KEY) === 'true') {
    applyCustomCSS(css);
  }
  
  renderCSSPresetsList();
  document.getElementById('css-editor-box').classList.remove('active');
  editingPresetId = null;
  
  alert('预设已保存！');
}

function deleteCSSPreset(id) {
  const preset = cssPresets.find(p => p.id === id);
  if (!preset) return;

  if (!confirm(`确定要删除预设「${preset.name || '未命名'}」吗？`)) {
    return;
  }

  cssPresets = cssPresets.filter(p => p.id !== id);
  saveCSSPresets();

  if (localStorage.getItem(ACTIVE_CSS_PRESET_KEY) === id) {
    localStorage.removeItem(ACTIVE_CSS_PRESET_KEY);
    localStorage.removeItem('customCSS');
    
    if (localStorage.getItem(CSS_ENABLED_KEY) === 'true') {
      applyCustomCSS('');
    }
  }

  renderCSSPresetsList();
}

function cancelCSSEdit() {
  document.getElementById('css-editor-box').classList.remove('active');
  editingPresetId = null;
}

function updateCSSToggleStatus() {
  const enabled = localStorage.getItem(CSS_ENABLED_KEY) === 'true';
  const toggle = document.getElementById('css-enabled-toggle');
  const status = document.getElementById('css-toggle-status');
  
  if (toggle) toggle.checked = enabled;
  if (status) {
    status.textContent = enabled ? '已启用' : '已禁用';
    status.className = 'css-toggle-status' + (enabled ? ' enabled' : '');
  }
}

function toggleCSSEnabled(enabled) {
  localStorage.setItem(CSS_ENABLED_KEY, enabled ? 'true' : 'false');
  updateCSSToggleStatus();
  
  if (enabled) {
    const css = localStorage.getItem('customCSS') || '';
    applyCustomCSS(css);
  } else {
    applyCustomCSS('');
    const protectStyle = document.getElementById('wallpaper-protect-css');
    if (protectStyle) protectStyle.remove();
  }
  
  const timestamp = Date.now().toString();
  localStorage.setItem('cssToggleSync', timestamp);
  setTimeout(() => {
    localStorage.removeItem('cssToggleSync');
  }, 100);
}

function initCSSModule() {
  if (localStorage.getItem(CSS_ENABLED_KEY) === null) {
    localStorage.setItem(CSS_ENABLED_KEY, 'false');
  }
  
  loadCSSPresets();
  renderCSSPresetsList();
  updateCSSToggleStatus();

  const toggle = document.getElementById('css-enabled-toggle');
  if (toggle) {
    toggle.addEventListener('change', () => {
      toggleCSSEnabled(toggle.checked);
    });
  }

  const newBtn = document.getElementById('new-css-preset');
  if (newBtn) {
    newBtn.addEventListener('click', startNewCSSPreset);
  }

  const saveBtn = document.getElementById('save-css-preset');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveCurrentCSSPreset);
  }

  const applyBtn = document.getElementById('apply-css');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const css = document.getElementById('custom-css-input').value;
      applyCustomCSS(css);
    });
  }

  const cancelBtn = document.getElementById('cancel-css-edit');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', cancelCSSEdit);
  }

  document.querySelectorAll('.css-preset-item').forEach(item => {
    item.addEventListener('click', () => {
      const css = item.dataset.css;
      const cssInput = document.getElementById('custom-css-input');
      if (cssInput) {
        if (!document.getElementById('css-editor-box').classList.contains('active')) {
          startNewCSSPreset();
        }
        const current = cssInput.value.trim();
        cssInput.value = current ? current + '\n' + css : css;
      }
    });
  });
}

/* ========== 初始化壁纸模块 ========== */
async function initWallpaperModule() {
  // 1) 加载已保存的按钮颜色
  const savedColor = localStorage.getItem('buttonColor');
  if (savedColor) {
    applyButtonColor(savedColor);
    document.querySelectorAll('.color-item').forEach(el => {
      if (el.dataset.color === savedColor) el.classList.add('active');
      else el.classList.remove('active');
    });
    const picker = document.getElementById('custom-color-picker');
    const hexInput = document.getElementById('custom-color-hex');
    if (picker) picker.value = savedColor;
    if (hexInput) hexInput.value = savedColor;
  }

  // 2) 渲染已保存壁纸列表
  await renderSavedWallpapers();
  
  // 3) 渲染图标自定义列表
  await renderIconGrid();

  // 4) 绑定标签页切换
  document.querySelectorAll('.wp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      document.querySelectorAll('.wp-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.wp-content').forEach(c => c.classList.remove('active'));
      const targetContent = document.getElementById('tab-' + targetTab);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // 5) 预设主题点击
  document.querySelectorAll('.theme-item').forEach(item => {
    item.addEventListener('click', () => {
      const theme = item.dataset.theme;
      if (!theme) return;
      
      // 清除自定义壁纸
      localStorage.removeItem('customWallpaperId');
      localStorage.removeItem('customWallpaperURL');
      // 清除自定义按钮颜色
      localStorage.removeItem('buttonColor');
      // 设置主题
      localStorage.setItem('theme', theme);
      
      // 立即应用主题颜色到当前页面
      const color = themeColorMap[theme] || themeColorMap.pink;
      const root = document.documentElement;
      root.style.setProperty('--topbar-color', color);
      root.style.setProperty('--btn-color', color);
      root.style.setProperty('--btn-hover', shadeColor(color, -12));
      root.style.setProperty('--btn-active', shadeColor(color, -22));
      
      // 直接更新顶栏背景色
      const topbar = document.querySelector('.topbar');
      if (topbar) topbar.style.background = color;
      
      // 更新UI状态
      document.querySelectorAll('.theme-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.wp-saved-item').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.color-item').forEach(el => el.classList.remove('active'));
      
      // 更新颜色选择器
      const picker = document.getElementById('custom-color-picker');
      const hexInput = document.getElementById('custom-color-hex');
      if (picker) picker.value = color;
      if (hexInput) hexInput.value = color;
      
      alert('主题已设置！返回主页查看效果。');
    });
  });

  // 6) 标记当前主题
  const currentTheme = localStorage.getItem('theme') || 'pink';
  const savedWpId = localStorage.getItem('customWallpaperId');
  const savedWpURL = localStorage.getItem('customWallpaperURL');
  if (!savedWpId && !savedWpURL) {
    document.querySelectorAll('.theme-item').forEach(el => {
      if (el.dataset.theme === currentTheme) el.classList.add('active');
    });
  }

  // 7) 上传区域事件
  const uploadArea = document.getElementById('wp-upload-area');
  const fileInput = document.getElementById('wp-file-input');

  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', async (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        await handleWallpaperUpload(file);
      }
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleWallpaperUpload(file);
        e.target.value = '';
      }
    });
  }
  
  // 8) URL壁纸应用
  const wpUrlApply = document.getElementById('wp-url-apply');
  if (wpUrlApply) {
    wpUrlApply.addEventListener('click', () => {
      const url = document.getElementById('wp-url-input')?.value.trim();
      if (!url) {
        alert('请输入图片URL');
        return;
      }
      localStorage.setItem('customWallpaperURL', url);
      localStorage.removeItem('customWallpaperId');
      document.querySelectorAll('.theme-item').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.wp-saved-item').forEach(el => el.classList.remove('active'));
      alert('URL壁纸已设置！返回主页查看效果。');
    });
  }

  // 9) 颜色选择器事件
  document.querySelectorAll('.color-item').forEach(item => {
    item.addEventListener('click', () => {
      const color = item.dataset.color;
      applyButtonColor(color);
      document.querySelectorAll('.color-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      const picker = document.getElementById('custom-color-picker');
      const hexInput = document.getElementById('custom-color-hex');
      if (picker) picker.value = color;
      if (hexInput) hexInput.value = color;
    });
  });

  // 10) 自定义颜色输入
  const colorPicker = document.getElementById('custom-color-picker');
  const colorHexInput = document.getElementById('custom-color-hex');
  const applyColorBtn = document.getElementById('apply-custom-color');

  if (colorPicker) {
    colorPicker.addEventListener('input', () => {
      if (colorHexInput) colorHexInput.value = colorPicker.value;
    });
  }

  if (colorHexInput) {
    colorHexInput.addEventListener('input', () => {
      let val = colorHexInput.value.trim();
      if (val && !val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-fA-F]{6}$/.test(val) && colorPicker) {
        colorPicker.value = val;
      }
    });
  }

  if (applyColorBtn) {
    applyColorBtn.addEventListener('click', () => {
      let color = colorHexInput ? colorHexInput.value.trim() : '';
      if (!color.startsWith('#')) color = '#' + color;
      if (/^#[0-9a-fA-F]{6}$/.test(color)) {
        applyButtonColor(color);
        document.querySelectorAll('.color-item').forEach(el => el.classList.remove('active'));
      } else {
        alert('请输入有效的颜色代码（如 #f8cbd0）');
      }
    });
  }

  // 11) 重置颜色按钮
  const resetColorBtn = document.getElementById('reset-color-btn');
  if (resetColorBtn) {
    resetColorBtn.addEventListener('click', () => {
      if (confirm('确定要重置按钮颜色吗？将恢复到当前预设主题的默认颜色。')) {
        resetButtonColorLocal();
        alert('按钮颜色已重置！');
      }
    });
  }

  // 12) 重置壁纸按钮
  const resetWallpaperBtn = document.getElementById('reset-wallpaper-btn');
  if (resetWallpaperBtn) {
    resetWallpaperBtn.addEventListener('click', () => {
      if (confirm('确定要重置壁纸吗？将恢复到当前预设主题的默认壁纸。')) {
        resetWallpaper();
        alert('壁纸已重置！返回主页查看效果。');
      }
    });
  }

  // 13) 图标自定义事件
  const iconFileInput = document.getElementById('icon-file-input');
  if (iconFileInput) {
    iconFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleIconUpload(file);
        e.target.value = '';
      }
    });
  }
  
  const iconUrlApply = document.getElementById('icon-url-apply');
  if (iconUrlApply) {
    iconUrlApply.addEventListener('click', applyIconURL);
  }
  
  const resetIconsBtn = document.getElementById('reset-all-icons');
  if (resetIconsBtn) {
    resetIconsBtn.addEventListener('click', resetAllIcons);
  }
  
  // 14) 图标样式选择
  document.querySelectorAll('.icon-style-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.icon-style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      localStorage.setItem('iconStyle', btn.dataset.style);
      renderIconGrid();
    });
  });
  
  const savedIconStyle = localStorage.getItem('iconStyle') || 'cover';
  document.querySelectorAll('.icon-style-btn').forEach(btn => {
    if (btn.dataset.style === savedIconStyle) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  // 15) 初始化CSS模块
  initCSSModule();
}

/* ========== 页面加载时初始化 ========== */
document.addEventListener('DOMContentLoaded', () => {
  initWallpaperModule();
});

  // 16) 初始化天气模块
  initWeatherModule();


/* ========== 天气设置模块 ========== */
function initWeatherModule() {
  // 天气总开关
  const weatherToggle = document.getElementById('weather-enabled-toggle');
  const weatherStatus = document.getElementById('weather-toggle-status');
  
  function updateWeatherToggleStatus() {
    const enabled = localStorage.getItem('weatherEnabled') !== 'false';
    if (weatherToggle) weatherToggle.checked = enabled;
    if (weatherStatus) {
      weatherStatus.textContent = enabled ? '已启用' : '已禁用';
      weatherStatus.className = 'weather-toggle-status' + (enabled ? ' enabled' : '');
    }
  }
  
  updateWeatherToggleStatus();
  
  if (weatherToggle) {
    weatherToggle.addEventListener('change', () => {
      const enabled = weatherToggle.checked;
      localStorage.setItem('weatherEnabled', enabled ? 'true' : 'false');
      updateWeatherToggleStatus();
    });
  }
  
  // 天气类型选择
  const weatherGrid = document.getElementById('weather-grid');
  const currentWeather = localStorage.getItem('weatherType') || 'sunny';
  
  document.querySelectorAll('.weather-item').forEach(item => {
    const weather = item.dataset.weather;
    if (weather === currentWeather) {
      item.classList.add('active');
    }
    
    item.addEventListener('click', () => {
      document.querySelectorAll('.weather-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      localStorage.setItem('weatherType', weather);
      
      // 如果天气是 none，自动关闭开关显示
      if (weather === 'none') {
        localStorage.setItem('weatherEnabled', 'false');
        updateWeatherToggleStatus();
      } else {
        // 选择其他天气时自动开启
        localStorage.setItem('weatherEnabled', 'true');
        updateWeatherToggleStatus();
      }
    });
  });
  
  // 性能模式
  const currentPerf = localStorage.getItem('weatherPerformance') || 'normal';
  document.querySelectorAll('.perf-btn').forEach(btn => {
    if (btn.dataset.perf === currentPerf) {
      btn.classList.add('active');
    }
    
    btn.addEventListener('click', () => {
      document.querySelectorAll('.perf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      localStorage.setItem('weatherPerformance', btn.dataset.perf);
    });
  });
  
  // 自动切换开关
  const autoToggle = document.getElementById('weather-auto-toggle');
  if (autoToggle) {
    autoToggle.checked = localStorage.getItem('weatherAutoSwitch') === 'true';
    
    autoToggle.addEventListener('change', () => {
      localStorage.setItem('weatherAutoSwitch', autoToggle.checked ? 'true' : 'false');
    });
  }
}
