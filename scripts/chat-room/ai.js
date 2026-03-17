/* scripts/chat-room/ai.js - AI调用模块 */

const ChatAI = {
  buildMessages({ character, userSettings, preset, worldBook, contextMsgs, summary, userMessage }) {
    const messages = [];
    const charName = character.name || '角色';
    const userName = userSettings?.name || '用户';

    let systemContent = '';

    if (preset?.entries) {
      preset.entries.filter(e => e.enabled && e.role === 'system').forEach(e => {
        systemContent += e.content.replace(/{{char}}/g, charName).replace(/{{user}}/g, userName) + '\n\n';
      });
    }

    systemContent += `你是${charName}。`;
    if (character.description) systemContent += `\n描述: ${character.description}`;
    if (character.personality) systemContent += `\n性格: ${character.personality}`;
    if (character.system_prompt) systemContent += `\n${character.system_prompt}`;

    if (userSettings?.persona) {
      systemContent += `\n\n用户设定: ${userSettings.persona}`;
    }

    if (character.perceptionSettings?.timeAware) {
      systemContent += `\n当前时间: ${ChatUtils.getTimeContext()}`;
    }
    if (character.perceptionSettings?.dateAware) {
      systemContent += `\n当前日期: ${ChatUtils.getDateContext()}`;
    }

    if (character.outfit) systemContent += `\n当前衣着: ${character.outfit}`;
    if (character.location) systemContent += `\n当前地点: ${character.location}`;
    if (character.affection !== undefined) systemContent += `\n对用户好感度: ${character.affection}/100`;
    if (character.mood !== undefined) systemContent += `\n当前心情: ${character.mood}/100`;

    if (worldBook?.entries) {
      const relevantEntries = worldBook.entries.filter(e => {
        if (!e.keywords || !e.keywords.length) return false;
        const text = (userMessage + ' ' + contextMsgs.map(m => m.content).join(' ')).toLowerCase();
        return e.keywords.some(k => text.includes(k.toLowerCase()));
      });
      if (relevantEntries.length) {
        systemContent += '\n\n世界书设定:\n' + relevantEntries.map(e => e.content).join('\n');
      }
    }

    if (summary) {
      systemContent += `\n\n之前的对话总结:\n${summary}`;
    }

    messages.push({ role: 'system', content: systemContent });

    if (character.mes_example) {
      const example = character.mes_example.replace(/{{char}}/g, charName).replace(/{{user}}/g, userName);
      messages.push({ role: 'system', content: `对话示例:\n${example}` });
    }

    contextMsgs.forEach(msg => {
      messages.push({
        role: msg.type === 'sent' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    messages.push({ role: 'user', content: userMessage });

    return messages;
  },

  async callAPI(messages, config) {
    let url = config.apiUrl || 'https://api.openai.com/v1/chat/completions';
    
    // 自动补全URL
    if (!url.includes('/chat/completions')) {
      url = url.replace(/\/+$/, '') + '/v1/chat/completions';
    }
    
    const key = config.apiKey;
    const model = config.model || 'gpt-3.5-turbo';

    console.log('请求URL:', url);
    console.log('使用模型:', model);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: config.temperature || 0.8,
        max_tokens: config.maxTokens || 1000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('API响应错误:', errText);
      throw new Error(`API错误 ${response.status}: ${errText.substring(0, 100)}`);
    }

    const data = await response.json();
    console.log('API响应:', data);
    
    return data.choices?.[0]?.message?.content || '';
  },

  parseResponse(text) {
    const thoughtMatch = text.match(/\[内心[：:]\s*(.+?)\]/);
    const thought = thoughtMatch ? thoughtMatch[1] : null;

    let cleaned = text.replace(/\[内心[：:].+?\]/g, '').trim();
    const floors = cleaned.split(/\n{2,}/).filter(f => f.trim());

    return { thought, floors: floors.length ? floors : [cleaned] };
  }
};

window.ChatAI = ChatAI;
