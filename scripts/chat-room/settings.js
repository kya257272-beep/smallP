/* scripts/chat-room/settings.js - 设置弹窗模块 */

const ChatSettings = {
  openSettings() {
    ChatUI.showModal('settings-modal');
  },

  closeSettings() {
    ChatUI.hideModal('settings-modal');
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // ========== 编辑角色设定 ==========
  openEditCharacter() {
    this.closeSettings();
    const char = ChatCore.currentCharacter;

    if (!char.dynamicsSettings) {
      char.dynamicsSettings = {
        enabled: false,
        postDiary: false,
        postMoments: false,
        frequency: '12h',
        triggerOnEvents: true,
        groupFrequency: 'normal'
      };
    }

    if (!char.perceptionSettings) {
      char.perceptionSettings = {
        timeAware: false,
        weatherAware: false,
        dateAware: false
      };
    }

    document.getElementById('edit-modal-title').textContent = '编辑角色设定';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="avatar-edit-section">
        <div class="avatar-preview" onclick="document.getElementById('avatar-input').click()">
          ${char.avatar ? `<img src="${char.avatar}">` : `<div class="avatar-placeholder-big">${char.name.charAt(0)}</div>`}
          <div class="avatar-edit-overlay">📷 更换</div>
        </div>
      </div>

      <div class="collapse-panel open">
        <div class="collapse-header" onclick="toggleCollapse(this)">
          <span class="collapse-title">📝 基本信息</span>
          <span class="collapse-arrow">▼</span>
        </div>
        <div class="collapse-body">
          <div class="form-group">
            <label>角色名</label>
            <input type="text" id="edit-char-name" value="${this.escapeHtml(char.name || '')}">
          </div>
          <div class="form-group">
            <label>个性签名</label>
            <input type="text" id="edit-char-signature" value="${this.escapeHtml(char.signature || '')}">
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea id="edit-char-desc" rows="4">${this.escapeHtml(char.description || '')}</textarea>
          </div>
          <div class="form-group">
            <label>性格</label>
            <textarea id="edit-char-personality" rows="3">${this.escapeHtml(char.personality || '')}</textarea>
          </div>
        </div>
      </div>

      <div class="collapse-panel">
        <div class="collapse-header" onclick="toggleCollapse(this)">
          <span class="collapse-title">⚙️ 高级设定</span>
          <span class="collapse-arrow">▼</span>
        </div>
        <div class="collapse-body">
          <div class="form-group">
            <label>系统提示词</label>
            <textarea id="edit-char-system" rows="4">${this.escapeHtml(char.system_prompt || '')}</textarea>
          </div>
          <div class="form-group">
            <label>对话示例</label>
            <textarea id="edit-char-example" rows="4">${this.escapeHtml(char.mes_example || '')}</textarea>
          </div>
          <div class="form-group">
            <label>开场白</label>
            <textarea id="edit-char-greeting" rows="3">${this.escapeHtml(char.first_mes || '')}</textarea>
          </div>
        </div>
      </div>

      <div class="collapse-panel">
        <div class="collapse-header" onclick="toggleCollapse(this)">
          <span class="collapse-title">💫 当前状态</span>
          <span class="collapse-arrow">▼</span>
        </div>
        <div class="collapse-body">
          <div class="form-group">
            <label>当前衣着</label>
            <input type="text" id="edit-char-outfit" value="${this.escapeHtml(char.outfit || '')}">
          </div>
          <div class="form-group">
            <label>当前地点</label>
            <input type="text" id="edit-char-location" value="${this.escapeHtml(char.location || '')}">
          </div>
          <div class="form-group">
            <label>好感度 (0-100): <span id="affection-display">${char.affection || 50}</span></label>
            <input type="range" id="edit-char-affection" min="0" max="100" value="${char.affection || 50}" oninput="document.getElementById('affection-display').textContent=this.value">
          </div>
          <div class="form-group">
            <label>心情值 (0-100): <span id="mood-display">${char.mood || 70}</span></label>
            <input type="range" id="edit-char-mood" min="0" max="100" value="${char.mood || 70}" oninput="document.getElementById('mood-display').textContent=this.value">
          </div>
        </div>
      </div>

      <div class="dynamics-section">
        <div class="dynamics-header">
          <span class="dynamics-icon">📱</span>
          <div>
            <div class="dynamics-title">动态与日记</div>
            <div class="dynamics-subtitle">让角色在主界面发布动态</div>
          </div>
        </div>

        <div class="switch-row">
          <div>
            <div class="switch-label">启用动态功能</div>
            <div class="switch-hint">角色会自动发布动态</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="dynamics-enabled" ${char.dynamicsSettings.enabled ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="switch-row">
          <div>
            <div class="switch-label">发布日记</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="dynamics-diary" ${char.dynamicsSettings.postDiary ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="switch-row">
          <div>
            <div class="switch-label">发布朋友圈动态</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="dynamics-moments" ${char.dynamicsSettings.postMoments ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="switch-row">
          <div>
            <div class="switch-label">大事件触发</div>
            <div class="switch-hint">被气到/开心/想炫耀时发送</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="dynamics-events" ${char.dynamicsSettings.triggerOnEvents ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="form-group">
          <label>发送频率</label>
          <div class="frequency-select" id="frequency-select">
            <div class="frequency-option ${char.dynamicsSettings.frequency === '6h' ? 'selected' : ''}" data-value="6h" onclick="selectFrequency(this)">6小时</div>
            <div class="frequency-option ${char.dynamicsSettings.frequency === '12h' ? 'selected' : ''}" data-value="12h" onclick="selectFrequency(this)">12小时</div>
            <div class="frequency-option ${char.dynamicsSettings.frequency === '24h' ? 'selected' : ''}" data-value="24h" onclick="selectFrequency(this)">24小时</div>
            <div class="frequency-option ${char.dynamicsSettings.frequency === 'random' ? 'selected' : ''}" data-value="random" onclick="selectFrequency(this)">随机</div>
          </div>
          <div class="form-hint">角色性格(话少/高冷)会自动降低频率</div>
        </div>

        <div class="form-group">
          <label>群聊发言频率</label>
          <select id="group-frequency">
            <option value="high" ${char.dynamicsSettings.groupFrequency === 'high' ? 'selected' : ''}>活跃</option>
            <option value="normal" ${char.dynamicsSettings.groupFrequency === 'normal' ? 'selected' : ''}>正常</option>
            <option value="low" ${char.dynamicsSettings.groupFrequency === 'low' ? 'selected' : ''}>安静</option>
            <option value="silent" ${char.dynamicsSettings.groupFrequency === 'silent' ? 'selected' : ''}>潜水</option>
          </select>
        </div>
      </div>

      <div class="perception-section">
        <div class="perception-header">
          <div class="perception-icons"><span>🕐</span><span>🌤️</span><span>📅</span></div>
          <div>
            <div class="dynamics-title">环境感知</div>
            <div class="dynamics-subtitle">角色感知现实时间和天气</div>
          </div>
        </div>

        <div class="switch-row">
          <div class="switch-label">时间感知</div>
          <label class="switch">
            <input type="checkbox" id="perception-time" ${char.perceptionSettings.timeAware ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="switch-row">
          <div class="switch-label">天气感知</div>
          <label class="switch">
            <input type="checkbox" id="perception-weather" ${char.perceptionSettings.weatherAware ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="switch-row">
          <div class="switch-label">日期感知</div>
          <label class="switch">
            <input type="checkbox" id="perception-date" ${char.perceptionSettings.dateAware ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>

      <button class="save-btn" onclick="ChatSettings.saveCharacterEdit()">💾 保存设定</button>
    `;

    ChatUI.showModal('edit-modal');
  },

  saveCharacterEdit() {
    const char = ChatCore.currentCharacter;

    char.name = document.getElementById('edit-char-name').value.trim() || char.name;
    char.signature = document.getElementById('edit-char-signature').value.trim();
    char.description = document.getElementById('edit-char-desc').value.trim();
    char.personality = document.getElementById('edit-char-personality').value.trim();
    char.system_prompt = document.getElementById('edit-char-system').value.trim();
    char.mes_example = document.getElementById('edit-char-example').value.trim();
    char.first_mes = document.getElementById('edit-char-greeting').value.trim();
    char.outfit = document.getElementById('edit-char-outfit').value.trim();
    char.location = document.getElementById('edit-char-location').value.trim();
    char.affection = parseInt(document.getElementById('edit-char-affection').value) || 50;
    char.mood = parseInt(document.getElementById('edit-char-mood').value) || 70;

    const selectedFreq = document.querySelector('.frequency-option.selected');
    char.dynamicsSettings = {
      enabled: document.getElementById('dynamics-enabled').checked,
      postDiary: document.getElementById('dynamics-diary').checked,
      postMoments: document.getElementById('dynamics-moments').checked,
      triggerOnEvents: document.getElementById('dynamics-events').checked,
      frequency: selectedFreq ? selectedFreq.dataset.value : '12h',
      groupFrequency: document.getElementById('group-frequency').value
    };

    char.perceptionSettings = {
      timeAware: document.getElementById('perception-time').checked,
      weatherAware: document.getElementById('perception-weather').checked,
      dateAware: document.getElementById('perception-date').checked
    };

    ChatCore.saveCharacter();
    ChatUI.updateTopbar(char);
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('保存成功');
  },

  // ========== 用户设定 ==========
  openUserSettings() {
    this.closeSettings();
    const user = ChatCore.userSettings;

    document.getElementById('edit-modal-title').textContent = '用户设定';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="avatar-edit-section">
        <div class="avatar-preview" onclick="document.getElementById('user-avatar-input').click()">
          ${user.avatar ? `<img src="${user.avatar}">` : `<div class="avatar-placeholder-big">我</div>`}
          <div class="avatar-edit-overlay">📷</div>
        </div>
      </div>
      
      <div class="form-group">
        <label>你的名字</label>
        <input type="text" id="edit-user-name" value="${this.escapeHtml(user.name || '我')}">
      </div>
      <div class="form-group">
        <label>个人设定</label>
        <textarea id="edit-user-persona" rows="5">${this.escapeHtml(user.persona || '')}</textarea>
      </div>
      
      <button class="save-btn" onclick="ChatSettings.saveUserSettings()">保存</button>
    `;

    ChatUI.showModal('edit-modal');
  },

  saveUserSettings() {
    ChatCore.userSettings.name = document.getElementById('edit-user-name').value.trim() || '我';
    ChatCore.userSettings.persona = document.getElementById('edit-user-persona').value.trim();
    ChatCore.saveUserSettings();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('保存成功');
  },

  // ========== 预设选择 ==========
  openPresetSettings() {
    this.closeSettings();
    const presets = JSON.parse(localStorage.getItem('presetConfigs') || '[]');
    const currentId = ChatCore.currentCharacter.settings?.presetId;

    let html = `<div class="hint-text">选择预设定义角色的说话风格</div><div class="preset-select-list">`;

    html += `
      <div class="preset-select-item ${!currentId ? 'selected' : ''}" onclick="ChatSettings.selectPreset('')">
        <div class="preset-icon">🚫</div>
        <div class="preset-info">
          <span class="preset-name">不使用预设</span>
          <span class="preset-meta">使用角色自带设定</span>
        </div>
        ${!currentId ? '<span class="preset-check">✓</span>' : ''}
      </div>
    `;

    presets.forEach(p => {
      const isSelected = p.id === currentId;
      const entryCount = (p.entries || []).filter(e => e.enabled).length;
      html += `
        <div class="preset-select-item ${isSelected ? 'selected' : ''}" onclick="ChatSettings.selectPreset('${p.id}')">
          <div class="preset-icon">📝</div>
          <div class="preset-info">
            <span class="preset-name">${this.escapeHtml(p.name)}</span>
            <span class="preset-meta">${entryCount} 条Prompt · ${p.description || '无描述'}</span>
          </div>
          ${isSelected ? '<span class="preset-check">✓</span>' : ''}
        </div>
      `;
    });

    html += '</div><a class="goto-link" href="preset.html">⚙️ 管理预设 →</a>';

    document.getElementById('edit-modal-title').textContent = '预设/Prompt';
    document.getElementById('edit-modal-body').innerHTML = html;
    ChatUI.showModal('edit-modal');
  },

  selectPreset(presetId) {
    ChatCore.currentCharacter.settings.presetId = presetId || null;
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast(presetId ? '预设已应用' : '已取消预设');
  },

  // ========== 世界书选择 ==========
  openWorldBook() {
    this.closeSettings();
    const worldBooks = JSON.parse(localStorage.getItem('worldBooks') || '[]');
    const currentId = ChatCore.currentCharacter.settings?.worldBookId;

    let html = `<div class="hint-text">世界书为角色提供背景知识</div><div class="preset-select-list">`;

    html += `
      <div class="preset-select-item ${!currentId ? 'selected' : ''}" onclick="ChatSettings.selectWorldBook('')">
        <div class="preset-icon">🚫</div>
        <div class="preset-info">
          <span class="preset-name">不使用世界书</span>
        </div>
        ${!currentId ? '<span class="preset-check">✓</span>' : ''}
      </div>
    `;

    worldBooks.forEach(wb => {
      const isSelected = wb.id === currentId;
      const entryCount = (wb.entries || []).length;
      const keywords = (wb.entries || []).slice(0, 3).map(e => (e.keywords || [])[0]).filter(Boolean).join(', ');
      html += `
        <div class="preset-select-item ${isSelected ? 'selected' : ''}" onclick="ChatSettings.selectWorldBook('${wb.id}')">
          <div class="preset-icon">📚</div>
          <div class="preset-info">
            <span class="preset-name">${this.escapeHtml(wb.name)}</span>
            <span class="preset-meta">${entryCount} 条目 · ${keywords || '无关键词'}</span>
          </div>
          ${isSelected ? '<span class="preset-check">✓</span>' : ''}
        </div>
      `;
    });

    html += '</div><a class="goto-link" href="worldbook.html">📚 管理世界书 →</a>';

    document.getElementById('edit-modal-title').textContent = '世界书';
    document.getElementById('edit-modal-body').innerHTML = html;
    ChatUI.showModal('edit-modal');
  },

  selectWorldBook(wbId) {
    ChatCore.currentCharacter.settings.worldBookId = wbId || null;
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast(wbId ? '世界书已绑定' : '已取消绑定');
  },

  // ========== 头像框设置 ==========
  openAvatarFrameSettings() {
    this.closeSettings();
    const charFrame = ChatCore.currentCharacter.settings?.avatarFrame || '';
    const userFrame = ChatCore.userSettings?.avatarFrame || '';

    const frames = [
      { id: '', name: '无框', icon: '⭕' },
      { id: 'gold', name: '金色尊贵', icon: '👑' },
      { id: 'rainbow', name: '彩虹绚丽', icon: '🌈' },
      { id: 'blue', name: '海洋之心', icon: '💙' },
      { id: 'pink', name: '甜蜜粉红', icon: '💗' },
      { id: 'purple', name: '神秘紫罗兰', icon: '💜' }
    ];

    const renderFrames = (selectedId, isChar) => frames.map(f => `
      <div class="frame-option ${selectedId === f.id ? 'selected' : ''}" onclick="ChatSettings.${isChar ? 'setCharFrame' : 'setUserFrame'}('${f.id}')">
        <div class="frame-preview ${f.id}">${isChar ? (ChatCore.currentCharacter.name || '?').charAt(0) : '我'}</div>
        <span class="frame-name">${f.icon} ${f.name}</span>
      </div>
    `).join('');

    document.getElementById('edit-modal-title').textContent = '头像框设置';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="frame-section">
        <div class="frame-section-title">💠 角色头像框</div>
        <div class="frame-options">${renderFrames(charFrame, true)}</div>
      </div>
      <div class="divider"></div>
      <div class="frame-section">
        <div class="frame-section-title">💠 你的头像框</div>
        <div class="frame-options">${renderFrames(userFrame, false)}</div>
      </div>
    `;
    ChatUI.showModal('edit-modal');
  },

  setCharFrame(frameId) {
    ChatCore.currentCharacter.settings.avatarFrame = frameId;
    ChatCore.saveCharacter();
    this.openAvatarFrameSettings();
  },

  setUserFrame(frameId) {
    ChatCore.userSettings.avatarFrame = frameId;
    ChatCore.saveUserSettings();
    this.openAvatarFrameSettings();
  },

  // ========== 聊天背景 ==========
  openChatBackground() {
    this.closeSettings();
    const charBg = ChatCore.currentCharacter.settings?.chatBackground;

    document.getElementById('edit-modal-title').textContent = '聊天背景';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="bg-options">
        <div class="bg-preview">${charBg ? `<img src="${charBg}">` : '<span>暂无背景</span>'}</div>
        <div class="bg-btns">
          <button class="small-btn" onclick="document.getElementById('bg-input').click()">选择图片</button>
          <button class="small-btn" onclick="ChatSettings.setBgFromUrl()">从URL</button>
          <button class="small-btn danger" onclick="ChatSettings.clearChatBg()">清除</button>
        </div>
      </div>
    `;
    ChatUI.showModal('edit-modal');
  },

  setBgFromUrl() {
    const url = prompt('输入背景图片URL:');
    if (url) {
      ChatCore.currentCharacter.settings.chatBackground = url;
      ChatCore.saveCharacter();
      ChatUI.applyBackground(url);
      ChatUI.hideModal('edit-modal');
    }
  },

  clearChatBg() {
    ChatCore.currentCharacter.settings.chatBackground = null;
    ChatCore.saveCharacter();
    ChatUI.applyBackground(null);
    ChatUI.hideModal('edit-modal');
  },

  // ========== 上下文条数 ==========
  openContextSettings() {
    this.closeSettings();
    const count = ChatCore.currentCharacter.settings?.contextCount || 20;

    document.getElementById('edit-modal-title').textContent = '上下文条数';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="context-slider-container">
        <div class="context-value" id="context-value">${count}</div>
        <input type="range" class="context-slider" id="context-slider" min="5" max="100" value="${count}" oninput="document.getElementById('context-value').textContent=this.value">
        <div class="context-hint">更多上下文=更好记忆，但消耗更多token</div>
      </div>
      <button class="save-btn" onclick="ChatSettings.saveContextCount()">保存</button>
    `;
    ChatUI.showModal('edit-modal');
  },

  saveContextCount() {
    const count = parseInt(document.getElementById('context-slider').value);
    ChatCore.currentCharacter.settings.contextCount = count;
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast(`上下文设为 ${count} 条`);
  },

  // ========== 其他 ==========
  toggleOfflineMode() {
    this.closeSettings();
    const char = ChatCore.currentCharacter;
    char.settings.offlineMode = !char.settings.offlineMode;
    ChatCore.saveCharacter();
    ChatUI.updateTopbar(char);
    ChatUtils.showToast(char.settings.offlineMode ? '已进入离线模式' : '已恢复在线');
  },

  async deleteCharacter() {
    if (!confirm(`确定要删除角色 "${ChatCore.currentCharacter.name}" 吗？`)) return;

    const db = await openChatDB();
    const charTx = db.transaction(CHAR_STORE, 'readwrite');
    charTx.objectStore(CHAR_STORE).delete(ChatCore.currentChatId);

    const msgTx = db.transaction(MSG_STORE, 'readwrite');
    const msgStore = msgTx.objectStore(MSG_STORE);
    const index = msgStore.index('chatId');
    const request = index.getAllKeys(ChatCore.currentChatId);
    request.onsuccess = () => (request.result || []).forEach(key => msgStore.delete(key));

    msgTx.oncomplete = () => {
      ChatUtils.showToast('角色已删除');
      setTimeout(() => ChatCore.goBack(), 500);
    };
  }
};

window.ChatSettings = ChatSettings;
