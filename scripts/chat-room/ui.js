/* scripts/chat-room/ui.js - UI渲染模块 */

const ChatUI = {
  showModal(id) {
    document.getElementById(id)?.classList.add('active');
  },

  hideModal(id) {
    document.getElementById(id)?.classList.remove('active');
  },

  updateTopbar(char) {
    document.getElementById('topbar-name').textContent = char.name || '未知';
    const statusEl = document.getElementById('topbar-status');
    const isOffline = char.settings?.offlineMode;
    statusEl.innerHTML = `<span class="status-dot ${isOffline ? 'offline' : 'online'}"></span><span>${isOffline ? '离线' : '在线'}</span>`;
  },

  addMessage({ content, type, sender, avatar, msgId }) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${type}`;
    if (msgId) div.dataset.msgId = msgId;

    const charFrame = type === 'received' ? (ChatCore.currentCharacter?.settings?.avatarFrame || '') : '';
    const userFrame = type === 'sent' ? (ChatCore.userSettings?.avatarFrame || '') : '';
    const frame = type === 'sent' ? userFrame : charFrame;

    const avatarHtml = avatar
      ? `<img src="${avatar}">`
      : `<div class="avatar-placeholder">${(sender || '?').charAt(0)}</div>`;

    div.innerHTML = `
      <div class="message-avatar-wrapper">
        <div class="message-avatar">${avatarHtml}</div>
        ${frame ? `<div class="msg-avatar-frame ${frame}"></div>` : ''}
      </div>
      <div class="message-content">
        <div class="message-bubble">${ChatUtils.parseMarkdown(content)}</div>
        <div class="message-time">${ChatUtils.formatTime(Date.now())}</div>
      </div>
    `;

    container.appendChild(div);
    this.scrollToBottom();
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
  }
};

window.ChatUI = ChatUI;
