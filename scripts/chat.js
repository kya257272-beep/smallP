/* scripts/chat.js - 主界面 */

const CHAT_DB_NAME = 'ChatDB';
const CHAT_DB_VERSION = 4;
const CHAR_STORE = 'characters';
const MSG_STORE = 'messages';
const DYNAMIC_STORE = 'dynamics';
const WORLDBOOK_STORE = 'worldbooks';

let chatDB = null;
let currentPage = 0;
let colorPickerType = null;
let dynamicsEnabled = false;
let dynamicsInterval = null;

// ========== 数据库 ==========
function openChatDB() {
  return new Promise((resolve, reject) => {
    if (chatDB) { resolve(chatDB); return; }
    const request = indexedDB.open(CHAT_DB_NAME, CHAT_DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { chatDB = request.result; resolve(chatDB); };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(CHAR_STORE)) {
        const charStore = db.createObjectStore(CHAR_STORE, { keyPath: 'id' });
        charStore.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains(MSG_STORE)) {
        const msgStore = db.createObjectStore(MSG_STORE, { keyPath: 'id' });
        msgStore.createIndex('chatId', 'chatId', { unique: false });
      }
      if (!db.objectStoreNames.contains(DYNAMIC_STORE)) {
        const dynStore = db.createObjectStore(DYNAMIC_STORE, { keyPath: 'id' });
        dynStore.createIndex('characterId', 'characterId', { unique: false });
        dynStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(WORLDBOOK_STORE)) {
        const wbStore = db.createObjectStore(WORLDBOOK_STORE, { keyPath: 'id' });
        wbStore.createIndex('name', 'name', { unique: false });
        wbStore.createIndex('characterId', 'characterId', { unique: false });
      }
    };
  });
}

async function getAllCharacters() {
  const db = await openChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAR_STORE, 'readonly');
    const store = tx.objectStore(CHAR_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function saveCharacterToDB(character) {
  const db = await openChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAR_STORE, 'readwrite');
    const store = tx.objectStore(CHAR_STORE);
    const request = store.put(character);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllDynamics() {
  const db = await openChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DYNAMIC_STORE, 'readonly');
    const store = tx.objectStore(DYNAMIC_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function saveDynamic(dynamic) {
  const db = await openChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DYNAMIC_STORE, 'readwrite');
    const store = tx.objectStore(DYNAMIC_STORE);
    const request = store.put(dynamic);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveWorldBookToDB(worldbook) {
  const db = await openChatDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORLDBOOK_STORE, 'readwrite');
    const store = tx.objectStore(WORLDBOOK_STORE);
    const request = store.put(worldbook);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  loadThemeSettings();
  applyWallpaperToBody();
  await renderCharacterList();
  await renderDynamics();
  setupSwipeListeners();

  dynamicsEnabled = localStorage.getItem('dynamicsEnabled') === 'true';
  const toggle = document.getElementById('dynamics-toggle');
  if (toggle) toggle.checked = dynamicsEnabled;
  if (dynamicsEnabled) startDynamicsTimer();

  // ⑦ Check if coming from MoMo add friend
  await checkMomoFriendImport();
});

function goBack() {
  // Determine which page we're on
  const isChatRoom = document.body.classList.contains('chatroom-body');
  if (isChatRoom) {
    // From chat-room → go back to chat.html
    window.location.replace('chat.html');
  } else {
    // From chat.html → go back to index.html (desktop)
    window.location.replace('index.html');
  }
}

// ========== 主题 ==========
function loadThemeSettings() {
  const theme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
  const topbarColor = theme.topbarColor || '#12B7F5';
  document.documentElement.style.setProperty('--topbar-color', topbarColor);
  
  const topbar = document.getElementById('qq-topbar');
  if (topbar) topbar.style.background = hexToRgba(topbarColor, 0.6);
  
  const preview = document.getElementById('topbar-color-preview');
  if (preview) preview.style.background = topbarColor;
  
  const bubbleColor = theme.bubbleColor || '#12B7F5';
  document.documentElement.style.setProperty('--bubble-sent', bubbleColor);
  const bubblePreview = document.getElementById('bubble-color-preview');
  if (bubblePreview) bubblePreview.style.background = bubbleColor;
  
  if (theme.customCSS) {
    const cssEl = document.getElementById('custom-theme-css');
    if (cssEl) cssEl.textContent = theme.customCSS;
  }
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function saveThemeSettings(updates) {
  const theme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
  Object.assign(theme, updates);
  localStorage.setItem('qqTheme', JSON.stringify(theme));
}

function applyWallpaperToBody() {
  const wallpaper = localStorage.getItem('chatWallpaper');
  const body = document.getElementById('chat-body');
  if (body) {
    body.style.backgroundImage = wallpaper ? `url(${wallpaper})` : 'none';
  }
}

// ========== 滑动切换 ==========
function setupSwipeListeners() {
  const container = document.getElementById('swipe-container');
  if (!container) return;
  container.addEventListener('scroll', () => {
    const pageWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    const newPage = Math.round(scrollLeft / pageWidth);
    if (newPage !== currentPage) {
      currentPage = newPage;
      updateTabbar();
      updateTopbarForPage();
    }
  });
}

function switchPage(page) {
  const container = document.getElementById('swipe-container');
  if (!container) return;
  container.scrollTo({ left: page * container.clientWidth, behavior: 'smooth' });
}

function updateTabbar() {
  document.querySelectorAll('.tab-item').forEach((tab, index) => {
    tab.classList.toggle('active', index === currentPage);
  });
}

function updateTopbarForPage() {
  const titles = ['消息', '主题', '空间'];
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[currentPage];
  const searchEl = document.getElementById('qq-search');
  if (searchEl) searchEl.style.display = currentPage === 0 ? 'block' : 'none';
}

// ========== 角色列表 ==========
async function renderCharacterList() {
  const list = document.getElementById('character-list');
  if (!list) return;
  
  const characters = await getAllCharacters();
  const theme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
  const frameStyle = theme.avatarFrame || '';
  
  if (characters.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="icon">💬</div><div class="text">还没有聊天，点击右上角+添加角色</div></div>`;
    return;
  }
  
  characters.sort((a, b) => (b.lastMsgTime || 0) - (a.lastMsgTime || 0));
  
  list.innerHTML = characters.map(char => `
    <div class="character-item" onclick="openChat('${char.id}')" data-id="${char.id}">
      <div class="char-avatar-wrapper">
        <div class="char-avatar">
          ${char.avatar ? `<img src="${char.avatar}" alt="${escapeHtml(char.name)}">` : char.name.charAt(0).toUpperCase()}
        </div>
        ${frameStyle ? `<div class="avatar-frame ${frameStyle}"></div>` : ''}
      </div>
      <div class="char-info">
        <div class="name">${escapeHtml(char.name)}</div>
        <div class="last-msg">${escapeHtml(char.signature || char.lastMessage || '开始聊天吧~')}</div>
      </div>
      <div class="char-meta">
        <div class="time">${formatTime(char.lastMsgTime)}</div>
        ${char.unreadCount ? `<div class="unread">${char.unreadCount}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function filterCharacters() {
  const input = document.getElementById('search-input');
  if (!input) return;
  const keyword = input.value.trim().toLowerCase();
  document.querySelectorAll('.character-item').forEach(item => {
    const nameEl = item.querySelector('.name');
    if (!nameEl) return;
    const name = nameEl.textContent.toLowerCase();
    item.style.display = (!keyword || name.includes(keyword)) ? 'flex' : 'none';
  });
}

function openChat(charId) {
  window.location.href = `chat-room.html?id=${charId}`;
}

// ========== 添加角色 ==========
function openAddMenu() {
  const modal = document.getElementById('add-modal');
  if (modal) modal.classList.add('active');
}

function closeAddModal() {
  const modal = document.getElementById('add-modal');
  if (modal) modal.classList.remove('active');
  resetForm();
}

function showManualForm() {
  const form = document.getElementById('manual-form');
  if (form) form.style.display = 'block';
}

function resetForm() {
  const form = document.getElementById('manual-form');
  if (form) form.style.display = 'none';
  const nameInput = document.getElementById('char-name');
  if (nameInput) nameInput.value = '';
  const sigInput = document.getElementById('char-signature');
  if (sigInput) sigInput.value = '';
  const descInput = document.getElementById('char-description');
  if (descInput) descInput.value = '';
  const preview = document.getElementById('avatar-preview');
  if (preview) { preview.innerHTML = '<span>点击上传</span>'; delete preview.dataset.avatar; }
}

// ========== 图片压缩 ==========
function compressImage(file, maxSize = 800) {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    img.onload = () => {
      let width = img.width, height = img.height;
      if (width > height) {
        if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
      } else {
        if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => { URL.revokeObjectURL(img.src); resolve(null); };
    img.src = URL.createObjectURL(file);
  });
}

function compressAvatar(file, maxSize = 256) {
  return compressImage(file, maxSize);
}

async function previewAvatar(input) {
  if (input.files && input.files[0]) {
    const preview = document.getElementById('avatar-preview');
    if (!preview) return;
    const compressed = await compressAvatar(input.files[0], 256);
    if (compressed) {
      preview.innerHTML = `<img src="${compressed}">`;
      preview.dataset.avatar = compressed;
    }
  }
}

async function saveCharacter() {
  const nameInput = document.getElementById('char-name');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) { alert('请输入角色名称'); return; }
  
  const preview = document.getElementById('avatar-preview');
  const avatarData = preview ? preview.dataset.avatar : null;
  const sigInput = document.getElementById('char-signature');
  const descInput = document.getElementById('char-description');
  
  const character = {
    id: 'char_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name: name,
    avatar: avatarData || null,
    signature: sigInput ? sigInput.value.trim() : '',
    description: descInput ? descInput.value.trim() : '',
    greeting: '',
    affection: 50,
    createdAt: Date.now(),
    lastMsgTime: Date.now(),
    lastMessage: null,
    settings: {}
  };
  
  await saveCharacterToDB(character);
  closeAddModal();
  await renderCharacterList();
}

// ========== PNG/JSON导入 ==========
function decodeBase64UTF8(base64) {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    try { return decodeURIComponent(escape(atob(base64))); } catch (e2) { return null; }
  }
}

function extractPNGMetadata(uint8Array) {
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (uint8Array[i] !== pngSignature[i]) throw new Error('不是有效的PNG文件');
  
  let offset = 8;
  while (offset < uint8Array.length) {
    const length = (uint8Array[offset] << 24) | (uint8Array[offset + 1] << 16) | (uint8Array[offset + 2] << 8) | uint8Array[offset + 3];
    const typeBytes = uint8Array.slice(offset + 4, offset + 8);
    const type = String.fromCharCode(...typeBytes);
    
    if (type === 'tEXt') {
      const chunkData = uint8Array.slice(offset + 8, offset + 8 + length);
      const nullIndex = chunkData.indexOf(0);
      if (nullIndex > 0) {
        const keyword = new TextDecoder('latin1').decode(chunkData.slice(0, nullIndex));
        if (keyword === 'chara') {
          const base64Data = new TextDecoder('latin1').decode(chunkData.slice(nullIndex + 1));
          try {
            const jsonString = decodeBase64UTF8(base64Data.trim());
            if (jsonString) return JSON.parse(jsonString);
          } catch (e) { console.error('JSON解析失败:', e); }
        }
      }
    }
    if (type === 'IEND') break;
    offset += 4 + 4 + length + 4;
  }
  return null;
}

function importPNGCard() {
  const input = document.getElementById('png-input');
  if (input) input.click();
}

async function handlePNGImport(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const characterData = extractPNGMetadata(uint8Array);
    
    if (!characterData) {
      alert('未找到角色卡数据，请确认是有效的PNG角色卡');
      input.value = '';
      return;
    }
    
    const avatarData = await compressAvatar(file, 256);
    const data = characterData.data || characterData;
    
    const character = {
      id: 'char_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: data.name || '未命名角色',
      avatar: avatarData,
      description: data.description || '',
      personality: data.personality || '',
      scenario: data.scenario || '',
      mes_example: data.mes_example || '',
      system_prompt: data.system_prompt || '',
      post_history_instructions: data.post_history_instructions || '',
      first_mes: '',
      signature: data.creator_notes || '',
      tags: data.tags || [],
      creator: data.creator || '',
      character_version: data.character_version || '',
      createdAt: Date.now(),
      lastMsgTime: Date.now(),
      affection: 50,
      settings: {}
    };
    
    await saveCharacterToDB(character);
    
    const charBook = data.character_book || characterData.character_book;
    if (charBook && charBook.entries && charBook.entries.length > 0) {
      await saveWorldBookFromCharacter(character.id, character.name, charBook);
    }
    
    await renderCharacterList();
    alert(`成功导入角色：${character.name}`);
  } catch (e) {
    console.error('PNG导入失败:', e);
    alert('导入失败：' + e.message);
  }
  
  input.value = '';
  closeAddModal();
}

async function saveWorldBookFromCharacter(characterId, characterName, charBook) {
  try {
    const worldbook = {
      id: 'wb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: charBook.name || `${characterName}的世界书`,
      description: charBook.description || `从角色卡"${characterName}"提取的世界书`,
      characterId: characterId,
      isGlobal: false,
      createdAt: Date.now(),
      entries: (charBook.entries || []).map((entry, index) => ({
        id: 'entry_' + Date.now() + '_' + index,
        keys: entry.keys || (entry.key ? entry.key.split(',').map(k => k.trim()) : []),
        secondaryKeys: entry.secondary_keys || [],
        content: entry.content || '',
        comment: entry.comment || entry.name || `条目 ${index + 1}`,
        enabled: entry.enabled !== false,
        constant: entry.constant || false,
        selective: entry.selective || false,
        order: entry.insertion_order || entry.order || index,
        position: entry.position || 'before_char',
        priority: entry.priority || 10,
        depth: entry.depth || 4
      }))
    };
    await saveWorldBookToDB(worldbook);
    console.log(`已保存世界书：${worldbook.name}，包含 ${worldbook.entries.length} 个条目`);
  } catch (e) { console.error('保存世界书失败:', e); }
}

function importJSONCard() {
  const input = document.getElementById('json-input');
  if (input) input.click();
}

async function handleJSONImport(input) {
  if (!input.files || !input.files[0]) return;
  
  try {
    const text = await input.files[0].text();
    const rawData = JSON.parse(text);
    const data = rawData.data || rawData;
    
    let avatarData = null;
    if (data.avatar) {
      try {
        const blob = await fetch(data.avatar).then(r => r.blob());
        avatarData = await compressAvatar(new File([blob], 'avatar.png'), 256);
      } catch (e) { avatarData = data.avatar; }
    }
    
    const character = {
      id: 'char_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: data.name || input.files[0].name.replace('.json', ''),
      avatar: avatarData,
      signature: '',
      description: data.description || '',
      personality: data.personality || '',
      scenario: data.scenario || '',
      mes_example: data.mes_example || '',
      system_prompt: data.system_prompt || '',
      first_mes: '',
      affection: 50,
      createdAt: Date.now(),
      lastMsgTime: Date.now(),
      lastMessage: null,
      settings: {}
    };
    
    await saveCharacterToDB(character);
    
    const charBook = data.character_book;
    if (charBook && charBook.entries && charBook.entries.length > 0) {
      await saveWorldBookFromCharacter(character.id, character.name, charBook);
    }
    
    alert(`成功导入角色：${character.name}`);
    closeAddModal();
    await renderCharacterList();
  } catch (e) {
    console.error('JSON导入失败:', e);
    alert('导入失败：JSON格式错误');
  }
  input.value = '';
}

// ========== 颜色选择器 ==========
function openTopbarColorPicker() {
  colorPickerType = 'topbar';
  const title = document.getElementById('color-picker-title');
  if (title) title.textContent = '顶栏颜色';
  renderColorPresets();
  const modal = document.getElementById('color-picker-modal');
  if (modal) modal.classList.add('active');
}

function openBubbleColorPicker() {
  colorPickerType = 'bubble';
  const title = document.getElementById('color-picker-title');
  if (title) title.textContent = '气泡颜色';
  renderColorPresets();
  const modal = document.getElementById('color-picker-modal');
  if (modal) modal.classList.add('active');
}

function closeColorPicker() {
  const modal = document.getElementById('color-picker-modal');
  if (modal) modal.classList.remove('active');
}

function renderColorPresets() {
  const presets = ['#12B7F5', '#07C160', '#FA5151', '#FFC300', '#576B95', '#FF6B81', '#A29BFE', '#00CEC9', '#FD79A8', '#6C5CE7'];
  const container = document.getElementById('color-presets');
  if (!container) return;
  const theme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
  const currentColor = colorPickerType === 'topbar' ? theme.topbarColor : theme.bubbleColor;
  container.innerHTML = presets.map(color => `<div class="color-preset ${currentColor === color ? 'selected' : ''}" style="background: ${color}" onclick="selectPresetColor('${color}')"></div>`).join('');
}

function selectPresetColor(color) {
  document.querySelectorAll('.color-preset').forEach(el => el.classList.remove('selected'));
  event.target.classList.add('selected');
  const input = document.getElementById('custom-color-input');
  if (input) input.value = color;
}

function applyColor() {
  const input = document.getElementById('custom-color-input');
  if (!input) return;
  const color = input.value;
  
  if (colorPickerType === 'topbar') {
    document.documentElement.style.setProperty('--topbar-color', color);
    const topbar = document.getElementById('qq-topbar');
    if (topbar) topbar.style.background = hexToRgba(color, 0.6);
    const preview = document.getElementById('topbar-color-preview');
    if (preview) preview.style.background = color;
    saveThemeSettings({ topbarColor: color });
  } else {
    document.documentElement.style.setProperty('--bubble-sent', color);
    const preview = document.getElementById('bubble-color-preview');
    if (preview) preview.style.background = color;
    saveThemeSettings({ bubbleColor: color });
  }
  closeColorPicker();
}

// ========== 头像框 ==========
function openAvatarFramePicker() {
  const frames = [{ id: '', name: '无' }, { id: 'gold', name: '金色' }, { id: 'rainbow', name: '彩虹' }, { id: 'blue', name: '科技蓝' }];
  const theme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
  const currentFrame = theme.avatarFrame || '';
  const grid = document.getElementById('frame-grid');
  if (grid) {
    grid.innerHTML = frames.map(frame => `<div class="frame-option ${currentFrame === frame.id ? 'selected' : ''}" onclick="selectFrame('${frame.id}')"><div class="frame-preview ${frame.id}"></div><div class="frame-name">${frame.name}</div></div>`).join('');
  }
  const modal = document.getElementById('frame-picker-modal');
  if (modal) modal.classList.add('active');
}

function closeFramePicker() {
  const modal = document.getElementById('frame-picker-modal');
  if (modal) modal.classList.remove('active');
}

function selectFrame(frameId) {
  saveThemeSettings({ avatarFrame: frameId });
  closeFramePicker();
  renderCharacterList();
}

// ========== 壁纸管理（主界面）==========
function openWallpaperPicker() {
  renderWallpaperLibrary();
  const modal = document.getElementById('wallpaper-modal');
  if (modal) modal.classList.add('active');
}

function closeWallpaperModal() {
  const modal = document.getElementById('wallpaper-modal');
  if (modal) modal.classList.remove('active');
}

function getWallpaperLibrary() {
  return JSON.parse(localStorage.getItem('wallpaperLibrary') || '[]');
}

function saveWallpaperLibrary(library) {
  localStorage.setItem('wallpaperLibrary', JSON.stringify(library));
}

function renderWallpaperLibrary() {
  const library = getWallpaperLibrary();
  const currentWallpaper = localStorage.getItem('chatWallpaper');
  const container = document.getElementById('wallpaper-library');
  if (!container) return;
  
  if (library.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:#999;padding:20px;grid-column:span 3;">暂无保存的壁纸</div>';
    return;
  }
  
  container.innerHTML = library.map((wp, index) => `
    <div class="wallpaper-item ${currentWallpaper === wp ? 'selected' : ''}" onclick="selectWallpaper(${index})">
      <img src="${wp}" alt="壁纸">
      <button class="delete-wp" onclick="event.stopPropagation(); deleteWallpaper(${index})">✕</button>
    </div>
  `).join('');
}

async function addWallpaper(input) {
  if (!input.files || !input.files[0]) return;
  try {
    const compressed = await compressImage(input.files[0], 800);
    if (compressed) {
      const library = getWallpaperLibrary();
      library.unshift(compressed);
      if (library.length > 10) library.pop();
      saveWallpaperLibrary(library);
      localStorage.setItem('chatWallpaper', compressed);
      saveThemeSettings({ chatWallpaper: compressed });
      applyWallpaperToBody();
      renderWallpaperLibrary();
    }
  } catch (e) {
    console.error('添加壁纸失败:', e);
    alert('添加壁纸失败');
  }
  input.value = '';
}

function selectWallpaper(index) {
  const library = getWallpaperLibrary();
  if (index >= 0 && index < library.length) {
    const wallpaper = library[index];
    localStorage.setItem('chatWallpaper', wallpaper);
    saveThemeSettings({ chatWallpaper: wallpaper });
    applyWallpaperToBody();
    renderWallpaperLibrary();
    closeWallpaperModal();
  }
}

function deleteWallpaper(index) {
  if (!confirm('确定删除这张壁纸？')) return;
  const library = getWallpaperLibrary();
  const deletedWp = library[index];
  library.splice(index, 1);
  saveWallpaperLibrary(library);
  
  const currentWp = localStorage.getItem('chatWallpaper');
  if (currentWp === deletedWp) {
    localStorage.removeItem('chatWallpaper');
    saveThemeSettings({ chatWallpaper: null });
    document.getElementById('chat-body').style.backgroundImage = 'none';
  }
  renderWallpaperLibrary();
}

function removeWallpaper() {
  localStorage.removeItem('chatWallpaper');
  saveThemeSettings({ chatWallpaper: null });
  document.getElementById('chat-body').style.backgroundImage = 'none';
  renderWallpaperLibrary();
  closeWallpaperModal();
}

// ========== 自定义CSS ==========
function openCustomCSS() {
  const theme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
  const input = document.getElementById('custom-css-input');
  if (input) input.value = theme.customCSS || '';
  const modal = document.getElementById('css-modal');
  if (modal) modal.classList.add('active');
}

function closeCSSModal() {
  const modal = document.getElementById('css-modal');
  if (modal) modal.classList.remove('active');
}

function previewCSS() {
  const input = document.getElementById('custom-css-input');
  const cssEl = document.getElementById('custom-theme-css');
  if (input && cssEl) cssEl.textContent = input.value;
}

function saveCSS() {
  const input = document.getElementById('custom-css-input');
  if (!input) return;
  const css = input.value;
  const cssEl = document.getElementById('custom-theme-css');
  if (cssEl) cssEl.textContent = css;
  saveThemeSettings({ customCSS: css });
  closeCSSModal();
  alert('CSS已保存');
}

function resetTheme() {
  if (!confirm('确定重置所有主题设置？')) return;
  localStorage.removeItem('qqTheme');
  localStorage.removeItem('chatWallpaper');
  localStorage.removeItem('wallpaperLibrary');
  location.reload();
}

// ========== 动态功能 ==========
function toggleDynamics() {
  const toggle = document.getElementById('dynamics-toggle');
  if (!toggle) return;
  dynamicsEnabled = toggle.checked;
  localStorage.setItem('dynamicsEnabled', dynamicsEnabled);
  if (dynamicsEnabled) { startDynamicsTimer(); generateRandomDynamic(); }
  else stopDynamicsTimer();
}

function startDynamicsTimer() {
  if (dynamicsInterval) return;
  const randomDelay = () => (30 + Math.random() * 90) * 60 * 1000;
  const scheduleNext = () => {
    dynamicsInterval = setTimeout(async () => {
      if (dynamicsEnabled) { await generateRandomDynamic(); scheduleNext(); }
    }, randomDelay());
  };
  scheduleNext();
}

function stopDynamicsTimer() {
  if (dynamicsInterval) { clearTimeout(dynamicsInterval); dynamicsInterval = null; }
}

async function generateRandomDynamic() {
  const characters = await getAllCharacters();
  if (characters.length === 0) return;
  
  const char = characters[Math.floor(Math.random() * characters.length)];
  const isSignature = Math.random() < 0.3;
  
  try {
    const apiConfig = JSON.parse(localStorage.getItem('apiConfig') || '{}');
    let content;
    
    if (apiConfig.key && apiConfig.provider) {
      content = await callAIForDynamic(char, isSignature, apiConfig);
    } else {
      const templates = isSignature 
        ? ['今天也要加油哦~', '阳光正好，微风不燥', '做自己喜欢的事情吧', '每一天都是新的开始']
        : ['今天天气真好呢！', '刚刚看了一部很棒的电影~', '想念大家了，有人在吗？', '分享一下今天的心情💭'];
      content = templates[Math.floor(Math.random() * templates.length)];
    }
    
    if (isSignature) {
      char.signature = content;
      await saveCharacterToDB(char);
      await renderCharacterList();
    } else {
      const dynamic = {
        id: 'dyn_' + Date.now(),
        characterId: char.id,
        characterName: char.name,
        characterAvatar: char.avatar,
        content: content,
        type: 'post',
        timestamp: Date.now()
      };
      await saveDynamic(dynamic);
      await renderDynamics();
    }
  } catch (e) { console.error('生成动态失败:', e); }
}

async function callAIForDynamic(char, isSignature, config) {
  const prompt = isSignature 
    ? `你是${char.name}，请生成一条简短的个性签名（10-20字）：`
    : `你是${char.name}，请发一条QQ空间动态（30-100字），可以是日常分享、心情、或者想法：`;
  
  let endpoint = config.provider;
  if (!endpoint.startsWith('http')) endpoint = 'https://' + endpoint;
  if (!endpoint.includes('/v1/chat/completions')) endpoint = endpoint.replace(/\/$/, '') + '/v1/chat/completions';
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
    body: JSON.stringify({
      model: config.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `你是${char.name}。${char.description || ''}` },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
      max_tokens: 100
    })
  });
  
  const data = await response.json();
  return data.choices[0]?.message?.content?.trim() || '今天也是美好的一天~';
}

async function renderDynamics() {
  const list = document.getElementById('dynamics-list');
  if (!list) return;
  
  const dynamics = await getAllDynamics();
  
  if (dynamics.length === 0) {
    list.innerHTML = `<div class="dynamics-empty"><div class="empty-icon">📭</div><div class="empty-text">暂无动态</div><div class="empty-hint">开启角色动态功能后，角色们会在这里发布动态</div></div>`;
    return;
  }
  
  dynamics.sort((a, b) => b.timestamp - a.timestamp);
  
  list.innerHTML = dynamics.slice(0, 50).map(dyn => `
    <div class="dynamic-card">
      <div class="dynamic-header">
        <div class="dynamic-avatar">
          ${dyn.characterAvatar ? `<img src="${dyn.characterAvatar}" alt="">` : `<div style="width:100%;height:100%;background:#12B7F5;display:flex;align-items:center;justify-content:center;color:#fff;border-radius:50%;">${dyn.characterName?.charAt(0) || '?'}</div>`}
        </div>
        <div class="dynamic-info">
          <div class="dynamic-name">${escapeHtml(dyn.characterName || '未知')}</div>
          <div class="dynamic-time">${formatDynamicTime(dyn.timestamp)}</div>
        </div>
      </div>
      <div class="dynamic-content">${escapeHtml(dyn.content)}</div>
    </div>
  `).join('');
}

// ========== 工具函数 ==========
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return date.getHours().toString().padStart(2,'0') + ':' + date.getMinutes().toString().padStart(2,'0');
  if (diff < 604800000) return ['周日','周一','周二','周三','周四','周五','周六'][date.getDay()];
  return (date.getMonth()+1) + '/' + date.getDate();
}

function formatDynamicTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
  return `${date.getMonth()+1}月${date.getDate()}日`;
}

// ========== ⑥ QID搜索添加MoMo好友 ==========
function showQIDSearch() {
  const form = document.getElementById('qid-search-form');
  if (form) form.style.display = 'block';
  // Hide manual form if open
  const manualForm = document.getElementById('manual-form');
  if (manualForm) manualForm.style.display = 'none';
}

async function searchMomoByQID() {
  const qidInput = document.getElementById('qid-input');
  if (!qidInput) return;
  const qid = qidInput.value.trim();

  if (!qid || qid.length !== 6 || !/^\d{6}$/.test(qid)) {
    alert('请输入有效的6位数字QID');
    return;
  }

  // Search momoUserProfiles for matching QID
  let profiles;
  try {
    profiles = JSON.parse(localStorage.getItem('momoUserProfiles') || '{}');
  } catch { profiles = {}; }

  let foundProfile = null;
  for (const username of Object.keys(profiles)) {
    if (profiles[username].qid === qid) {
      foundProfile = profiles[username];
      break;
    }
  }

  if (!foundProfile) {
    alert('未找到该QID对应的MoMo用户');
    return;
  }

  // Create QQ character from MoMo profile
  await createCharacterFromMomoProfile(foundProfile);

  qidInput.value = '';
  closeAddModal();
  await renderCharacterList();
  alert(`已通过QID添加MoMo好友：${foundProfile.username}`);
}

async function createCharacterFromMomoProfile(profile) {
  const character = {
    id: 'char_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    name: profile.username,
    avatar: null,
    signature: `来自MoMo · QID: ${profile.qid}`,
    description: profile.bio || '',
    affection: 50,
    createdAt: Date.now(),
    lastMsgTime: Date.now(),
    lastMessage: null,
    settings: {}
  };

  await saveCharacterToDB(character);

  // Import DMs from MoMo if available
  try {
    const momoDMs = JSON.parse(localStorage.getItem('momoDMs') || '{}');
    const msgs = momoDMs[profile.username];
    if (msgs && msgs.length > 0) {
      const db = await openChatDB();
      const tx = db.transaction(MSG_STORE, 'readwrite');
      const store = tx.objectStore(MSG_STORE);

      for (const msg of msgs) {
        const dbMsg = {
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          chatId: character.id,
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: msg.timestamp || Date.now()
        };
        store.put(dbMsg);
      }
    }
  } catch (e) {
    console.error('导入MoMo聊天记录失败:', e);
  }

  return character;
}

// ========== ⑦ 从MoMo跳转自动添加好友 ==========
async function checkMomoFriendImport() {
  const data = sessionStorage.getItem('momoToQQFriend');
  if (!data) return;

  sessionStorage.removeItem('momoToQQFriend');

  try {
    const profile = JSON.parse(data);
    if (!profile || !profile.username) return;

    await createCharacterFromMomoProfile(profile);
    await renderCharacterList();

    // Show toast-like notification
    const notification = document.createElement('div');
    notification.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#fff;padding:10px 24px;border-radius:22px;font-size:.85rem;z-index:999;white-space:nowrap;';
    notification.textContent = `已从MoMo添加好友：${profile.username}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  } catch (e) {
    console.error('MoMo好友导入失败:', e);
  }
}
