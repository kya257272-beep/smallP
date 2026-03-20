/* scripts/chat-room/settings.js - 设置弹窗模块 */

const ChatSettings = {
  openSettings() {
    const char = ChatCore.currentCharacter;
    if (char && char.isGroup) {
      this.renderGroupSettings();
    }
    ChatUI.showModal('settings-modal');
  },

  renderGroupSettings() {
    const list = document.querySelector('#settings-modal .settings-list');
    if (!list) return;
    const char = ChatCore.currentCharacter;
    list.innerHTML = `
      <div class="settings-item" onclick="ChatGroup.openGroupEdit()">
        <span class="settings-icon themed-icon">✎</span>
        <span class="settings-text themed-text">编辑群信息</span>
        <span class="settings-arrow themed-text">›</span>
      </div>
      <div class="settings-item" onclick="ChatGroup.openMemberManager()">
        <span class="settings-icon themed-icon">⚤</span>
        <span class="settings-text themed-text">成员管理 (${(char.members || []).length}人)</span>
        <span class="settings-arrow themed-text">›</span>
      </div>
      <div class="settings-item" onclick="ChatGroup.openAutoChatSettings()">
        <span class="settings-icon themed-icon">⊚</span>
        <span class="settings-text themed-text">自动聊天</span>
        <span class="settings-arrow themed-text">›</span>
      </div>
      <div class="settings-item" onclick="openChatBackground()">
        <span class="settings-icon themed-icon">▣</span>
        <span class="settings-text themed-text">群背景</span>
        <span class="settings-arrow themed-text">›</span>
      </div>
      <div class="settings-item" onclick="openContextSettings()">
        <span class="settings-icon themed-icon">▤</span>
        <span class="settings-text themed-text">上下文条数</span>
        <span class="settings-arrow themed-text">›</span>
      </div>
      <div class="settings-item" onclick="ChatGroup.openMuteSettings()">
        <span class="settings-icon themed-icon">⊘</span>
        <span class="settings-text themed-text">禁言设置</span>
        <span class="settings-arrow themed-text">›</span>
      </div>
      <div class="settings-item" onclick="clearChatHistory()">
        <span class="settings-icon themed-icon">⊠</span>
        <span class="settings-text themed-text">清空聊天记录</span>
        <span class="settings-arrow themed-text">›</span>
      </div>
      <div class="settings-item danger" onclick="ChatGroup.dissolveGroup()">
        <span class="settings-icon">✗</span>
        <span class="settings-text">解散群聊</span>
        <span class="settings-arrow">›</span>
      </div>
    `;
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
        frequency: '12h',
        triggerOnEvents: true,
        customHours: null
      };
    }

    if (!char.perceptionSettings) {
      char.perceptionSettings = {
        timeAware: false,
        weatherAware: false,
        dateAware: false
      };
    }

    if (!char.illustrations) char.illustrations = [];
    const presetSlots = ['高兴', '平静', '生气', '难过'];
    // 确保预设槽位存在，插入到数组最前面并保持顺序
    for (let j = presetSlots.length - 1; j >= 0; j--) {
      const mood = presetSlots[j];
      if (!char.illustrations.find(ill => ill.preset === mood)) {
        char.illustrations.unshift({ id: 'preset_' + mood, name: char.name + '_' + mood, preset: mood, data: null });
      }
    }
    char.illustrations.forEach(ill => {
      if (ill.preset) ill.name = char.name + '_' + ill.preset;
    });

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
            <label>对话示例</label>
            <textarea id="edit-char-example" rows="4">${this.escapeHtml(char.mes_example || '')}</textarea>
          </div>
          <div class="form-group">
            <label>开场白</label>
            <textarea id="edit-char-greeting" rows="3">${this.escapeHtml(char.first_mes || '')}</textarea>
          </div>
        </div>
      </div>

      <div class="dynamics-section">
        <div class="dynamics-header">
          <div>
            <div class="dynamics-title">动态与日记</div>
            <div class="dynamics-subtitle">让角色在主界面发布动态</div>
          </div>
        </div>

        <div class="switch-row">
          <div>
            <div class="switch-label">启用动态功能</div>
            <div class="switch-hint">启用后角色会根据人设在QQ空间发布动态（吐槽/分享/发癫/炫耀等）</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="dynamics-enabled" ${char.dynamicsSettings.enabled ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="switch-row">
          <div>
            <div class="switch-label">开启日记功能</div>
            <div class="switch-hint">每24小时内随机判定一次，调用日记模型生成日记</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="dynamics-diary" ${char.dynamicsSettings.postDiary ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="form-group" style="margin-top:10px;">
          <label>日记判定概率</label>
          <input type="number" id="diary-probability" min="0" max="100" value="${char.diarySettings?.probability || 50}" style="width:80px;padding:6px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
          <span style="font-size:13px;color:#666;">%（一篇日记调用一次模型）</span>
        </div>

        <div class="switch-row">
          <div>
            <div class="switch-label">大事件触发</div>
            <div class="switch-hint">大事件可无视时间限制立即发送</div>
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
            <div class="frequency-option ${char.dynamicsSettings.frequency === 'custom' ? 'selected' : ''}" data-value="custom" onclick="selectFrequency(this)">自定义</div>
          </div>
          <div class="custom-freq-row" id="custom-freq-row" style="display:${char.dynamicsSettings.frequency === 'custom' ? 'flex' : 'none'}; align-items:center; gap:8px; margin-top:8px;">
            <input type="number" id="custom-freq-input" min="1" max="168" value="${char.dynamicsSettings.customHours || 8}" style="width:80px;padding:6px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px;">
            <span style="font-size:13px;color:#666;">小时</span>
          </div>
          <div class="form-hint">角色性格(话少/高冷)会自动降低频率</div>
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
          <div>
            <div class="switch-label">时间感知</div>
            <div class="switch-hint">角色感知现实日期和时间（如 2026年3月20日 周四 14:30）</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="perception-time" ${char.perceptionSettings.timeAware ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="switch-row">
          <div>
            <div class="switch-label">天气感知</div>
            <div class="switch-hint">读取主界面天气系统的天气数据</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="perception-weather" ${char.perceptionSettings.weatherAware ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>

        <div class="switch-row">
          <div>
            <div class="switch-label">节日感知</div>
            <div class="switch-hint">注入星期几和节日信息</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="perception-date" ${char.perceptionSettings.dateAware ? 'checked' : ''}>
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="collapse-panel">
        <div class="collapse-header" onclick="toggleCollapse(this)">
          <span class="collapse-title">🖼️ 角色立绘</span>
          <span class="collapse-arrow">▼</span>
        </div>
        <div class="collapse-body">
          <div class="illustration-grid" id="illustration-grid">
            ${char.illustrations.map((ill, i) => `
              <div class="illustration-item${ill.preset ? ' preset-slot' : ''}">
                ${ill.data
                  ? `<img src="${ill.data}" class="illustration-thumb" onclick="ChatSettings.${ill.preset ? 'uploadPresetSlot(' + i + ')' : 'renameIllustration(' + i + ')'}">
                     <button class="illustration-delete" onclick="ChatSettings.${ill.preset ? 'clearPresetSlot(' + i + ')' : 'deleteIllustration(' + i + ')'}">✕</button>`
                  : `<div class="illustration-empty" onclick="ChatSettings.uploadPresetSlot(${i})">+</div>`
                }
                <div class="illustration-name">${this.escapeHtml(ill.name)}</div>
              </div>
            `).join('')}
          </div>
          <button class="save-btn" style="margin-top:10px;background:#4CAF50" onclick="ChatSettings.addIllustration()">+ 添加自定义立绘</button>
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
    char.mes_example = document.getElementById('edit-char-example').value.trim();
    char.first_mes = document.getElementById('edit-char-greeting').value.trim();

    const selectedFreq = document.querySelector('.frequency-option.selected');
    const freq = selectedFreq ? selectedFreq.dataset.value : '12h';
    char.dynamicsSettings = {
      enabled: document.getElementById('dynamics-enabled').checked,
      postDiary: document.getElementById('dynamics-diary').checked,
      triggerOnEvents: document.getElementById('dynamics-events').checked,
      frequency: freq,
      customHours: freq === 'custom' ? (parseInt(document.getElementById('custom-freq-input').value) || 8) : null
    };

    char.perceptionSettings = {
      timeAware: document.getElementById('perception-time').checked,
      weatherAware: document.getElementById('perception-weather').checked,
      dateAware: document.getElementById('perception-date').checked
    };

    char.diarySettings = {
      probability: parseInt(document.getElementById('diary-probability').value) || 50
    };

    ChatCore.saveCharacter();
    ChatUI.updateTopbar(char);
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('保存成功');
  },

  // ========== 角色立绘管理 ==========
  _pendingIllustrationSlot: null,

  addIllustration() {
    this._pendingIllustrationSlot = null;
    document.getElementById('illustration-input').click();
  },

  uploadPresetSlot(index) {
    this._pendingIllustrationSlot = index;
    document.getElementById('illustration-input').click();
  },

  clearPresetSlot(index) {
    const char = ChatCore.currentCharacter;
    if (!char.illustrations || !char.illustrations[index]) return;
    char.illustrations[index].data = null;
    ChatCore.saveCharacter();
    this.openEditCharacter();
  },

  async handleIllustrationUpload(input) {
    if (!input.files || !input.files[0]) return;
    const char = ChatCore.currentCharacter;
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(input.files[0]);
      });
      const compressed = await compressImage(dataUrl, 800, 0.8);
      if (!compressed) { ChatUtils.showToast('图片处理失败'); return; }

      if (this._pendingIllustrationSlot !== null) {
        // 填充指定槽位（预设或自定义）
        const idx = this._pendingIllustrationSlot;
        if (char.illustrations && char.illustrations[idx]) {
          char.illustrations[idx].data = compressed;
        }
        this._pendingIllustrationSlot = null;
      } else {
        // 新增自定义立绘
        const name = prompt('为立绘命名：', char.name + '_立绘');
        if (!name) { input.value = ''; return; }
        if (!char.illustrations) char.illustrations = [];
        char.illustrations.push({
          id: 'ill_' + Date.now(),
          name: name,
          data: compressed
        });
      }
      ChatCore.saveCharacter();
      ChatUtils.showToast('立绘已保存');
      this.openEditCharacter();
    } catch (e) {
      console.error('立绘上传失败:', e);
      ChatUtils.showToast('上传失败');
    }
    input.value = '';
  },

  deleteIllustration(index) {
    const char = ChatCore.currentCharacter;
    if (!char.illustrations || !char.illustrations[index]) return;
    if (char.illustrations[index].preset) return;
    if (!confirm('确定删除此立绘？')) return;
    char.illustrations.splice(index, 1);
    ChatCore.saveCharacter();
    ChatUtils.showToast('立绘已删除');
    this.openEditCharacter();
  },

  renameIllustration(index) {
    const char = ChatCore.currentCharacter;
    if (!char.illustrations || !char.illustrations[index]) return;
    const newName = prompt('重命名立绘：', char.illustrations[index].name);
    if (!newName) return;
    char.illustrations[index].name = newName;
    ChatCore.saveCharacter();
    this.openEditCharacter();
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

  // ========== 提示词排序设置（私聊） ==========
  getDefaultPrivatePromptEntries() {
    return [
      { id: 'char_persona', name: '角色人设', type: 'fixed', enabled: true },
      { id: 'user_persona', name: '用户人设', type: 'fixed', enabled: true },
      { id: 'summary', name: '总结信息', type: 'fixed', enabled: true },
      { id: 'chat_history', name: '聊天记录', type: 'fixed', enabled: true }
    ];
  },

  _getPrivateFixedEntryPreview(entry) {
    const char = ChatCore.currentCharacter;
    const userSettings = ChatCore.userSettings || {};

    switch (entry.id) {
      case 'char_persona': {
        let text = `你是${char.name || '(未设置)'}。`;
        if (char.description) text += `\n描述: ${char.description}`;
        if (char.personality) text += `\n性格: ${char.personality}`;
        if (char.system_prompt) text += `\n${char.system_prompt}`;
        return text;
      }
      case 'user_persona': {
        let text = `用户: ${userSettings.name || '我'}`;
        if (userSettings.persona) text += ` - ${userSettings.persona}`;
        return text;
      }
      case 'summary': {
        const summary = char.summaryContent?.text;
        return summary ? summary.substring(0, 200) + (summary.length > 200 ? '...' : '') : '(暂无总结内容)';
      }
      case 'chat_history':
        return '(通过上下文消息自动注入，不在系统提示词中)';
      default:
        return '(未知固定条目)';
    }
  },

  openPromptOrderSettings() {
    this.closeSettings();
    const char = ChatCore.currentCharacter;
    if (!char.promptEntries) {
      char.promptEntries = this.getDefaultPrivatePromptEntries();
    }

    let html = '<div class="prompt-hint">拖动条目可调整提示词组装顺序。点击固定项可展开查看内容。</div>';
    html += '<div class="prompt-order-list" id="prompt-order-list">';
    char.promptEntries.forEach((entry, i) => {
      const isFixed = entry.type === 'fixed';
      const fixedPreview = isFixed ? this._getPrivateFixedEntryPreview(entry) : '';
      html += `
        <div class="prompt-order-item ${isFixed ? 'fixed' : 'custom'}" draggable="true" data-index="${i}">
          <span class="drag-handle">⠿</span>
          <div class="prompt-item-info" style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="prompt-item-name">${this.escapeHtml(entry.name)}</span>
              ${isFixed ? '<span style="font-size:11px;color:#999;background:#f0f0f0;padding:1px 6px;border-radius:4px;">固定</span>' : ''}
            </div>
            ${entry.type === 'custom' ? `<span class="prompt-item-preview">${this.escapeHtml((entry.content || '').substring(0, 30))}...</span>` : ''}
            ${isFixed ? `<div class="prompt-fixed-expand" id="prompt-expand-${i}" style="display:none;margin-top:8px;padding:8px 10px;background:#f8f9fa;border-radius:8px;font-size:12px;color:#666;line-height:1.5;white-space:pre-wrap;word-break:break-word;max-height:150px;overflow-y:auto;border:1px solid #eee;">${this.escapeHtml(fixedPreview)}</div>` : ''}
          </div>
          <div class="prompt-item-actions">
            ${isFixed ? `<button class="small-icon-btn" onclick="ChatSettings.toggleFixedPreview(${i})" title="查看内容" style="font-size:14px;">👁</button>` : ''}
            <label class="mini-switch">
              <input type="checkbox" ${entry.enabled ? 'checked' : ''} onchange="ChatSettings.togglePromptEntry(${i}, this.checked)">
              <span class="mini-slider"></span>
            </label>
            ${entry.type === 'custom' ? `
              <button class="small-icon-btn" onclick="ChatSettings.editPromptEntry(${i})">✏️</button>
              <button class="small-icon-btn danger" onclick="ChatSettings.deletePromptEntry(${i})">🗑️</button>
            ` : ''}
          </div>
        </div>
      `;
    });
    html += '</div>';
    html += '<button class="save-btn" style="margin-top:12px;background:#4CAF50" onclick="ChatSettings.addPromptEntry()">+ 添加自定义条目</button>';

    document.getElementById('edit-modal-title').textContent = '提示词';
    document.getElementById('edit-modal-body').innerHTML = html;
    ChatUI.showModal('edit-modal');

    this._initPromptDrag();
  },

  toggleFixedPreview(index) {
    const el = document.getElementById('prompt-expand-' + index);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  },

  _initPromptDrag() {
    const list = document.getElementById('prompt-order-list');
    if (!list) return;
    let draggedItem = null;

    list.querySelectorAll('.prompt-order-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        draggedItem = item;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        draggedItem = null;
        this._savePromptOrder();
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedItem || draggedItem === item) return;
        const rect = item.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) {
          list.insertBefore(draggedItem, item);
        } else {
          list.insertBefore(draggedItem, item.nextSibling);
        }
      });
    });
  },

  _savePromptOrder() {
    const char = ChatCore.currentCharacter;
    const items = document.querySelectorAll('.prompt-order-item');
    const newOrder = [];
    items.forEach(item => {
      const idx = parseInt(item.dataset.index);
      if (char.promptEntries[idx]) {
        newOrder.push(char.promptEntries[idx]);
      }
    });
    char.promptEntries = newOrder;
    ChatCore.saveCharacter();
  },

  togglePromptEntry(index, enabled) {
    const char = ChatCore.currentCharacter;
    if (char.promptEntries[index]) {
      char.promptEntries[index].enabled = enabled;
      ChatCore.saveCharacter();
    }
  },

  addPromptEntry() {
    ChatUI.hideModal('edit-modal');
    document.getElementById('edit-modal-title').textContent = '添加提示词条目';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="form-group">
        <label>条目名称</label>
        <input type="text" id="prompt-entry-name" placeholder="例如: 特殊规则">
      </div>
      <div class="form-group">
        <label>内容</label>
        <textarea id="prompt-entry-content" rows="6" placeholder="提示词内容..."></textarea>
      </div>
      <button class="save-btn" onclick="ChatSettings.saveNewPromptEntry()">添加</button>
    `;
    ChatUI.showModal('edit-modal');
  },

  saveNewPromptEntry() {
    const name = document.getElementById('prompt-entry-name').value.trim();
    const content = document.getElementById('prompt-entry-content').value.trim();
    if (!name) { ChatUtils.showToast('请输入名称'); return; }
    if (!content) { ChatUtils.showToast('请输入内容'); return; }

    const char = ChatCore.currentCharacter;
    if (!char.promptEntries) char.promptEntries = this.getDefaultPrivatePromptEntries();
    char.promptEntries.push({
      id: 'custom_' + Date.now(),
      name,
      content,
      type: 'custom',
      enabled: true
    });
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('条目已添加');
    this.openPromptOrderSettings();
  },

  editPromptEntry(index) {
    const char = ChatCore.currentCharacter;
    const entry = char.promptEntries[index];
    if (!entry || entry.type !== 'custom') return;

    document.getElementById('edit-modal-title').textContent = '编辑提示词条目';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="form-group">
        <label>条目名称</label>
        <input type="text" id="prompt-entry-name" value="${this.escapeHtml(entry.name)}">
      </div>
      <div class="form-group">
        <label>内容</label>
        <textarea id="prompt-entry-content" rows="6">${this.escapeHtml(entry.content || '')}</textarea>
      </div>
      <button class="save-btn" onclick="ChatSettings.saveEditPromptEntry(${index})">保存</button>
    `;
    ChatUI.showModal('edit-modal');
  },

  saveEditPromptEntry(index) {
    const char = ChatCore.currentCharacter;
    const entry = char.promptEntries[index];
    if (!entry) return;
    entry.name = document.getElementById('prompt-entry-name').value.trim() || entry.name;
    entry.content = document.getElementById('prompt-entry-content').value.trim();
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('已保存');
    this.openPromptOrderSettings();
  },

  deletePromptEntry(index) {
    const char = ChatCore.currentCharacter;
    if (!char.promptEntries[index] || char.promptEntries[index].type === 'fixed') return;
    if (!confirm('确定删除此条目？')) return;
    char.promptEntries.splice(index, 1);
    ChatCore.saveCharacter();
    this.openPromptOrderSettings();
  },

  // ========== 头像框设置 ==========
  openAvatarFrameSettings() {
    this.closeSettings();
    const charFrame = ChatCore.currentCharacter.settings?.avatarFrame || '';

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

    const renderFrames = (selectedId) => {
      let html = frames.map(f => `
        <div class="frame-option ${selectedId === f.id ? 'selected' : ''}" onclick="ChatSettings.setCharFrame('${f.id}')">
          <div class="frame-preview ${f.id}">${(ChatCore.currentCharacter.name || '?').charAt(0)}</div>
          <span class="frame-name">${f.icon} ${f.name}</span>
        </div>
      `).join('');
      const isCustom = selectedId.startsWith('custom:');
      const customColor = isCustom ? selectedId.replace('custom:', '') : '#ff6600';
      html += `
        <div class="frame-option ${isCustom ? 'selected' : ''}" onclick="ChatSettings.showCustomCharFrame()">
          <div class="frame-preview" style="${isCustom ? `box-shadow: 0 0 0 2px ${customColor}, 0 0 10px ${customColor}40;` : 'background:#eee;'}">🎨</div>
          <span class="frame-name">🎨 自定义颜色</span>
        </div>
      `;
      return html;
    };

    const savedCSS = localStorage.getItem('globalAvatarCSS') || '';

    document.getElementById('edit-modal-title').textContent = '头像框设置';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="frame-section">
        <div class="frame-section-title">💠 当前角色头像框</div>
        <div class="frame-options">${renderFrames(charFrame)}</div>
        ${charFrame.startsWith('custom:') ? `<div class="custom-frame-picker" style="margin-top:8px;display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f5f5f5;border-radius:8px;"><input type="color" id="char-custom-color" value="${charFrame.replace('custom:', '')}" onchange="ChatSettings.setCharFrame('custom:'+this.value)"><span style="font-size:13px;color:#666;">选择颜色</span></div>` : ''}
      </div>
      <div class="divider"></div>
      <div class="frame-section">
        <div class="frame-section-title">🎨 自定义头像CSS美化</div>
        <textarea id="avatar-css-input" rows="5" placeholder=".message-avatar { border: 2px solid gold; }" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-family:monospace;font-size:13px;resize:vertical;margin-bottom:10px;">${this.escapeHtml(savedCSS)}</textarea>
        <button class="save-btn" onclick="ChatSettings.saveAvatarCSS()">应用CSS</button>
      </div>
    `;
    ChatUI.showModal('edit-modal');
  },

  showCustomCharFrame() {
    const color = prompt('输入自定义颜色值（如 #ff6600）:', '#ff6600');
    if (color) this.setCharFrame('custom:' + color);
  },

  setCharFrame(frameId) {
    ChatCore.currentCharacter.settings.avatarFrame = frameId;
    ChatCore.saveCharacter();
    this.openAvatarFrameSettings();
  },

  saveAvatarCSS() {
    const input = document.getElementById('avatar-css-input');
    if (!input) return;
    const css = input.value;
    localStorage.setItem('globalAvatarCSS', css);
    const styleEl = document.getElementById('custom-avatar-css');
    if (styleEl) styleEl.textContent = css;
    ChatUtils.showToast('头像CSS已应用');
  },

  // ========== 气泡样式设置 ==========
  openBubbleStyleSettings() {
    this.closeSettings();
    const char = ChatCore.currentCharacter;
    if (!char.settings) char.settings = {};
    const bs = char.settings.bubbleStyle || '';
    const bc = char.settings.bubbleColor || '';
    const bcssList = char.settings.bubbleColors || [];
    const bDir = char.settings.bubbleGradientDir || '135deg';
    const bCSS = char.settings.bubbleCSS || '';

    const styles = [
      { id: '', name: '默认' },
      { id: 'rounded', name: '圆润' },
      { id: 'square', name: '方正' },
      { id: 'minimal', name: '简约' },
      { id: 'shadow', name: '立体阴影' }
    ];

    const presetColors = [
      '#12B7F5', '#4CAF50', '#FF6B9D', '#FF9800', '#9C27B0',
      '#E91E63', '#00BCD4', '#795548', '#607D8B', '#F44336',
      '#3F51B5', '#009688', '#CDDC39', '#FF5722', '#673AB7'
    ];

    let html = '';
    // 气泡形状
    html += '<div class="form-group"><label>气泡形状</label><div class="bubble-style-options">';
    styles.forEach(s => {
      html += `<div class="bubble-style-option ${bs === s.id ? 'selected' : ''}" onclick="ChatSettings.setBubbleStyle('${s.id}')">${s.name}</div>`;
    });
    html += '</div></div>';

    // 气泡颜色（支持渐变）
    html += '<div class="form-group"><label>气泡颜色</label>';
    html += '<div class="selected-colors" id="bubble-selected-colors">';
    if (bcssList.length > 0) {
      bcssList.forEach((c, i) => {
        html += `<div class="selected-color-chip" style="background:${c}" onclick="ChatSettings.removeBubbleColor(${i})"><span class="remove-chip">×</span></div>`;
      });
    } else if (bc) {
      html += `<div class="selected-color-chip" style="background:${bc}" onclick="ChatSettings.removeBubbleColor(0)"><span class="remove-chip">×</span></div>`;
    }
    html += '</div>';
    // 渐变方向
    html += '<div class="gradient-direction" id="bubble-gradient-dir">';
    ['90deg', '180deg', '135deg', '45deg'].forEach(dir => {
      const arrows = {'90deg':'→', '180deg':'↓', '135deg':'↘', '45deg':'↗'};
      html += `<span class="dir-option ${bDir === dir ? 'selected' : ''}" data-dir="${dir}" onclick="ChatSettings.setBubbleGradientDir('${dir}')">${arrows[dir]}</span>`;
    });
    html += '</div>';
    // 预设色板
    html += '<div class="color-presets">';
    presetColors.forEach(c => {
      html += `<div class="color-preset" style="background:${c}" onclick="ChatSettings.addBubbleColor('${c}')"></div>`;
    });
    html += '</div>';
    html += '<div class="custom-color" style="display:flex;align-items:center;gap:8px;margin:8px 0;"><input type="color" id="bubble-custom-color" value="#12B7F5"><span style="font-size:13px;">自定义颜色</span><button class="btn-secondary" onclick="ChatSettings.addBubbleColor(document.getElementById(\'bubble-custom-color\').value)" style="padding:4px 12px;font-size:13px;">添加</button></div>';
    html += '<button class="btn-secondary" onclick="ChatSettings.clearBubbleColors()" style="width:100%;margin-bottom:8px;">清除颜色（恢复默认）</button>';
    html += '</div>';

    // 自定义CSS
    html += '<div class="form-group"><label>自定义气泡CSS</label>';
    html += `<textarea id="bubble-css-input" rows="4" placeholder=".message-bubble { border: 2px dashed gold; }" style="width:100%;padding:10px;border:1px solid #e0e0e0;border-radius:8px;font-family:monospace;font-size:13px;resize:vertical;">${this.escapeHtml(bCSS)}</textarea>`;
    html += '</div>';

    html += '<button class="save-btn" onclick="ChatSettings.saveBubbleStyle()">保存气泡样式</button>';

    document.getElementById('edit-modal-title').textContent = '气泡样式';
    document.getElementById('edit-modal-body').innerHTML = html;
    ChatUI.showModal('edit-modal');
  },

  _bubbleColorList: [],

  setBubbleStyle(styleId) {
    const char = ChatCore.currentCharacter;
    char.settings.bubbleStyle = styleId;
    ChatCore.saveCharacter();
    this.openBubbleStyleSettings();
  },

  addBubbleColor(color) {
    const char = ChatCore.currentCharacter;
    if (!char.settings.bubbleColors) char.settings.bubbleColors = [];
    char.settings.bubbleColors.push(color);
    char.settings.bubbleColor = color;
    ChatCore.saveCharacter();
    this.openBubbleStyleSettings();
  },

  removeBubbleColor(index) {
    const char = ChatCore.currentCharacter;
    if (!char.settings.bubbleColors) return;
    char.settings.bubbleColors.splice(index, 1);
    if (char.settings.bubbleColors.length === 0) {
      char.settings.bubbleColor = '';
    }
    ChatCore.saveCharacter();
    this.openBubbleStyleSettings();
  },

  clearBubbleColors() {
    const char = ChatCore.currentCharacter;
    char.settings.bubbleColors = [];
    char.settings.bubbleColor = '';
    ChatCore.saveCharacter();
    this.openBubbleStyleSettings();
  },

  setBubbleGradientDir(dir) {
    const char = ChatCore.currentCharacter;
    char.settings.bubbleGradientDir = dir;
    ChatCore.saveCharacter();
    this.openBubbleStyleSettings();
  },

  saveBubbleStyle() {
    const char = ChatCore.currentCharacter;
    char.settings.bubbleCSS = document.getElementById('bubble-css-input')?.value || '';
    ChatCore.saveCharacter();

    // 应用自定义气泡CSS
    this._applyBubbleCSS(char);

    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('气泡样式已保存');
  },

  _applyBubbleCSS(char) {
    let styleEl = document.getElementById('custom-bubble-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'custom-bubble-css';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = char.settings?.bubbleCSS || '';
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
