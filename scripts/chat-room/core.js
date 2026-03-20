/* scripts/chat-room/core.js - 核心逻辑 */

const ChatCore = {
  currentChatId: null,
  currentCharacter: null,
  userSettings: null,
  _quoteData: null,

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

        // 加载全局头像CSS
        const avatarCSS = localStorage.getItem('globalAvatarCSS');
        if (avatarCSS) {
          const avatarStyleEl = document.getElementById('custom-avatar-css');
          if (avatarStyleEl) avatarStyleEl.textContent = avatarCSS;
        }

        await this.loadMessages();
        this.bindEvents();

        // 应用角色气泡自定义CSS
        if (this.currentCharacter.settings?.bubbleCSS) {
          ChatSettings._applyBubbleCSS(this.currentCharacter);
        }

        resolve(true);
      };
      request.onerror = () => resolve(false);
    });
  },

  // 获取群成员的角色设置（头像框、气泡样式等）
  _getMemberSettings(senderName) {
    const char = this.currentCharacter;
    if (!char?.isGroup) return {};
    const member = (char.members || []).find(m => m.name === senderName);
    if (!member) return {};
    // 成员的settings存在linked character中，缓存在_memberSettingsCache
    if (this._memberSettingsCache && this._memberSettingsCache[senderName]) {
      return this._memberSettingsCache[senderName];
    }
    return member.settings || {};
  },

  // 预加载群成员的角色设置
  async _loadMemberSettings() {
    const char = this.currentCharacter;
    if (!char?.isGroup) return;
    this._memberSettingsCache = {};
    const members = char.members || [];
    const memberIds = members.filter(m => m.id).map(m => m.id);
    if (memberIds.length === 0) return;

    const db = await openChatDB();
    const tx = db.transaction(CHAR_STORE, 'readonly');
    const store = tx.objectStore(CHAR_STORE);

    return new Promise(resolve => {
      let completed = 0;
      memberIds.forEach(id => {
        const req = store.get(id);
        req.onsuccess = () => {
          const charData = req.result;
          if (charData) {
            const member = members.find(m => m.id === id);
            if (member) {
              this._memberSettingsCache[member.name] = charData.settings || {};
            }
          }
          completed++;
          if (completed === memberIds.length) resolve();
        };
        req.onerror = () => {
          completed++;
          if (completed === memberIds.length) resolve();
        };
      });
    });
  },

  async loadMessages() {
    // 预加载群成员设置（头像框、气泡样式）
    await this._loadMemberSettings();

    const db = await openChatDB();
    const tx = db.transaction(MSG_STORE, 'readonly');
    const store = tx.objectStore(MSG_STORE);
    const index = store.index('chatId');
    const isGroup = this.currentCharacter?.isGroup;

    return new Promise(resolve => {
      const request = index.getAll(this.currentChatId);
      request.onsuccess = () => {
        const msgs = (request.result || []).sort((a, b) => a.timestamp - b.timestamp);
        ChatUI.clearMessages();
        msgs.forEach(msg => {
          const quoteData = msg.quoteId ? {
            quoteId: msg.quoteId,
            quoteSender: msg.quoteSender,
            quoteContent: msg.quoteContent
          } : null;

          // 群聊时获取发送者的个人设置
          let memberSettings = {};
          if (isGroup && msg.type === 'received' && msg.sender) {
            memberSettings = this._getMemberSettings(msg.sender);
          }

          ChatUI.addMessage({
            content: msg.content,
            type: msg.type,
            sender: msg.sender,
            avatar: msg.avatar,
            msgId: msg.id,
            senderName: isGroup && msg.type === 'received' ? msg.sender : null,
            isGroup: isGroup,
            timestamp: msg.timestamp,
            quoteData,
            memberFrame: memberSettings.avatarFrame,
            memberBubbleStyle: memberSettings.bubbleStyle,
            memberBubbleColor: memberSettings.bubbleColor,
            memberBubbleColors: memberSettings.bubbleColors,
            memberBubbleGradientDir: memberSettings.bubbleGradientDir
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
    ChatUI.hideMentionPopup();

    const msgId = ChatUtils.generateMsgId();
    const user = this.userSettings;
    const ts = Date.now();

    // 获取引用数据
    const quoteData = this._quoteData;
    this._quoteData = null;
    ChatUI.hideQuotePreview();

    ChatUI.addMessage({
      content,
      type: 'sent',
      sender: user.name || '我',
      avatar: user.avatar,
      msgId,
      timestamp: ts,
      quoteData
    });

    const msgObj = {
      id: msgId,
      chatId: this.currentChatId,
      content,
      type: 'sent',
      sender: user.name || '我',
      avatar: user.avatar,
      timestamp: ts
    };
    if (quoteData) {
      msgObj.quoteId = quoteData.quoteId;
      msgObj.quoteSender = quoteData.quoteSender;
      msgObj.quoteContent = quoteData.quoteContent;
    }

    await this.saveMessage(msgObj);
  },

  async sendAndCall() {
    await this.sendMessage();
    await this.generateReply();
  },

  async callAI() {
    // 取最后一条用户消息作为 context
    const contextMsgs = await this.getContextMessages();
    const lastUserMsg = [...contextMsgs].reverse().find(m => m.type === 'sent');
    const userMessage = lastUserMsg ? lastUserMsg.content : '[继续]';
    await this.generateReply(userMessage);
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

  // 更新连续聊天天数和友谊等级
  _updateChatStreak(char) {
    const today = new Date().toDateString();
    const wave = char.friendshipWave || { consecutiveDays: 0, level: 0, lastChatDate: null };

    if (wave.lastChatDate === today) {
      // 今天已经聊过，不重复计算
      char.friendshipWave = wave;
      return;
    }

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (wave.lastChatDate === yesterday) {
      // 昨天聊过，连续天数 +1
      wave.consecutiveDays = (wave.consecutiveDays || 0) + 1;
    } else {
      // 超过一天没聊，重置为第1天
      wave.consecutiveDays = 1;
    }
    wave.lastChatDate = today;

    // 根据连续天数计算等级
    const d = wave.consecutiveDays;
    if (d >= 60) wave.level = 6;       // 灵魂伴侣
    else if (d >= 30) wave.level = 5;  // 知己
    else if (d >= 14) wave.level = 4;  // 挚友
    else if (d >= 7) wave.level = 3;   // 好友
    else if (d >= 3) wave.level = 2;   // 熟悉
    else if (d >= 1) wave.level = 1;   // 相识
    else wave.level = 0;               // 初识

    char.friendshipWave = wave;
    this.saveCharacter();
  },

  saveUserSettings() {
    localStorage.setItem('userChatSettings', JSON.stringify(this.userSettings));
  },

  getAPIConfig() {
    // 优先使用功能绑定系统（api-config.js）
    if (typeof getModelForFunction === 'function') {
      const chatBinding = getModelForFunction('chat');
      if (chatBinding && chatBinding.apiKey) {
        return {
          apiKey: chatBinding.apiKey,
          apiUrl: 'https://api.daidaibird.top/v1/chat/completions',
          model: chatBinding.model || 'gpt-3.5-turbo',
          temperature: parseFloat(localStorage.getItem('ai_temperature')) || 0.7,
          maxTokens: parseInt(localStorage.getItem('ai_max_tokens')) || 2048
        };
      }
    }

    // 次选：从 apiConfigs + modelBindings 读取
    try {
      const cfgs = JSON.parse(localStorage.getItem('apiConfigs') || '[]');
      if (cfgs.length > 0) {
        const bindings = JSON.parse(localStorage.getItem('modelBindings') || '{}');
        const chatBind = bindings.chat || {};
        // 优先用 chat 功能绑定的 configId，否则用激活配置
        const activeId = chatBind.configId || localStorage.getItem('activeConfigId');
        const config = cfgs.find(c => c.id === activeId) || cfgs[0];
        if (config && config.key) {
          return {
            apiKey: config.key,
            apiUrl: 'https://api.daidaibird.top/v1/chat/completions',
            model: chatBind.model || 'gpt-3.5-turbo',
            temperature: parseFloat(localStorage.getItem('ai_temperature')) || 0.7,
            maxTokens: parseInt(localStorage.getItem('ai_max_tokens')) || 2048
          };
        }
      }
    } catch (e) {
      console.error('读取API配置失败:', e);
    }

    // 兜底：旧格式 apiConfig（单数）
    const config = JSON.parse(localStorage.getItem('apiConfig') || '{}');
    return {
      apiKey: config.apiKey || config.key || config.api_key || '',
      apiUrl: config.apiUrl || config.url || config.api_url || config.baseUrl || 'https://api.openai.com/v1/chat/completions',
      model: config.model || 'gpt-3.5-turbo',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || config.max_tokens || 2048
    };
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

  async generateReply(userMessage, forcedSpeakers) {
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

      // 检测上下文中的待处理红包和转账
      const pendingContext = this._detectPendingItems(contextMsgs);

      // 群聊分支
      if (char.isGroup) {
        // 解析@提及的成员（强制发言）
        const mentionedNames = [];
        if (userMessage) {
          (char.members || []).forEach(m => {
            if (userMessage.includes('@' + m.name)) {
              mentionedNames.push(m.name);
            }
          });
        }
        const allForced = [...new Set([...(forcedSpeakers || []), ...mentionedNames])];

        // 按发言频率概率筛选本轮可发言的成员
        let speakingMembers = null;
        if (typeof ChatGroup !== 'undefined' && ChatGroup.filterMembersByFrequency) {
          speakingMembers = ChatGroup.filterMembersByFrequency(char.members || []);
          // 至少保证1个成员发言
          if (speakingMembers.length === 0) {
            const nonMuted = (char.members || []).filter(m => !m.muted);
            if (nonMuted.length > 0) {
              speakingMembers = [nonMuted[Math.floor(Math.random() * nonMuted.length)]];
            }
          }
        }

        // 将强制发言成员加入列表
        if (allForced.length > 0 && speakingMembers) {
          for (const name of allForced) {
            const member = (char.members || []).find(m => m.name === name);
            if (member && !speakingMembers.find(s => s.name === name)) {
              speakingMembers.push(member);
            }
          }
        }

        const messages = ChatAI.buildGroupMessages({
          character: char,
          userSettings: this.userSettings,
          contextMsgs,
          summary: char.summaryContent?.text || '',
          userMessage,
          speakingMembers,
          pendingContext
        });

        console.log('群聊发送消息:', messages);
        const reply = await ChatAI.callAPI(messages, apiConfig);
        ChatUI.hideTyping();

        const parsed = ChatAI.parseResponse(reply, true);

        if (parsed.thought) {
          char.thought = parsed.thought;
          this.saveCharacter();
        }

        // 收集AI回复中的特殊标记
        const replyContents = [];
        const replySenders = [];

        if (parsed.messages && parsed.messages.length > 0) {
          for (const msg of parsed.messages) {
            const member = (char.members || []).find(m => m.name === msg.sender);
            const replyId = ChatUtils.generateMsgId();
            // 应用正则替换规则
            let content = msg.content;
            // 内置：清除模型思维链
            content = ChatUtils.stripThinking(content);
            if (typeof ChatGroup !== 'undefined' && ChatGroup.applyRegexRules) {
              content = ChatGroup.applyRegexRules(content);
            }

            replyContents.push(content);
            replySenders.push(msg.sender);

            const memberSettings = this._getMemberSettings(msg.sender);

            ChatUI.addMessage({
              content,
              type: 'received',
              sender: msg.sender || char.name,
              avatar: member?.avatar || null,
              msgId: replyId,
              senderName: msg.sender,
              isGroup: true,
              memberFrame: memberSettings.avatarFrame,
              memberBubbleStyle: memberSettings.bubbleStyle,
              memberBubbleColor: memberSettings.bubbleColor,
              memberBubbleColors: memberSettings.bubbleColors,
              memberBubbleGradientDir: memberSettings.bubbleGradientDir
            });

            await this.saveMessage({
              id: replyId,
              chatId: this.currentChatId,
              content,
              type: 'received',
              sender: msg.sender || char.name,
              avatar: member?.avatar || null,
              timestamp: Date.now()
            });
          }
        }

        ChatUI.scrollToBottom();
        char.lastMsgTime = Date.now();
        this.saveCharacter();

        // 后处理：红包抢夺和转账接收
        await this._processPostReply(reply, pendingContext, replySenders);

        // 处理AI主动发送的转账
        if (parsed.aiTransfers && parsed.aiTransfers.length > 0) {
          for (const tr of parsed.aiTransfers) {
            const senderName = tr.sender || replySenders[0] || char.name;
            const member = (char.members || []).find(m => m.name === senderName);
            const trContent = `[transfer:${parseFloat(tr.amount).toFixed(2)}:${tr.note}:pending:${senderName}]`;
            const trId = ChatUtils.generateMsgId();
            ChatUI.addMessage({
              content: trContent, type: 'received', sender: senderName,
              avatar: member?.avatar || null, msgId: trId, senderName, isGroup: true
            });
            await this.saveMessage({
              id: trId, chatId: this.currentChatId, content: trContent, type: 'received',
              sender: senderName, avatar: member?.avatar || null, timestamp: Date.now()
            });
          }
        }

        // 处理AI主动发送的红包
        if (parsed.aiRedPackets && parsed.aiRedPackets.length > 0) {
          for (const rp of parsed.aiRedPackets) {
            const senderName = rp.sender || replySenders[0] || char.name;
            const member = (char.members || []).find(m => m.name === senderName);
            const rpId = 'rp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            const rpContent = `[redpacket:lucky:${parseFloat(rp.amount).toFixed(2)}:1::${senderName}:${rpId}:[]]`;
            const rpMsgId = ChatUtils.generateMsgId();
            ChatUI.addMessage({
              content: rpContent, type: 'received', sender: senderName,
              avatar: member?.avatar || null, msgId: rpMsgId, senderName, isGroup: true
            });
            await this.saveMessage({
              id: rpMsgId, chatId: this.currentChatId, content: rpContent, type: 'received',
              sender: senderName, avatar: member?.avatar || null, timestamp: Date.now()
            });
          }
        }

        if (typeof ChatSummary !== 'undefined') {
          ChatSummary.checkAutoSummary();
        }
        return;
      }

      // 私聊分支
      const messages = ChatAI.buildMessages({
        character: char,
        userSettings: this.userSettings,
        contextMsgs,
        summary: char.summaryContent?.text || '',
        userMessage,
        pendingContext
      });

      console.log('发送消息:', messages); // 调试用

      const reply = await ChatAI.callAPI(messages, apiConfig);
      ChatUI.hideTyping();

      const parsed = ChatAI.parseResponse(reply);

      // 状态更新（好感度、心情、内心想法、衣着、地点）
      if (parsed.status) {
        const s = parsed.status;
        if (s.affection !== undefined)
          char.affection = Math.max(0, Math.min(100, (char.affection || 50) + s.affection));
        if (s.mood !== undefined)
          char.mood = Math.max(0, Math.min(100, (char.mood || 70) + s.mood));
        if (s.thought) char.thought = s.thought;
        if (s.outfit) char.outfit = s.outfit;
        if (s.location) char.location = s.location;
        this.saveCharacter();
        ChatUI.updateTopbar(char);
      }
      // fallback: 保留旧的 [内心:xxx] 支持
      if (!parsed.status?.thought && parsed.thought) {
        char.thought = parsed.thought;
        this.saveCharacter();
      }

      for (const content of parsed.floors) {
        if (!content) continue;
        const replyId = ChatUtils.generateMsgId();
        // 应用正则替换规则
        let processedContent = content;
        // 内置：清除模型思维链
        processedContent = ChatUtils.stripThinking(processedContent);
        if (typeof ChatGroup !== 'undefined' && ChatGroup.applyRegexRules) {
          processedContent = ChatGroup.applyRegexRules(processedContent);
        }

        ChatUI.addMessage({
          content: processedContent,
          type: 'received',
          sender: char.name,
          avatar: char.avatar,
          msgId: replyId
        });

        await this.saveMessage({
          id: replyId,
          chatId: this.currentChatId,
          content: processedContent,
          type: 'received',
          sender: char.name,
          avatar: char.avatar,
          timestamp: Date.now()
        });
      }

      ChatUI.scrollToBottom();

      // 后处理：转账接收和红包
      await this._processPostReply(reply, pendingContext, [char.name]);

      // 处理AI主动发送的转账
      if (parsed.aiTransfers && parsed.aiTransfers.length > 0) {
        for (const tr of parsed.aiTransfers) {
          const trContent = `[transfer:${parseFloat(tr.amount).toFixed(2)}:${tr.note}:pending:${char.name}]`;
          const trId = ChatUtils.generateMsgId();
          ChatUI.addMessage({
            content: trContent, type: 'received', sender: char.name, avatar: char.avatar, msgId: trId
          });
          await this.saveMessage({
            id: trId, chatId: this.currentChatId, content: trContent, type: 'received',
            sender: char.name, avatar: char.avatar, timestamp: Date.now()
          });
        }
      }

      // 处理AI主动发送的红包
      if (parsed.aiRedPackets && parsed.aiRedPackets.length > 0) {
        for (const rp of parsed.aiRedPackets) {
          const rpId = 'rp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          const rpContent = `[redpacket:lucky:${parseFloat(rp.amount).toFixed(2)}:1::${char.name}:${rpId}:[]]`;
          const rpMsgId = ChatUtils.generateMsgId();
          ChatUI.addMessage({
            content: rpContent, type: 'received', sender: char.name, avatar: char.avatar, msgId: rpMsgId
          });
          await this.saveMessage({
            id: rpMsgId, chatId: this.currentChatId, content: rpContent, type: 'received',
            sender: char.name, avatar: char.avatar, timestamp: Date.now()
          });
        }
      }

      // 更新连续聊天天数（初识系统）
      this._updateChatStreak(char);

      if (typeof ChatSummary !== 'undefined') {
        ChatSummary.checkAutoSummary();
      }
    } catch (error) {
      console.error('回复失败:', error);
      ChatUI.hideTyping();
      const errMsg = error.message || String(error);
      ChatUI.addMessage({
        content: `*回复失败: ${errMsg.substring(0, 300)}*`,
        type: 'received',
        sender: '系统',
        avatar: null
      });
    }
  },

  // 检测上下文中待处理的红包和转账
  _detectPendingItems(contextMsgs) {
    const pendingRedPackets = [];
    const pendingTransfers = [];

    for (const msg of contextMsgs) {
      // 待领红包
      const rpMatch = msg.content.match(/^\[redpacket:(.+?):(.+?):(.+?):(.*?):(.+?):(.+?):(.+)\]$/);
      if (rpMatch) {
        const [, type, amount, count, extra, sender, rpId, claimedJson] = rpMatch;
        let claimed = [];
        try { claimed = JSON.parse(claimedJson); } catch(e) {}
        if (claimed.length < parseInt(count)) {
          pendingRedPackets.push({ type, amount, count: parseInt(count), extra, sender, rpId, claimed, msgId: msg.id });
        }
      }
      // 待接收转账
      const trMatch = msg.content.match(/^\[transfer:(.+?):(.+?):pending:(.+?)\]$/);
      if (trMatch) {
        pendingTransfers.push({ amount: trMatch[1], note: trMatch[2], sender: trMatch[3], msgId: msg.id });
      }
    }

    return { pendingRedPackets, pendingTransfers };
  },

  // AI回复后处理：红包抢夺 + 转账接收
  async _processPostReply(rawReply, pendingContext, replySenders) {
    // 处理转账接收
    if (rawReply.includes('[accept_transfer]') && pendingContext.pendingTransfers.length > 0) {
      const tr = pendingContext.pendingTransfers[0];
      // 更新转账状态
      const db = await openChatDB();
      const tx = db.transaction(MSG_STORE, 'readwrite');
      const store = tx.objectStore(MSG_STORE);
      const req = store.get(tr.msgId);
      req.onsuccess = () => {
        const msg = req.result;
        if (msg) {
          msg.content = msg.content.replace(':pending:', ':accepted:');
          store.put(msg);
        }
      };
      const transferEl = document.querySelector(`[data-msg-id="${tr.msgId}"] .transfer-card`);
      if (transferEl) {
        transferEl.dataset.status = 'accepted';
        transferEl.querySelector('.transfer-card-bottom').textContent = '已收款';
      }
      const acceptor = replySenders[0] || '对方';
      const sysId = ChatUtils.generateMsgId();
      ChatUI.addMessage({ content: `${acceptor}已收款 ¥${tr.amount}`, type: 'system', msgId: sysId });
      await this.saveMessage({ id: sysId, chatId: this.currentChatId, content: `${acceptor}已收款 ¥${tr.amount}`, type: 'system', sender: '系统', timestamp: Date.now() });
    }

    // 处理红包抢夺 — 基于[claim_rp:rpId]标记 + 发言频率/人设
    const claimMatches = rawReply.match(/\[claim_rp:([^\]]+)\]/g);
    if (claimMatches && pendingContext.pendingRedPackets.length > 0) {
      for (const claimTag of claimMatches) {
        const rpIdMatch = claimTag.match(/\[claim_rp:(.+)\]/);
        if (!rpIdMatch) continue;
        const rpId = rpIdMatch[1];
        const rp = pendingContext.pendingRedPackets.find(r => r.rpId === rpId);
        if (!rp) continue;

        // 从发言者中找到抢红包的人
        const claimers = replySenders.filter(s => s && !rp.claimed.find(c => c.name === s));
        if (claimers.length === 0) continue;

        for (const claimer of claimers) {
          if (rp.claimed.length >= rp.count) break;
          // 专属红包只有指定人能抢
          if (rp.type === 'exclusive' && claimer !== rp.extra) continue;

          const remaining = parseFloat(rp.amount) - rp.claimed.reduce((s, c) => s + c.amount, 0);
          const remainCount = rp.count - rp.claimed.length;
          let gotAmount;
          if (remainCount === 1) {
            gotAmount = Math.round(remaining * 100) / 100;
          } else {
            const max = (remaining / remainCount) * 2;
            gotAmount = Math.max(0.01, Math.round(Math.random() * max * 100) / 100);
            gotAmount = Math.min(gotAmount, remaining - (remainCount - 1) * 0.01);
          }
          rp.claimed.push({ name: claimer, amount: gotAmount });

          const sysId = ChatUtils.generateMsgId();
          const sysText = `${claimer}抢到了红包，获得¥${gotAmount.toFixed(2)}`;
          ChatUI.addMessage({ content: sysText, type: 'system', msgId: sysId });
          await this.saveMessage({ id: sysId, chatId: this.currentChatId, content: sysText, type: 'system', sender: '系统', timestamp: Date.now() });
        }

        // 更新红包消息
        if (typeof updateRedPacketMessage === 'function') {
          await updateRedPacketMessage(rp.msgId, rp.type, parseFloat(rp.amount), rp.count, rp.extra, rp.sender, rp.rpId, rp.claimed);
        }
      }
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
      const lastUserMsgIdx = msgs.map(m => m.type).lastIndexOf('sent');

      if (lastUserMsgIdx === -1) return;
      const lastUserMsg = msgs[lastUserMsgIdx];

      // 删除最后一条用户消息之后的所有AI回复
      const toDelete = msgs.slice(lastUserMsgIdx + 1).filter(m => m.type === 'received');
      for (const msg of toDelete) {
        await this.deleteMessage(msg.id);
        document.querySelector(`[data-msg-id="${msg.id}"]`)?.remove();
      }

      await this.generateReply(lastUserMsg.content);
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

  async updateMessageContent(msgId, newContent) {
    if (!msgId) return;
    const db = await openChatDB();
    const tx = db.transaction(MSG_STORE, 'readwrite');
    const store = tx.objectStore(MSG_STORE);
    const req = store.get(msgId);
    req.onsuccess = () => {
      const msg = req.result;
      if (msg) {
        msg.content = newContent;
        store.put(msg);
      }
    };
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
  },

  // 拍一拍
  async handlePat(memberName) {
    const char = this.currentCharacter;
    if (!char) return;

    const text = `你拍了拍 ${memberName}`;
    const msgId = ChatUtils.generateMsgId();

    ChatUI.addMessage({
      content: text,
      type: 'system',
      msgId
    });

    await this.saveMessage({
      id: msgId,
      chatId: this.currentChatId,
      content: text,
      type: 'system',
      sender: '系统',
      timestamp: Date.now()
    });

    // 根据发言频率概率决定是否回应
    if (char.isGroup) {
      const member = (char.members || []).find(m => m.name === memberName);
      if (member && typeof ChatGroup !== 'undefined') {
        const prob = ChatGroup.getFrequencyProbability(member.frequency);
        if (Math.random() < prob) {
          await this.generateReply(`[用户拍了拍${memberName}]`, [memberName]);
        }
      }
    } else {
      await this.generateReply(`[用户拍了拍${char.name}]`);
    }
  }
};

window.ChatCore = ChatCore;
