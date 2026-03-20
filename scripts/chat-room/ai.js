/* scripts/chat-room/ai.js - AI调用模块 */

const ChatAI = {
  buildMessages({ character, userSettings, contextMsgs, summary, userMessage, pendingContext }) {
    const messages = [];
    const charName = character.name || '角色';
    const userName = userSettings?.name || '用户';

    // 获取提示词条目顺序
    const promptEntries = character.promptEntries || [
      { id: 'char_persona', name: '角色人设', type: 'fixed', enabled: true },
      { id: 'user_persona', name: '用户人设', type: 'fixed', enabled: true },
      { id: 'summary', name: '总结信息', type: 'fixed', enabled: true },
      { id: 'chat_history', name: '聊天记录', type: 'fixed', enabled: true }
    ];

    let systemContent = '';

    // 按照用户排序顺序组装提示词
    for (const entry of promptEntries) {
      if (!entry.enabled) continue;

      if (entry.id === 'char_persona') {
        systemContent += `【角色人设】\n`;
        systemContent += `你是${charName}。`;
        if (character.description) systemContent += `\n描述: ${character.description}`;
        if (character.personality) systemContent += `\n性格: ${character.personality}`;
        if (character.system_prompt) systemContent += `\n${character.system_prompt}`;

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
        systemContent += '\n\n';
      } else if (entry.id === 'user_persona') {
        systemContent += `【用户人设】\n`;
        systemContent += `用户: ${userName}`;
        if (userSettings?.persona) systemContent += ` - ${userSettings.persona}`;
        systemContent += '\n\n';
      } else if (entry.id === 'summary') {
        if (summary) {
          systemContent += `【总结信息】\n`;
          systemContent += `之前的对话总结:\n${summary}\n\n`;
        }
      } else if (entry.id === 'chat_history') {
        // chat_history 通过 context messages 注入，不在 system content 中
      } else if (entry.type === 'custom' && entry.content) {
        systemContent += `【${entry.name}】\n`;
        systemContent += `${entry.content.replace(/{{char}}/g, charName).replace(/{{user}}/g, userName)}\n\n`;
      }
    }

    // 注入待处理红包/转账上下文
    if (pendingContext) {
      if (pendingContext.pendingTransfers.length > 0) {
        const tr = pendingContext.pendingTransfers[0];
        systemContent += `\n[互动提示] 用户给你转了¥${tr.amount}，备注：${tr.note}。你可以决定是否接收。如果接收，在回复中包含[accept_transfer]标记。`;
      }
      if (pendingContext.pendingRedPackets.length > 0) {
        for (const rp of pendingContext.pendingRedPackets) {
          const remain = rp.count - rp.claimed.length;
          const typeNames = { lucky: '拼手气', voice: '语音', exclusive: '专属' };
          systemContent += `\n[互动提示] 群里有一个${typeNames[rp.type] || ''}红包(¥${rp.amount}，还剩${remain}个)。根据你的性格决定是否抢红包。如果要抢，在回复中包含[claim_rp:${rp.rpId}]标记。`;
        }
      }
    }

    // 私聊短句回复格式指令
    systemContent += `\n回复格式：将回复拆分为多条短消息，每条用<msg>标签包裹。
示例：<msg>哈哈真的吗</msg><msg>我也遇到过</msg><msg>太离谱了吧</msg>
每条5-50字，共1-5条。不要输出标签以外的内容。
你也可以发送语音消息，用<voice>标签包裹，如：<voice>今天天气真好啊</voice>
语音消息会以语音条形式展示。
你可以主动给用户转账或发红包：
- 转账：在消息中包含[send_transfer:金额:备注]，如[send_transfer:6.66:请你喝奶茶]
- 红包：在消息中包含[send_rp:金额]，如[send_rp:8.88]
根据角色性格和场景自然使用，不要滥用。
在所有<msg>之后，输出一个<status>标签描述你的状态变化：
<status>
affection=+数值或-数值（好感度变化，范围-10到+10）
mood=+数值或-数值（心情变化，范围-15到+15）
thought=一句话内心想法
</status>
仅当衣着或地点发生变化时才额外加上：
outfit=新衣着
location=新地点
不要解释status标签，直接输出即可。`;

    messages.push({ role: 'system', content: systemContent });

    if (character.mes_example) {
      const example = character.mes_example.replace(/{{char}}/g, charName).replace(/{{user}}/g, userName);
      messages.push({ role: 'system', content: `对话示例:\n${example}` });
    }

    contextMsgs.forEach(msg => {
      if (msg.type === 'system') {
        const dynMatch = msg.content.match(/^\[dynamic:(.+?):(.+)\]$/s);
        if (dynMatch) {
          messages.push({ role: 'user', content: `[用户发布了一条动态：${dynMatch[2]}]` });
        }
        return;
      }
      const role = msg.type === 'sent' ? 'user' : 'assistant';
      // 检测图片消息，构建vision格式
      const imgMatch = msg.content.match(/^\[img:(.+)\]$/s);
      if (imgMatch && role === 'user') {
        messages.push({
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imgMatch[1] } },
            { type: 'text', text: '(用户发送了一张图片，请根据图片内容回应)' }
          ]
        });
      } else {
        messages.push({ role, content: msg.content });
      }
    });

    messages.push({ role: 'user', content: userMessage });

    return messages;
  },

  // ========== 群聊消息构建 ==========
  buildGroupMessages({ character, userSettings, contextMsgs, summary, userMessage, speakingMembers, pendingContext }) {
    const messages = [];
    const members = character.members || [];
    const userName = character.groupUserSettings?.name || userSettings?.name || '用户';
    const userPersona = character.groupUserSettings?.persona || userSettings?.persona || '';

    // 获取提示词条目顺序
    const promptEntries = character.promptEntries || [
      { id: 'group_info', name: '群聊信息', type: 'fixed', enabled: true },
      { id: 'member_persona', name: '成员人设', type: 'fixed', enabled: true },
      { id: 'user_persona', name: '用户人设', type: 'fixed', enabled: true },
      { id: 'group_summary', name: '群聊总结', type: 'fixed', enabled: true },
      { id: 'chat_history', name: '当前群聊记录', type: 'fixed', enabled: true }
    ];

    let systemContent = '你正在模拟群聊中的多个角色。\n\n';

    // 按照用户排序顺序组装提示词
    for (const entry of promptEntries) {
      if (!entry.enabled) continue;

      if (entry.id === 'group_info') {
        systemContent += `群名: ${character.name}\n`;
        if (character.description) systemContent += `群简介: ${character.description}\n`;
        const admins = members.filter(m => m.role === 'admin');
        if (admins.length > 0) {
          systemContent += `管理员: ${admins.map(a => a.name).join('、')}\n`;
        }
        systemContent += '\n';
      } else if (entry.id === 'member_persona') {
        systemContent += '[群成员列表]\n';
        members.forEach(m => {
          systemContent += `- ${m.name}`;
          if (m.persona) systemContent += `: ${m.persona}`;
          systemContent += '\n';
        });
        systemContent += '\n';
      } else if (entry.id === 'user_persona') {
        systemContent += `用户: ${userName}`;
        if (userPersona) systemContent += ` - ${userPersona}`;
        systemContent += '\n\n';
      } else if (entry.id === 'group_summary') {
        if (summary) {
          systemContent += `之前的对话总结:\n${summary}\n\n`;
        }
      } else if (entry.id === 'chat_history') {
        // chat_history 不在 system content 中，通过 context messages 处理
      } else if (entry.type === 'custom' && entry.content) {
        systemContent += `${entry.content}\n\n`;
      }
    }

    // 回复格式指令
    systemContent += `回复格式：用<msg name="成员名">内容</msg>表示每条消息。
同一成员连续发言只需第一条写name，后续可省略name。
被另一成员打断后需重新写name。
每条5-50字。不要输出标签以外的内容。不要代替用户发言。
你也可以发送语音消息，用<voice name="成员名">内容</voice>标签，会以语音条形式展示。

示例：
<msg name="小明">你们听说了吗</msg>
<msg>今天食堂出新菜了</msg>
<voice name="小红">我刚从食堂回来味道还不错</voice>
<msg name="小红">真的假的</msg>
成员可以主动给用户转账或发红包：
- 转账：在消息中包含[send_transfer:金额:备注]，如[send_transfer:6.66:请你喝奶茶]
- 红包：在消息中包含[send_rp:金额]，如[send_rp:8.88]
根据角色性格和场景自然使用，不要滥用。`;

    // 如果有概率筛选后的发言成员列表，告诉AI只让这些成员发言
    if (speakingMembers && speakingMembers.length > 0) {
      const names = speakingMembers.map(m => m.name).join('、');
      systemContent += `\n\n本轮请只让以下成员发言：${names}`;
    }

    // 注入待处理红包/转账上下文
    if (pendingContext) {
      if (pendingContext.pendingTransfers.length > 0) {
        const tr = pendingContext.pendingTransfers[0];
        systemContent += `\n\n[互动提示] 用户给成员转了¥${tr.amount}，备注：${tr.note}。收到转账的成员可以决定是否接收，如果接收在回复中包含[accept_transfer]。`;
      }
      if (pendingContext.pendingRedPackets.length > 0) {
        for (const rp of pendingContext.pendingRedPackets) {
          const remain = rp.count - rp.claimed.length;
          const alreadyClaimed = rp.claimed.map(c => c.name).join('、');
          const typeNames = { lucky: '拼手气', voice: '语音', exclusive: '专属' };
          let hint = `\n\n[互动提示] 群里有一个${typeNames[rp.type] || ''}红包(¥${rp.amount}，共${rp.count}个还剩${remain}个)。`;
          if (alreadyClaimed) hint += `已抢：${alreadyClaimed}。`;
          if (rp.type === 'exclusive') hint += `只有${rp.extra}能抢。`;
          if (rp.type === 'voice') hint += `口令：${rp.extra}。`;
          hint += `成员根据自己的性格和兴趣决定是否抢红包。要抢请在回复中包含[claim_rp:${rp.rpId}]标记。`;
          systemContent += hint;
        }
      }
    }

    messages.push({ role: 'system', content: systemContent });

    // 上下文消息
    contextMsgs.forEach(msg => {
      if (msg.type === 'system') {
        const dynMatch = msg.content.match(/^\[dynamic:(.+?):(.+)\]$/s);
        if (dynMatch) {
          messages.push({ role: 'user', content: `[用户发布了一条动态：${dynMatch[2]}]` });
        }
        return;
      }
      if (msg.type === 'sent') {
        // 检测图片消息，构建vision格式
        const imgMatch = msg.content.match(/^\[img:(.+)\]$/s);
        if (imgMatch) {
          messages.push({
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imgMatch[1] } },
              { type: 'text', text: '(用户发送了一张图片，请根据图片内容回应)' }
            ]
          });
        } else {
          messages.push({ role: 'user', content: msg.content });
        }
      } else {
        const prefix = msg.sender ? `[${msg.sender}] ` : '';
        messages.push({ role: 'assistant', content: prefix + msg.content });
      }
    });

    messages.push({ role: 'user', content: userMessage });

    return messages;
  },

  async callAPI(messages, config) {
    let url = config.apiUrl || 'https://api.openai.com/v1/chat/completions';

    // 智能补全URL：兼容各种格式
    url = url.replace(/\/+$/, '');
    if (!url.includes('/chat/completions')) {
      if (url.endsWith('/v1')) {
        url += '/chat/completions';
      } else {
        url += '/v1/chat/completions';
      }
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
      console.error('API响应错误:', response.status, errText);
      throw new Error(`API错误 ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    console.log('API响应:', data);

    const content = data.choices?.[0]?.message?.content
      || data.choices?.[0]?.text
      || data.response
      || data.output?.text
      || '';

    if (!content) {
      console.warn('API返回空内容，原始数据:', JSON.stringify(data).substring(0, 500));
    }

    return content;
  },

  parseResponse(text, isGroup = false) {
    if (!text || !text.trim()) {
      return isGroup
        ? { messages: [{ sender: null, content: '(空回复)' }], thought: null, aiTransfers: [], aiRedPackets: [] }
        : { thought: null, floors: ['(空回复)'], aiTransfers: [], aiRedPackets: [] };
    }

    // 内置：清除模型思维链
    text = ChatUtils.stripThinking(text);

    // 提取 <status> 块
    let status = null;
    const statusMatch = text.match(/<status>([\s\S]*?)<\/status>/i);
    if (statusMatch) {
      status = {};
      const lines = statusMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) continue;
        const key = line.substring(0, eqIdx).trim();
        const val = line.substring(eqIdx + 1).trim();
        if (key === 'affection' || key === 'mood') {
          const num = parseInt(val, 10);
          if (!isNaN(num)) status[key] = num;
        } else if (key === 'thought' || key === 'outfit' || key === 'location') {
          if (val) status[key] = val;
        }
      }
      if (Object.keys(status).length === 0) status = null;
    }

    // 提取内心想法
    const thoughtMatch = text.match(/\[内心[：:]\s*(.+?)\]/);
    const thought = thoughtMatch ? thoughtMatch[1] : null;
    let cleaned = text.replace(/\[内心[：:].+?\]/g, '').replace(/<status>[\s\S]*?<\/status>/gi, '').trim();

    // 提取 <msg> 和 <voice> 标签 — 按出现顺序
    const tagRegex = /<(msg|voice)(?:\s+name=["']([^"']*)["'])?\s*>([\s\S]*?)<\/\1>/gi;
    const results = [];
    let match, lastSender = null;
    while ((match = tagRegex.exec(cleaned)) !== null) {
      const tagType = match[1].toLowerCase();
      const content = match[3].trim();
      if (!content) continue;
      const sender = match[2] || lastSender;
      lastSender = sender;
      if (tagType === 'voice') {
        results.push({ sender, content: `[voice:${content}]` });
      } else {
        results.push({ sender, content });
      }
    }

    // 提取AI主动发送的转账和红包
    const aiTransfers = [];
    const aiRedPackets = [];

    // 同时清理AI回复中的特殊标记
    results.forEach(r => {
      // 提取 [send_transfer:金额:备注]
      const trMatches = r.content.match(/\[send_transfer:([^:\]]+):([^\]]*)\]/g);
      if (trMatches) {
        for (const tag of trMatches) {
          const m = tag.match(/\[send_transfer:([^:\]]+):([^\]]*)\]/);
          if (m) aiTransfers.push({ amount: m[1], note: m[2], sender: r.sender });
        }
      }
      // 提取 [send_rp:金额]
      const rpMatches = r.content.match(/\[send_rp:([^\]]+)\]/g);
      if (rpMatches) {
        for (const tag of rpMatches) {
          const m = tag.match(/\[send_rp:([^\]]+)\]/);
          if (m) aiRedPackets.push({ amount: m[1], sender: r.sender });
        }
      }
      r.content = r.content
        .replace(/\[accept_transfer\]/g, '')
        .replace(/\[claim_rp:[^\]]*\]/g, '')
        .replace(/\[send_transfer:[^\]]*\]/g, '')
        .replace(/\[send_rp:[^\]]*\]/g, '')
        .trim();
    });

    // 过滤掉清理后内容为空的消息
    const filteredResults = results.filter(r => r.content);

    // fallback: 无<msg>标签时，按\n\n或\n分段
    if (filteredResults.length === 0) {
      // 先尝试双换行分段
      let floors = cleaned.split(/\n{2,}/).map(f => f.trim()).filter(Boolean);
      // 如果只有一段，尝试单换行分段（但只在段落较长时）
      if (floors.length <= 1 && cleaned.length > 80) {
        floors = cleaned.split(/\n/).map(f => f.trim()).filter(Boolean);
      }
      if (floors.length === 0) floors = [cleaned];

      if (isGroup) {
        return { messages: floors.map(f => ({ sender: null, content: f })), thought, status, aiTransfers, aiRedPackets };
      }
      return { thought, status, floors, aiTransfers, aiRedPackets };
    }

    if (isGroup) {
      return { messages: filteredResults, thought, status, aiTransfers, aiRedPackets };
    }
    return { thought, status, floors: filteredResults.map(r => r.content), aiTransfers, aiRedPackets };
  }
};

window.ChatAI = ChatAI;
