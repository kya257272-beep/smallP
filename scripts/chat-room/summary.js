/* scripts/chat-room/summary.js - 总结功能 */

const ChatSummary = {
  openSummarySettings() {
    ChatSettings.closeSettings();
    const char = ChatCore.currentCharacter;
    const settings = char.summarySettings || {};
    const content = char.summaryContent || {};

    document.getElementById('edit-modal-title').textContent = '总结上下文';
    document.getElementById('edit-modal-body').innerHTML = `
      <div class="switch-row">
        <div class="switch-label">启用总结功能</div>
        <label class="switch">
          <input type="checkbox" id="summary-enabled" ${settings.enabled ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
      <div class="switch-row">
        <div class="switch-label">自动总结</div>
        <label class="switch">
          <input type="checkbox" id="summary-auto" ${settings.autoSummary ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
      <div class="form-group">
        <label>自动总结间隔 (条数)</label>
        <input type="number" id="summary-interval" min="10" max="200" value="${settings.floorInterval || 50}">
      </div>
      <div class="form-group">
        <label>当前总结内容</label>
        <textarea id="summary-content" rows="6">${content.text || ''}</textarea>
        <div class="form-hint">上次总结于第 ${content.lastFloor || 0} 条</div>
      </div>
      <div style="display:flex;gap:10px;">
        <button class="save-btn" style="flex:1" onclick="ChatSummary.saveSummarySettings()">保存</button>
        <button class="save-btn" style="flex:1;background:#4CAF50" onclick="ChatSummary.executeSummary()">立即总结</button>
      </div>
    `;
    ChatUI.showModal('edit-modal');
  },

  saveSummarySettings() {
    const char = ChatCore.currentCharacter;
    char.summarySettings = {
      enabled: document.getElementById('summary-enabled').checked,
      autoSummary: document.getElementById('summary-auto').checked,
      floorInterval: parseInt(document.getElementById('summary-interval').value) || 50
    };
    char.summaryContent = char.summaryContent || {};
    char.summaryContent.text = document.getElementById('summary-content').value.trim();
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('保存成功');
  },

  async executeSummary() {
    const char = ChatCore.currentCharacter;
    const apiConfig = ChatCore.getAPIConfig();

    if (!apiConfig.apiKey && !apiConfig.key) {
      ChatUtils.showToast('请先配置API');
      return;
    }

    ChatUtils.showToast('正在生成总结...');

    try {
      const db = await openChatDB();
      const tx = db.transaction(MSG_STORE, 'readonly');
      const store = tx.objectStore(MSG_STORE);
      const index = store.index('chatId');

      const request = index.getAll(ChatCore.currentChatId);
      request.onsuccess = async () => {
        const messages = (request.result || []).sort((a, b) => a.timestamp - b.timestamp);
        if (messages.length < 5) {
          ChatUtils.showToast('消息太少');
          return;
        }

        const chatContent = messages.map(m => `${m.type === 'sent' ? '用户' : char.name}: ${m.content}`).join('\n');

        const summaryPrompt = `总结以下对话的关键信息(重要事件、关系变化、设定、当前状态)，不超过500字：\n\n${chatContent}`;

        const summary = await ChatAI.callAPI([
          { role: 'system', content: '你是对话总结助手。' },
          { role: 'user', content: summaryPrompt }
        ], apiConfig);

        char.summaryContent = { text: summary, lastFloor: messages.length };
        ChatCore.saveCharacter();

        document.getElementById('summary-content').value = summary;
        ChatUtils.showToast('总结完成');
      };
    } catch (error) {
      ChatUtils.showToast('总结失败: ' + error.message);
    }
  },

  async checkAutoSummary() {
    const char = ChatCore.currentCharacter;
    const settings = char.summarySettings;
    if (!settings?.enabled || !settings?.autoSummary) return;

    const db = await openChatDB();
    const tx = db.transaction(MSG_STORE, 'readonly');
    const store = tx.objectStore(MSG_STORE);
    const index = store.index('chatId');

    const request = index.count(ChatCore.currentChatId);
    request.onsuccess = () => {
      const msgCount = request.result;
      const lastFloor = char.summaryContent?.lastFloor || 0;
      if (msgCount - lastFloor >= settings.floorInterval) {
        this.executeSummary();
      }
    };
  }
};

window.ChatSummary = ChatSummary;
