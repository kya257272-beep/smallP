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
  initSpacePage();
  await renderSpaceFeed();
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
  const topbarColors = theme.topbarColors || [topbarColor];
  const topbarDir = theme.topbarGradientDir || '135deg';
  const topbarGradient = buildGradientCSS(topbarColors, topbarDir);
  document.documentElement.style.setProperty('--topbar-color', topbarColor);
  document.documentElement.style.setProperty('--topbar-gradient', topbarGradient);

  const topbar = document.getElementById('qq-topbar');
  if (topbar) topbar.style.background = topbarColors.length > 1 ? topbarGradient : hexToRgba(topbarColor, 0.6);

  const preview = document.getElementById('topbar-color-preview');
  if (preview) preview.style.background = topbarGradient;

  const bubbleColor = theme.bubbleColor || '#12B7F5';
  const bubbleColors = theme.bubbleColors || [bubbleColor];
  const bubbleDir = theme.bubbleGradientDir || '135deg';
  const bubbleGradient = buildGradientCSS(bubbleColors, bubbleDir);
  document.documentElement.style.setProperty('--bubble-sent', bubbleColor);
  document.documentElement.style.setProperty('--bubble-sent-gradient', bubbleGradient);
  const bubblePreview = document.getElementById('bubble-color-preview');
  if (bubblePreview) bubblePreview.style.background = bubbleGradient;

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
        ${(() => { const f = char.settings?.avatarFrame || ''; return f ? (f.startsWith('custom:') ? `<div class="avatar-frame" style="box-shadow: 0 0 0 2px ${f.replace('custom:', '')}, 0 0 10px ${f.replace('custom:', '')}40;"></div>` : `<div class="avatar-frame ${f}"></div>`) : ''; })()}
      </div>
      <div class="char-info">
        <div class="name">${escapeHtml(char.name)}</div>
        <div class="last-msg">${escapeHtml(char.signature || char.lastMessage || '开始聊天吧~')}</div>
      </div>
      <div class="char-meta">
        <div class="time">${formatTime(char.lastMsgTime)}</div>
        ${char.unreadCount ? `<div class="unread">${char.unreadCount}</div>` : ''}
        ${char.dynamicsSettings?.postDiary ? `<div class="diary-badge" onclick="event.stopPropagation();openDiary('${char.id}')" title="查看日记">📖</div>` : ''}
      </div>
    </div>
  `).join('');
}

function filterCharacters() {
  const input = document.getElementById('search-input');
  if (!input) return;
  const keyword = input.value.trim().toLowerCase();
  document.querySelectorAll('.character-item').forEach(item => {
    const name = item.querySelector('.name')?.textContent.toLowerCase() || '';
    const lastMsg = item.querySelector('.last-msg')?.textContent.toLowerCase() || '';
    const visible = !keyword || name.includes(keyword) || lastMsg.includes(keyword);
    item.style.display = visible ? 'flex' : 'none';
  });
}

function openChat(charId) {
  window.location.href = `chat-room.html?id=${charId}`;
}

function openDiary(charId) {
  window.location.href = `diary.html?charId=${charId}`;
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
    mes_example: document.getElementById('char-example') ? document.getElementById('char-example').value.trim() : '',
    first_mes: document.getElementById('char-greeting') ? document.getElementById('char-greeting').value.trim() : '',
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

// ========== 颜色选择器（渐变支持）==========
let _colorList = [];
let _gradientDir = '135deg';

function openTopbarColorPicker() {
  colorPickerType = 'topbar';
  const title = document.getElementById('color-picker-title');
  if (title) title.textContent = '顶栏颜色';
  const theme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
  _colorList = theme.topbarColors ? [...theme.topbarColors] : (theme.topbarColor ? [theme.topbarColor] : ['#12B7F5']);
  _gradientDir = theme.topbarGradientDir || '135deg';
  renderColorPresets();
  renderSelectedColors();
  renderGradientDirUI();
  const modal = document.getElementById('color-picker-modal');
  if (modal) modal.classList.add('active');
}

function openBubbleColorPicker() {
  colorPickerType = 'bubble';
  const title = document.getElementById('color-picker-title');
  if (title) title.textContent = '气泡颜色';
  const theme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
  _colorList = theme.bubbleColors ? [...theme.bubbleColors] : (theme.bubbleColor ? [theme.bubbleColor] : ['#12B7F5']);
  _gradientDir = theme.bubbleGradientDir || '135deg';
  renderColorPresets();
  renderSelectedColors();
  renderGradientDirUI();
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
  container.innerHTML = presets.map(color => `<div class="color-preset" style="background: ${color}" onclick="selectPresetColor('${color}')"></div>`).join('');
}

function selectPresetColor(color) {
  const input = document.getElementById('custom-color-input');
  if (input) input.value = color;
}

function addColorToGradient() {
  const input = document.getElementById('custom-color-input');
  if (!input) return;
  _colorList.push(input.value);
  renderSelectedColors();
}

function removeGradientColor(index) {
  _colorList.splice(index, 1);
  renderSelectedColors();
}

function renderSelectedColors() {
  const container = document.getElementById('selected-colors');
  if (!container) return;
  if (_colorList.length === 0) {
    container.innerHTML = '<div style="font-size:13px;color:#999;">尚未添加颜色，点击下方"添加颜色"</div>';
    return;
  }
  container.innerHTML = _colorList.map((c, i) => `
    <div class="selected-color-chip" style="background:${c};" title="${c}">
      <div class="remove-chip" onclick="removeGradientColor(${i})">×</div>
    </div>
  `).join('');
}

function selectGradientDir(dir) {
  _gradientDir = dir;
  renderGradientDirUI();
}

function renderGradientDirUI() {
  document.querySelectorAll('.dir-option').forEach(el => {
    el.classList.toggle('selected', el.getAttribute('data-dir') === _gradientDir);
  });
}

function buildGradientCSS(colors, dir) {
  if (!colors || colors.length === 0) return '#12B7F5';
  if (colors.length === 1) return colors[0];
  return `linear-gradient(${dir}, ${colors.join(', ')})`;
}

function applyColor() {
  if (_colorList.length === 0) {
    const input = document.getElementById('custom-color-input');
    if (input) _colorList = [input.value];
  }
  const gradient = buildGradientCSS(_colorList, _gradientDir);
  const firstColor = _colorList[0] || '#12B7F5';

  if (colorPickerType === 'topbar') {
    document.documentElement.style.setProperty('--topbar-color', firstColor);
    document.documentElement.style.setProperty('--topbar-gradient', gradient);
    const topbar = document.getElementById('qq-topbar');
    if (topbar) topbar.style.background = _colorList.length > 1 ? gradient : hexToRgba(firstColor, 0.6);
    const preview = document.getElementById('topbar-color-preview');
    if (preview) preview.style.background = gradient;
    saveThemeSettings({ topbarColor: firstColor, topbarColors: [..._colorList], topbarGradientDir: _gradientDir });
  } else {
    document.documentElement.style.setProperty('--bubble-sent', firstColor);
    document.documentElement.style.setProperty('--bubble-sent-gradient', gradient);
    const preview = document.getElementById('bubble-color-preview');
    if (preview) preview.style.background = gradient;
    saveThemeSettings({ bubbleColor: firstColor, bubbleColors: [..._colorList], bubbleGradientDir: _gradientDir });
  }
  closeColorPicker();
}

// ========== 头像框（用户）==========
function openAvatarFramePicker() {
  const frames = [
    { id: '', name: '无框', icon: '⭕' },
    { id: 'gold', name: '金色尊贵', icon: '👑' },
    { id: 'rainbow', name: '彩虹绚丽', icon: '🌈' },
    { id: 'blue', name: '海洋之心', icon: '💙' },
    { id: 'pink', name: '甜蜜粉红', icon: '💗' },
    { id: 'purple', name: '神秘紫罗兰', icon: '💜' },
    { id: 'green', name: '翡翠之光', icon: '💚' },
    { id: 'red', name: '烈焰赤红', icon: '❤️' },
    { id: 'orange', name: '暖阳橙光', icon: '🧡' },
    { id: 'gradient', name: '星河渐变', icon: '🌌' },
    { id: 'neon', name: '霓虹闪烁', icon: '💠' }
  ];
  const theme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
  const currentFrame = theme.userAvatarFrame || '';
  const grid = document.getElementById('frame-grid');
  if (grid) {
    let html = frames.map(f => `
      <div class="frame-option ${currentFrame === f.id ? 'selected' : ''}" onclick="selectUserFrame('${f.id}')">
        <div class="frame-preview ${f.id}" style="border-radius:50%;">${f.icon}</div>
        <div class="frame-name">${f.icon} ${f.name}</div>
      </div>
    `).join('');
    const isCustom = currentFrame.startsWith('custom:');
    const customColor = isCustom ? currentFrame.replace('custom:', '') : '#ff6600';
    html += `
      <div class="frame-option ${isCustom ? 'selected' : ''}" onclick="showCustomUserFrame()">
        <div class="frame-preview" style="border-radius:50%;${isCustom ? `box-shadow: 0 0 0 2px ${customColor}, 0 0 10px ${customColor}40;` : 'background:#eee;'}">🎨</div>
        <div class="frame-name">🎨 自定义颜色</div>
      </div>
    `;
    const savedCSS = theme.userAvatarCSS || '';
    html += `
      <div style="grid-column:span 2;margin-top:8px;">
        <div style="font-size:13px;color:#666;margin-bottom:6px;">自定义头像CSS</div>
        <textarea id="user-avatar-css-input" rows="3" placeholder=".space-avatar { border: 2px solid gold; }" style="width:100%;padding:8px;border:1px solid #e0e0e0;border-radius:8px;font-family:monospace;font-size:12px;resize:vertical;margin-bottom:8px;">${escapeHtml(savedCSS)}</textarea>
        <button class="save-btn" onclick="saveUserAvatarCSS()">保存CSS</button>
      </div>
    `;
    grid.innerHTML = html;
  }
  const modal = document.getElementById('frame-picker-modal');
  if (modal) modal.classList.add('active');
}

function closeFramePicker() {
  const modal = document.getElementById('frame-picker-modal');
  if (modal) modal.classList.remove('active');
}

function selectUserFrame(frameId) {
  saveThemeSettings({ userAvatarFrame: frameId });
  closeFramePicker();
}

function showCustomUserFrame() {
  const color = prompt('输入自定义颜色值（如 #ff6600）:', '#ff6600');
  if (color) {
    saveThemeSettings({ userAvatarFrame: 'custom:' + color });
    closeFramePicker();
  }
}

function saveUserAvatarCSS() {
  const input = document.getElementById('user-avatar-css-input');
  if (!input) return;
  saveThemeSettings({ userAvatarCSS: input.value });
  alert('头像CSS已保存');
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
  const charName = char.name || '角色';
  const userName = char.userSettings?.name || '用户';

  // 构建包含所有已启用提示词条目的系统提示
  let systemContent = '';
  const promptEntries = char.promptEntries || [];
  for (const entry of promptEntries) {
    if (!entry.enabled) continue;
    if (entry.id === 'char_persona') {
      systemContent += `【角色人设】\n你是${charName}。`;
      if (char.description) systemContent += `\n描述: ${char.description}`;
      if (char.personality) systemContent += `\n性格: ${char.personality}`;
      if (char.system_prompt) systemContent += `\n${char.system_prompt}`;
      systemContent += '\n\n';
    } else if (entry.id === 'user_persona') {
      systemContent += `【用户人设】\n用户: ${userName}`;
      if (char.userSettings?.persona) systemContent += ` - ${char.userSettings.persona}`;
      systemContent += '\n\n';
    } else if (entry.type === 'custom' && entry.content) {
      systemContent += `【${entry.name}】\n${entry.content.replace(/{{char}}/g, charName).replace(/{{user}}/g, userName)}\n\n`;
    }
  }
  // 如果没有提示词条目，使用简单人设
  if (!systemContent) {
    systemContent = `你是${charName}。${char.description || ''}`;
  }

  const prompt = isSignature
    ? `请生成一条简短的个性签名（10-20字）：`
    : `请发一条QQ空间动态（30-100字），可以是日常分享、心情、或者想法：`;

  let endpoint = config.provider;
  if (!endpoint.startsWith('http')) endpoint = 'https://' + endpoint;
  if (!endpoint.includes('/v1/chat/completions')) endpoint = endpoint.replace(/\/$/, '') + '/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.key}` },
    body: JSON.stringify({
      model: config.model || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
      max_tokens: 100
    })
  });

  const data = await response.json();
  const result = data.choices[0]?.message?.content?.trim() || '今天也是美好的一天~';
  const usage = data.usage || {};

  try {
    const _est = (t) => { if(!t)return 0; const s=typeof t==='string'?t:JSON.stringify(t); let c=0,o=0; for(const ch of s){/[\u4e00-\u9fff]/.test(ch)?c++:o++;} return Math.ceil(c/1.5+o/4); };
    let logs = JSON.parse(localStorage.getItem('apiCallLogs') || '[]');
    logs.push({
      timestamp: Date.now(),
      model: config.model || 'gpt-3.5-turbo',
      inputTokens: usage.prompt_tokens || _est(prompt),
      outputTokens: usage.completion_tokens || _est(result)
    });
    if (logs.length > 100) logs = logs.slice(-100);
    localStorage.setItem('apiCallLogs', JSON.stringify(logs));
  } catch(e) {}

  return result;
}

async function renderDynamics() {
  // Legacy — now delegated to renderSpaceFeed
  await renderSpaceFeed();
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

// ========== QID搜索添加MoMo好友 ==========
function showQIDSearch() {
  const form = document.getElementById('qid-search-form');
  if (form) form.style.display = 'block';
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

// ========== 从MoMo跳转自动添加好友 ==========
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

// ========== 空间页 ==========
function initSpacePage() {
  // 封面
  const coverImg = localStorage.getItem('spaceCoverImage');
  const imgEl = document.getElementById('space-cover-img');
  const placeholder = document.getElementById('space-cover-placeholder');
  if (coverImg && imgEl) {
    imgEl.src = coverImg;
    imgEl.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  }
  // 头像
  const settings = JSON.parse(localStorage.getItem('userChatSettings') || '{}');
  const avatarEl = document.getElementById('space-avatar');
  if (avatarEl) {
    if (settings.avatar) {
      avatarEl.innerHTML = `<img src="${settings.avatar}">`;
    } else {
      avatarEl.textContent = '👤';
    }
    // 应用头像框
    const theme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
    const frame = theme.userAvatarFrame || '';
    if (frame) {
      if (frame.startsWith('custom:')) {
        const c = frame.replace('custom:', '');
        avatarEl.style.boxShadow = `0 0 0 3px ${c}, 0 0 10px ${c}40`;
      } else if (frame === 'rainbow') {
        avatarEl.style.animation = 'rainbowFrame 2s linear infinite';
      } else if (frame === 'gradient') {
        avatarEl.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
      } else if (frame === 'neon') {
        avatarEl.style.boxShadow = '0 0 0 3px #0ff, 0 0 10px #0ff, 0 0 20px rgba(0,255,255,0.3)';
      } else if (frame) {
        const colorMap = { gold:'#ffd700', blue:'#12B7F5', pink:'#f48fb1', purple:'#ce93d8', green:'#4caf50', red:'#f44336', orange:'#ff9800' };
        const c = colorMap[frame];
        if (c) avatarEl.style.boxShadow = `0 0 0 3px ${c}, 0 0 10px ${c}80`;
      }
    }
  }
  // 用户名
  const nameEl = document.getElementById('space-username');
  if (nameEl) nameEl.textContent = settings.userName || '我';
}

function uploadSpaceCover() {
  document.getElementById('space-cover-input').click();
}

async function handleSpaceCoverSelect(input) {
  if (!input.files || !input.files[0]) return;
  const compressed = await compressImage(input.files[0], 800);
  if (compressed) {
    localStorage.setItem('spaceCoverImage', compressed);
    const imgEl = document.getElementById('space-cover-img');
    const placeholder = document.getElementById('space-cover-placeholder');
    if (imgEl) { imgEl.src = compressed; imgEl.style.display = 'block'; }
    if (placeholder) placeholder.style.display = 'none';
  }
  input.value = '';
}

function uploadSpaceAvatar() {
  document.getElementById('space-avatar-input').click();
}

async function handleSpaceAvatarSelect(input) {
  if (!input.files || !input.files[0]) return;
  const compressed = await compressAvatar(input.files[0], 256);
  if (compressed) {
    const settings = JSON.parse(localStorage.getItem('userChatSettings') || '{}');
    settings.avatar = compressed;
    localStorage.setItem('userChatSettings', JSON.stringify(settings));
    const avatarEl = document.getElementById('space-avatar');
    if (avatarEl) avatarEl.innerHTML = `<img src="${compressed}">`;
  }
  input.value = '';
}

// ========== 动态流渲染 ==========
async function renderSpaceFeed() {
  const feed = document.getElementById('space-feed');
  if (!feed) return;

  const dynamics = await getAllDynamics();
  if (dynamics.length === 0) {
    feed.innerHTML = `<div class="dynamics-empty"><div class="empty-icon">📭</div><div class="empty-text">暂无动态</div><div class="empty-hint">开启角色动态功能后，角色们会在这里发布动态</div></div>`;
    return;
  }

  dynamics.sort((a, b) => b.timestamp - a.timestamp);
  const settings = JSON.parse(localStorage.getItem('userChatSettings') || '{}');

  feed.innerHTML = dynamics.slice(0, 50).map(dyn => {
    const isUser = dyn.isUserPost;
    const avatar = isUser ? (settings.avatar || '') : (dyn.characterAvatar || '');
    const name = isUser ? (dyn.userName || '我') : (dyn.characterName || '未知');
    const avatarHTML = avatar
      ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : `<div style="width:100%;height:100%;background:#12B7F5;display:flex;align-items:center;justify-content:center;color:#fff;border-radius:50%;font-size:14px;">${name.charAt(0)}</div>`;

    // Images
    let imagesHTML = '';
    if (dyn.images && dyn.images.length > 0) {
      const cols = dyn.images.length === 1 ? 1 : dyn.images.length === 2 ? 2 : 3;
      imagesHTML = `<div class="dynamic-images cols-${cols}">${dyn.images.map(img => `<img src="${img}" onclick="viewDynImage('${img.replace(/'/g, "\\'")}')">`).join('')}</div>`;
    }

    // Likes
    const likes = dyn.likes || [];
    const userLiked = likes.some(l => l.isUser);
    const likeNames = likes.map(l => l.name).join(', ');

    // Comments
    const comments = dyn.comments || [];
    const commentsHTML = comments.map(c => `
      <div class="dynamic-comment">
        <span class="dynamic-comment-name">${escapeHtml(c.name)}</span>
        <span class="dynamic-comment-text">${escapeHtml(c.text)}</span>
      </div>
    `).join('');

    return `
      <div class="dynamic-card" id="dyn-${dyn.id}">
        <button class="dynamic-delete" onclick="deletePost('${dyn.id}')">✕</button>
        <div class="dynamic-header">
          <div class="dynamic-avatar">${avatarHTML}</div>
          <div class="dynamic-info">
            <div class="dynamic-name">${escapeHtml(name)}</div>
            <div class="dynamic-time">${formatDynamicTime(dyn.timestamp)}</div>
          </div>
        </div>
        <div class="dynamic-content">${escapeHtml(dyn.content)}</div>
        ${imagesHTML}
        <div class="dynamic-actions">
          <button class="dynamic-action-btn ${userLiked ? 'liked' : ''}" onclick="toggleLike('${dyn.id}')">
            ${userLiked ? '❤️' : '🤍'} ${likes.length > 0 ? likes.length : ''}
          </button>
          <button class="dynamic-action-btn" onclick="toggleCommentInput('${dyn.id}')">
            💬 ${comments.length > 0 ? comments.length : ''}
          </button>
        </div>
        ${likeNames ? `<div style="font-size:12px;color:#999;padding:4px 0;">❤️ ${escapeHtml(likeNames)}</div>` : ''}
        ${comments.length > 0 ? `<div class="dynamic-comments">${commentsHTML}</div>` : ''}
        <div class="dynamic-comment-input" id="comment-input-${dyn.id}" style="display:none;">
          <input type="text" id="comment-text-${dyn.id}" placeholder="写评论..." onkeydown="if(event.key==='Enter')submitComment('${dyn.id}')">
          <button onclick="submitComment('${dyn.id}')">发送</button>
        </div>
      </div>
    `;
  }).join('');
}

function viewDynImage(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:2000;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `<img src="${src}" style="max-width:90%;max-height:90%;object-fit:contain;">`;
  document.body.appendChild(overlay);
}

// ========== 新建动态 ==========
let _postImages = [];

function openNewPostEditor() {
  _postImages = [];
  const textInput = document.getElementById('post-text-input');
  if (textInput) textInput.value = '';
  const preview = document.getElementById('post-image-preview');
  if (preview) preview.innerHTML = '';
  const modal = document.getElementById('new-post-modal');
  if (modal) modal.classList.add('active');
}

function closeNewPostEditor() {
  const modal = document.getElementById('new-post-modal');
  if (modal) modal.classList.remove('active');
}

async function handlePostImageSelect(input) {
  if (!input.files) return;
  for (const file of input.files) {
    const compressed = await compressImage(file, 600);
    if (compressed) _postImages.push(compressed);
  }
  const preview = document.getElementById('post-image-preview');
  if (preview) {
    preview.innerHTML = _postImages.map(img => `<img class="post-img-thumb" src="${img}">`).join('');
  }
  input.value = '';
}

async function submitNewPost() {
  const textInput = document.getElementById('post-text-input');
  const content = textInput ? textInput.value.trim() : '';
  if (!content && _postImages.length === 0) { alert('请输入内容或添加图片'); return; }

  const settings = JSON.parse(localStorage.getItem('userChatSettings') || '{}');
  const dynamic = {
    id: 'dyn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    content: content,
    images: [..._postImages],
    isUserPost: true,
    userName: settings.userName || '我',
    userAvatar: settings.avatar || '',
    characterId: '_user_',
    characterName: settings.userName || '我',
    characterAvatar: settings.avatar || '',
    timestamp: Date.now(),
    likes: [],
    comments: []
  };

  await saveDynamic(dynamic);

  // Sync to all character chats
  try {
    const characters = await getAllCharacters();
    const db = await openChatDB();
    const snippet = content.length > 20 ? content.substring(0, 20) + '...' : content;
    for (const char of characters) {
      const tx = db.transaction(MSG_STORE, 'readwrite');
      const store = tx.objectStore(MSG_STORE);
      store.put({
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        chatId: char.id,
        type: 'system',
        content: `[dynamic:${dynamic.id}:${snippet}]`,
        timestamp: Date.now()
      });
    }
  } catch (e) { console.error('同步动态到聊天失败:', e); }

  closeNewPostEditor();
  await renderSpaceFeed();
}

// ========== 点赞 ==========
async function toggleLike(dynId) {
  const db = await openChatDB();
  const tx = db.transaction(DYNAMIC_STORE, 'readwrite');
  const store = tx.objectStore(DYNAMIC_STORE);
  const dyn = await new Promise((res, rej) => { const r = store.get(dynId); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  if (!dyn) return;

  if (!dyn.likes) dyn.likes = [];
  const settings = JSON.parse(localStorage.getItem('userChatSettings') || '{}');
  const idx = dyn.likes.findIndex(l => l.isUser);
  const wasLiked = idx >= 0;

  if (wasLiked) {
    dyn.likes.splice(idx, 1);
  } else {
    dyn.likes.push({ name: settings.userName || '我', isUser: true });
  }

  await new Promise((res, rej) => { const r = store.put(dyn); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });

  // If user post and new like, characters may auto-like
  if (dyn.isUserPost && !wasLiked) {
    try {
      const characters = await getAllCharacters();
      for (const char of characters) {
        const prob = (char.affection || 50) * 0.5 / 100;
        if (Math.random() < prob) {
          dyn.likes.push({ name: char.name, characterId: char.id });
        }
      }
      await saveDynamic(dyn);
    } catch (e) { console.error('角色自动点赞失败:', e); }
  }

  await renderSpaceFeed();
}

// ========== 评论 ==========
function toggleCommentInput(dynId) {
  const el = document.getElementById('comment-input-' + dynId);
  if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

async function submitComment(dynId) {
  const input = document.getElementById('comment-text-' + dynId);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const db = await openChatDB();
  const tx = db.transaction(DYNAMIC_STORE, 'readwrite');
  const store = tx.objectStore(DYNAMIC_STORE);
  const dyn = await new Promise((res, rej) => { const r = store.get(dynId); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  if (!dyn) return;

  if (!dyn.comments) dyn.comments = [];
  const settings = JSON.parse(localStorage.getItem('userChatSettings') || '{}');
  dyn.comments.push({ name: settings.userName || '我', text: text, isUser: true, timestamp: Date.now() });
  await saveDynamic(dyn);

  input.value = '';

  // AI reply
  if (!dyn.isUserPost && dyn.characterId) {
    // Character dynamic — reply from that character
    callAIForComment(dyn.characterId, dyn.content, text, dynId);
  } else if (dyn.isUserPost) {
    // User dynamic — random characters may comment
    try {
      const characters = await getAllCharacters();
      for (const char of characters) {
        const prob = (char.affection || 50) * 0.5 / 100;
        if (Math.random() < prob) {
          callAIForComment(char.id, dyn.content, text, dynId);
        }
      }
    } catch (e) { console.error('角色自动评论失败:', e); }
  }

  await renderSpaceFeed();
}

async function callAIForComment(charId, dynContent, userComment, dynId) {
  try {
    const characters = await getAllCharacters();
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    const apiConfig = JSON.parse(localStorage.getItem('apiConfig') || '{}');
    if (!apiConfig.key || !apiConfig.provider) return;

    // 构建包含所有已启用提示词条目的系统提示
    const charName = char.name || '角色';
    const userName = char.userSettings?.name || '用户';
    let systemContent = '';
    const promptEntries = char.promptEntries || [];
    for (const entry of promptEntries) {
      if (!entry.enabled) continue;
      if (entry.id === 'char_persona') {
        systemContent += `【角色人设】\n你是${charName}。`;
        if (char.description) systemContent += `\n描述: ${char.description}`;
        if (char.personality) systemContent += `\n性格: ${char.personality}`;
        if (char.system_prompt) systemContent += `\n${char.system_prompt}`;
        systemContent += '\n\n';
      } else if (entry.id === 'user_persona') {
        systemContent += `【用户人设】\n用户: ${userName}`;
        if (char.userSettings?.persona) systemContent += ` - ${char.userSettings.persona}`;
        systemContent += '\n\n';
      } else if (entry.type === 'custom' && entry.content) {
        systemContent += `【${entry.name}】\n${entry.content.replace(/{{char}}/g, charName).replace(/{{user}}/g, userName)}\n\n`;
      }
    }
    if (!systemContent) {
      systemContent = `你是${charName}。${char.description || ''}`;
    }
    systemContent += '\n请用1-2条短句回复动态评论，不要使用标签。';

    let endpoint = apiConfig.provider;
    if (!endpoint.startsWith('http')) endpoint = 'https://' + endpoint;
    if (!endpoint.includes('/v1/chat/completions')) endpoint = endpoint.replace(/\/$/, '') + '/v1/chat/completions';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.key}` },
      body: JSON.stringify({
        model: apiConfig.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: `动态内容："${dynContent}"。有人评论了："${userComment}"。请回复：` }
        ],
        temperature: 0.9,
        max_tokens: 300
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    const usage = data.usage || {};

    try {
      const _est = (t) => { if(!t)return 0; const s=typeof t==='string'?t:JSON.stringify(t); let c=0,o=0; for(const ch of s){/[\u4e00-\u9fff]/.test(ch)?c++:o++;} return Math.ceil(c/1.5+o/4); };
      let logs = JSON.parse(localStorage.getItem('apiCallLogs') || '[]');
      logs.push({
        timestamp: Date.now(),
        model: apiConfig.model || 'gpt-3.5-turbo',
        inputTokens: usage.prompt_tokens || _est(userComment),
        outputTokens: usage.completion_tokens || _est(reply)
      });
      if (logs.length > 100) logs = logs.slice(-100);
      localStorage.setItem('apiCallLogs', JSON.stringify(logs));
    } catch(e) {}

    if (!reply) return;

    const dyn = await new Promise((res, rej) => {
      const db2tx = chatDB.transaction(DYNAMIC_STORE, 'readwrite');
      const s = db2tx.objectStore(DYNAMIC_STORE);
      const r = s.get(dynId);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    if (!dyn) return;
    if (!dyn.comments) dyn.comments = [];
    dyn.comments.push({ name: char.name, text: reply, characterId: char.id, timestamp: Date.now() });
    await saveDynamic(dyn);
    await renderSpaceFeed();
  } catch (e) {
    console.error('AI评论回复失败:', e);
  }
}

// ========== 删除动态 ==========
async function deletePost(dynId) {
  if (!confirm('确定删除这条动态？')) return;
  try {
    const db = await openChatDB();
    const tx = db.transaction(DYNAMIC_STORE, 'readwrite');
    const store = tx.objectStore(DYNAMIC_STORE);
    store.delete(dynId);
    await new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    await renderSpaceFeed();
  } catch (e) {
    console.error('删除动态失败:', e);
  }
}

// ========== 后台生成完成器 ==========
// 用户退出聊天时如果AI正在生成，生成上下文会保存到 localStorage.pendingGeneration
// 在聊天列表页加载时检查并完成生成
(async function checkPendingGeneration() {
  const pending = localStorage.getItem('pendingGeneration');
  if (!pending) return;
  localStorage.removeItem('pendingGeneration');

  try {
    const ctx = JSON.parse(pending);
    if (!ctx.messages || !ctx.apiConfig || !ctx.chatId) return;

    console.log('后台继续生成回复，chatId:', ctx.chatId);

    // 直接调用API（不用流式，后台用非流式即可）
    let url = ctx.apiConfig.apiUrl || 'https://api.openai.com/v1/chat/completions';
    url = url.replace(/\/+$/, '');
    if (!url.includes('/chat/completions')) {
      url += (url.endsWith('/v1') ? '' : '/v1') + '/chat/completions';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ctx.apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: ctx.apiConfig.model || 'gpt-3.5-turbo',
        messages: ctx.messages,
        temperature: ctx.apiConfig.temperature || 0.8,
        max_tokens: ctx.apiConfig.maxTokens || 1000
      })
    });

    if (!response.ok) {
      console.error('后台生成API错误:', response.status);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (!content) return;

    // 解析回复并保存到数据库
    const db = await openChatDB();

    if (ctx.isGroup) {
      // 群聊：解析多条消息
      const msgRegex = /<(msg|voice)(?:\s+name=["']([^"']*)["'])?(?:\s+[^>]*)?\s*>([\s\S]*?)<\/\1>/gi;
      let match;
      while ((match = msgRegex.exec(content)) !== null) {
        const sender = match[2] || ctx.charName;
        const msgContent = match[3].trim();
        if (!msgContent) continue;

        const msgId = 'bg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        const member = (ctx.members || []).find(m => m.name === sender);
        const msgObj = {
          id: msgId,
          chatId: ctx.chatId,
          content: msgContent,
          type: 'received',
          sender: sender,
          avatar: member?.avatar || null,
          timestamp: Date.now()
        };

        await new Promise((resolve, reject) => {
          const tx = db.transaction(MSG_STORE, 'readwrite');
          tx.objectStore(MSG_STORE).put(msgObj);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    } else {
      // 私聊：解析楼层
      const floorRegex = /<(msg|voice)(?:\s+[^>]*)?\s*>([\s\S]*?)<\/\1>/gi;
      let match;
      const floors = [];
      while ((match = floorRegex.exec(content)) !== null) {
        const floorContent = match[2].trim();
        if (floorContent) floors.push(floorContent);
      }
      // 没有标签包裹时整段作为回复
      if (floors.length === 0) {
        const cleaned = content.replace(/<status>[\s\S]*?<\/status>/gi, '')
          .replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (cleaned) floors.push(cleaned);
      }

      for (const floorContent of floors) {
        const msgId = 'bg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        const msgObj = {
          id: msgId,
          chatId: ctx.chatId,
          content: floorContent,
          type: 'received',
          sender: ctx.charName,
          avatar: ctx.charAvatar,
          timestamp: Date.now()
        };

        await new Promise((resolve, reject) => {
          const tx = db.transaction(MSG_STORE, 'readwrite');
          tx.objectStore(MSG_STORE).put(msgObj);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    }

    console.log('后台生成完成，已保存回复');
  } catch (e) {
    console.error('后台生成失败:', e);
  }
})();
