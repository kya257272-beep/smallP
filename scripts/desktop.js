/* scripts/desktop.js - 多页桌面修复版（含href同步） */

window.addNewApp = function(appConfig) {
  const apps = JSON.parse(localStorage.getItem('desktopAppsLayout') || '[]');
  const newApp = {
    id: appConfig.id || 'app-' + Date.now(),
    name: appConfig.name || '新应用',
    icon: appConfig.icon || '📱',
    href: appConfig.href || '',
    page: appConfig.page ?? 0,
    position: apps.filter(a => a.page === (appConfig.page ?? 0)).length
  };
  apps.push(newApp);
  localStorage.setItem('desktopAppsLayout', JSON.stringify(apps));
  location.reload();
  return newApp;
};

window.resetDesktopLayout = function() {
  localStorage.removeItem('desktopAppsLayout');
  location.reload();
};

window.getDesktopLayout = function() {
  return JSON.parse(localStorage.getItem('desktopAppsLayout') || '[]');
};

(function() {
  'use strict';

  const APPS_CONFIG_FILE = 'apps.json';
  const STORAGE_KEY = 'desktopAppsLayout';
  const TOTAL_PAGES = 3;

  const themeColors = {
    pink:   { icon: "linear-gradient(135deg,#ff9a9e 0%,#fad0c4 100%)" },
    blue:   { icon: "linear-gradient(135deg,#9fd3ff 0%,#cfe9ff 100%)" },
    green:  { icon: "linear-gradient(135deg,#c6f6d5 0%,#eafde4 100%)" },
    yellow: { icon: "linear-gradient(135deg,#ffed9e 0%,#ffdcb0 100%)" },
    purple: { icon: "linear-gradient(135deg,#e7d9ff 0%,#f6efff 100%)" },
    black:  { icon: "linear-gradient(135deg,#ffffff 0%,#f0f0f0 100%)" }
  };

  let apps = [];
  let currentPage = 0;
  let isDragging = false;
  let dragApp = null;
  let dragGhost = null;
  let startX = 0, startY = 0;
  let swipeStartX = 0;
  let isSwiping = false;

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

  function getDefaultApps() {
    return [
      { id: 'api', name: 'API配置', icon: '🎀', href: 'api-config.html', page: 0, position: 0 },
      { id: 'chat', name: 'QQ', icon: '🐧', href: 'chat.html', page: 0, position: 1 },
      { id: 'wallpaper', name: '壁纸', icon: '🎨', href: 'wallpaper.html', page: 0, position: 2 },
      { id: 'music', name: '音乐', icon: '🎶', href: 'music.html', page: 0, position: 3 },
      { id: 'offline', name: '线下', icon: '🍀', href: 'offline-mode.html', page: 0, position: 4 },
      { id: 'momo', name: 'momo', icon: '🌸', href: 'momo.html', page: 0, position: 5 },
      { id: 'preset', name: '预设配置', icon: '📝', href: 'preset.html', page: 1, position: 0 },
      { id: 'worldbook', name: '世界书', icon: '📚', href: 'worldbook.html', page: 1, position: 1 },
      { id: 'diary', name: '日记', icon: '🗓', href: 'diary.html', page: 1, position: 2 }
    ];
  }

  function saveApps() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  }

  async function loadApps() {
    let configApps = [];
    let configVersion = 0;
    try {
      const response = await fetch(APPS_CONFIG_FILE + '?t=' + Date.now());
      if (response.ok) {
        const config = await response.json();
        configApps = config.apps || [];
        configVersion = parseInt(config.layoutVersion) || 0;
      }
    } catch (e) {
      configApps = getDefaultApps();
    }
    if (configApps.length === 0) configApps = getDefaultApps();

    // Check layout version - force re-layout if apps.json version is newer
    const savedVersion = parseInt(localStorage.getItem('desktopLayoutVersion') || '0');
    const forceRelayout = configVersion > savedVersion;
    if (forceRelayout) {
      localStorage.setItem('desktopLayoutVersion', String(configVersion));
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    let savedApps = [];
    if (saved) {
      try { savedApps = JSON.parse(saved); } catch (e) {}
    }

    if (savedApps.length > 0) {
      // Force re-layout from config when version bumped
      if (forceRelayout) {
        apps = configApps;
        saveApps();
        return;
      }

      const savedIds = new Set(savedApps.map(a => a.id));
      
      // 【关键修复】同步已有应用的 href、name、icon（从 apps.json 更新到本地缓存）
      savedApps.forEach(savedApp => {
        const configApp = configApps.find(c => c.id === savedApp.id);
        if (configApp) {
          // 如果 apps.json 中有 href 而本地缓存没有或为空，则更新
          if (configApp.href && !savedApp.href) {
            savedApp.href = configApp.href;
          }
          // 也可以同步其他字段（可选）
          if (configApp.name && savedApp.name !== configApp.name) {
            savedApp.name = configApp.name;
          }
          if (configApp.icon && savedApp.icon !== configApp.icon) {
            savedApp.icon = configApp.icon;
          }
        }
      });
      
      // 添加新应用（apps.json 中有但本地缓存没有的）
      configApps.filter(app => !savedIds.has(app.id)).forEach(app => savedApps.push(app));
      apps = savedApps;
    } else {
      apps = configApps;
    }
    
    // 确保 page 是数字
    apps.forEach(app => {
      app.page = parseInt(app.page) || 0;
      app.position = parseInt(app.position) || 0;
    });
    
    saveApps();
  }

  function applyCurrentTheme() {
    const customBtnColor = localStorage.getItem('buttonColor');
    const theme = localStorage.getItem('theme') || 'pink';
    const t = themeColors[theme] || themeColors.pink;
    
    document.querySelectorAll('.icon-wrapper').forEach(el => {
      if (customBtnColor) {
        el.style.background = `linear-gradient(135deg, ${customBtnColor} 0%, ${shadeColor(customBtnColor, 25)} 100%)`;
      } else {
        el.style.background = t.icon;
      }
    });
    
    if (typeof window.loadCustomIcons === 'function') window.loadCustomIcons();
  }
  window.applyCurrentTheme = applyCurrentTheme;

  function renderAllPages() {
    for (let p = 0; p < TOTAL_PAGES; p++) renderPage(p);
  }

  function renderPage(pageIndex) {
    const grid = document.getElementById('app-grid-' + pageIndex);
    if (!grid) return;
    grid.innerHTML = '';
    
    const pageApps = apps.filter(app => app.page === pageIndex).sort((a, b) => a.position - b.position);
    pageApps.forEach(app => grid.appendChild(createAppIcon(app)));
  }

  function createAppIcon(app) {
    const div = document.createElement('div');
    div.className = 'app-icon';
    div.dataset.app = app.id;
    div.dataset.page = app.page;
    div.dataset.position = app.position;
    if (app.href) div.dataset.href = app.href;
    
    div.innerHTML = `
      <span class="delete-btn">×</span>
      <div class="icon-wrapper"><span class="main-icon">${app.icon}</span></div>
      <div class="app-name">${app.name}</div>
    `;
    
    div.addEventListener('click', (e) => {
      if (isDragging || document.body.classList.contains('edit-mode')) return;
      if (e.target.classList.contains('delete-btn')) return;
      if (app.href) window.location.href = app.href;
      else openGenericModal(app.name);
    });
    
    div.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('确定删除「' + app.name + '」吗？')) {
        apps = apps.filter(a => a.id !== app.id);
        saveApps();
        renderAllPages();
        applyCurrentTheme();
      }
    });
    
    bindDragEvents(div, app);
    
    let timer = null;
    div.addEventListener('pointerdown', () => { timer = setTimeout(() => document.body.classList.add('edit-mode'), 600); });
    div.addEventListener('pointerup', () => clearTimeout(timer));
    div.addEventListener('pointercancel', () => clearTimeout(timer));
    div.addEventListener('pointermove', () => clearTimeout(timer));
    
    return div;
  }

  function openGenericModal(name) {
    const title = document.getElementById('generic-title');
    const body = document.getElementById('generic-body');
    if (title) title.textContent = name;
    if (body) body.textContent = name + ' 的占位内容';
    const modal = document.getElementById('app-generic');
    if (modal) { modal.classList.add('active'); modal.setAttribute('aria-hidden', 'false'); }
  }

  function bindDragEvents(el, app) {
    let dragStarted = false, pointerId = null;
    
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      pointerId = e.pointerId;
      try { el.setPointerCapture(pointerId); } catch(err) {}
      startX = e.clientX; startY = e.clientY;
      dragStarted = false;
    });
    
    el.addEventListener('pointermove', (e) => {
      if (pointerId === null) return;
      if (!dragStarted && (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10)) {
        dragStarted = true;
        startDrag(el, app, e);
      }
      if (isDragging) moveDrag(e);
    });
    
    el.addEventListener('pointerup', (e) => {
      if (pointerId !== null) { try { el.releasePointerCapture(pointerId); } catch(err) {} pointerId = null; }
      if (isDragging) endDrag(e);
      dragStarted = false;
    });
    
    el.addEventListener('pointercancel', () => {
      if (pointerId !== null) { try { el.releasePointerCapture(pointerId); } catch(err) {} pointerId = null; }
      cancelDrag(); dragStarted = false;
    });
  }

  function startDrag(el, app, e) {
    isDragging = true;
    dragApp = app;
    el.classList.add('dragging');
    document.body.classList.add('edit-mode');
    
    if (dragGhost) {
      dragGhost.innerHTML = el.innerHTML;
      const delBtn = dragGhost.querySelector('.delete-btn');
      if (delBtn) delBtn.remove();
      dragGhost.classList.add('active');
      const iconWrapper = el.querySelector('.icon-wrapper');
      const ghostWrapper = dragGhost.querySelector('.icon-wrapper');
      if (iconWrapper && ghostWrapper) ghostWrapper.style.background = getComputedStyle(iconWrapper).background;
    }
    moveDrag(e);
  }

  let pageChangeTimeout = null;
  function moveDrag(e) {
    if (!dragGhost) return;
    dragGhost.style.left = e.clientX + 'px';
    dragGhost.style.top = e.clientY + 'px';
    
    // 边缘切换页面（加防抖）
    const threshold = 60;
    if (e.clientX < threshold && currentPage > 0) {
      if (!pageChangeTimeout) {
        pageChangeTimeout = setTimeout(() => { goToPage(currentPage - 1); pageChangeTimeout = null; }, 300);
      }
    } else if (e.clientX > window.innerWidth - threshold && currentPage < TOTAL_PAGES - 1) {
      if (!pageChangeTimeout) {
        pageChangeTimeout = setTimeout(() => { goToPage(currentPage + 1); pageChangeTimeout = null; }, 300);
      }
    } else {
      if (pageChangeTimeout) { clearTimeout(pageChangeTimeout); pageChangeTimeout = null; }
    }
    
    highlightDropTarget(e);
  }

  function highlightDropTarget(e) {
    document.querySelectorAll('.app-icon.drop-target').forEach(el => el.classList.remove('drop-target'));
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const appIcon = target ? target.closest('.app-icon') : null;
    if (appIcon && dragApp && appIcon.dataset.app !== dragApp.id) appIcon.classList.add('drop-target');
  }

  function endDrag(e) {
    if (pageChangeTimeout) { clearTimeout(pageChangeTimeout); pageChangeTimeout = null; }
    
    if (!isDragging || !dragApp) { cancelDrag(); return; }
    
    // 🔑 关键：使用当前页面作为目标
    const targetPageIndex = currentPage;
    
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const targetIcon = target ? target.closest('.app-icon') : null;
    
    if (targetIcon && targetIcon.dataset.app !== dragApp.id) {
      const targetApp = apps.find(a => a.id === targetIcon.dataset.app);
      if (targetApp) swapApps(dragApp, targetApp);
    } else {
      // 移动到当前页面末尾
      moveAppToPage(dragApp, targetPageIndex);
    }
    
    cancelDrag();
    saveApps();
    renderAllPages();
    applyCurrentTheme();
    goToPage(targetPageIndex);
  }

  function swapApps(app1, app2) {
    const t1 = { page: app1.page, position: app1.position };
    app1.page = app2.page; app1.position = app2.position;
    app2.page = t1.page; app2.position = t1.position;
  }

  function moveAppToPage(app, pageIndex) {
    const pageApps = apps.filter(a => a.page === pageIndex && a.id !== app.id);
    app.page = pageIndex;
    app.position = pageApps.length;
  }

  function cancelDrag() {
    isDragging = false; dragApp = null;
    document.querySelectorAll('.app-icon.dragging, .app-icon.drop-target').forEach(el => {
      el.classList.remove('dragging', 'drop-target');
    });
    if (dragGhost) { dragGhost.classList.remove('active'); dragGhost.innerHTML = ''; }
  }

  function bindPageSwipe() {
    const wrapper = document.getElementById('pages-wrapper');
    if (!wrapper) return;
    
    wrapper.addEventListener('touchstart', (e) => { if (!isDragging) { swipeStartX = e.touches[0].clientX; isSwiping = true; } }, { passive: true });
    wrapper.addEventListener('touchend', (e) => {
      if (!isSwiping || isDragging) return;
      isSwiping = false;
      const diff = swipeStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentPage < TOTAL_PAGES - 1) goToPage(currentPage + 1);
        else if (diff < 0 && currentPage > 0) goToPage(currentPage - 1);
      }
    });
    
    let mouseDown = false, mouseStartX = 0;
    wrapper.addEventListener('mousedown', (e) => { if (!isDragging) { mouseDown = true; mouseStartX = e.clientX; } });
    wrapper.addEventListener('mouseup', (e) => {
      if (!mouseDown || isDragging) return;
      mouseDown = false;
      const diff = mouseStartX - e.clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentPage < TOTAL_PAGES - 1) goToPage(currentPage + 1);
        else if (diff < 0 && currentPage > 0) goToPage(currentPage - 1);
      }
    });
    wrapper.addEventListener('mouseleave', () => { mouseDown = false; });
  }

  function goToPage(index) {
    if (index < 0 || index >= TOTAL_PAGES) return;
    currentPage = index;
    const wrapper = document.getElementById('pages-wrapper');
    if (wrapper) wrapper.style.transform = 'translateX(-' + (currentPage * 100) + '%)';
    document.querySelectorAll('.indicator').forEach((ind, i) => ind.classList.toggle('active', i === currentPage));
  }

  function bindIndicators() {
    document.querySelectorAll('.indicator').forEach((ind, i) => ind.addEventListener('click', () => goToPage(i)));
  }

  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('edit-mode') && !e.target.closest('.app-icon') && !e.target.closest('.delete-btn')) {
      document.body.classList.remove('edit-mode');
    }
  });

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === 'theme' || e.key === 'buttonColor') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) try { apps = JSON.parse(saved); } catch(err) {}
      renderAllPages();
      applyCurrentTheme();
    }
  });

  async function init() {
    dragGhost = document.getElementById('drag-ghost');
    await loadApps();
    renderAllPages();
    bindPageSwipe();
    bindIndicators();
    applyCurrentTheme();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
