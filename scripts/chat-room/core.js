/* scripts/chat-room/core.js - 核心逻辑 */

const ChatCore = {
  currentChatId: null,
  currentCharacter: null,
  userSettings: null,

  async init() {
    const params = new URLSearchParams(window.location.search);
    this.currentChatId = params.get('id');

    if (!this.currentChatId) {
      ChatUtils.showToast('缺少角色ID');
      setTimeout(() => this.goBack(), 1000);
      return false;
    }

    this.userSettings = JSON.parse(localStorage.getItem('userChatSettings') || '{}');

    const db = await openChatDB();
    const tx = db.transaction(CHAR_STORE, 'readonly');
    const store = tx.objectStore(CHAR_STORE);

    return new Promise(resolve => {
      const request = store.get(this.currentChatId);
      request.onsuccess = async () => {
        this.currentCharacter = request.result;
        if (!this.currentCharacter) {
          ChatUtils.showToast('角色不存在');
          setTimeout(() => this.goBack(), 1000);
          resolve(false);
          return;
        }

        this.currentCharacter.settings = this.currentCharacter.settings || {};
        ChatUI.updateTopbar(this.currentCharacter);
        ChatUI.applyBackground(this.currentCharacter.settings.chatBackground);

        const globalSettings = JSON.parse(localStorage.getItem('globalChatSettings') || '{}');
        ChatUI.applyCustomCSS(globalSettings.customCSS);

        await this.loadMessages();
        this.bindEvents();
        resolve(true);
      };
      request.onerror = () => resolve(false);
    });
  },

  async loadMessages() {
    const db = await openChatDB();
    const tx = db.transaction(MSG_STORE, 'readonly');
    const store = tx.objectStore(MSG_STORE);
    const index = store.index('chatId');

    return new Promise(resolve => {
      const request = index.getAll(this.currentChatId);
      request.onsuccess = () => {
        const msgs = (request.result || []).sort((a, b) => a.timestamp - b.timestamp);
        ChatUI.clearMessages();
        msgs.forEach(msg => {
          ChatUI.addMessage({
            content: msg.content,
            type: msg.type,
            sender: msg.sender,
            avatar: msg.avatar,
            msgId: msg.id
          });
        });
        ChatUI.scrollToBottom();
        resolve();
      };
      request.onerror = () => resolve();
    });
  },

  bindEvents() {
    const input = document.getElementById('message-input');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });
  },

  async sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    input.value = '';
    input.style.height = 'auto';

    const msgId = ChatUtils.generateMsgId();
    const user = this.userSettings;

    ChatUI.addMessage({
      content,
      type: 'sent',
      sender: user.name || '我',
      avatar: user.avatar,
      msgId
    });

    await this.saveMessage({
      id: msgId,
      chatId: this.currentChatId,
      content,
      type: 'sent',
      sender: user.name || '我',
      avatar: user.avatar,
      timestamp: Date.now()
    });

    await this.generateReply(content);
  },

  async saveMessage(msg) {
    const db = await openChatDB();
    return new Promise(resolve => {
      const tx = db.transaction(MSG_STORE, 'readwrite');
      tx.objectStore(MSG_STORE).put(msg);
      tx.oncomplete = () => resolve();
    });
  },

  saveCharacter() {
    openChatDB().then(db => {
      const tx = db.transaction(CHAR_STORE, 'readwrite');
      tx.objectStore(CHAR_STORE).put(this.currentCharacter);
    });
  },

  saveUserSettings() {
    localStorage.setItem('userChatSettings', JSON.stringify(this.userSettings));
  },

  getAPIConfig() {
    const config = JSON.parse(localStorage.getItem('apiConfig') || '{}');
    // 兼容不同的键名格式
    return {
      apiKey: config.apiKey || config.key || config.api_key || '',
      apiUrl: config.apiUrl || config.url || config.api_url || config.baseUrl || 'https://api.openai.com/v1/chat/completions',
      model: config.model || 'gpt-3.5-turbo',
      temperature: config.temperature || 0.8,
      maxTokens: config.maxTokens || config.max_tokens || 1000
    };
  },

  getPreset() {
    const presetId = this.currentCharacter.settings?.presetId;
    if (!presetId) return null;
    const presets = JSON.parse(localStorage.getItem('presetConfigs') || '[]');
    return presets.find(p => p.id === presetId) || null;
  },

  getWorldBook() {
    const wbId = this.currentCharacter.settings?.worldBookId;
    if (!wbId) return null;
    const worldBooks = JSON.parse(localStorage.getItem('worldBooks') || '[]');
    return worldBooks.find(w => w.id === wbId) || null;
  },

  async getContextMessages() {
    const count = this.currentCharacter.settings?.contextCount || 20;
    const db = await openChatDB();
    const tx = db.transaction(MSG_STORE, 'readonly');
    const store = tx.objectStore(MSG_STORE);
    const index = store.index('chatId');

    return new Promise(resolve => {
      const request = index.getAll(this.currentChatId);
      request.onsuccess = () => {
        const msgs = (request.result || []).sort((a, b) => a.timestamp - b.timestamp);
        resolve(msgs.slice(-count));
      };
      request.onerror = () => resolve([]);
    });
  },

  async generateReply(userMessage) {
    const char = this.currentCharacter;
    const apiConfig = this.getAPIConfig();

    console.log('API配置:', apiConfig); // 调试用

    if (!apiConfig.apiKey) {
      ChatUI.addMessage({
        content: '*请先在设置中配置API密钥*',
        type: 'received',
        sender: '系统',
        avatar: null
      });
      return;
    }

    ChatUI.showTyping(char);

    try {
      const contextMsgs = await this.getContextMessages();
      const messages = ChatAI.buildMessages({
        character: char,
        userSettings: this.userSettings,
        preset: this.getPreset(),
        worldBook: this.getWorldBook(),
        contextMsgs,
        summary: char.summaryContent?.text || '',
        userMessage
      });

      console.log('发送消息:', messages); // 调试用

      const reply = await ChatAI.callAPI(messages, apiConfig);
      ChatUI.hideTyping();

      const parsed = ChatAI.parseResponse(reply);

      if (parsed.thought) {
        char.thought = parsed.thought;
        this.saveCharacter();
      }

      for (const content of parsed.floors) {
        if (!content) continue;
        const replyId = ChatUtils.generateMsgId();

        ChatUI.addMessage({
          content,
          type: 'received',
          sender: char.name,
          avatar: char.avatar,
          msgId: replyId
        });

        await this.saveMessage({
          id: replyId,
          chatId: this.currentChatId,
          content,
          type: 'received',
          sender: char.name,
          avatar: char.avatar,
          timestamp: Date.now()
        });
      }

      ChatUI.scrollToBottom();
      
      if (typeof ChatSummary !== 'undefined') {
        ChatSummary.checkAutoSummary();
      }
    } catch (error) {
      console.error('回复失败:', error);
      ChatUI.hideTyping();
      ChatUI.addMessage({
        content: `*回复失败: ${error.message}*`,
        type: 'received',
        sender: '系统',
        avatar: null
      });
    }
  },

  async regenerateReply() {
    const db = await openChatDB();
    const tx = db.transaction(MSG_STORE, 'readonly');
    const store = tx.objectStore(MSG_STORE);
    const index = store.index('chatId');

    const request = index.getAll(this.currentChatId);
    request.onsuccess = async () => {
      const msgs = (request.result || []).sort((a, b) => a.timestamp - b.timestamp);
      const lastUserMsg = [...msgs].reverse().find(m => m.type === 'sent');

      if (lastUserMsg) {
        const lastAIMsg = msgs[msgs.length - 1];
        if (lastAIMsg && lastAIMsg.type === 'received') {
          await this.deleteMessage(lastAIMsg.id);
          document.querySelector(`[data-msg-id="${lastAIMsg.id}"]`)?.remove();
        }
        await this.generateReply(lastUserMsg.content);
      }
    };
  },

  async continueGenerate() {
    await this.generateReply('[继续]');
  },

  async deleteMessage(msgId) {
    const db = await openChatDB();
    return new Promise(resolve => {
      const tx = db.transaction(MSG_STORE, 'readwrite');
      tx.objectStore(MSG_STORE).delete(msgId);
      tx.oncomplete = () => resolve();
    });
  },

  async clearHistory() {
    if (!confirm('确定要清空所有聊天记录吗？')) return;

    const db = await openChatDB();
    const tx = db.transaction(MSG_STORE, 'readwrite');
    const store = tx.objectStore(MSG_STORE);
    const index = store.index('chatId');

    const request = index.getAllKeys(this.currentChatId);
    request.onsuccess = () => {
      (request.result || []).forEach(key => store.delete(key));
    };

    tx.oncomplete = () => {
      ChatUI.clearMessages();
      ChatUtils.showToast('聊天记录已清空');
    };
  },

  goBack() {
    // 使用 replace 避免历史记录堆积
    // 或者检查是否有历史可以返回
    if (document.referrer && document.referrer.includes('chat.html')) {
      history.back();
    } else {
      window.location.replace('chat.html');
    }
  }
};

window.ChatCore = ChatCore;
