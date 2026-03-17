/* scripts/preset.js - 预设配置模块（仿SillyTavern单选预设系统） */

// ========== 常量 ==========
const PRESET_STORAGE_KEY = 'presetConfigs';
const ACTIVE_PRESET_KEY = 'activePresetId';

// ========== 主题颜色表 ==========
const themeColors = {
  pink:   { topbar: "#f8cbd0" },
  blue:   { topbar: "#a7c8f2" },
  green:  { topbar: "#b8d6a2" },
  yellow: { topbar: "#f7d26d" },
  purple: { topbar: "#c3b0e6" },
  black:  { topbar: "#333333" }
};

// ========== 数据存储 ==========
function getAllPresets() {
  try {
    const data = localStorage.getItem(PRESET_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('读取预设失败:', e);
    return [];
  }
}

function saveAllPresets(presets) {
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn('保存预设失败:', e);
  }
}

function getActivePresetId() {
  return localStorage.getItem(ACTIVE_PRESET_KEY) || null;
}

function setActivePresetId(id) {
  if (id) {
    localStorage.setItem(ACTIVE_PRESET_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_PRESET_KEY);
  }
}

function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ========== 状态管理 ==========
let currentEditingPreset = null;
let currentEditingEntry = null;
let draggedEntry = null;

// ========== 工具函数 ==========
function shadeColor(color, percent) {
  if (!color || color[0] !== '#') return color;
  let hex = color;
  if (hex.length === 4) {
    hex = '#' + hex[1]+hex[1] + hex[2]+hex[2] + hex[3]+hex[3];
  }
  let R = parseInt(hex.substring(1,3), 16);
  let G = parseInt(hex.substring(3,5), 16);
  let B = parseInt(hex.substring(5,7), 16);
  R = Math.min(255, Math.max(0, Math.round(R * (100 + percent) / 100)));
  G = Math.min(255, Math.max(0, Math.round(G * (100 + percent) / 100)));
  B = Math.min(255, Math.max(0, Math.round(B * (100 + percent) / 100)));
  return "#" + [R, G, B].map(v => v.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ========== 主题应用 ==========
function applyTheme(themeName) {
  const t = themeColors[themeName] || themeColors.pink;
  const customBtnColor = localStorage.getItem('buttonColor');
  const color = customBtnColor || t.topbar;

  const root = document.documentElement;
  root.style.setProperty('--topbar-color', color);
  root.style.setProperty('--btn-color', color);
  root.style.setProperty('--btn-hover', shadeColor(color, -15));
  root.style.setProperty('--btn-active', shadeColor(color, -25));

  const topbar = document.querySelector('.preset-topbar');
  if (topbar) topbar.style.background = color;
}

function loadCustomButtonColor() {
  const savedColor = localStorage.getItem('buttonColor');
  if (savedColor) {
    const root = document.documentElement;
    root.style.setProperty('--topbar-color', savedColor);
    root.style.setProperty('--btn-color', savedColor);
    root.style.setProperty('--btn-hover', shadeColor(savedColor, -15));
    root.style.setProperty('--btn-active', shadeColor(savedColor, -25));
    
    const topbar = document.querySelector('.preset-topbar');
    if (topbar) topbar.style.background = savedColor;
  }
}

function loadCustomCSS() {
  let styleEl = document.getElementById('custom-user-css');
  if (styleEl) styleEl.remove();
  
  const enabled = localStorage.getItem('customCSSEnabled');
  if (enabled !== 'true') return;
  
  const savedCSS = localStorage.getItem('customCSS');
  if (savedCSS && savedCSS.trim()) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-user-css';
    styleEl.textContent = savedCSS;
    document.head.appendChild(styleEl);
  }
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'pink';
  applyTheme(savedTheme);
  loadCustomButtonColor();
  loadCustomCSS();
  
  renderPresetList();
  updateActivePresetHint();
  bindEvents();
});

// ========== 更新激活预设提示 ==========
function updateActivePresetHint() {
  const activeId = getActivePresetId();
  const presets = getAllPresets();
  const activePreset = presets.find(p => p.id === activeId);
  
  const nameEl = document.getElementById('activePresetName');
  if (nameEl) {
    nameEl.textContent = activePreset ? activePreset.name : '无';
  }
}

// ========== 渲染预设列表（单选模式） ==========
function renderPresetList() {
  const presets = getAllPresets();
  const activeId = getActivePresetId();
  const listEl = document.getElementById('presetList');
  const emptyHint = document.getElementById('emptyHint');
  
  if (presets.length === 0) {
    emptyHint.style.display = 'block';
    listEl.innerHTML = '';
    listEl.appendChild(emptyHint);
    return;
  }
  
  emptyHint.style.display = 'none';
  
  const html = presets.map(preset => {
    const isActive = preset.id === activeId;
    const enabledCount = preset.entries.filter(e => e.enabled).length;
    const totalCount = preset.entries.length;
    
    // 按顺序显示条目标签
    const sortedEntries = [...preset.entries].sort((a, b) => (a.order || 0) - (b.order || 0));
    const entryTags = sortedEntries.slice(0, 4).map(entry => `
      <span class="entry-tag ${entry.enabled ? '' : 'disabled'}">
        <span class="entry-role">${getRoleIcon(entry.role)}</span>
        ${escapeHtml(entry.name)}
        <span class="entry-depth">${entry.depth}</span>
      </span>
    `).join('');
    
    const moreTag = preset.entries.length > 4 
      ? `<span class="entry-tag">+${preset.entries.length - 4}...</span>` 
      : '';
    
    return `
      <div class="preset-card ${isActive ? 'active' : ''}" data-preset-id="${preset.id}">
        <div class="preset-card-header">
          <div class="preset-info" data-action="select">
            <div class="preset-name">${escapeHtml(preset.name || '未命名预设')}</div>
            <div class="preset-meta">${enabledCount}/${totalCount} 条目已启用</div>
          </div>
          <button class="preset-edit-btn" data-action="edit">✎</button>
        </div>
        ${preset.entries.length > 0 ? `
          <div class="entries-preview" data-action="select">
            ${entryTags}${moreTag}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  listEl.innerHTML = html;
  listEl.appendChild(emptyHint);
  emptyHint.style.display = 'none';
}

function getRoleIcon(role) {
  switch(role) {
    case 'user': return '👤';
    case 'assistant': return '🤖';
    default: return '⚙️';
  }
}

// ========== 事件绑定 ==========
function bindEvents() {
  // 返回按钮
  document.getElementById('back-btn').addEventListener('click', () => {
    if (window.ShellMusic && window.ShellMusic.isInShell()) {
      window.ShellMusic.navigate('index.html');
    } else {
      window.location.href = 'index.html';
    }
  });
  
  // 新建预设
  document.getElementById('addPresetBtn').addEventListener('click', () => {
    openPresetModal(null);
  });
  
  // 导出全部
  document.getElementById('exportAllBtn').addEventListener('click', () => {
    exportAllPresets();
  });
  
  // 预设列表点击（事件委托）
  document.getElementById('presetList').addEventListener('click', (e) => {
    const card = e.target.closest('.preset-card');
    if (!card) return;
    
    const presetId = card.dataset.presetId;
    const action = e.target.closest('[data-action]')?.dataset.action;
    
    if (action === 'edit') {
      const presets = getAllPresets();
      const preset = presets.find(p => p.id === presetId);
      if (preset) openPresetModal(preset);
    } else {
      // 点击卡片其他区域：选中/切换预设
      selectPreset(presetId);
    }
  });
  
  // 预设弹窗
  document.getElementById('closePresetModal').addEventListener('click', closePresetModal);
  document.getElementById('presetModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closePresetModal();
  });
  
  document.getElementById('addEntryBtn').addEventListener('click', () => openEntryModal(null));
  document.getElementById('savePresetBtn').addEventListener('click', saveCurrentPreset);
  document.getElementById('deletePresetBtn').addEventListener('click', deleteCurrentPreset);
  document.getElementById('exportPresetBtn').addEventListener('click', exportCurrentPreset);
  
  // 条目弹窗
  document.getElementById('closeEntryModal').addEventListener('click', closeEntryModal);
  document.getElementById('entryModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeEntryModal();
  });
  
  // 角色选择
  document.getElementById('roleSelector').addEventListener('click', (e) => {
    const btn = e.target.closest('.role-btn');
    if (!btn) return;
    document.querySelectorAll('#roleSelector .role-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
  
  document.getElementById('depthMinus').addEventListener('click', () => {
    const input = document.getElementById('entryDepth');
    input.value = Math.max(0, parseInt(input.value) - 1);
  });
  document.getElementById('depthPlus').addEventListener('click', () => {
    const input = document.getElementById('entryDepth');
    input.value = Math.min(999, parseInt(input.value) + 1);
  });
  
  document.getElementById('saveEntryBtn').addEventListener('click', saveCurrentEntry);
  document.getElementById('deleteEntryBtn').addEventListener('click', deleteCurrentEntry);
  
  // 导出弹窗
  document.getElementById('closeExportModal').addEventListener('click', closeExportModal);
  document.getElementById('exportModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeExportModal();
  });
  document.getElementById('copyExportBtn').addEventListener('click', copyExportContent);
  document.getElementById('downloadExportBtn').addEventListener('click', downloadExportFile);
}

// ========== 预设操作（单选模式） ==========
function selectPreset(presetId) {
  const activeId = getActivePresetId();
  
  // 点击已激活的预设则取消激活
  if (activeId === presetId) {
    setActivePresetId(null);
    showToast('已取消激活预设');
  } else {
    setActivePresetId(presetId);
    const presets = getAllPresets();
    const preset = presets.find(p => p.id === presetId);
    showToast(`已激活: ${preset?.name || '预设'}`);
  }
  
  renderPresetList();
  updateActivePresetHint();
}

function openPresetModal(preset) {
  if (preset) {
    currentEditingPreset = JSON.parse(JSON.stringify(preset));
  } else {
    currentEditingPreset = {
      id: generateId(),
      name: '',
      entries: []
    };
  }
  
  document.getElementById('presetNameInput').value = currentEditingPreset.name;
  document.getElementById('deletePresetBtn').style.display = preset ? 'block' : 'none';
  document.getElementById('exportPresetBtn').style.display = preset ? 'block' : 'none';
  
  renderEntriesList();
  document.getElementById('presetModal').classList.add('active');
}

function closePresetModal() {
  document.getElementById('presetModal').classList.remove('active');
  currentEditingPreset = null;
}

function saveCurrentPreset() {
  if (!currentEditingPreset) return;
  
  const name = document.getElementById('presetNameInput').value.trim();
  if (!name) {
    showToast('请输入预设名称');
    return;
  }
  
  currentEditingPreset.name = name;
  
  const presets = getAllPresets();
  const existingIndex = presets.findIndex(p => p.id === currentEditingPreset.id);
  
  if (existingIndex >= 0) {
    presets[existingIndex] = currentEditingPreset;
  } else {
    presets.push(currentEditingPreset);
  }
  
  saveAllPresets(presets);
  renderPresetList();
  updateActivePresetHint();
  closePresetModal();
  showToast('预设已保存');
}

function deleteCurrentPreset() {
  if (!currentEditingPreset) return;
  if (!confirm('确定要删除这个预设吗？')) return;
  
  const presets = getAllPresets();
  const newPresets = presets.filter(p => p.id !== currentEditingPreset.id);
  saveAllPresets(newPresets);
  
  // 如果删除的是当前激活的预设，清除激活状态
  if (getActivePresetId() === currentEditingPreset.id) {
    setActivePresetId(null);
  }
  
  renderPresetList();
  updateActivePresetHint();
  closePresetModal();
  showToast('预设已删除');
}

// ========== 导出功能（只导出不导入） ==========
let exportData = null;
let exportFileName = '';

function exportCurrentPreset() {
  if (!currentEditingPreset) return;
  
  exportData = JSON.stringify([currentEditingPreset], null, 2);
  exportFileName = `preset_${currentEditingPreset.name || 'export'}_${Date.now()}.json`;
  
  document.getElementById('exportContent').value = exportData;
  document.getElementById('exportModal').classList.add('active');
}

function exportAllPresets() {
  const presets = getAllPresets();
  if (presets.length === 0) {
    showToast('暂无预设可导出');
    return;
  }
  
  exportData = JSON.stringify(presets, null, 2);
  exportFileName = `all_presets_${Date.now()}.json`;
  
  document.getElementById('exportContent').value = exportData;
  document.getElementById('exportModal').classList.add('active');
}

function closeExportModal() {
  document.getElementById('exportModal').classList.remove('active');
  exportData = null;
  exportFileName = '';
}

function copyExportContent() {
  const content = document.getElementById('exportContent').value;
  navigator.clipboard.writeText(content).then(() => {
    showToast('已复制到剪贴板');
  }).catch(() => {
    // 降级方案
    const textarea = document.getElementById('exportContent');
    textarea.select();
    document.execCommand('copy');
    showToast('已复制到剪贴板');
  });
}

function downloadExportFile() {
  if (!exportData) return;
  
  const blob = new Blob([exportData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('文件已下载');
}

// ========== 条目列表渲染（含拖拽） ==========
function renderEntriesList() {
  if (!currentEditingPreset) return;
  
  const listEl = document.getElementById('entriesList');
  
  if (currentEditingPreset.entries.length === 0) {
    listEl.innerHTML = '<div class="entries-empty">暂无条目，点击上方按钮添加</div>';
    return;
  }
  
  // 按order排序
  const sortedEntries = [...currentEditingPreset.entries].sort((a, b) => (a.order || 0) - (b.order || 0));
  
  const html = sortedEntries.map((entry, index) => `
    <div class="entry-item" data-entry-id="${entry.id}" data-index="${index}" draggable="true">
      <div class="drag-handle" title="拖拽排序">⋮⋮</div>
      <div class="entry-toggle ${entry.enabled ? 'active' : ''}" data-action="toggle-entry"></div>
      <div class="entry-info" data-action="edit-entry">
        <div class="entry-header">
          <div class="entry-name">${escapeHtml(entry.name || '未命名条目')}</div>
          <span class="entry-role-badge ${entry.role || 'system'}">${entry.role || 'system'}</span>
        </div>
        <div class="entry-preview">${escapeHtml(entry.content.substring(0, 50))}${entry.content.length > 50 ? '...' : ''}</div>
      </div>
      <div class="entry-depth-badge" title="深度">D:${entry.depth}</div>
    </div>
  `).join('');
  
  listEl.innerHTML = html;
  
  // 绑定点击事件
  listEl.querySelectorAll('.entry-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const entryId = item.dataset.entryId;
      const action = e.target.closest('[data-action]')?.dataset.action;
      
      if (action === 'toggle-entry') {
        toggleEntry(entryId);
      } else if (action === 'edit-entry' || (!action && !e.target.classList.contains('drag-handle'))) {
        const entry = currentEditingPreset.entries.find(en => en.id === entryId);
        if (entry) openEntryModal(entry);
      }
    });
  });
  
  // 绑定拖拽事件
  setupDragAndDrop(listEl);
}

// ========== 拖拽排序 ==========
function setupDragAndDrop(listEl) {
  const items = listEl.querySelectorAll('.entry-item');
  
  items.forEach(item => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleDragEnd);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('dragleave', handleDragLeave);
    item.addEventListener('drop', handleDrop);
    
    item.addEventListener('touchstart', handleTouchStart, { passive: false });
    item.addEventListener('touchmove', handleTouchMove, { passive: false });
    item.addEventListener('touchend', handleTouchEnd);
  });
}

function handleDragStart(e) {
  draggedEntry = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.entryId);
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.entry-item').forEach(item => {
    item.classList.remove('drag-over', 'drag-over-bottom');
  });
  draggedEntry = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  if (this === draggedEntry) return;
  
  const rect = this.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  
  this.classList.remove('drag-over', 'drag-over-bottom');
  if (e.clientY < midY) {
    this.classList.add('drag-over');
  } else {
    this.classList.add('drag-over-bottom');
  }
}

function handleDragLeave(e) {
  this.classList.remove('drag-over', 'drag-over-bottom');
}

function handleDrop(e) {
  e.preventDefault();
  
  if (this === draggedEntry) return;
  
  const draggedId = e.dataTransfer.getData('text/plain');
  const targetId = this.dataset.entryId;
  
  reorderEntries(draggedId, targetId, this.classList.contains('drag-over-bottom'));
  
  this.classList.remove('drag-over', 'drag-over-bottom');
}

// 触摸拖拽支持
let touchStartY = 0;
let touchStartItem = null;
let touchMoved = false;
let touchTimeout = null;

function handleTouchStart(e) {
  if (e.target.classList.contains('drag-handle')) {
    touchStartItem = this;
    touchStartY = e.touches[0].clientY;
    touchMoved = false;
    
    touchTimeout = setTimeout(() => {
      if (touchStartItem === this) {
        this.classList.add('dragging');
      }
    }, 150);
  }
}

function handleTouchMove(e) {
  if (!touchStartItem || touchStartItem !== this) return;
  
  touchMoved = true;
  e.preventDefault();
  
  const touch = e.touches[0];
  const items = document.querySelectorAll('.entry-item');
  
  items.forEach(item => {
    item.classList.remove('drag-over', 'drag-over-bottom');
    
    if (item === this) return;
    
    const rect = item.getBoundingClientRect();
    if (touch.clientY > rect.top && touch.clientY < rect.bottom) {
      const midY = rect.top + rect.height / 2;
      if (touch.clientY < midY) {
        item.classList.add('drag-over');
      } else {
        item.classList.add('drag-over-bottom');
      }
    }
  });
}

function handleTouchEnd(e) {
  if (touchTimeout) {
    clearTimeout(touchTimeout);
    touchTimeout = null;
  }
  
  if (!touchStartItem || touchStartItem !== this) return;
  
  this.classList.remove('dragging');
  
  if (touchMoved) {
    const items = document.querySelectorAll('.entry-item');
    items.forEach(item => {
      if (item.classList.contains('drag-over') || item.classList.contains('drag-over-bottom')) {
        const draggedId = this.dataset.entryId;
        const targetId = item.dataset.entryId;
        reorderEntries(draggedId, targetId, item.classList.contains('drag-over-bottom'));
      }
      item.classList.remove('drag-over', 'drag-over-bottom');
    });
  }
  
  touchStartItem = null;
  touchMoved = false;
}

function reorderEntries(draggedId, targetId, insertAfter) {
  if (!currentEditingPreset) return;
  
  const entries = currentEditingPreset.entries;
  const draggedIndex = entries.findIndex(e => e.id === draggedId);
  const targetIndex = entries.findIndex(e => e.id === targetId);
  
  if (draggedIndex === -1 || targetIndex === -1) return;
  
  const [draggedItem] = entries.splice(draggedIndex, 1);
  
  let newIndex = targetIndex;
  if (draggedIndex < targetIndex) newIndex--;
  if (insertAfter) newIndex++;
  
  entries.splice(newIndex, 0, draggedItem);
  
  // 重新分配order值
  entries.forEach((entry, index) => {
    entry.order = index;
  });
  
  renderEntriesList();
  showToast('顺序已调整');
}

function toggleEntry(entryId) {
  if (!currentEditingPreset) return;
  
  const entry = currentEditingPreset.entries.find(e => e.id === entryId);
  if (entry) {
    entry.enabled = !entry.enabled;
    renderEntriesList();
  }
}

// ========== 条目编辑 ==========
function openEntryModal(entry) {
  if (entry) {
    currentEditingEntry = JSON.parse(JSON.stringify(entry));
  } else {
    currentEditingEntry = {
      id: generateId(),
      name: '',
      content: '',
      role: 'system',
      depth: 0,
      order: currentEditingPreset.entries.length,
      enabled: true
    };
  }
  
  document.getElementById('entryNameInput').value = currentEditingEntry.name;
  document.getElementById('entryDepth').value = currentEditingEntry.depth;
  document.getElementById('entryContent').value = currentEditingEntry.content;
  document.getElementById('deleteEntryBtn').style.display = entry ? 'block' : 'none';
  
  // 设置角色
  const role = currentEditingEntry.role || 'system';
  document.querySelectorAll('#roleSelector .role-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === role);
  });
  
  document.getElementById('entryModal').classList.add('active');
}

function closeEntryModal() {
  document.getElementById('entryModal').classList.remove('active');
  currentEditingEntry = null;
}

function saveCurrentEntry() {
  if (!currentEditingEntry || !currentEditingPreset) return;
  
  const name = document.getElementById('entryNameInput').value.trim();
  const depth = parseInt(document.getElementById('entryDepth').value) || 0;
  const content = document.getElementById('entryContent').value;
  const role = document.querySelector('#roleSelector .role-btn.active')?.dataset.role || 'system';
  
  if (!name) {
    showToast('请输入条目名称');
    return;
  }
  
  if (!content.trim()) {
    showToast('请输入提示词内容');
    return;
  }
  
  currentEditingEntry.name = name;
  currentEditingEntry.depth = depth;
  currentEditingEntry.content = content;
  currentEditingEntry.role = role;
  
  const existingIndex = currentEditingPreset.entries.findIndex(e => e.id === currentEditingEntry.id);
  
  if (existingIndex >= 0) {
    currentEditingPreset.entries[existingIndex] = currentEditingEntry;
  } else {
    currentEditingPreset.entries.push(currentEditingEntry);
  }
  
  renderEntriesList();
  closeEntryModal();
  showToast('条目已保存');
}

function deleteCurrentEntry() {
  if (!currentEditingEntry || !currentEditingPreset) return;
  if (!confirm('确定要删除这个条目吗？')) return;
  
  currentEditingPreset.entries = currentEditingPreset.entries.filter(
    e => e.id !== currentEditingEntry.id
  );
  
  // 重新分配order
  currentEditingPreset.entries.forEach((entry, index) => {
    entry.order = index;
  });
  
  renderEntriesList();
  closeEntryModal();
  showToast('条目已删除');
}

// ========== 跨标签页同步 ==========
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') {
    applyTheme(e.newValue || 'pink');
  }
  if (e.key === 'buttonColor') {
    if (e.newValue) {
      loadCustomButtonColor();
    } else {
      const theme = localStorage.getItem('theme') || 'pink';
      applyTheme(theme);
    }
  }
  if (e.key === 'customCSS' || e.key === 'customCSSEnabled' || e.key === 'cssToggleSync') {
    loadCustomCSS();
  }
  if (e.key === PRESET_STORAGE_KEY || e.key === ACTIVE_PRESET_KEY) {
    renderPresetList();
    updateActivePresetHint();
  }
});

// ========== 全局API（供聊天模块调用） ==========

/**
 * 获取当前激活的预设
 * @returns {Object|null} 预设对象或null
 */
window.getActivePreset = function() {
  const activeId = getActivePresetId();
  if (!activeId) return null;
  
  const presets = getAllPresets();
  return presets.find(p => p.id === activeId) || null;
};

/**
 * 获取当前激活预设中所有启用的条目（按顺序和深度排序）
 * @returns {Array} 条目数组
 */
window.getActivePresetEntries = function() {
  const preset = window.getActivePreset();
  if (!preset) return [];
  
  return preset.entries
    .filter(e => e.enabled)
    .sort((a, b) => {
      // 先按深度降序（深度大的靠前），再按order升序
      if (b.depth !== a.depth) return b.depth - a.depth;
      return (a.order || 0) - (b.order || 0);
    })
    .map(entry => ({
      id: entry.id,
      name: entry.name,
      content: entry.content,
      role: entry.role || 'system',
      depth: entry.depth
    }));
};

/**
 * 获取系统提示词（合并所有启用的system类型条目）
 * @param {string} separator - 分隔符
 * @returns {string}
 */
window.getSystemPromptForAI = function(separator = '\n\n') {
  const entries = window.getActivePresetEntries();
  return entries
    .filter(e => e.role === 'system')
    .map(e => e.content)
    .join(separator);
};

/**
 * 构建包含预设的消息数组（用于发送给AI API）
 * @param {Array} userMessages - 用户对话消息数组
 * @returns {Array} 完整的消息数组
 */
window.buildMessagesWithPresets = function(userMessages = []) {
  const entries = window.getActivePresetEntries();
  
  if (entries.length === 0) {
    return [...userMessages];
  }
  
  const messages = [...userMessages];
  const messageCount = messages.length;
  
  // 按深度分组
  const depthGroups = {};
  entries.forEach(entry => {
    const depth = entry.depth;
    if (!depthGroups[depth]) {
      depthGroups[depth] = [];
    }
    depthGroups[depth].push(entry);
  });
  
  // 获取所有深度值并排序（从大到小）
  const depths = Object.keys(depthGroups).map(Number).sort((a, b) => b - a);
  
  depths.forEach(depth => {
    const groupEntries = depthGroups[depth];
    
    groupEntries.forEach(entry => {
      // 计算插入位置
      let insertPosition = Math.max(0, messageCount - depth);
      
      const presetMessage = {
        role: entry.role,
        content: entry.content,
        _preset: true,
        _depth: depth,
        _name: entry.name
      };
      
      messages.splice(insertPosition, 0, presetMessage);
    });
  });
  
  return messages;
};

/**
 * 检查是否有激活的预设
 * @returns {boolean}
 */
window.hasActivePreset = function() {
  return window.getActivePreset() !== null;
};

/**
 * 获取预设统计信息
 * @returns {Object}
 */
window.getPresetStats = function() {
  const presets = getAllPresets();
  const activePreset = window.getActivePreset();
  
  const stats = {
    totalPresets: presets.length,
    hasActivePreset: !!activePreset,
    activePresetName: activePreset?.name || null,
    totalEntries: 0,
    enabledEntries: 0,
    totalCharacters: 0
  };
  
  if (activePreset) {
    stats.totalEntries = activePreset.entries.length;
    activePreset.entries.forEach(entry => {
      if (entry.enabled) {
        stats.enabledEntries++;
        stats.totalCharacters += entry.content.length;
      }
    });
  }
  
  return stats;
};

/**
 * 导出所有预设数据（只读API）
 * @returns {string} JSON字符串
 */
window.exportPresets = function() {
  const presets = getAllPresets();
  return JSON.stringify(presets, null, 2);
};

// 注意：不提供 importPresets API，只能导出

// ========== 调试辅助 ==========
if (typeof window !== 'undefined') {
  window._presetDebug = {
    getAllPresets,
    getActivePresetId,
    generateId
  };
}
