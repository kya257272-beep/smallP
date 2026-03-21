/* scripts/chat-room/ui.js - UI渲染模块 */

const ChatUI = {
  _longPressTimer: null,
  _selectedMsgEl: null,
  _toolbarOpen: false,
  _toolbarPage: 0,
  _bubbleMenuLock: false,

  showModal(id) {
    document.getElementById(id)?.classList.add('active');
  },

  hideModal(id) {
    document.getElementById(id)?.classList.remove('active');
  },

  updateTopbar(char) {
    const nameEl = document.getElementById('topbar-name');
    const statusEl = document.getElementById('topbar-status');
    const heartsEl = document.getElementById('topbar-hearts');

    if (char.isGroup) {
      nameEl.childNodes[0].textContent = char.name || '群聊';
      const memberCount = (char.members || []).length;
      statusEl.innerHTML = `<span>${memberCount}人</span>`;
      if (heartsEl) heartsEl.style.display = 'none';
    } else {
      nameEl.childNodes[0].textContent = char.name || '未知';
      statusEl.innerHTML = `<span class="status-dot online"></span><span>在线</span>`;
      if (heartsEl) {
        heartsEl.style.display = 'inline-flex';
        const affection = char.affection || 50;
        const mood = char.mood || 70;
        heartsEl.innerHTML = `
          <span class="heart-indicator pink" title="好感度 ${affection}%">
            <svg viewBox="0 0 24 24" class="heart-svg">
              <defs>
                <clipPath id="heart-clip-pink">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </clipPath>
              </defs>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
              <rect x="0" y="${24 - 24 * affection / 100}" width="24" height="${24 * affection / 100}" fill="#ff6b9d" clip-path="url(#heart-clip-pink)"/>
            </svg>
          </span>
          <span class="heart-indicator blue" title="心情值 ${mood}%">
            <svg viewBox="0 0 24 24" class="heart-svg">
              <defs>
                <clipPath id="heart-clip-blue">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </clipPath>
              </defs>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
              <rect x="0" y="${24 - 24 * mood / 100}" width="24" height="${24 * mood / 100}" fill="#64b5f6" clip-path="url(#heart-clip-blue)"/>
            </svg>
          </span>
        `;
      }
    }
  },

  addMessage({ content, type, sender, avatar, msgId, senderName, isGroup, timestamp, quoteData, memberFrame, memberBubbleStyle, memberBubbleColor, memberBubbleColors, memberBubbleGradientDir }) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    if (msgId) div.dataset.msgId = msgId;
    if (sender) div.dataset.sender = sender;
    if (timestamp) div.dataset.timestamp = timestamp;

    // 系统消息特殊渲染
    if (type === 'system') {
      // 动态分享卡片走 parseMarkdown
      if (content.startsWith('[dynamic:')) {
        const parsed = ChatUtils.parseMarkdown(content);
        div.innerHTML = `<div class="system-msg-card">${parsed}</div>`;
      } else {
        div.innerHTML = `<div class="system-msg-text">${content}</div>`;
      }
      container.appendChild(div);
      this.scrollToBottom();
      return;
    }

    // 头像框：优先使用传入的memberFrame，否则读当前角色设置
    let frame = '';
    if (type === 'received') {
      frame = memberFrame || ChatCore.currentCharacter?.settings?.avatarFrame || '';
    } else if (type === 'sent') {
      // 用户头像框：从QQ主题设置读取
      const qqTheme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
      frame = qqTheme.userAvatarFrame || '';
    }

    // 气泡样式：优先使用传入的成员级别设置
    const bubbleStyle = (type === 'received') ? (memberBubbleStyle || ChatCore.currentCharacter?.settings?.bubbleStyle || '') : '';
    const bubbleColors = (type === 'received') ? (memberBubbleColors || ChatCore.currentCharacter?.settings?.bubbleColors || []) : [];
    const bubbleColor = (type === 'received') ? (memberBubbleColor || ChatCore.currentCharacter?.settings?.bubbleColor || '') : '';
    const bubbleGradientDir = (type === 'received') ? (memberBubbleGradientDir || ChatCore.currentCharacter?.settings?.bubbleGradientDir || '135deg') : '135deg';

    const avatarHtml = avatar
      ? `<img src="${avatar}">`
      : `<div class="avatar-placeholder">${(sender || '?').charAt(0)}</div>`;

    const senderLabel = (isGroup && type === 'received' && senderName)
      ? `<div class="group-sender-name">${ChatUtils.escapeHtml ? ChatUtils.escapeHtml(senderName) : senderName}</div>`
      : '';

    const timeStr = timestamp ? ChatUtils.formatTime(timestamp) : ChatUtils.formatTime(Date.now());

    // 引用块
    const quoteHtml = quoteData
      ? `<div class="message-quote" data-quote-id="${quoteData.quoteId || ''}">「${ChatUtils.escapeHtml ? ChatUtils.escapeHtml(quoteData.quoteSender || '') : (quoteData.quoteSender || '')}：${ChatUtils.escapeHtml ? ChatUtils.escapeHtml((quoteData.quoteContent || '').substring(0, 50)) : (quoteData.quoteContent || '').substring(0, 50)}」</div>`
      : '';

    const parsedContent = ChatUtils.parseMarkdown(content);
    const isSticker = content.startsWith('[sticker:');
    const isTransfer = content.startsWith('[transfer:');
    const isRedPacket = content.startsWith('[redpacket:');
    const isVoice = content.startsWith('[voice:');
    const isSpecialCard = isSticker || isTransfer || isRedPacket;

    div.innerHTML = `
      <div class="message-avatar-wrapper">
        <div class="message-avatar">${avatarHtml}</div>
        ${frame ? (frame.startsWith('custom:') ? `<div class="msg-avatar-frame" style="box-shadow: 0 0 0 2px ${frame.replace('custom:', '')}, 0 0 10px ${frame.replace('custom:', '')}40;"></div>` : `<div class="msg-avatar-frame ${frame}"></div>`) : ''}
      </div>
      <div class="message-content">
        ${senderLabel}
        ${quoteHtml}
        <div class="message-bubble${isSticker ? ' sticker-bubble' : ''}${isTransfer ? ' card-bubble' : ''}${isRedPacket ? ' card-bubble' : ''}">${parsedContent}</div>
        <div class="message-time">${timeStr}</div>
      </div>
    `;

    const bubble = div.querySelector('.message-bubble');
    this._bindBubbleEvents(bubble, div);

    // 应用气泡样式
    if (bubble && type === 'received') {
      if (bubbleStyle) bubble.classList.add('bubble-' + bubbleStyle);
      if (bubbleColors.length > 0) {
        const grad = bubbleColors.length > 1
          ? `linear-gradient(${bubbleGradientDir}, ${bubbleColors.join(', ')})`
          : bubbleColors[0];
        bubble.style.background = grad;
        bubble.style.color = '#fff';
      } else if (bubbleColor) {
        bubble.style.background = bubbleColor;
        bubble.style.color = '#fff';
      }
    }

    // 双击头像 → 拍一拍
    const avatarEl = div.querySelector('.message-avatar');
    if (type === 'received' && sender) {
      avatarEl.style.cursor = 'pointer';
      avatarEl.addEventListener('dblclick', () => {
        ChatCore.handlePat(sender);
      });
    }

    // 点击引用块跳转到原消息
    const quoteEl = div.querySelector('.message-quote');
    if (quoteEl) {
      quoteEl.addEventListener('click', () => {
        const qId = quoteEl.dataset.quoteId;
        if (qId) {
          const target = document.querySelector(`[data-msg-id="${qId}"]`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.style.background = 'rgba(255,213,0,0.15)';
            setTimeout(() => target.style.background = '', 1500);
          }
        }
      });
    }

    container.appendChild(div);
    this.scrollToBottom();
  },

  // ③ 长按(移动端) + 右键(PC端)
  _bindBubbleEvents(bubble, msgEl) {
    // 移动端: 长按
    let timer = null;
    const touchStart = (e) => {
      timer = setTimeout(() => {
        this._showBubbleMenu(bubble, msgEl);
      }, 500);
    };
    const touchCancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
    };
    bubble.addEventListener('touchstart', touchStart, { passive: true });
    bubble.addEventListener('touchend', touchCancel);
    bubble.addEventListener('touchmove', touchCancel);

    // PC端: 右键
    bubble.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._showBubbleMenu(bubble, msgEl);
    });
  },

  _showBubbleMenu(bubble, msgEl) {
    this._selectedMsgEl = msgEl;
    const menu = document.getElementById('bubble-menu');
    if (!menu) return;

    const rect = bubble.getBoundingClientRect();
    const menuW = 210;
    let left = rect.left + rect.width / 2 - menuW / 2;
    let top = rect.top - 50;

    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    if (top < 60) top = rect.bottom + 6;

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.classList.add('visible');

    // ③ 至少停留2秒后才能被点击外部关闭
    this._bubbleMenuLock = true;
    setTimeout(() => { this._bubbleMenuLock = false; }, 2000);

    const dismiss = (e) => {
      if (menu.contains(e.target)) return;
      if (this._bubbleMenuLock) return;
      menu.classList.remove('visible');
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('touchstart', dismiss);
    };
    // 先移除旧的（防止叠加）
    document.removeEventListener('mousedown', this._bubbleDismiss);
    document.removeEventListener('touchstart', this._bubbleDismiss);
    this._bubbleDismiss = dismiss;
    setTimeout(() => {
      document.addEventListener('mousedown', dismiss);
      document.addEventListener('touchstart', dismiss);
    }, 50);
  },

  hideBubbleMenu() {
    const menu = document.getElementById('bubble-menu');
    if (menu) menu.classList.remove('visible');
    this._bubbleMenuLock = false;
    if (this._bubbleDismiss) {
      document.removeEventListener('mousedown', this._bubbleDismiss);
      document.removeEventListener('touchstart', this._bubbleDismiss);
    }
  },

  getSelectedMsgEl() {
    return this._selectedMsgEl;
  },

  showTyping(char) {
    const container = document.getElementById('chat-messages');
    let typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();

    typing = document.createElement('div');
    typing.className = 'message received';
    typing.id = 'typing-indicator';

    const avatarHtml = char?.avatar
      ? `<img src="${char.avatar}">`
      : `<div class="avatar-placeholder">${(char?.name || '?').charAt(0)}</div>`;

    typing.innerHTML = `
      <div class="message-avatar-wrapper">
        <div class="message-avatar">${avatarHtml}</div>
      </div>
      <div class="message-content">
        <div class="message-bubble">
          <div class="typing-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
    `;

    container.appendChild(typing);
    this.scrollToBottom();
  },

  hideTyping() {
    document.getElementById('typing-indicator')?.remove();
  },

  scrollToBottom() {
    const container = document.getElementById('chat-messages');
    setTimeout(() => container.scrollTop = container.scrollHeight, 50);
  },

  clearMessages() {
    document.getElementById('chat-messages').innerHTML = '';
  },

  applyBackground(url) {
    const body = document.getElementById('chatroom-body');
    if (url) {
      body.style.backgroundImage = `url(${url})`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
    } else {
      body.style.backgroundImage = '';
    }
  },

  applyCustomCSS(css) {
    document.getElementById('custom-chat-css').textContent = css || '';
  },

  // 引用预览
  showQuotePreview(sender, content) {
    const el = document.getElementById('quote-preview');
    if (!el) return;
    document.getElementById('quote-preview-sender').textContent = sender + '：';
    document.getElementById('quote-preview-text').textContent = content.substring(0, 40);
    el.classList.add('visible');
  },

  hideQuotePreview() {
    const el = document.getElementById('quote-preview');
    if (el) el.classList.remove('visible');
  },

  // @提及弹窗
  showMentionPopup(members) {
    const popup = document.getElementById('mention-popup');
    if (!popup || !members || members.length === 0) {
      this.hideMentionPopup();
      return;
    }
    let html = '';
    members.forEach(m => {
      const avatarHtml = m.avatar
        ? `<img src="${m.avatar}">`
        : `<div class="avatar-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold">${(m.name || '?').charAt(0)}</div>`;
      html += `
        <div class="mention-item" onclick="insertMention('${m.name.replace(/'/g, "\\'")}')">
          <div class="mention-item-avatar">${avatarHtml}</div>
          <span class="mention-item-name">${m.name}</span>
        </div>
      `;
    });
    popup.innerHTML = html;
    popup.classList.add('visible');
  },

  hideMentionPopup() {
    const popup = document.getElementById('mention-popup');
    if (popup) popup.classList.remove('visible');
  },

  // ② 主题色同步 — 读取所有可能的颜色来源
  applyThemeColor() {
    let color = null;
    let gradient = null;

    // 来源1: qqTheme (chat.js 设置的)
    try {
      const qqTheme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
      if (qqTheme.topbarColor) color = qqTheme.topbarColor;
      if (qqTheme.topbarColors && qqTheme.topbarColors.length > 0) {
        const dir = qqTheme.topbarGradientDir || '135deg';
        const colors = qqTheme.topbarColors;
        gradient = colors.length > 1 ? `linear-gradient(${dir}, ${colors.join(', ')})` : colors[0];
      }
      // bubble gradient
      if (qqTheme.bubbleColors && qqTheme.bubbleColors.length > 0) {
        const bDir = qqTheme.bubbleGradientDir || '135deg';
        const bColors = qqTheme.bubbleColors;
        const bGradient = bColors.length > 1 ? `linear-gradient(${bDir}, ${bColors.join(', ')})` : bColors[0];
        document.documentElement.style.setProperty('--bubble-sent-gradient', bGradient);
      }
    } catch (e) {}

    // 来源2: buttonColor 自定义覆盖
    const btnColor = localStorage.getItem('buttonColor');
    if (btnColor) { color = btnColor; gradient = btnColor; }

    // 来源3: currentTheme 主题名映射
    if (!color) {
      const theme = localStorage.getItem('currentTheme') || localStorage.getItem('theme') || 'blue';
      const map = {
        pink: '#f8cbd0', blue: '#a7c8f2', green: '#b8d6a2',
        yellow: '#f7d26d', purple: '#c3b0e6', black: '#333333'
      };
      color = map[theme] || '#a7c8f2';
    }

    if (!gradient) gradient = color;

    document.documentElement.style.setProperty('--theme-icon-color', color);
    document.documentElement.style.setProperty('--theme-gradient', gradient);
    // 同步顶栏颜色
    const topbar = document.querySelector('.chatroom-topbar');
    if (topbar) {
      topbar.style.background = gradient;
      topbar.style.color = '#fff';
    }
    // 同步发送按钮颜色
    const sendBtn = document.querySelector('.send-btn');
    if (sendBtn) {
      sendBtn.style.background = gradient;
    }
  },

  // 底部工具栏
  toggleToolbar() {
    const toolbar = document.getElementById('bottom-toolbar');
    if (!toolbar) return;
    this._toolbarOpen = !this._toolbarOpen;
    toolbar.classList.toggle('open', this._toolbarOpen);
  },

  // ③ 工具栏翻页：移动端滑动 + PC端左右区域点击
  initToolbarSwipe() {
    const pages = document.getElementById('toolbar-pages');
    if (!pages) return;
    const totalPages = pages.querySelectorAll('.toolbar-page').length;

    const goToPage = (page) => {
      this._toolbarPage = Math.max(0, Math.min(page, totalPages - 1));
      pages.style.transform = `translateX(-${this._toolbarPage * 100}%)`;
      document.querySelectorAll('.toolbar-dot').forEach((d, i) => {
        d.classList.toggle('active', i === this._toolbarPage);
      });
    };

    // 移动端：触摸滑动
    let startX = 0;
    pages.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    });
    pages.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) {
        goToPage(this._toolbarPage + (dx < 0 ? 1 : -1));
      }
    });

    // PC端：点击左半/右半区域翻页
    const dotsContainer = document.getElementById('toolbar-dots');
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.toolbar-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          goToPage(parseInt(dot.dataset.page) || 0);
        });
        dot.style.cursor = 'pointer';
      });
    }

    // 左右导航箭头区域（点击toolbar边缘60px区域翻页，避免影响按钮点击）
    pages.addEventListener('click', (e) => {
      // 只在PC端（非触摸事件）生效
      if ('ontouchstart' in window) return;
      // 如果点击的是工具栏按钮，不翻页
      if (e.target.closest('.toolbar-item')) return;
      // 用视口坐标判断左右，避免 translateX 导致 rect 偏移
      const x = e.clientX;
      const width = window.innerWidth;
      if (x < 60) {
        goToPage(this._toolbarPage - 1);
      } else if (x > width - 60) {
        goToPage(this._toolbarPage + 1);
      }
    });
  }
};

window.ChatUI = ChatUI;
