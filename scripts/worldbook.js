/* scripts/worldbook.js - 世界书管理 */

// 数据库配置（与chat.js共享）
const CHAT_DB_NAME = 'ChatDB';
const CHAT_DB_VERSION = 3;
const CHAR_STORE = 'characters';
const WORLDBOOK_STORE = 'worldbooks';

let wbDB = null;
let currentTab = 'character';
let currentWorldBook = null;
let allCharacters = [];

// 打开数据库
function openWBDatabase() {
  return new Promise((resolve, reject) => {
    if (wbDB) { resolve(wbDB); return; }
    
    const request = indexedDB.open(CHAT_DB_NAME, CHAT_DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { 
      wbDB = request.result; 
      resolve(wbDB); 
    };
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      
      if (!db.objectStoreNames.contains(CHAR_STORE)) {
        const charStore = db.createObjectStore(CHAR_STORE, { keyPath: 'id' });
        charStore.createIndex('name', 'name', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(WORLDBOOK_STORE)) {
        const wbStore = db.createObjectStore(WORLDBOOK_STORE, { keyPath: 'id' });
        wbStore.createIndex('name', 'name', { unique: false });
        wbStore.createIndex('characterId', 'characterId', { unique: false });
        wbStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// 获取所有世界书
async function getAllWorldBooks() {
  const db = await openWBDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORLDBOOK_STORE, 'readonly');
    const store = tx.objectStore(WORLDBOOK_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// 获取单个世界书
async function getWorldBookById(id) {
  const db = await openWBDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORLDBOOK_STORE, 'readonly');
    const store = tx.objectStore(WORLDBOOK_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 保存世界书
async function saveWorldBookToDB(worldbook) {
  const db = await openWBDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORLDBOOK_STORE, 'readwrite');
    const store = tx.objectStore(WORLDBOOK_STORE);
    const request = store.put(worldbook);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 删除世界书
async function deleteWorldBookFromDB(id) {
  const db = await openWBDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WORLDBOOK_STORE, 'readwrite');
    const store = tx.objectStore(WORLDBOOK_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// 获取所有角色
async function getAllCharactersForWB() {
  const db = await openWBDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHAR_STORE, 'readonly');
    const store = tx.objectStore(CHAR_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ========== 页面初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  allCharacters = await getAllCharactersForWB();
  await renderWorldBookList();
  populateCharacterSelect();
});

// 返回上一页
function goBack() {
  const urlParams = new URLSearchParams(window.location.search);
  const from = urlParams.get('from');
  if (from) {
    window.location.href = from;
  } else {
    window.history.back();
  }
}

// 切换标签
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.wb-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  renderWorldBookList();
}

// 填充角色选择下拉框
function populateCharacterSelect() {
  const select = document.getElementById('wb-character');
  if (!select) return;
  
  select.innerHTML = '<option value="">全局世界书（不关联角色）</option>';
  allCharacters.forEach(char => {
    select.innerHTML += `<option value="${char.id}">${escapeHtml(char.name)}</option>`;
  });
}

// 渲染世界书列表
async function renderWorldBookList() {
  const list = document.getElementById('wb-list');
  if (!list) return;
  
  const worldbooks = await getAllWorldBooks();
  
  // 根据标签过滤
  const filtered = worldbooks.filter(wb => {
    if (currentTab === 'global') {
      return !wb.characterId || wb.isGlobal;
    } else {
      return wb.characterId && !wb.isGlobal;
    }
  });
  
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="wb-empty">
        <div class="icon">📚</div>
        <div class="text">
          ${currentTab === 'global' ? '还没有全局世界书' : '还没有角色世界书'}<br>
          点击右上角 + 创建
        </div>
      </div>
    `;
    return;
  }
  
  // 按创建时间排序
  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  
  list.innerHTML = filtered.map(wb => {
    const char = allCharacters.find(c => c.id === wb.characterId);
    const entryCount = wb.entries ? wb.entries.length : 0;
    const enabledCount = wb.entries ? wb.entries.filter(e => e.enabled).length : 0;
    
    return `
      <div class="wb-card" onclick="openWorldBookDetail('${wb.id}')">
        <div class="wb-card-header">
          <div class="wb-icon ${wb.isGlobal || !wb.characterId ? 'global' : ''}">📖</div>
          <div class="wb-card-info">
            <div class="wb-card-name">${escapeHtml(wb.name)}</div>
            <div class="wb-card-meta">
              ${char ? `关联: ${escapeHtml(char.name)}` : '全局世界书'}
            </div>
          </div>
          <div class="wb-card-arrow">›</div>
        </div>
        <div class="wb-card-stats">
          <div class="wb-stat">
            条目: <span class="wb-stat-value">${entryCount}</span>
          </div>
          <div class="wb-stat">
            启用: <span class="wb-stat-value">${enabledCount}</span>
          </div>
          <div class="wb-stat">
            创建: <span class="wb-stat-value">${formatDate(wb.createdAt)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 搜索
async function searchWorldBooks() {
  const keyword = document.getElementById('wb-search-input').value.trim().toLowerCase();
  const cards = document.querySelectorAll('.wb-card');
  
  if (!keyword) {
    cards.forEach(card => card.style.display = 'block');
    return;
  }
  
  const worldbooks = await getAllWorldBooks();
  const wbMap = {};
  worldbooks.forEach(wb => wbMap[wb.id] = wb);
  
  cards.forEach(card => {
    const id = card.getAttribute('onclick').match(/'([^']+)'/)[1];
    const wb = wbMap[id];
    if (!wb) return;
    
    // 搜索名称、描述、条目关键词和内容
    let matches = wb.name.toLowerCase().includes(keyword) ||
                  (wb.description && wb.description.toLowerCase().includes(keyword));
    
    if (!matches && wb.entries) {
      matches = wb.entries.some(entry => 
        (entry.comment && entry.comment.toLowerCase().includes(keyword)) ||
        (entry.keys && entry.keys.some(k => k.toLowerCase().includes(keyword))) ||
        (entry.content && entry.content.toLowerCase().includes(keyword))
      );
    }
    
    card.style.display = matches ? 'block' : 'none';
  });
}

// ========== 创建/编辑世界书 ==========
function openCreateModal() {
  document.getElementById('create-modal-title').textContent = '创建世界书';
  document.getElementById('wb-name').value = '';
  document.getElementById('wb-description').value = '';
  document.getElementById('wb-character').value = currentTab === 'global' ? '' : '';
  document.getElementById('wb-edit-id').value = '';
  document.getElementById('create-wb-modal').classList.add('active');
}

function closeCreateModal() {
  document.getElementById('create-wb-modal').classList.remove('active');
}

async function saveWorldBook() {
  const name = document.getElementById('wb-name').value.trim();
  if (!name) {
    alert('请输入世界书名称');
    return;
  }
  
  const editId = document.getElementById('wb-edit-id').value;
  const characterId = document.getElementById('wb-character').value;
  
  let worldbook;
  if (editId) {
    worldbook = await getWorldBookById(editId);
    worldbook.name = name;
    worldbook.description = document.getElementById('wb-description').value.trim();
    worldbook.characterId = characterId || null;
    worldbook.isGlobal = !characterId;
  } else {
    worldbook = {
      id: 'wb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: name,
      description: document.getElementById('wb-description').value.trim(),
      characterId: characterId || null,
      isGlobal: !characterId,
      createdAt: Date.now(),
      entries: []
    };
  }
  
  await saveWorldBookToDB(worldbook);
  closeCreateModal();
  renderWorldBookList();
}

// ========== 世界书详情 ==========
async function openWorldBookDetail(id) {
  currentWorldBook = await getWorldBookById(id);
  if (!currentWorldBook) return;
  
  const char = allCharacters.find(c => c.id === currentWorldBook.characterId);
  
  document.getElementById('detail-modal-title').textContent = currentWorldBook.name;
  document.getElementById('detail-name').textContent = currentWorldBook.name;
  document.getElementById('detail-description').textContent = currentWorldBook.description || '无描述';
  document.getElementById('detail-character').textContent = char ? char.name : '全局';
  
  renderEntriesList();
  document.getElementById('wb-detail-modal').classList.add('active');
}

function closeDetailModal() {
  document.getElementById('wb-detail-modal').classList.remove('active');
  currentWorldBook = null;
}

// 渲染条目列表
function renderEntriesList() {
  const list = document.getElementById('entries-list');
  const entries = currentWorldBook.entries || [];
  
  document.getElementById('entries-count').textContent = entries.length;
  
  if (entries.length === 0) {
    list.innerHTML = `
      <div class="wb-empty" style="padding: 30px;">
        <div class="icon" style="font-size: 40px;">📝</div>
        <div class="text" style="font-size: 14px;">还没有条目，点击上方按钮添加</div>
      </div>
    `;
    return;
  }
  
  // 按顺序排序
  entries.sort((a, b) => (a.order || 0) - (b.order || 0));
  
  list.innerHTML = entries.map((entry, index) => `
    <div class="entry-card ${entry.enabled ? '' : 'disabled'} ${entry.constant ? 'constant' : ''}">
      <div class="entry-header">
        <div class="entry-toggle ${entry.enabled ? 'active' : ''}" 
             onclick="event.stopPropagation(); toggleEntry(${index})"></div>
        <div class="entry-info" onclick="editEntry(${index})">
          <div class="entry-name">${escapeHtml(entry.comment) || `条目 ${index + 1}`}</div>
          <div class="entry-keys">
            ${(entry.keys || []).slice(0, 5).map(k => `<span>${escapeHtml(k)}</span>`).join('')}
            ${entry.keys && entry.keys.length > 5 ? `<span>+${entry.keys.length - 5}</span>` : ''}
          </div>
        </div>
        <div class="entry-badges">
          ${entry.constant ? '<span class="entry-badge constant">常驻</span>' : ''}
          ${entry.selective ? '<span class="entry-badge selective">选择性</span>' : ''}
        </div>
        <div class="entry-actions">
          <button class="entry-action-btn" onclick="event.stopPropagation(); editEntry(${index})">✏️</button>
          <button class="entry-action-btn" onclick="event.stopPropagation(); deleteEntry(${index})">🗑️</button>
        </div>
      </div>
      <div class="entry-content-preview">${escapeHtml(entry.content || '')}</div>
    </div>
  `).join('');
}

// 切换条目启用状态
async function toggleEntry(index) {
  if (!currentWorldBook || !currentWorldBook.entries[index]) return;
  
  currentWorldBook.entries[index].enabled = !currentWorldBook.entries[index].enabled;
  await saveWorldBookToDB(currentWorldBook);
  renderEntriesList();
}

// 删除条目
async function deleteEntry(index) {
  if (!confirm('确定删除此条目？')) return;
  
  currentWorldBook.entries.splice(index, 1);
  await saveWorldBookToDB(currentWorldBook);
  renderEntriesList();
}

// ========== 条目编辑 ==========
function openEntryModal() {
  document.getElementById('entry-modal-title').textContent = '添加条目';
  document.getElementById('entry-comment').value = '';
  document.getElementById('entry-keys').value = '';
  document.getElementById('entry-secondary-keys').value = '';
  document.getElementById('entry-content').value = '';
  document.getElementById('entry-position').value = 'before_char';
  document.getElementById('entry-priority').value = '10';
  document.getElementById('entry-depth').value = '4';
  document.getElementById('entry-order').value = currentWorldBook.entries ? currentWorldBook.entries.length : 0;
  document.getElementById('entry-enabled').checked = true;
  document.getElementById('entry-constant').checked = false;
  document.getElementById('entry-selective').checked = false;
  document.getElementById('entry-edit-id').value = '';
  document.getElementById('entry-modal').classList.add('active');
}

function editEntry(index) {
  const entry = currentWorldBook.entries[index];
  if (!entry) return;
  
  document.getElementById('entry-modal-title').textContent = '编辑条目';
  document.getElementById('entry-comment').value = entry.comment || '';
  document.getElementById('entry-keys').value = (entry.keys || []).join(', ');
  document.getElementById('entry-secondary-keys').value = (entry.secondaryKeys || []).join(', ');
  document.getElementById('entry-content').value = entry.content || '';
  document.getElementById('entry-position').value = entry.position || 'before_char';
  document.getElementById('entry-priority').value = entry.priority || 10;
  document.getElementById('entry-depth').value = entry.depth || 4;
  document.getElementById('entry-order').value = entry.order || index;
  document.getElementById('entry-enabled').checked = entry.enabled !== false;
  document.getElementById('entry-constant').checked = entry.constant || false;
  document.getElementById('entry-selective').checked = entry.selective || false;
  document.getElementById('entry-edit-id').value = index.toString();
  document.getElementById('entry-modal').classList.add('active');
}

function closeEntryModal() {
  document.getElementById('entry-modal').classList.remove('active');
}

async function saveEntry() {
  const keys = document.getElementById('entry-keys').value.trim();
  const content = document.getElementById('entry-content').value.trim();
  
  if (!keys) {
    alert('请输入触发关键词');
    return;
  }
  if (!content) {
    alert('请输入条目内容');
    return;
  }
  
  const entry = {
    id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    comment: document.getElementById('entry-comment').value.trim(),
    keys: keys.split(',').map(k => k.trim()).filter(k => k),
    secondaryKeys: document.getElementById('entry-secondary-keys').value.split(',').map(k => k.trim()).filter(k => k),
    content: content,
    position: document.getElementById('entry-position').value,
    priority: parseInt(document.getElementById('entry-priority').value) || 10,
    depth: parseInt(document.getElementById('entry-depth').value) || 4,
    order: parseInt(document.getElementById('entry-order').value) || 0,
    enabled: document.getElementById('entry-enabled').checked,
    constant: document.getElementById('entry-constant').checked,
    selective: document.getElementById('entry-selective').checked
  };
  
  const editId = document.getElementById('entry-edit-id').value;
  
  if (editId !== '') {
    const index = parseInt(editId);
    currentWorldBook.entries[index] = { ...currentWorldBook.entries[index], ...entry };
  } else {
    if (!currentWorldBook.entries) currentWorldBook.entries = [];
    currentWorldBook.entries.push(entry);
  }
  
  await saveWorldBookToDB(currentWorldBook);
  closeEntryModal();
  renderEntriesList();
}

// ========== 编辑/删除当前世界书 ==========
function editCurrentWorldBook() {
  if (!currentWorldBook) return;
  
  document.getElementById('create-modal-title').textContent = '编辑世界书';
  document.getElementById('wb-name').value = currentWorldBook.name;
  document.getElementById('wb-description').value = currentWorldBook.description || '';
  document.getElementById('wb-character').value = currentWorldBook.characterId || '';
  document.getElementById('wb-edit-id').value = currentWorldBook.id;
  
  closeDetailModal();
  document.getElementById('create-wb-modal').classList.add('active');
}

async function deleteCurrentWorldBook() {
  if (!currentWorldBook) return;
  if (!confirm(`确定删除世界书"${currentWorldBook.name}"及其所有条目？`)) return;
  
  await deleteWorldBookFromDB(currentWorldBook.id);
  closeDetailModal();
  renderWorldBookList();
}

// ========== 导入/导出 ==========
function openImportModal() {
  document.getElementById('import-paste-area').style.display = 'none';
  document.getElementById('import-modal').classList.add('active');
}

function closeImportModal() {
  document.getElementById('import-modal').classList.remove('active');
}

function importFromFile() {
  document.getElementById('wb-file-input').click();
}

function importFromClipboard() {
  document.getElementById('import-paste-area').style.display = 'block';
  document.getElementById('import-text').value = '';
  document.getElementById('import-text').focus();
}

async function handleFileImport(input) {
  if (!input.files || !input.files[0]) return;
  
  try {
    const text = await input.files[0].text();
    await processImportData(text);
    closeImportModal();
  } catch (e) {
    alert('导入失败: ' + e.message);
  }
  
  input.value = '';
}

async function processImport() {
  const text = document.getElementById('import-text').value.trim();
  if (!text) {
    alert('请粘贴世界书数据');
    return;
  }
  
  try {
    await processImportData(text);
    closeImportModal();
  } catch (e) {
    alert('导入失败: ' + e.message);
  }
}

async function processImportData(jsonText) {
  const data = JSON.parse(jsonText);
  
  // 支持多种格式
  let worldbooks = [];
  
  if (Array.isArray(data)) {
    worldbooks = data;
  } else if (data.entries && Array.isArray(data.entries)) {
    // SillyTavern格式
    worldbooks = [{
      name: data.name || '导入的世界书',
      description: data.description || '',
      entries: data.entries
    }];
  } else if (data.data && data.data.entries) {
    worldbooks = [{
      name: data.data.name || data.name || '导入的世界书',
      description: data.data.description || data.description || '',
      entries: data.data.entries
    }];
  } else {
    worldbooks = [data];
  }
  
  for (const wbData of worldbooks) {
    const worldbook = {
      id: 'wb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: wbData.name || '导入的世界书',
      description: wbData.description || '',
      characterId: null,
      isGlobal: true,
      createdAt: Date.now(),
      entries: (wbData.entries || []).map((entry, index) => ({
        id: 'entry_' + Date.now() + '_' + index,
        keys: entry.keys || (entry.key ? entry.key.split(',').map(k => k.trim()) : []),
        secondaryKeys: entry.secondary_keys || entry.secondaryKeys || [],
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
  }
  
  alert(`成功导入 ${worldbooks.length} 本世界书`);
  renderWorldBookList();
}

function exportCurrentWorldBook() {
  if (!currentWorldBook) return;
  
  const exportData = {
    name: currentWorldBook.name,
    description: currentWorldBook.description,
    entries: currentWorldBook.entries
  };
  
  downloadJSON(exportData, `${currentWorldBook.name}.json`);
}

async function exportAllWorldBooks() {
  const worldbooks = await getAllWorldBooks();
  const exportData = worldbooks.map(wb => ({
    name: wb.name,
    description: wb.description,
    entries: wb.entries
  }));
  
  downloadJSON(exportData, '所有世界书.json');
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ========== 工具函数 ==========
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return `${date.getMonth()+1}/${date.getDate()}`;
}
