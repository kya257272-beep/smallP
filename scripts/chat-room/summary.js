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
        <div>
          <div class="switch-label">启用总结功能</div>
          <div class="switch-hint">将历史消息压缩为总结以节省token</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="summary-enabled" ${settings.enabled ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
      <div class="switch-row">
        <div>
          <div class="switch-label">自动总结</div>
          <div class="switch-hint">达到指定条数自动触发</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="summary-auto" ${settings.autoSummary ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
      <div class="form-group">
        <label>自动总结触发条数</label>
        <input type="number" id="summary-interval" min="10" max="500" value="${settings.floorInterval || 50}">
      </div>
      <div class="form-group">
        <label>总结提示词</label>
        <textarea id="summary-prompt" rows="4">${ChatSettings.escapeHtml(settings.summaryPrompt || '总结以下对话的关键信息(重要事件、关系变化、设定、当前状态)，不超过500字：')}</textarea>
      </div>
      <div class="form-group">
        <label>当前总结内容</label>
        <textarea id="summary-content" rows="5">${ChatSettings.escapeHtml(content.text || '')}</textarea>
        <div class="form-hint">上次总结于第 ${content.lastFloor || 0} 条</div>
      </div>

      <div class="summary-range-section">
        <div class="form-hint" style="margin-bottom:8px">手动总结范围（留空=全部）</div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="number" id="summary-from" placeholder="起始楼层" min="1" style="flex:1">
          <span>~</span>
          <input type="number" id="summary-to" placeholder="结束楼层" min="1" style="flex:1">
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="save-btn" style="flex:1" onclick="ChatSummary.saveSummarySettings()">保存设置</button>
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
      floorInterval: parseInt(document.getElementById('summary-interval').value) || 50,
      summaryPrompt: document.getElementById('summary-prompt').value.trim() || '总结以下对话的关键信息(重要事件、关系变化、设定、当前状态)，不超过500字：'
    };
    char.summaryContent = char.summaryContent || {};
    char.summaryContent.text = document.getElementById('summary-content').value.trim();
    ChatCore.saveCharacter();
    ChatUI.hideModal('edit-modal');
    ChatUtils.showToast('总结设置已保存');
  },

  async executeSummary() {
    const char = ChatCore.currentCharacter;
    const apiConfig = ChatCore.getAPIConfig();

    if (!apiConfig.apiKey) {
      ChatUtils.showToast('请先配置API');
      return;
    }

    const fromVal = document.getElementById('summary-from')?.value;
    const toVal = document.getElementById('summary-to')?.value;
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

        const contentEl = document.getElementById('summary-content');
        if (contentEl) contentEl.value = summary;
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
