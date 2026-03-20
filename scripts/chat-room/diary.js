/* scripts/chat-room/diary.js - 日记模块 */

const ChatDiary = {
  _openDiaryDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('DiaryDB', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('diaries')) {
          const store = db.createObjectStore('diaries', { keyPath: 'id', autoIncrement: true });
          store.createIndex('charId', 'charId', { unique: false });
        }
        if (!db.objectStoreNames.contains('styles')) {
          db.createObjectStore('styles');
        }
      };
    });
  },

  _idbReq(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async checkAndSchedule(charId) {
    try {
      const db = await openChatDB();
      const tx = db.transaction(CHAR_STORE, 'readonly');
      const char = await this._idbReq(tx.objectStore(CHAR_STORE).get(charId));

      if (!char || !char.dynamicsSettings?.postDiary) return;

      const now = Date.now();
      if (!char.diarySchedule) {
        char.diarySchedule = { lastCheck: 0, nextCheck: now, cooldownUntil: 0 };
      }

      if (now < char.diarySchedule.nextCheck) return;

      const probability = char.diarySettings?.probability || 50;
      const roll = Math.random() * 100;

      if (roll < probability) {
        await this.generateDiary(char);
        char.diarySchedule.cooldownUntil = now + 24 * 3600 * 1000;
        char.diarySchedule.nextCheck = now + 24 * 3600 * 1000;
      } else {
        char.diarySchedule.cooldownUntil = now + 12 * 3600 * 1000;
        char.diarySchedule.nextCheck = now + 12 * 3600 * 1000;
      }

      char.diarySchedule.lastCheck = now;
      const tx2 = db.transaction(CHAR_STORE, 'readwrite');
      await this._idbReq(tx2.objectStore(CHAR_STORE).put(char));
    } catch (e) {
      console.error('日记调度检查失败:', e);
    }
  },

  async generateDiary(char) {
    const apiConfig = JSON.parse(localStorage.getItem('apiConfig') || '{}');
    if (!apiConfig.apiUrl || !apiConfig.apiKey) {
      console.warn('日记生成失败：未配置API');
      return;
    }

    const messages = this.buildDiaryPrompt(char);

    try {
      const content = await ChatAI.callAPI(messages, apiConfig);
      if (!content || !content.trim()) {
        console.warn('日记生成失败：模型返回空内容');
        return;
      }

      // 内置：清除模型思维链
      const cleaned = ChatUtils.stripThinking(content).trim();

      await this.saveDiary(char.id, char.name, cleaned);
      console.log('日记生成成功:', char.name);
    } catch (e) {
      console.error('日记生成失败:', e);
    }
  },

  buildDiaryPrompt(char) {
    const messages = [];
    const charName = char.name || '角色';
    const userName = char.userSettings?.name || '用户';

    let systemContent = `你是${charName}，正在写一篇私人日记。\n\n`;

    const promptEntries = char.promptEntries || [];

    for (const entry of promptEntries) {
      if (!entry.enabled) continue;

      if (entry.id === 'char_persona') {
        systemContent += `【角色人设】\n`;
        if (char.description) systemContent += `描述: ${char.description}\n`;
        if (char.personality) systemContent += `性格: ${char.personality}\n`;
        if (char.system_prompt) systemContent += `${char.system_prompt}\n`;

        if (char.perceptionSettings?.timeAware) {
          systemContent += `当前时间: ${ChatUtils.getTimeContext()}\n`;
        }
        if (char.perceptionSettings?.dateAware) {
          systemContent += `当前日期: ${ChatUtils.getDateContext()}\n`;
        }
        systemContent += '\n';
      } else if (entry.id === 'user_persona') {
        systemContent += `【用户人设】\n用户: ${userName}`;
        if (char.userSettings?.persona) systemContent += ` - ${char.userSettings.persona}`;
        systemContent += '\n\n';
      } else if (entry.type === 'custom' && entry.content) {
        systemContent += `【${entry.name}】\n${entry.content.replace(/{{char}}/g, charName).replace(/{{user}}/g, userName)}\n\n`;
      }
    }

    systemContent += `请写一篇200-500字的日记，记录今天的心情、想法、发生的事情等。用第一人称，自然真实，符合角色性格。`;

    messages.push({ role: 'system', content: systemContent });

    if (char.mes_example) {
      const example = char.mes_example.replace(/{{char}}/g, charName).replace(/{{user}}/g, userName);
      messages.push({ role: 'system', content: `对话示例:\n${example}` });
    }

    return messages;
  },

  async saveDiary(charId, charName, content) {
    const db = await this._openDiaryDB();
    const tx = db.transaction('diaries', 'readwrite');
    const weather = this.getWeather();

    await this._idbReq(tx.objectStore('diaries').add({
      charId,
      charName,
      content,
      weather,
      timestamp: Date.now()
    }));
    db.close();
  },

  getWeather() {
    const weathers = ['晴', '多云', '阴', '小雨', '雨'];
    return weathers[Math.floor(Math.random() * weathers.length)];
  }
};

window.ChatDiary = ChatDiary;
