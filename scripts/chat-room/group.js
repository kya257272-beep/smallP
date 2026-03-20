/* scripts/chat-room/group.js - 群聊管理（重写） */

const ChatGroup = {
  autoChatTimer: null,

  // ========== 群信息编辑 ==========
  openGroupEdit() {
    ChatSettings.closeSettings();
    const char = ChatCore.currentCharacter;

    document.getElementById('edit-modal-title').textContent = '编辑群信息';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="avatar-edit-section">
        <div class="avatar-preview" onclick="document.getElementById('avatar-input').click()">
          ${char.avatar ? `<img src="${char.avatar}">` : `<div class="avatar-placeholder-big">群</div>`}
          <div class="avatar-edit-overlay">📷 更换</div>
        </div>
      </div>
      <div class="form-group">
        <label>群名称</label>
        <input type="text" id="edit-group-name" value="${ChatSettings.escapeHtml(char.name || '')}">
      </div>
      <div class="form-group">
        <label>群简介</label>
        <textarea id="edit-group-desc" rows="3">${ChatSettings.escapeHtml(char.description || '')}</textarea>
      </div>
      <button class="save-btn" onclick="ChatGroup.saveGroupEdit()">保存</button>
    `;
    ChatUI.showModal('edit-modal');
  },

  saveGroupEdit() {
    const char = ChatCore.currentCharacter;
    char.name = document.getElementById('edit-group-name').value.trim() || char.name;
    char.description = document.getElementById('edit-group-desc').value.trim();
    ChatCore.saveCharacter();
    ChatUI.updateTopbar(char);
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('群信息已保存');
  },

  // ========== 成员管理 ==========
  openMemberManager() {
    ChatSettings.closeSettings();
    const char = ChatCore.currentCharacter;
    const members = char.members || [];

    let html = '<div class="group-member-list">';
    members.forEach((m, i) => {
      html += `
        <div class="group-member-row">
          <div class="group-member-info">
            <div class="group-member-avatar">
              ${m.avatar ? `<img src="${m.avatar}">` : `<span>${(m.name || '?').charAt(0)}</span>`}
            </div>
            <div class="group-member-detail">
              <div class="group-member-name">${ChatSettings.escapeHtml(m.name)}</div>
              <div class="group-member-role">${m.role === 'admin' ? '👑 管理员' : '成员'}</div>
            </div>
          </div>
          <div class="group-member-actions">
            <button class="small-action-btn" onclick="ChatGroup.toggleAdmin(${i})">
              ${m.role === 'admin' ? '取消管理' : '设为管理'}
            </button>
            <button class="small-action-btn danger" onclick="ChatGroup.removeMember(${i})">移出</button>
          </div>
        </div>
      `;
    });
    html += '</div>';
    html += '<button class="save-btn" style="margin-top:16px" onclick="ChatGroup.openAddMember()">+ 添加新成员</button>';

    document.getElementById('edit-modal-title').textContent = `成员管理 (${members.length}人)`;
    document.getElementById('edit-modal-body').innerHTML = html;
    ChatUI.showModal('edit-modal');
  },

  toggleAdmin(index) {
    const char = ChatCore.currentCharacter;
    if (!char.members[index]) return;
    char.members[index].role = char.members[index].role === 'admin' ? 'member' : 'admin';
    ChatCore.saveCharacter();
    this.openMemberManager();
  },

  removeMember(index) {
    const char = ChatCore.currentCharacter;
    const member = char.members[index];
    if (!member) return;
    if (!confirm(`确定将 ${member.name} 移出群聊？`)) return;

    char.members.splice(index, 1);
    char.memberIds = char.members.map(m => m.id);
    ChatCore.saveCharacter();
    ChatUI.updateTopbar(char);
    this.openMemberManager();
    ChatUtils.showToast(`${member.name} 已移出群聊`);
  },

  async openAddMember() {
    const char = ChatCore.currentCharacter;
    const existingIds = new Set((char.members || []).map(m => m.id));

    const db = await openChatDB();
    const tx = db.transaction(CHAR_STORE, 'readonly');
    const request = tx.objectStore(CHAR_STORE).getAll();

    request.onsuccess = () => {
      const available = (request.result || []).filter(c => !c.isGroup && !existingIds.has(c.id));

      if (available.length === 0) {
        ChatUtils.showToast('没有可添加的好友了');
        return;
      }

      let html = '<div class="group-member-list">';
      available.forEach(c => {
        html += `
          <label class="group-add-item">
            <input type="checkbox" value="${c.id}" class="add-member-cb">
            <div class="group-member-avatar">
              ${c.avatar ? `<img src="${c.avatar}">` : `<span>${c.name.charAt(0)}</span>`}
            </div>
            <span>${ChatSettings.escapeHtml(c.name)}</span>
          </label>
        `;
      });
      html += '</div>';
      html += '<button class="save-btn" style="margin-top:16px" onclick="ChatGroup.confirmAddMembers()">确认添加</button>';

      document.getElementById('edit-modal-title').textContent = '添加新成员';
      document.getElementById('edit-modal-body').innerHTML = html;
    };
  },

  async confirmAddMembers() {
    const char = ChatCore.currentCharacter;
    const checkboxes = document.querySelectorAll('.add-member-cb:checked');
    if (checkboxes.length === 0) {
      ChatUtils.showToast('请选择要添加的成员');
      return;
    }

    const ids = Array.from(checkboxes).map(cb => cb.value);

    const db = await openChatDB();
    const tx = db.transaction(CHAR_STORE, 'readonly');
    const store = tx.objectStore(CHAR_STORE);

    for (const id of ids) {
      const req = store.get(id);
      await new Promise(resolve => {
        req.onsuccess = () => {
          const c = req.result;
          if (c) {
            char.members.push({
              id: c.id,
              name: c.name,
              avatar: c.avatar || null,
              role: 'member',
              muted: false,
              persona: c.description || '',
              frequency: 'normal'
            });
            char.memberIds.push(c.id);
          }
          resolve();
        };
        req.onerror = () => resolve();
      });
    }

    ChatCore.saveCharacter();
    ChatUI.updateTopbar(char);
    this.openMemberManager();
    ChatUtils.showToast(`已添加 ${ids.length} 位成员`);
  },

  // ========== 自动聊天 ==========
  openAutoChatSettings() {
    ChatSettings.closeSettings();
    const char = ChatCore.currentCharacter;
    const ac = char.autoChat || { enabled: false, mode: 'random', fixedInterval: 60, randomMin: 30, randomMax: 180 };

    document.getElementById('edit-modal-title').textContent = '自动聊天';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="switch-row">
        <div>
          <div class="switch-label">启用自动聊天</div>
          <div class="switch-hint">群成员会定时自动发言</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="ac-enabled" ${ac.enabled ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>

      <div class="form-group" style="margin-top:16px">
        <label>间隔模式</label>
        <select id="ac-mode" style="width:100%;padding:12px;border:2px solid #e5e5e5;border-radius:12px;font-size:15px">
          <option value="fixed" ${ac.mode === 'fixed' ? 'selected' : ''}>固定间隔</option>
          <option value="random" ${ac.mode === 'random' ? 'selected' : ''}>随机间隔</option>
        </select>
      </div>

      <div class="form-group">
        <label>固定间隔（秒）</label>
        <input type="number" id="ac-fixed" value="${ac.fixedInterval || 60}" min="10" max="3600">
      </div>

      <div class="form-group">
        <label>随机最小间隔（秒）</label>
        <input type="number" id="ac-min" value="${ac.randomMin || 30}" min="10" max="3600">
      </div>

      <div class="form-group">
        <label>随机最大间隔（秒）</label>
        <input type="number" id="ac-max" value="${ac.randomMax || 180}" min="10" max="3600">
      </div>

      <button class="save-btn" onclick="ChatGroup.saveAutoChat()">保存</button>
    `;
    ChatUI.showModal('edit-modal');
  },

  saveAutoChat() {
    const char = ChatCore.currentCharacter;
    const enabled = document.getElementById('ac-enabled').checked;
    char.autoChat = {
      enabled,
      mode: document.getElementById('ac-mode').value,
      fixedInterval: parseInt(document.getElementById('ac-fixed').value) || 60,
      randomMin: parseInt(document.getElementById('ac-min').value) || 30,
      randomMax: parseInt(document.getElementById('ac-max').value) || 180
    };
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');

    if (enabled) {
      this.startAutoChat();
      ChatUtils.showToast('自动聊天已开启');
    } else {
      this.stopAutoChat();
      ChatUtils.showToast('自动聊天已关闭');
    }
  },

  startAutoChat() {
    this.stopAutoChat();
    const char = ChatCore.currentCharacter;
    const ac = char.autoChat;
    if (!ac || !ac.enabled) return;

    const getDelay = () => {
      if (ac.mode === 'fixed') return (ac.fixedInterval || 60) * 1000;
      const min = (ac.randomMin || 30) * 1000;
      const max = (ac.randomMax || 180) * 1000;
      return min + Math.random() * (max - min);
    };

    const schedule = () => {
      this.autoChatTimer = setTimeout(async () => {
        if (!ChatCore.currentCharacter?.autoChat?.enabled) return;
        try {
          await this.triggerAutoChat();
        } catch (e) {
          console.error('自动聊天失败:', e);
        }
        schedule();
      }, getDelay());
    };

    schedule();
  },

  stopAutoChat() {
    if (this.autoChatTimer) {
      clearTimeout(this.autoChatTimer);
      this.autoChatTimer = null;
    }
  },

  async triggerAutoChat() {
    const char = ChatCore.currentCharacter;
    if (!char || !char.isGroup) return;

    const activeMembers = (char.members || []).filter(m => !m.muted);
    if (activeMembers.length === 0) return;

    // 按发言频率概率筛选本轮发言成员
    let speakingMembers = this.filterMembersByFrequency(char.members || []);
    if (speakingMembers.length === 0) {
      // 至少让1个非禁言成员发言
      if (activeMembers.length > 0) {
        speakingMembers = [activeMembers[Math.floor(Math.random() * activeMembers.length)]];
      } else {
        return;
      }
    }

    const apiConfig = ChatCore.getAPIConfig();
    if (!apiConfig.apiKey) return;

    ChatUI.showTyping(char);

    try {
      const contextMsgs = await ChatCore.getContextMessages();
      const messages = ChatAI.buildGroupMessages({
        character: char,
        userSettings: ChatCore.userSettings,
        contextMsgs,
        summary: char.summaryContent?.text || '',
        userMessage: '[群成员自由聊天，请随机选择1-2个成员发言，话题自然延续或开启新话题]',
        speakingMembers
      });

      const reply = await ChatAI.callAPI(messages, apiConfig);
      ChatUI.hideTyping();

      const parsed = ChatAI.parseResponse(reply, true);
      if (parsed.messages && parsed.messages.length > 0) {
        for (const msg of parsed.messages) {
          const member = (char.members || []).find(m => m.name === msg.sender);
          const replyId = ChatUtils.generateMsgId();
          let content = msg.content;
          if (this.applyRegexRules) content = this.applyRegexRules(content);

          ChatUI.addMessage({
            content,
            type: 'received',
            sender: msg.sender || '未知',
            avatar: member?.avatar || null,
            msgId: replyId,
            senderName: msg.sender,
            isGroup: true
          });

          await ChatCore.saveMessage({
            id: replyId,
            chatId: ChatCore.currentChatId,
            content,
            type: 'received',
            sender: msg.sender || '未知',
            avatar: member?.avatar || null,
            timestamp: Date.now()
          });
        }
        ChatUI.scrollToBottom();
      }
    } catch (e) {
      ChatUI.hideTyping();
      console.error('自动聊天出错:', e);
    }
  },

  // ========== 发言频率概率过滤 ==========
  // 活跃=100%, 正常=80%, 安静=50%, 潜水=10%
  getFrequencyProbability(frequency) {
    const map = { high: 1.0, normal: 0.8, low: 0.5, silent: 0.1 };
    return map[frequency] || 0.8;
  },

  filterMembersByFrequency(members) {
    return members.filter(m => {
      if (m.muted) return false;
      const prob = this.getFrequencyProbability(m.frequency);
      return Math.random() < prob;
    });
  },

  // ========== 禁言设置（个人+全员） ==========
  openMuteSettings() {
    ChatSettings.closeSettings();
    const char = ChatCore.currentCharacter;
    const members = char.members || [];

    let html = `
      <div class="switch-row">
        <div>
          <div class="switch-label">全员禁言</div>
          <div class="switch-hint">所有成员禁止发言</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="mute-all" ${char.groupMuted ? 'checked' : ''} onchange="ChatGroup.toggleAllMute(this.checked)">
          <span class="switch-slider"></span>
        </label>
      </div>
      <div style="margin-top:16px;font-size:14px;font-weight:600;color:#333;margin-bottom:8px">个人禁言</div>
      <div class="group-member-list">
    `;

    members.forEach((m, i) => {
      html += `
        <div class="group-member-row">
          <div class="group-member-info">
            <div class="group-member-avatar">
              ${m.avatar ? `<img src="${m.avatar}">` : `<span>${(m.name || '?').charAt(0)}</span>`}
            </div>
            <div class="group-member-name">${ChatSettings.escapeHtml(m.name)}</div>
          </div>
          <label class="switch">
            <input type="checkbox" ${m.muted ? 'checked' : ''} onchange="ChatGroup.toggleMemberMute(${i}, this.checked)">
            <span class="switch-slider"></span>
          </label>
        </div>
      `;
    });

    html += '</div>';
    document.getElementById('edit-modal-title').textContent = '禁言设置';
    document.getElementById('edit-modal-body').innerHTML = html;
    ChatUI.showModal('edit-modal');
  },

  toggleAllMute(muted) {
    const char = ChatCore.currentCharacter;
    char.groupMuted = muted;
    ChatCore.saveCharacter();

    const input = document.getElementById('message-input');
    const sendBtn = document.querySelector('.send-btn');
    if (muted) {
      if (input) { input.disabled = true; input.placeholder = '全员禁言中...'; }
      if (sendBtn) sendBtn.disabled = true;
    } else {
      if (input) { input.disabled = false; input.placeholder = '输入消息...'; }
      if (sendBtn) sendBtn.disabled = false;
    }
  },

  toggleMemberMute(index, muted) {
    const char = ChatCore.currentCharacter;
    if (char.members[index]) {
      char.members[index].muted = muted;
      ChatCore.saveCharacter();
    }
  },

  // ========== 禁言状态检查（旧方法保留兼容） ==========
  toggleGroupMute() {
    const char = ChatCore.currentCharacter;
    char.groupMuted = !char.groupMuted;
    ChatCore.saveCharacter();

    const input = document.getElementById('message-input');
    const sendBtn = document.querySelector('.send-btn');
    if (char.groupMuted) {
      input.disabled = true;
      input.placeholder = '全员禁言中...';
      sendBtn.disabled = true;
    } else {
      input.disabled = false;
      input.placeholder = '输入消息...';
      sendBtn.disabled = false;
    }
    ChatSettings.closeSettings();
    ChatUtils.showToast(char.groupMuted ? '已开启全员禁言' : '已关闭全员禁言');
  },

  // ========== 解散群聊 ==========
  async dissolveGroup() {
    if (!confirm('确定要解散群聊吗？此操作不可恢复。')) return;

    const db = await openChatDB();
    const charTx = db.transaction(CHAR_STORE, 'readwrite');
    charTx.objectStore(CHAR_STORE).delete(ChatCore.currentChatId);

    const msgTx = db.transaction(MSG_STORE, 'readwrite');
    const msgStore = msgTx.objectStore(MSG_STORE);
    const index = msgStore.index('chatId');
    const request = index.getAllKeys(ChatCore.currentChatId);
    request.onsuccess = () => (request.result || []).forEach(key => msgStore.delete(key));

    msgTx.oncomplete = () => {
      ChatUtils.showToast('群聊已解散');
      setTimeout(() => window.location.replace('chat.html'), 500);
    };
  },

  // ========== 初始化检查 ==========
  initGroupFeatures() {
    const char = ChatCore.currentCharacter;
    if (!char || !char.isGroup) return;

    // 禁言状态
    if (char.groupMuted) {
      const input = document.getElementById('message-input');
      const sendBtn = document.querySelector('.send-btn');
      if (input) { input.disabled = true; input.placeholder = '全员禁言中...'; }
      if (sendBtn) sendBtn.disabled = true;
    }

    // 自动聊天
    if (char.autoChat?.enabled) {
      this.startAutoChat();
    }
  },

  // ========== ④-1 成员人设编辑 ==========
  openMemberPersona() {
    const char = ChatCore.currentCharacter;
    const members = char.members || [];

    let html = '<div class="group-member-list">';
    members.forEach((m, i) => {
      const freqMap = { high: '活跃', normal: '正常', low: '安静', silent: '潜水' };
      html += `
        <div class="persona-edit-card">
          <div class="persona-card-header">
            <div class="group-member-avatar">
              ${m.avatar ? `<img src="${m.avatar}">` : `<span>${(m.name || '?').charAt(0)}</span>`}
            </div>
            <input type="text" class="persona-name-input" value="${ChatSettings.escapeHtml(m.name)}" data-index="${i}" placeholder="成员名">
          </div>
          <textarea class="persona-text-input" data-index="${i}" rows="3" placeholder="人设描述...">${ChatSettings.escapeHtml(m.persona || '')}</textarea>
          <div class="persona-freq-row">
            <span class="persona-freq-label">发言频率:</span>
            <select class="persona-freq-select" data-index="${i}">
              <option value="high" ${m.frequency === 'high' ? 'selected' : ''}>活跃 (100%)</option>
              <option value="normal" ${m.frequency === 'normal' ? 'selected' : ''}>正常 (80%)</option>
              <option value="low" ${m.frequency === 'low' ? 'selected' : ''}>安静 (50%)</option>
              <option value="silent" ${m.frequency === 'silent' ? 'selected' : ''}>潜水 (10%)</option>
            </select>
          </div>
        </div>
      `;
    });
    html += '</div>';
    html += '<button class="save-btn" onclick="ChatGroup.saveMemberPersona()">保存</button>';

    document.getElementById('edit-modal-title').textContent = '成员人设';
    document.getElementById('edit-modal-body').innerHTML = html;
    ChatUI.showModal('edit-modal');
  },

  saveMemberPersona() {
    const char = ChatCore.currentCharacter;
    document.querySelectorAll('.persona-name-input').forEach(input => {
      const i = parseInt(input.dataset.index);
      if (char.members[i]) char.members[i].name = input.value.trim() || char.members[i].name;
    });
    document.querySelectorAll('.persona-text-input').forEach(input => {
      const i = parseInt(input.dataset.index);
      if (char.members[i]) char.members[i].persona = input.value.trim();
    });
    document.querySelectorAll('.persona-freq-select').forEach(sel => {
      const i = parseInt(sel.dataset.index);
      if (char.members[i]) char.members[i].frequency = sel.value;
    });
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('成员人设已保存');
  },

  // ========== ④-2 群聊提示词（可排序） ==========
  getDefaultPromptEntries() {
    return [
      { id: 'group_info', name: '群聊信息', type: 'fixed', enabled: true },
      { id: 'member_persona', name: '成员人设', type: 'fixed', enabled: true },
      { id: 'user_persona', name: '用户人设', type: 'fixed', enabled: true },
      { id: 'group_summary', name: '群聊总结', type: 'fixed', enabled: true },
      { id: 'chat_history', name: '当前群聊记录', type: 'fixed', enabled: true }
    ];
  },

  // 获取固定提示词条目的实际内容预览
  _getFixedEntryPreview(entry) {
    const char = ChatCore.currentCharacter;
    const members = char.members || [];
    const userSettings = ChatCore.userSettings || {};
    const userName = char.groupUserSettings?.name || userSettings.name || '用户';
    const userPersona = char.groupUserSettings?.persona || userSettings.persona || '';

    switch (entry.id) {
      case 'group_info': {
        let text = `群名: ${char.name || '(未设置)'}`;
        if (char.description) text += `\n群简介: ${char.description}`;
        const admins = members.filter(m => m.role === 'admin');
        if (admins.length > 0) text += `\n管理员: ${admins.map(a => a.name).join('、')}`;
        return text;
      }
      case 'member_persona': {
        if (members.length === 0) return '(暂无成员)';
        return members.map(m => `- ${m.name}${m.persona ? ': ' + m.persona : ''}`).join('\n');
      }
      case 'user_persona': {
        let text = `用户: ${userName}`;
        if (userPersona) text += ` - ${userPersona}`;
        return text;
      }
      case 'group_summary': {
        const summary = char.summaryContent?.text;
        return summary ? summary.substring(0, 200) + (summary.length > 200 ? '...' : '') : '(暂无总结内容)';
      }
      case 'chat_history':
        return '(通过上下文消息自动注入，不在系统提示词中)';
      default:
        return '(未知固定条目)';
    }
  },

  openPromptOrder() {
    const char = ChatCore.currentCharacter;
    if (!char.promptEntries) {
      char.promptEntries = this.getDefaultPromptEntries();
    }

    let html = '<div class="prompt-hint">拖动条目可调整提示词组装顺序。点击固定项可展开查看内容。</div>';
    html += '<div class="prompt-order-list" id="prompt-order-list">';
    char.promptEntries.forEach((entry, i) => {
      const isFixed = entry.type === 'fixed';
      const fixedPreview = isFixed ? this._getFixedEntryPreview(entry) : '';
      html += `
        <div class="prompt-order-item ${isFixed ? 'fixed' : 'custom'}" draggable="true" data-index="${i}">
          <span class="drag-handle">⠿</span>
          <div class="prompt-item-info" style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="prompt-item-name">${ChatSettings.escapeHtml(entry.name)}</span>
              ${isFixed ? '<span style="font-size:11px;color:#999;background:#f0f0f0;padding:1px 6px;border-radius:4px;">固定</span>' : ''}
            </div>
            ${entry.type === 'custom' ? `<span class="prompt-item-preview">${ChatSettings.escapeHtml((entry.content || '').substring(0, 30))}...</span>` : ''}
            ${isFixed ? `<div class="prompt-fixed-expand" id="prompt-expand-${i}" style="display:none;margin-top:8px;padding:8px 10px;background:#f8f9fa;border-radius:8px;font-size:12px;color:#666;line-height:1.5;white-space:pre-wrap;word-break:break-word;max-height:150px;overflow-y:auto;border:1px solid #eee;">${ChatSettings.escapeHtml(fixedPreview)}</div>` : ''}
          </div>
          <div class="prompt-item-actions">
            ${isFixed ? `<button class="small-icon-btn" onclick="ChatGroup.toggleFixedPreview(${i})" title="查看内容" style="font-size:14px;">👁</button>` : ''}
            <label class="mini-switch">
              <input type="checkbox" ${entry.enabled ? 'checked' : ''} onchange="ChatGroup.togglePromptEntry(${i}, this.checked)">
              <span class="mini-slider"></span>
            </label>
            ${entry.type === 'custom' ? `
              <button class="small-icon-btn" onclick="ChatGroup.editPromptEntry(${i})">✏️</button>
              <button class="small-icon-btn danger" onclick="ChatGroup.deletePromptEntry(${i})">🗑️</button>
            ` : ''}
          </div>
        </div>
      `;
    });
    html += '</div>';
    html += '<button class="save-btn" style="margin-top:12px;background:#4CAF50" onclick="ChatGroup.addPromptEntry()">+ 添加自定义条目</button>';

    document.getElementById('edit-modal-title').textContent = '群聊提示词';
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
        // 保存新顺序
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
      <button class="save-btn" onclick="ChatGroup.saveNewPromptEntry()">添加</button>
    `;
    ChatUI.showModal('edit-modal');
  },

  saveNewPromptEntry() {
    const name = document.getElementById('prompt-entry-name').value.trim();
    const content = document.getElementById('prompt-entry-content').value.trim();
    if (!name) { ChatUtils.showToast('请输入名称'); return; }
    if (!content) { ChatUtils.showToast('请输入内容'); return; }

    const char = ChatCore.currentCharacter;
    if (!char.promptEntries) char.promptEntries = this.getDefaultPromptEntries();
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
    this.openPromptOrder();
  },

  editPromptEntry(index) {
    const char = ChatCore.currentCharacter;
    const entry = char.promptEntries[index];
    if (!entry || entry.type !== 'custom') return;

    document.getElementById('edit-modal-title').textContent = '编辑提示词条目';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="form-group">
        <label>条目名称</label>
        <input type="text" id="prompt-entry-name" value="${ChatSettings.escapeHtml(entry.name)}">
      </div>
      <div class="form-group">
        <label>内容</label>
        <textarea id="prompt-entry-content" rows="6">${ChatSettings.escapeHtml(entry.content || '')}</textarea>
      </div>
      <button class="save-btn" onclick="ChatGroup.saveEditPromptEntry(${index})">保存</button>
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
    this.openPromptOrder();
  },

  deletePromptEntry(index) {
    const char = ChatCore.currentCharacter;
    if (!char.promptEntries[index] || char.promptEntries[index].type === 'fixed') return;
    if (!confirm('确定删除此条目？')) return;
    char.promptEntries.splice(index, 1);
    ChatCore.saveCharacter();
    this.openPromptOrder();
  },

  // ========== ④-3 查找替换正则 ==========
  openRegexReplace() {
    const char = ChatCore.currentCharacter;
    if (!char.regexRules) char.regexRules = [];

    let html = '<div class="regex-hint">正则查找替换，应用于AI回复内容。支持HTML代码美化。</div>';
    html += '<div class="regex-list" id="regex-list">';
    char.regexRules.forEach((rule, i) => {
      html += `
        <div class="regex-rule-card">
          <div class="regex-rule-header">
            <span class="regex-rule-name">${ChatSettings.escapeHtml(rule.name || '规则' + (i + 1))}</span>
            <div class="regex-rule-actions">
              <label class="mini-switch">
                <input type="checkbox" ${rule.enabled ? 'checked' : ''} onchange="ChatGroup.toggleRegex(${i}, this.checked)">
                <span class="mini-slider"></span>
              </label>
              <button class="small-icon-btn" onclick="ChatGroup.editRegex(${i})">✏️</button>
              <button class="small-icon-btn danger" onclick="ChatGroup.deleteRegex(${i})">🗑️</button>
            </div>
          </div>
          <div class="regex-rule-preview">
            <code>${ChatSettings.escapeHtml(rule.find)}</code> → <code>${ChatSettings.escapeHtml(rule.replace.substring(0, 30))}</code>
          </div>
        </div>
      `;
    });
    if (char.regexRules.length === 0) {
      html += '<div class="empty-hint">暂无规则，点击下方添加</div>';
    }
    html += '</div>';
    html += '<button class="save-btn" style="margin-top:12px;background:#4CAF50" onclick="ChatGroup.addRegex()">+ 添加规则</button>';

    document.getElementById('edit-modal-title').textContent = '查找替换正则';
    document.getElementById('edit-modal-body').innerHTML = html;
    ChatUI.showModal('edit-modal');
  },

  toggleRegex(index, enabled) {
    const char = ChatCore.currentCharacter;
    if (char.regexRules[index]) {
      char.regexRules[index].enabled = enabled;
      ChatCore.saveCharacter();
    }
  },

  addRegex() {
    document.getElementById('edit-modal-title').textContent = '添加正则规则';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="form-group">
        <label>规则名称</label>
        <input type="text" id="regex-name" placeholder="例如: 动作美化">
      </div>
      <div class="form-group">
        <label>查找 (正则)</label>
        <input type="text" id="regex-find" placeholder="例如: \\*(.+?)\\*">
        <div class="form-hint">使用JavaScript正则语法</div>
      </div>
      <div class="form-group">
        <label>替换为</label>
        <textarea id="regex-replace" rows="3" placeholder="例如: <em class='action'>$1</em>"></textarea>
        <div class="form-hint">$1-$9 代表捕获组，支持HTML</div>
      </div>
      <div class="switch-row">
        <div class="switch-label">全局匹配 (g)</div>
        <label class="switch">
          <input type="checkbox" id="regex-global" checked>
          <span class="switch-slider"></span>
        </label>
      </div>
      <button class="save-btn" onclick="ChatGroup.saveNewRegex()">添加</button>
    `;
    ChatUI.showModal('edit-modal');
  },

  saveNewRegex() {
    const name = document.getElementById('regex-name').value.trim();
    const find = document.getElementById('regex-find').value.trim();
    const replace = document.getElementById('regex-replace').value;
    const global = document.getElementById('regex-global').checked;

    if (!find) { ChatUtils.showToast('请输入查找正则'); return; }

    try { new RegExp(find); } catch (e) {
      ChatUtils.showToast('正则语法错误: ' + e.message);
      return;
    }

    const char = ChatCore.currentCharacter;
    if (!char.regexRules) char.regexRules = [];
    char.regexRules.push({ name: name || '规则', find, replace, global, enabled: true });
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('规则已添加');
    this.openRegexReplace();
  },

  editRegex(index) {
    const char = ChatCore.currentCharacter;
    const rule = char.regexRules[index];
    if (!rule) return;

    document.getElementById('edit-modal-title').textContent = '编辑正则规则';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="form-group">
        <label>规则名称</label>
        <input type="text" id="regex-name" value="${ChatSettings.escapeHtml(rule.name || '')}">
      </div>
      <div class="form-group">
        <label>查找 (正则)</label>
        <input type="text" id="regex-find" value="${ChatSettings.escapeHtml(rule.find)}">
      </div>
      <div class="form-group">
        <label>替换为</label>
        <textarea id="regex-replace" rows="3">${ChatSettings.escapeHtml(rule.replace)}</textarea>
      </div>
      <div class="switch-row">
        <div class="switch-label">全局匹配 (g)</div>
        <label class="switch">
          <input type="checkbox" id="regex-global" ${rule.global ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
      <button class="save-btn" onclick="ChatGroup.saveEditRegex(${index})">保存</button>
    `;
    ChatUI.showModal('edit-modal');
  },

  saveEditRegex(index) {
    const char = ChatCore.currentCharacter;
    const rule = char.regexRules[index];
    if (!rule) return;

    const find = document.getElementById('regex-find').value.trim();
    if (!find) { ChatUtils.showToast('请输入查找正则'); return; }
    try { new RegExp(find); } catch (e) {
      ChatUtils.showToast('正则语法错误: ' + e.message);
      return;
    }

    rule.name = document.getElementById('regex-name').value.trim() || rule.name;
    rule.find = find;
    rule.replace = document.getElementById('regex-replace').value;
    rule.global = document.getElementById('regex-global').checked;
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('已保存');
    this.openRegexReplace();
  },

  deleteRegex(index) {
    const char = ChatCore.currentCharacter;
    if (!confirm('确定删除此规则？')) return;
    char.regexRules.splice(index, 1);
    ChatCore.saveCharacter();
    this.openRegexReplace();
  },

  applyRegexRules(text) {
    const char = ChatCore.currentCharacter;
    // 内置：清除模型思维链
    let result = ChatUtils.stripThinking(text);
    if (!char.regexRules || char.regexRules.length === 0) return result;
    char.regexRules.forEach(rule => {
      if (!rule.enabled) return;
      try {
        const flags = rule.global ? 'g' : '';
        const regex = new RegExp(rule.find, flags);
        result = result.replace(regex, rule.replace);
      } catch (e) {
        console.error('正则替换错误:', e);
      }
    });
    return result;
  },

  // ========== ④-4 总结（增强版） ==========
  openGroupSummary() {
    const char = ChatCore.currentCharacter;
    const settings = char.summarySettings || {};
    const content = char.summaryContent || {};

    document.getElementById('edit-modal-title').textContent = '总结设置';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="switch-row">
        <div>
          <div class="switch-label">启用总结功能</div>
          <div class="switch-hint">将历史消息压缩为总结以节省token</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="gs-enabled" ${settings.enabled ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
      <div class="switch-row">
        <div>
          <div class="switch-label">自动总结</div>
          <div class="switch-hint">达到指定条数自动触发</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="gs-auto" ${settings.autoSummary ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
      <div class="form-group">
        <label>自动总结触发条数</label>
        <input type="number" id="gs-interval" min="10" max="500" value="${settings.floorInterval || 50}">
      </div>
      <div class="form-group">
        <label>总结提示词</label>
        <textarea id="gs-prompt" rows="4">${ChatSettings.escapeHtml(settings.summaryPrompt || '总结以下对话的关键信息(重要事件、关系变化、设定、当前状态)，不超过500字：')}</textarea>
      </div>
      <div class="form-group">
        <label>当前总结内容</label>
        <textarea id="gs-content" rows="5">${ChatSettings.escapeHtml(content.text || '')}</textarea>
        <div class="form-hint">上次总结于第 ${content.lastFloor || 0} 条</div>
      </div>

      <div class="summary-range-section">
        <div class="form-hint" style="margin-bottom:8px">手动总结范围（留空=全部）</div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="number" id="gs-from" placeholder="起始" min="1" style="flex:1">
          <span>~</span>
          <input type="number" id="gs-to" placeholder="结束" min="1" style="flex:1">
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="save-btn" style="flex:1" onclick="ChatGroup.saveGroupSummary()">保存设置</button>
        <button class="save-btn" style="flex:1;background:#4CAF50" onclick="ChatGroup.executeGroupSummary()">立即总结</button>
      </div>
    `;
    ChatUI.showModal('edit-modal');
  },

  saveGroupSummary() {
    const char = ChatCore.currentCharacter;
    char.summarySettings = {
      enabled: document.getElementById('gs-enabled').checked,
      autoSummary: document.getElementById('gs-auto').checked,
      floorInterval: parseInt(document.getElementById('gs-interval').value) || 50,
      summaryPrompt: document.getElementById('gs-prompt').value.trim() || '总结以下对话的关键信息(重要事件、关系变化、设定、当前状态)，不超过500字：'
    };
    char.summaryContent = char.summaryContent || {};
    char.summaryContent.text = document.getElementById('gs-content').value.trim();
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('总结设置已保存');
  },

  async executeGroupSummary() {
    const char = ChatCore.currentCharacter;
    const apiConfig = ChatCore.getAPIConfig();
    if (!apiConfig.apiKey) {
      ChatUtils.showToast('请先配置API');
      return;
    }

    const fromVal = document.getElementById('gs-from')?.value;
    const toVal = document.getElementById('gs-to')?.value;
    const fromIdx = fromVal ? parseInt(fromVal) - 1 : 0;
    const toIdx = toVal ? parseInt(toVal) : undefined;

    ChatUtils.showToast('正在生成总结...');

    try {
      const db = await openChatDB();
      const tx = db.transaction(MSG_STORE, 'readonly');
      const store = tx.objectStore(MSG_STORE);
      const index = store.index('chatId');

      const request = index.getAll(ChatCore.currentChatId);
      request.onsuccess = async () => {
        let messages = (request.result || []).sort((a, b) => a.timestamp - b.timestamp);
        if (toIdx !== undefined) {
          messages = messages.slice(fromIdx, toIdx);
        } else if (fromIdx > 0) {
          messages = messages.slice(fromIdx);
        }

        if (messages.length < 3) {
          ChatUtils.showToast('消息太少，无法总结');
          return;
        }

        const chatContent = messages.map(m => `${m.sender || (m.type === 'sent' ? '用户' : char.name)}: ${m.content}`).join('\n');
        const summaryPrompt = (char.summarySettings?.summaryPrompt || '总结以下对话的关键信息(重要事件、关系变化、设定、当前状态)，不超过500字：') + '\n\n' + chatContent;

        const existingSummary = char.summaryContent?.text;
        const sysContent = existingSummary
          ? `你是对话总结助手。之前的总结:\n${existingSummary}\n\n请将新内容整合进总结中。`
          : '你是对话总结助手。';

        const summary = await ChatAI.callAPI([
          { role: 'system', content: sysContent },
          { role: 'user', content: summaryPrompt }
        ], apiConfig);

        const allMsgs = (request.result || []).sort((a, b) => a.timestamp - b.timestamp);
        char.summaryContent = { text: summary, lastFloor: allMsgs.length };
        ChatCore.saveCharacter();

        const contentEl = document.getElementById('gs-content');
        if (contentEl) contentEl.value = summary;
        ChatUtils.showToast('总结完成');
      };
    } catch (error) {
      ChatUtils.showToast('总结失败: ' + error.message);
    }
  },

  // ========== ④-5 群聊用户人设 ==========
  openGroupUserPersona() {
    const user = ChatCore.userSettings;
    const char = ChatCore.currentCharacter;
    const groupUserSettings = char.groupUserSettings || {};

    document.getElementById('edit-modal-title').textContent = '用户人设（群聊）';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="form-hint" style="margin-bottom:12px">此设定仅在本群聊中生效，留空则使用全局用户设定</div>
      <div class="avatar-edit-section">
        <div class="avatar-preview" onclick="document.getElementById('user-avatar-input').click()">
          ${(groupUserSettings.avatar || user.avatar) ? `<img src="${groupUserSettings.avatar || user.avatar}">` : `<div class="avatar-placeholder-big">我</div>`}
          <div class="avatar-edit-overlay">📷</div>
        </div>
      </div>
      <div class="form-group">
        <label>群内昵称</label>
        <input type="text" id="gu-name" value="${ChatSettings.escapeHtml(groupUserSettings.name || user.name || '')}" placeholder="留空使用全局名称">
      </div>
      <div class="form-group">
        <label>群内人设</label>
        <textarea id="gu-persona" rows="5" placeholder="留空使用全局人设">${ChatSettings.escapeHtml(groupUserSettings.persona || '')}</textarea>
      </div>
      <button class="save-btn" onclick="ChatGroup.saveGroupUserPersona()">保存</button>
    `;
    ChatUI.showModal('edit-modal');
  },

  saveGroupUserPersona() {
    const char = ChatCore.currentCharacter;
    char.groupUserSettings = {
      name: document.getElementById('gu-name').value.trim(),
      persona: document.getElementById('gu-persona').value.trim()
    };
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('群聊用户人设已保存');
  },

  // ========== 收藏消息 ==========
  openFavorites() {
    const char = ChatCore.currentCharacter;
    const favs = char.favorites || [];
    const body = document.getElementById('favorites-body');
    if (!body) return;

    if (favs.length === 0) {
      body.innerHTML = '<div class="empty-hint">暂无收藏消息</div>';
    } else {
      let html = '<div class="favorites-list">';
      favs.forEach((fav, i) => {
        const avatarHtml = fav.avatar
          ? `<img src="${fav.avatar}">`
          : `<div class="avatar-placeholder">${(fav.sender || '?').charAt(0)}</div>`;
        html += `
          <div class="fav-item">
            <div class="fav-header">
              <div class="fav-avatar">${avatarHtml}</div>
              <div class="fav-meta">
                <span class="fav-sender">${ChatSettings.escapeHtml(fav.sender)}</span>
                <span class="fav-time">${fav.time || ''}</span>
              </div>
              <button class="small-icon-btn danger" onclick="ChatGroup.removeFavorite(${i})" title="取消收藏">✕</button>
            </div>
            <div class="fav-content">${ChatSettings.escapeHtml(fav.content)}</div>
          </div>
        `;
      });
      html += '</div>';
      body.innerHTML = html;
    }

    ChatUI.showModal('favorites-modal');
  },

  removeFavorite(index) {
    const char = ChatCore.currentCharacter;
    if (!char.favorites || !char.favorites[index]) return;
    char.favorites.splice(index, 1);
    ChatCore.saveCharacter();
    this.openFavorites();
    ChatUtils.showToast('已取消收藏');
  },

  // ========== 查找聊天记录 ==========
  openSearchHistory() {
    document.getElementById('search-history-input').value = '';
    document.getElementById('search-results').innerHTML = '<div class="empty-hint">输入关键词开始搜索</div>';
    ChatUI.showModal('search-history-modal');
    setTimeout(() => document.getElementById('search-history-input')?.focus(), 300);
  },

  async executeSearch() {
    const keyword = document.getElementById('search-history-input')?.value.trim().toLowerCase();
    const container = document.getElementById('search-results');
    if (!container) return;

    if (!keyword) {
      container.innerHTML = '<div class="empty-hint">输入关键词开始搜索</div>';
      return;
    }

    const db = await openChatDB();
    const tx = db.transaction(MSG_STORE, 'readonly');
    const store = tx.objectStore(MSG_STORE);
    const index = store.index('chatId');
    const request = index.getAll(ChatCore.currentChatId);

    request.onsuccess = () => {
      const msgs = (request.result || [])
        .filter(m => m.content && m.content.toLowerCase().includes(keyword))
        .sort((a, b) => b.timestamp - a.timestamp);

      if (msgs.length === 0) {
        container.innerHTML = '<div class="empty-hint">未找到匹配消息</div>';
        return;
      }

      let html = `<div class="search-count">找到 ${msgs.length} 条结果</div>`;
      msgs.forEach(msg => {
        const senderName = msg.sender || (msg.type === 'sent' ? '我' : '未知');
        const time = ChatUtils.formatTime(msg.timestamp);
        const date = new Date(msg.timestamp);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        // 高亮关键词
        const escaped = ChatSettings.escapeHtml(msg.content.substring(0, 100));
        const highlighted = escaped.replace(
          new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
          '<mark>$&</mark>'
        );

        html += `
          <div class="search-result-item">
            <div class="search-result-header">
              <span class="search-result-sender">${ChatSettings.escapeHtml(senderName)}</span>
              <span class="search-result-date">${dateStr} ${time}</span>
            </div>
            <div class="search-result-content">${highlighted}</div>
          </div>
        `;
      });
      container.innerHTML = html;
    };
  }
};

window.ChatGroup = ChatGroup;
