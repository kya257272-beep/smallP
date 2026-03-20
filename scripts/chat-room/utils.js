/* scripts/chat-room/utils.js - 工具函数 */

const ChatUtils = {
  generateMsgId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  formatTime(timestamp) {
    const d = new Date(timestamp);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  },

  showToast(msg) {
    let toast = document.querySelector('.toast-message');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast-message';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  },

  parseMarkdown(text) {
    if (!text) return '';

    // 转账卡片
    const transferMatch = text.match(/^\[transfer:(.+?):(.+?):(.+?):(.+?)\]$/);
    if (transferMatch) {
      const [, amount, note, status, sender] = transferMatch;
      const isAccepted = status === 'accepted';
      return `<div class="transfer-card" data-status="${status}" data-amount="${amount}" data-note="${ChatUtils.escapeHtml(note)}" data-sender="${ChatUtils.escapeHtml(sender)}" onclick="handleTransferClick(this)">
        <div class="transfer-card-top">
          <div class="transfer-icon">💰</div>
          <div class="transfer-info">
            <div class="transfer-amount-display">¥${amount}</div>
            <div class="transfer-note-display">${ChatUtils.escapeHtml(note)}</div>
          </div>
        </div>
        <div class="transfer-card-bottom">${isAccepted ? '已收款' : 'QQ转账'}</div>
      </div>`;
    }

    // 红包卡片 — QQ风格
    const rpMatch = text.match(/^\[redpacket:(.+?):(.+?):(.+?):(.*?):(.+?):(.+?):(.+)\]$/);
    if (rpMatch) {
      const [, type, amount, count, extra, sender, rpId, claimedJson] = rpMatch;
      let claimed = [];
      try { claimed = JSON.parse(claimedJson); } catch(e) {}
      const totalCount = parseInt(count);
      const allClaimed = claimed.length >= totalCount;
      const typeLabels = { lucky: '拼手气红包', voice: '语音红包', exclusive: '专属红包' };
      const typeIcons = { lucky: '🧧', voice: '🎤', exclusive: '♛' };
      const subText = type === 'voice' ? extra : (type === 'exclusive' ? `专属 ${extra}` : '恭喜发财');
      return `<div class="redpacket-card${allClaimed ? ' claimed' : ''}" data-rp-id="${rpId}" data-type="${type}" data-amount="${amount}" data-count="${count}" data-extra="${ChatUtils.escapeHtml(extra)}" data-sender="${ChatUtils.escapeHtml(sender)}" data-claimed='${ChatUtils.escapeHtml(claimedJson)}' onclick="handleRedPacketClick(this)">
        <div class="rp-card-flap"></div>
        <div class="rp-card-body">
          <div class="rp-card-icon">${typeIcons[type] || '🧧'}</div>
          <div class="rp-card-gold-text">${ChatUtils.escapeHtml(subText)}</div>
        </div>
        <div class="rp-card-bottom">${typeLabels[type] || '红包'}</div>
      </div>`;
    }

    // 表情贴纸
    const stickerMatch = text.match(/^\[sticker:(.+?):(.+)\]$/s);
    if (stickerMatch) {
      return `<img class="sticker-image" src="${stickerMatch[2]}" alt="${ChatUtils.escapeHtml(stickerMatch[1])}">`;
    }

    // 语音消息
    const voiceMatch = text.match(/^\[voice:(.+)\]$/s);
    if (voiceMatch) {
      const content = voiceMatch[1];
      const duration = Math.max(2, Math.min(15, Math.ceil(content.length / 4)));
      const barCount = Math.max(10, Math.min(22, duration * 2));
      let bars = '';
      for (let i = 0; i < barCount; i++) {
        const h = 4 + Math.floor(Math.random() * 14);
        bars += `<span class="voice-bar" style="height:${h}px"></span>`;
      }
      return `<div class="voice-msg" onclick="this.classList.toggle('expanded')">
        <div class="voice-bar-row">
          <span class="voice-icon">🔊</span>
          <div class="voice-bars">${bars}</div>
          <span class="voice-duration">${duration}″</span>
        </div>
        <div class="voice-expand">${ChatUtils.escapeHtml(content)}</div>
      </div>`;
    }

    // 语音通话总结
    const vcSummaryMatch = text.match(/^\[voicecall-summary:(.+)\]$/s);
    if (vcSummaryMatch) {
      return `<div class="voicecall-summary">${ChatUtils.escapeHtml(vcSummaryMatch[1])}</div>`;
    }

    // 动态分享卡片
    const dynamicMatch = text.match(/^\[dynamic:(.+?):(.+)\]$/s);
    if (dynamicMatch) {
      const [, dynId, snippet] = dynamicMatch;
      return `<div class="dynamic-share-card" onclick="window.location.href='chat.html'" style="background:#f0f6ff;border-radius:10px;padding:10px 14px;cursor:pointer;border:1px solid #e0ecff;">
        <div style="font-size:12px;color:#999;margin-bottom:4px;">📝 动态分享</div>
        <div style="font-size:14px;color:#333;">${ChatUtils.escapeHtml(snippet)}</div>
        <div style="font-size:11px;color:#aaa;margin-top:4px;">点击查看空间</div>
      </div>`;
    }

    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[img:(.+?)\]/g, '<img src="$1" onclick="viewImage(\'$1\')">')
      .replace(/\n/g, '<br>');
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  stripThinking(text) {
    if (!text) return text;
    return text.replace(/<(?:think|thinking)>[\s\S]*?<\/(?:think|thinking)>/g, '');
  },

  getTimeContext() {
    const h = new Date().getHours();
    if (h >= 5 && h < 9) return '清晨';
    if (h >= 9 && h < 12) return '上午';
    if (h >= 12 && h < 14) return '中午';
    if (h >= 14 && h < 18) return '下午';
    if (h >= 18 && h < 22) return '晚上';
    return '深夜';
  },

  getDateContext() {
    const d = new Date();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
  },

  async getWeatherContext() {
    try {
      const stored = localStorage.getItem('weatherData');
      if (stored) {
        const data = JSON.parse(stored);
        if (Date.now() - data.timestamp < 3600000) return data.weather;
      }
    } catch (e) {}
    return '天气未知';
  }
};

window.ChatUtils = ChatUtils;
