/* scripts/chat-room/index.js - 入口文件 */

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof openChatDB !== 'function') {
    console.error('chat.js 未加载');
    return;
  }
  const ok = await ChatCore.init();
  if (ok) {
    ChatGroup.initGroupFeatures();
    ChatUI.applyThemeColor();
    ChatUI.initToolbarSwipe();
    renderShortcutBar();

    // 私聊时隐藏+按钮，群聊时显示
    const plusBtn = document.querySelector('.group-only-btn');
    if (plusBtn) {
      plusBtn.style.display = ChatCore.currentCharacter?.isGroup ? '' : 'none';
    }

    // 检查日记调度
    if (ChatCore.currentCharacter && !ChatCore.currentCharacter.isGroup) {
      ChatDiary.checkAndSchedule(ChatCore.currentCharacter.id);
    }

    // 主动发言检查
    if (ChatCore.currentCharacter && !ChatCore.currentCharacter.isGroup) {
      checkProactiveSpeaking();
    }

    // @提及监听
    const msgInput = document.getElementById('message-input');
    msgInput.addEventListener('input', () => {
      const char = ChatCore.currentCharacter;
      if (!char || !char.isGroup) return;

      const cursorPos = msgInput.selectionStart;
      const text = msgInput.value.substring(0, cursorPos);
      const lastAt = text.lastIndexOf('@');

      if (lastAt >= 0 && cursorPos - lastAt <= 12) {
        const query = text.substring(lastAt + 1).toLowerCase();
        const members = (char.members || []).filter(m =>
          m.name.toLowerCase().includes(query)
        );
        if (members.length > 0) {
          ChatUI.showMentionPopup(members);
          return;
        }
      }
      ChatUI.hideMentionPopup();
    });
  }
});

function toggleCollapse(header) {
  header.parentElement.classList.toggle('open');
}

function selectFrequency(el) {
  document.querySelectorAll('.frequency-option').forEach(opt => opt.classList.remove('selected'));
  el.classList.add('selected');
  const customRow = document.getElementById('custom-freq-row');
  if (customRow) customRow.style.display = el.dataset.value === 'custom' ? 'flex' : 'none';
}

function goBack() { ChatCore.goBack(); }
function sendMessage() { ChatCore.sendMessage(); }
function callAI() { ChatCore.callAI(); }
function openSettingsModal() { ChatSettings.openSettings(); }
function closeSettingsModal() { ChatSettings.closeSettings(); }
function openEditCharacter() { ChatSettings.openEditCharacter(); }
function openUserSettings() { ChatSettings.openUserSettings(); }
function openPromptOrderSettings() { ChatSettings.openPromptOrderSettings(); }
function openChatBackground() { ChatSettings.openChatBackground(); }
function openAvatarFrameSettings() { ChatSettings.openAvatarFrameSettings(); }
function openBubbleStyleSettings() { ChatSettings.openBubbleStyleSettings(); }
function openContextSettings() { ChatSettings.openContextSettings(); }
function summarizeContext() { ChatSummary.openSummarySettings(); }
function goOfflineMode() {
  ChatSettings.closeSettings();
  window.location.href = 'offline-mode.html?id=' + ChatCore.currentChatId;
}
function clearChatHistory() { ChatCore.clearHistory(); }
function deleteCharacter() { ChatSettings.deleteCharacter(); }
function closeEditModal() { ChatUI.hideModal('edit-modal'); }
function openMoreActions() { ChatUI.showModal('more-actions-modal'); }
function closeMoreActions() { ChatUI.hideModal('more-actions-modal'); }
function toggleToolbar() { ChatUI.toggleToolbar(); }

function regenerateReply() { closeMoreActions(); closeGroupPlus(); ChatCore.regenerateReply(); }
function continueGenerate() { closeMoreActions(); closeGroupPlus(); ChatCore.continueGenerate(); }
function sendImage() {
  closeMoreActions(); closeGroupPlus();
  const toolbar = document.getElementById('bottom-toolbar');
  if (toolbar) toolbar.classList.remove('open');
  ChatUI._toolbarOpen = false;
  document.getElementById('image-input').click();
}
function editLastMessage() { closeMoreActions(); ChatUtils.showToast('功能开发中'); }

// 群聊+面板
function handlePlusClick() {
  const char = ChatCore.currentCharacter;
  if (char && char.isGroup) {
    ChatUI.showModal('group-plus-modal');
  } else {
    openMoreActions();
  }
}
function closeGroupPlus() { ChatUI.hideModal('group-plus-modal'); }
function openGroupMemberPersona() { closeGroupPlus(); ChatGroup.openMemberPersona(); }
function openGroupPromptOrder() { closeGroupPlus(); ChatGroup.openPromptOrder(); }
function openRegexReplace() { closeGroupPlus(); ChatGroup.openRegexReplace(); }
function openGroupSummary() { closeGroupPlus(); ChatGroup.openGroupSummary(); }
function openGroupUserPersona() { closeGroupPlus(); ChatGroup.openGroupUserPersona(); }
// 收藏消息
function openFavorites() { closeGroupPlus(); ChatGroup.openFavorites(); }
function openFavoritesFromSettings() { closeSettingsModal(); ChatGroup.openFavorites(); }
function closeFavorites() { ChatUI.hideModal('favorites-modal'); }

// 查找聊天记录
function openSearchHistory() { closeGroupPlus(); ChatGroup.openSearchHistory(); }
function openSearchHistoryFromSettings() { closeSettingsModal(); ChatGroup.openSearchHistory(); }
function closeSearchHistory() { ChatUI.hideModal('search-history-modal'); }
let _searchDebounce = null;
function searchHistoryDebounce() {
  if (_searchDebounce) clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(() => ChatGroup.executeSearch(), 300);
}

// 气泡长按菜单
function bubbleRegenerate() {
  ChatUI.hideBubbleMenu();
  ChatCore.regenerateReply();
}
function bubbleContinue() {
  ChatUI.hideBubbleMenu();
  ChatCore.continueGenerate();
}
function bubbleEdit() {
  ChatUI.hideBubbleMenu();
  const el = ChatUI.getSelectedMsgEl();
  if (!el) return;
  const msgId = el.dataset.msgId;
  const bubble = el.querySelector('.message-bubble');
  if (!bubble) return;
  const oldText = bubble.textContent;
  const newText = prompt('编辑消息内容:', oldText);
  if (newText !== null && newText !== oldText) {
    bubble.innerHTML = ChatUtils.parseMarkdown(newText);
    // 更新DB
    ChatCore.updateMessageContent(msgId, newText);
  }
}
function bubbleDelete() {
  ChatUI.hideBubbleMenu();
  const el = ChatUI.getSelectedMsgEl();
  if (!el) return;
  if (!confirm('删除此消息？')) return;
  const msgId = el.dataset.msgId;
  el.remove();
  if (msgId) ChatCore.deleteMessage(msgId);
}
function bubbleFavorite() {
  ChatUI.hideBubbleMenu();
  const el = ChatUI.getSelectedMsgEl();
  if (!el) return;
  const msgId = el.dataset.msgId;
  const sender = el.dataset.sender || '未知';
  const bubble = el.querySelector('.message-bubble');
  const avatar = el.querySelector('.message-avatar img');
  const timeEl = el.querySelector('.message-time');

  const fav = {
    id: 'fav_' + Date.now(),
    msgId,
    sender,
    avatar: avatar ? avatar.src : null,
    content: bubble ? bubble.textContent : '',
    time: timeEl ? timeEl.textContent : '',
    timestamp: Date.now()
  };

  const char = ChatCore.currentCharacter;
  if (!char.favorites) char.favorites = [];
  // 避免重复收藏
  if (char.favorites.find(f => f.msgId === msgId)) {
    ChatUtils.showToast('已收藏过了');
    return;
  }
  char.favorites.push(fav);
  ChatCore.saveCharacter();
  ChatUtils.showToast('已收藏');
}

function showCharacterStatus() {
  const char = ChatCore.currentCharacter;
  if (!char) return;

  document.getElementById('status-avatar').innerHTML = char.avatar
    ? `<img src="${char.avatar}">`
    : `<div class="avatar-placeholder-big">${char.name.charAt(0)}</div>`;
  document.getElementById('status-name').textContent = char.name;
  document.getElementById('status-signature').textContent = char.signature || '这个人很懒，什么都没写~';

  document.getElementById('status-affection').textContent = char.affection || 50;
  document.getElementById('affection-fill').style.width = (char.affection || 50) + '%';

  const mood = char.mood || 70;
  document.getElementById('status-mood').textContent = mood;
  const moodFill = document.getElementById('mood-fill');
  moodFill.style.width = mood + '%';
  moodFill.className = 'mood-fill ' + (mood > 70 ? 'happy' : mood > 40 ? 'neutral' : 'sad');

  document.getElementById('status-outfit').textContent = char.outfit || '日常';
  document.getElementById('status-location').textContent = char.location || '未知';
  document.getElementById('status-thought').textContent = char.thought || '（未知）';

  const wave = char.friendshipWave || { consecutiveDays: 0, level: 0 };
  const levels = ['初识', '相识', '熟悉', '好友', '挚友', '知己', '灵魂伴侣'];
  const icons = ['🌊', '💧', '🌈', '⭐', '💎', '👑', '💖'];
  document.getElementById('wave-icon').textContent = icons[wave.level] || '🌊';
  document.getElementById('wave-level').textContent = levels[wave.level] || '初识';
  document.getElementById('wave-days').textContent = `连续聊天 ${wave.consecutiveDays} 天`;

  ChatUI.showModal('character-status-modal');
}

function handleTopbarClick() {
  const char = ChatCore.currentCharacter;
  if (!char) return;
  if (char.isGroup) {
    openSettingsModal();
  } else {
    showCharacterStatus();
  }
}

function closeCharacterStatus() {
  ChatUI.hideModal('character-status-modal');
}

function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    ChatCore.currentCharacter.avatar = e.target.result;
    ChatCore.saveCharacter();
    ChatSettings.openEditCharacter();
  };
  reader.readAsDataURL(file);
}

function handleUserAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    ChatCore.userSettings.avatar = e.target.result;
    ChatCore.saveUserSettings();
    ChatSettings.openUserSettings();
  };
  reader.readAsDataURL(file);
}

function setChatBackground(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    ChatCore.currentCharacter.settings.chatBackground = e.target.result;
    ChatCore.saveCharacter();
    ChatUI.applyBackground(e.target.result);
    ChatUI.hideModal('edit-modal');
  };
  reader.readAsDataURL(file);
}

function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    // 压缩图片
    const compressed = await compressImage(e.target.result, 800, 0.7);
    const content = `[img:${compressed}]`;
    const msgId = ChatUtils.generateMsgId();
    const user = ChatCore.userSettings;
    const ts = Date.now();
    ChatUI.addMessage({ content, type: 'sent', sender: user.name || '我', avatar: user.avatar, msgId, timestamp: ts });
    await ChatCore.saveMessage({
      id: msgId, chatId: ChatCore.currentChatId, content, type: 'sent',
      sender: user.name || '我', avatar: user.avatar, timestamp: ts
    });
    ChatUI.scrollToBottom();
    // 不自动调用AI，用户点箭头才调用
  };
  reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxSize, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function viewImage(src) {
  window.open(src, '_blank');
}

// 引用消息
function bubbleQuote() {
  ChatUI.hideBubbleMenu();
  const el = ChatUI.getSelectedMsgEl();
  if (!el) return;
  const msgId = el.dataset.msgId;
  const sender = el.dataset.sender || '未知';
  const bubble = el.querySelector('.message-bubble');
  const content = bubble ? bubble.textContent : '';

  ChatCore._quoteData = {
    quoteId: msgId,
    quoteSender: sender,
    quoteContent: content
  };

  ChatUI.showQuotePreview(sender, content);
  document.getElementById('message-input').focus();
}

function cancelQuote() {
  ChatCore._quoteData = null;
  ChatUI.hideQuotePreview();
}

// @提及插入
function insertMention(name) {
  const input = document.getElementById('message-input');
  const cursorPos = input.selectionStart;
  const text = input.value;
  const lastAt = text.lastIndexOf('@', cursorPos - 1);
  if (lastAt >= 0) {
    input.value = text.substring(0, lastAt) + '@' + name + ' ' + text.substring(cursorPos);
    const newPos = lastAt + name.length + 2;
    input.selectionStart = input.selectionEnd = newPos;
  }
  ChatUI.hideMentionPopup();
  input.focus();
}

// ===== 转账功能 =====
function openTransferModal() {
  const toolbar = document.getElementById('bottom-toolbar');
  if (toolbar) { toolbar.classList.remove('open'); ChatUI._toolbarOpen = false; }
  const char = ChatCore.currentCharacter;
  const section = document.getElementById('transfer-target-section');
  if (char && char.isGroup) {
    section.style.display = 'block';
    const sel = document.getElementById('transfer-target');
    sel.innerHTML = (char.members || []).map(m => `<option value="${m.name}">${m.name}</option>`).join('');
  } else {
    section.style.display = 'none';
  }
  document.getElementById('transfer-amount').value = '';
  document.getElementById('transfer-note').value = '';
  ChatUI.showModal('transfer-modal');
}
function closeTransferModal() { ChatUI.hideModal('transfer-modal'); }

async function confirmTransfer() {
  const amount = parseFloat(document.getElementById('transfer-amount').value);
  if (!amount || amount <= 0) { ChatUtils.showToast('请输入金额'); return; }
  const note = document.getElementById('transfer-note').value.trim() || '转账';
  const user = ChatCore.userSettings;
  const sender = user.name || '我';

  closeTransferModal();

  const content = `[transfer:${amount.toFixed(2)}:${note}:pending:${sender}]`;
  const msgId = ChatUtils.generateMsgId();
  const ts = Date.now();

  ChatUI.addMessage({ content, type: 'sent', sender, avatar: user.avatar, msgId, timestamp: ts });
  await ChatCore.saveMessage({
    id: msgId, chatId: ChatCore.currentChatId, content, type: 'sent',
    sender, avatar: user.avatar, timestamp: ts
  });
  // 不自动调用AI，用户点箭头才调用，AI会检测到pending转账并决定是否接收
}

function handleTransferClick(el) {
  if (el.dataset.status === 'accepted') {
    ChatUtils.showToast('已收款');
    return;
  }

  // 检查是否是AI发来的转账（received类型），用户点击可领取
  const msgEl = el.closest('[data-msg-id]');

  if (el.dataset.status === 'pending' && msgEl) {
    // data-msg-id 所在的 div 就是 .message.received / .message.sent
    const messageWrapper = msgEl.classList.contains('message') ? msgEl : msgEl.closest('.message');
    if (messageWrapper && messageWrapper.classList.contains('received')) {
      // 用户领取AI发的转账
      const amount = el.dataset.amount;
      const msgId = msgEl.dataset.msgId;

      // 更新DB
      openChatDB().then(db => {
        const tx = db.transaction(MSG_STORE, 'readwrite');
        const store = tx.objectStore(MSG_STORE);
        const req = store.get(msgId);
        req.onsuccess = () => {
          const msg = req.result;
          if (msg) {
            msg.content = msg.content.replace(':pending:', ':accepted:');
            store.put(msg);
          }
        };
      });

      // 更新DOM
      el.dataset.status = 'accepted';
      const bottom = el.querySelector('.transfer-card-bottom');
      if (bottom) bottom.textContent = '已收款';

      // 系统消息
      const sysId = ChatUtils.generateMsgId();
      const sysText = `你已收款 ¥${amount}`;
      ChatUI.addMessage({ content: sysText, type: 'system', msgId: sysId });
      ChatCore.saveMessage({ id: sysId, chatId: ChatCore.currentChatId, content: sysText, type: 'system', sender: '系统', timestamp: Date.now() });
      ChatUtils.showToast('已收款');
      return;
    }
  }

  ChatUtils.showToast('等待对方接收，点击➤调用AI');
}

// ===== 红包功能 =====
let _currentRPType = 'lucky';
let _currentRPElement = null;

function openRedPacketModal() {
  const toolbar = document.getElementById('bottom-toolbar');
  if (toolbar) { toolbar.classList.remove('open'); ChatUI._toolbarOpen = false; }
  _currentRPType = 'lucky';
  document.querySelectorAll('.rp-tab').forEach(t => t.classList.toggle('active', t.dataset.type === 'lucky'));
  document.getElementById('rp-amount').value = '';
  document.getElementById('rp-count').value = '1';
  document.getElementById('rp-voice-text').value = '';
  switchRPTab('lucky');

  const char = ChatCore.currentCharacter;
  if (char && char.isGroup) {
    const count = (char.members || []).length;
    document.getElementById('rp-count').value = Math.min(count, 5);
    // 填充专属红包下拉
    const sel = document.getElementById('rp-exclusive-target');
    sel.innerHTML = (char.members || []).map(m => `<option value="${m.name}">${m.name}</option>`).join('');
  }
  ChatUI.showModal('redpacket-modal');
}
function closeRedPacketModal() { ChatUI.hideModal('redpacket-modal'); }

function switchRPTab(type) {
  _currentRPType = type;
  document.querySelectorAll('.rp-tab').forEach(t => t.classList.toggle('active', t.dataset.type === type));
  document.getElementById('rp-count-group').style.display = type === 'lucky' ? 'block' : 'none';
  document.getElementById('rp-voice-group').style.display = type === 'voice' ? 'block' : 'none';
  document.getElementById('rp-exclusive-group').style.display = type === 'exclusive' ? 'block' : 'none';
}

function splitRedPacket(total, count) {
  const amounts = [];
  let remaining = Math.round(total * 100);
  for (let i = 0; i < count - 1; i++) {
    const max = Math.floor((remaining / (count - i)) * 2);
    let amt = Math.max(1, Math.floor(Math.random() * max));
    amt = Math.min(amt, remaining - (count - i - 1));
    amounts.push(amt / 100);
    remaining -= amt;
  }
  amounts.push(remaining / 100);
  return amounts;
}

async function confirmRedPacket() {
  const amount = parseFloat(document.getElementById('rp-amount').value);
  if (!amount || amount <= 0) { ChatUtils.showToast('请输入金额'); return; }
  const char = ChatCore.currentCharacter;
  const user = ChatCore.userSettings;
  const sender = user.name || '我';
  const rpId = 'rp_' + Date.now();

  let count = 1, extra = '';
  if (_currentRPType === 'lucky') {
    count = parseInt(document.getElementById('rp-count').value) || 1;
    if (!char?.isGroup) count = 1;
  } else if (_currentRPType === 'voice') {
    extra = document.getElementById('rp-voice-text').value.trim();
    if (!extra) { ChatUtils.showToast('请输入语音口令'); return; }
    count = char?.isGroup ? Math.min((char.members || []).length, 5) : 1;
  } else if (_currentRPType === 'exclusive') {
    extra = document.getElementById('rp-exclusive-target').value;
    if (!extra) { ChatUtils.showToast('请选择成员'); return; }
    count = 1;
  }

  closeRedPacketModal();

  const content = `[redpacket:${_currentRPType}:${amount.toFixed(2)}:${count}:${extra}:${sender}:${rpId}:[]]`;
  const msgId = ChatUtils.generateMsgId();
  const ts = Date.now();

  ChatUI.addMessage({ content, type: 'sent', sender, avatar: user.avatar, msgId, timestamp: ts });
  await ChatCore.saveMessage({
    id: msgId, chatId: ChatCore.currentChatId, content, type: 'sent',
    sender, avatar: user.avatar, timestamp: ts
  });
  // 不自动调用AI，用户点箭头才调用，AI会检测到pending红包并决定是否抢
}

async function updateRedPacketMessage(msgId, type, amount, count, extra, sender, rpId, claimed) {
  const claimedJson = JSON.stringify(claimed);
  const newContent = `[redpacket:${type}:${amount.toFixed(2)}:${count}:${extra}:${sender}:${rpId}:${claimedJson}]`;

  await ChatCore.updateMessageContent(msgId, newContent);
  // 更新UI
  const el = document.querySelector(`[data-msg-id="${msgId}"] .message-bubble`);
  if (el) el.innerHTML = ChatUtils.parseMarkdown(newContent);
}

function handleRedPacketClick(el) {
  let claimed = [];
  try { claimed = JSON.parse(el.dataset.claimed); } catch(e) {}
  const count = parseInt(el.dataset.count);
  const sender = el.dataset.sender;
  const type = el.dataset.type;
  const extra = el.dataset.extra;

  _currentRPElement = el;

  document.getElementById('rp-open-sender').textContent = sender + '的红包';
  const typeTexts = { lucky: '恭喜发财，大吉大利', voice: `口令：${extra}`, exclusive: `专属红包` };
  document.getElementById('rp-open-text').textContent = typeTexts[type] || '恭喜发财';

  const allClaimed = claimed.length >= count;
  document.getElementById('rp-open-btn-wrap').style.display = allClaimed ? 'none' : 'flex';

  let listHtml = '';
  if (claimed.length > 0) {
    listHtml = claimed.map(c => `<div class="rp-claimed-item"><span class="rp-claimed-name">${ChatUtils.escapeHtml(c.name)}</span><span class="rp-claimed-amount">¥${c.amount.toFixed(2)}</span></div>`).join('');
  } else {
    listHtml = '<div class="empty-hint">还没有人领取</div>';
  }
  document.getElementById('rp-claimed-list').innerHTML = listHtml;
  ChatUI.showModal('redpacket-open-modal');
}

function closeRedPacketOpen() { ChatUI.hideModal('redpacket-open-modal'); }

async function claimRedPacket() {
  if (!_currentRPElement) {
    ChatUtils.showToast('红包数据异常');
    closeRedPacketOpen();
    return;
  }

  const el = _currentRPElement;
  let claimed = [];
  try { claimed = JSON.parse(el.dataset.claimed); } catch(e) {}
  const count = parseInt(el.dataset.count);
  const totalAmount = parseFloat(el.dataset.amount);
  const sender = el.dataset.sender;
  const type = el.dataset.type;
  const extra = el.dataset.extra || '';
  const rpId = el.dataset.rpid;

  // 检查是否已领完
  if (claimed.length >= count) {
    ChatUtils.showToast('红包已领完');
    closeRedPacketOpen();
    return;
  }

  // 检查用户是否已领取过
  const userName = ChatCore.userSettings?.name || '我';
  if (claimed.find(c => c.name === userName)) {
    ChatUtils.showToast('你已领取过了');
    closeRedPacketOpen();
    return;
  }

  // 计算领取金额（拼手气算法）
  const alreadyClaimed = claimed.reduce((s, c) => s + c.amount, 0);
  const remaining = Math.round((totalAmount - alreadyClaimed) * 100) / 100;
  const remainCount = count - claimed.length;
  let gotAmount;
  if (remainCount === 1) {
    gotAmount = Math.round(remaining * 100) / 100;
  } else {
    const max = (remaining / remainCount) * 2;
    gotAmount = Math.max(0.01, Math.round(Math.random() * max * 100) / 100);
    gotAmount = Math.min(gotAmount, Math.round((remaining - (remainCount - 1) * 0.01) * 100) / 100);
  }

  // 更新 claimed
  claimed.push({ name: userName, amount: gotAmount });
  el.dataset.claimed = JSON.stringify(claimed);

  // 找到消息ID并更新DB
  const msgEl = el.closest('[data-msg-id]');
  const msgId = msgEl?.dataset.msgId;
  if (msgId && typeof updateRedPacketMessage === 'function') {
    await updateRedPacketMessage(msgId, type, totalAmount, count, extra, sender, rpId, claimed);
  }

  // 系统消息
  const sysId = ChatUtils.generateMsgId();
  const sysText = `你领取了${sender}的红包，获得 ¥${gotAmount.toFixed(2)}`;
  ChatUI.addMessage({ content: sysText, type: 'system', msgId: sysId });
  await ChatCore.saveMessage({ id: sysId, chatId: ChatCore.currentChatId, content: sysText, type: 'system', sender: '系统', timestamp: Date.now() });

  ChatUtils.showToast(`领取了 ¥${gotAmount.toFixed(2)}`);
  closeRedPacketOpen();
}

// ===== 表情贴纸功能 =====
let _stickerManageMode = false;

function getStickers() {
  try { return JSON.parse(localStorage.getItem('customStickers') || '[]'); }
  catch(e) { return []; }
}
function saveStickers(stickers) {
  localStorage.setItem('customStickers', JSON.stringify(stickers));
}

function openStickerPanel() {
  const toolbar = document.getElementById('bottom-toolbar');
  if (toolbar) { toolbar.classList.remove('open'); ChatUI._toolbarOpen = false; }
  _stickerManageMode = false;
  renderStickerGrid();
  document.getElementById('sticker-panel').classList.add('open');
}

function closeStickerPanel() {
  document.getElementById('sticker-panel').classList.remove('open');
  _stickerManageMode = false;
}

function renderStickerGrid() {
  const grid = document.getElementById('sticker-grid');
  const stickers = getStickers();
  if (stickers.length === 0) {
    grid.innerHTML = '<div class="empty-hint" style="grid-column:span 4">还没有表情，点击下方添加</div>';
    return;
  }
  grid.innerHTML = stickers.map(s => `
    <div class="sticker-grid-item${_stickerManageMode ? ' manage-mode' : ''}" data-id="${s.id}" onclick="sendSticker('${s.id}')">
      <img src="${s.image}" alt="${ChatUtils.escapeHtml(s.name)}">
      <button class="sticker-delete-btn" onclick="event.stopPropagation();deleteSticker('${s.id}')">✕</button>
    </div>
  `).join('');
}

function addSticker() {
  document.getElementById('sticker-input').click();
}

async function handleStickerUpload(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const reader = new FileReader();
  reader.onload = async (e) => {
    const compressed = await compressImage(e.target.result, 120, 0.8);
    const name = prompt('给表情起个名字:', '') || '表情';
    const stickers = getStickers();
    stickers.push({ id: 'stk_' + Date.now(), name, image: compressed, addedAt: Date.now() });
    saveStickers(stickers);
    renderStickerGrid();
    ChatUtils.showToast('表情已添加');
  };
  reader.readAsDataURL(file);
}

async function sendSticker(id) {
  if (_stickerManageMode) return;
  const stickers = getStickers();
  const sticker = stickers.find(s => s.id === id);
  if (!sticker) return;

  closeStickerPanel();
  const content = `[sticker:${sticker.id}:${sticker.image}]`;
  const msgId = ChatUtils.generateMsgId();
  const user = ChatCore.userSettings;
  const ts = Date.now();

  ChatUI.addMessage({ content, type: 'sent', sender: user.name || '我', avatar: user.avatar, msgId, timestamp: ts });
  await ChatCore.saveMessage({
    id: msgId, chatId: ChatCore.currentChatId, content, type: 'sent',
    sender: user.name || '我', avatar: user.avatar, timestamp: ts
  });
}

function deleteSticker(id) {
  const stickers = getStickers().filter(s => s.id !== id);
  saveStickers(stickers);
  renderStickerGrid();
  ChatUtils.showToast('已删除');
}

function toggleStickerManage() {
  _stickerManageMode = !_stickerManageMode;
  renderStickerGrid();
}

// ===== 快捷键功能 =====
function getShortcuts() {
  try { return JSON.parse(localStorage.getItem('chatShortcuts') || '[]'); }
  catch(e) { return []; }
}
function saveShortcuts(list) {
  localStorage.setItem('chatShortcuts', JSON.stringify(list));
}
function renderShortcutBar() {
  const bar = document.getElementById('shortcut-bar');
  const list = getShortcuts();
  if (list.length === 0) {
    bar.classList.remove('visible');
    return;
  }
  bar.classList.add('visible');
  bar.innerHTML = list.map(s =>
    `<span class="shortcut-tag" onclick="fillShortcut('${s.replace(/'/g, "\\'")}')">${ChatUtils.escapeHtml(s)}</span>`
  ).join('');
}
function fillShortcut(text) {
  const input = document.getElementById('message-input');
  input.value += text;
  input.focus();
  input.dispatchEvent(new Event('input'));
}
function openShortcutSettings() {
  const toolbar = document.getElementById('bottom-toolbar');
  if (toolbar) { toolbar.classList.remove('open'); ChatUI._toolbarOpen = false; }
  renderShortcutList();
  ChatUI.showModal('shortcut-modal');
}
function closeShortcutSettings() {
  ChatUI.hideModal('shortcut-modal');
}
function renderShortcutList() {
  const container = document.getElementById('shortcut-list');
  const list = getShortcuts();
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-hint">还没有快捷键，在上方添加</div>';
    return;
  }
  container.innerHTML = list.map((s, i) =>
    `<div class="shortcut-item">
      <span>${ChatUtils.escapeHtml(s)}</span>
      <button class="shortcut-del-btn" onclick="deleteShortcut(${i})">✕</button>
    </div>`
  ).join('');
}
function addShortcut() {
  const input = document.getElementById('shortcut-input');
  const val = input.value.trim();
  if (!val) { ChatUtils.showToast('请输入快捷内容'); return; }
  const list = getShortcuts();
  if (list.includes(val)) { ChatUtils.showToast('已存在'); return; }
  list.push(val);
  saveShortcuts(list);
  input.value = '';
  renderShortcutList();
  renderShortcutBar();
  ChatUtils.showToast('已添加');
}
function deleteShortcut(idx) {
  const list = getShortcuts();
  list.splice(idx, 1);
  saveShortcuts(list);
  renderShortcutList();
  renderShortcutBar();
}

// ===== 语音模式功能 =====
let _voiceModeOn = false;

function toggleVoiceMode() {
  const toolbar = document.getElementById('bottom-toolbar');
  if (toolbar) { toolbar.classList.remove('open'); ChatUI._toolbarOpen = false; }
  _voiceModeOn = !_voiceModeOn;
  const indicator = document.getElementById('voice-mode-indicator');
  indicator.classList.toggle('visible', _voiceModeOn);
  ChatUtils.showToast(_voiceModeOn ? '语音模式已开启' : '语音模式已关闭');
}

// Override sendMessage to support voice mode
const _origSendMessage = ChatCore.sendMessage.bind(ChatCore);
ChatCore.sendMessage = async function() {
  if (_voiceModeOn) {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    input.value = '';
    input.style.height = 'auto';
    ChatUI.hideMentionPopup();

    const voiceContent = `[voice:${content}]`;
    const msgId = ChatUtils.generateMsgId();
    const user = this.userSettings;
    const ts = Date.now();

    const quoteData = this._quoteData;
    this._quoteData = null;
    ChatUI.hideQuotePreview();

    ChatUI.addMessage({
      content: voiceContent,
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
      content: voiceContent,
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
  } else {
    await _origSendMessage();
  }
};

// ===== 语音通话功能 =====
let _voiceCallActive = false;
let _voiceCallTimer = null;
let _voiceCallSeconds = 0;
let _voiceCallMembers = [];
let _voiceCallMessages = [];

function startVoiceCall() {
  const toolbar = document.getElementById('bottom-toolbar');
  if (toolbar) { toolbar.classList.remove('open'); ChatUI._toolbarOpen = false; }

  const char = ChatCore.currentCharacter;
  if (!char) return;

  if (char.isGroup) {
    // 群聊需要选择成员
    showVoiceCallSelect(char);
  } else {
    // 私聊直接进入
    _voiceCallMembers = [{ name: char.name, avatar: char.avatar }];
    enterVoiceCall();
  }
}

function showVoiceCallSelect(char) {
  const body = document.getElementById('voicecall-select-body');
  const members = char.members || [];
  body.innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:#888;">选择要参加语音通话的成员</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${members.map(m => `
        <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8f8f8;border-radius:10px;cursor:pointer;">
          <input type="checkbox" value="${ChatUtils.escapeHtml(m.name)}" class="vc-member-check" checked>
          <div style="width:32px;height:32px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#667eea,#764ba2);flex-shrink:0;">
            ${m.avatar ? `<img src="${m.avatar}" style="width:100%;height:100%;object-fit:cover;">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;">${m.name.charAt(0)}</div>`}
          </div>
          <span style="font-size:15px;">${ChatUtils.escapeHtml(m.name)}</span>
        </label>
      `).join('')}
    </div>
    <button style="width:100%;padding:12px;background:var(--primary-color);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;margin-top:16px;cursor:pointer;" onclick="confirmVoiceCallMembers()">开始通话</button>
  `;
  ChatUI.showModal('voicecall-select-modal');
}

function closeVoiceCallSelect() {
  ChatUI.hideModal('voicecall-select-modal');
}

function confirmVoiceCallMembers() {
  const checks = document.querySelectorAll('.vc-member-check:checked');
  if (checks.length === 0) { ChatUtils.showToast('至少选择一位成员'); return; }

  const char = ChatCore.currentCharacter;
  const members = char.members || [];
  _voiceCallMembers = [];
  checks.forEach(chk => {
    const m = members.find(mm => mm.name === chk.value);
    if (m) _voiceCallMembers.push({ name: m.name, avatar: m.avatar });
  });

  closeVoiceCallSelect();
  enterVoiceCall();
}

function enterVoiceCall() {
  _voiceCallActive = true;
  _voiceCallSeconds = 0;
  _voiceCallMessages = [];

  // 渲染成员头像
  const membersEl = document.getElementById('voicecall-members');
  membersEl.innerHTML = _voiceCallMembers.map(m => `
    <div class="voicecall-member">
      <div class="voicecall-member-avatar">
        ${m.avatar ? `<img src="${m.avatar}">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:18px;">${m.name.charAt(0)}</div>`}
      </div>
      <div class="voicecall-member-name">${ChatUtils.escapeHtml(m.name)}</div>
    </div>
  `).join('');

  // 清空消息区
  document.getElementById('voicecall-messages').innerHTML = '';
  document.getElementById('voicecall-input').value = '';

  // 计时器
  updateVoiceCallTimer();
  _voiceCallTimer = setInterval(() => {
    _voiceCallSeconds++;
    updateVoiceCallTimer();
  }, 1000);

  // 绑定回车发送
  const vcInput = document.getElementById('voicecall-input');
  vcInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendVoiceCallMsg();
    }
  };

  document.getElementById('voicecall-overlay').classList.add('active');
}

function updateVoiceCallTimer() {
  const m = Math.floor(_voiceCallSeconds / 60).toString().padStart(2, '0');
  const s = (_voiceCallSeconds % 60).toString().padStart(2, '0');
  document.getElementById('voicecall-timer').textContent = `${m}:${s}`;
}

async function sendVoiceCallMsg() {
  const input = document.getElementById('voicecall-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  const user = ChatCore.userSettings;
  const senderName = user.name || '我';

  // 用户消息（显示为语音格式）
  _voiceCallMessages.push({ sender: senderName, content: text, type: 'sent' });
  appendVoiceCallBubble(senderName, text, 'sent', user.avatar);

  // AI回复
  try {
    const char = ChatCore.currentCharacter;
    const apiConfig = ChatCore.getAPIConfig();
    if (!apiConfig.apiKey) {
      appendVoiceCallBubble('系统', '请先配置API密钥', 'received', null);
      return;
    }

    const messages = buildVoiceCallAIMessages(text);
    const reply = await ChatAI.callAPI(messages, apiConfig);
    const parsed = ChatAI.parseResponse(reply, char.isGroup);

    if (char.isGroup && parsed.messages) {
      for (const msg of parsed.messages) {
        const name = msg.sender || _voiceCallMembers[0]?.name || '成员';
        const member = _voiceCallMembers.find(m => m.name === name);
        _voiceCallMessages.push({ sender: name, content: msg.content, type: 'received' });
        appendVoiceCallBubble(name, msg.content, 'received', member?.avatar);
      }
    } else if (parsed.floors) {
      for (const floor of parsed.floors) {
        if (!floor) continue;
        const name = char.name;
        _voiceCallMessages.push({ sender: name, content: floor, type: 'received' });
        appendVoiceCallBubble(name, floor, 'received', char.avatar);
      }
    }
  } catch (e) {
    appendVoiceCallBubble('系统', '回复失败: ' + e.message, 'received', null);
  }
}

function buildVoiceCallAIMessages(userMessage) {
  const char = ChatCore.currentCharacter;
  const user = ChatCore.userSettings;
  const messages = [];

  let system = '你正在与用户进行语音通话，回复应该口语化、简短自然。\n';
  if (char.isGroup) {
    system += `参与通话的成员：${_voiceCallMembers.map(m => m.name).join('、')}\n`;
    _voiceCallMembers.forEach(m => {
      const memberData = (char.members || []).find(mm => mm.name === m.name);
      if (memberData?.persona) system += `${m.name}: ${memberData.persona}\n`;
    });
    system += `\n回复格式：用<msg name="成员名">内容</msg>表示。每条10-30字，口语化。\n`;
  } else {
    system += `你是${char.name}。`;
    if (char.description) system += `\n描述: ${char.description}`;
    if (char.personality) system += `\n性格: ${char.personality}`;
    system += `\n\n回复格式：用<msg>内容</msg>表示。每条10-30字，口语化。\n`;
  }

  messages.push({ role: 'system', content: system });

  // 添加通话上下文
  for (const msg of _voiceCallMessages.slice(-10)) {
    if (msg.type === 'sent') {
      messages.push({ role: 'user', content: msg.content });
    } else {
      const prefix = char.isGroup ? `[${msg.sender}] ` : '';
      messages.push({ role: 'assistant', content: prefix + msg.content });
    }
  }
  messages.push({ role: 'user', content: userMessage });

  return messages;
}

function appendVoiceCallBubble(sender, text, type, avatar) {
  const container = document.getElementById('voicecall-messages');
  const isVoice = text.startsWith('[voice:') && text.endsWith(']');
  const displayText = isVoice ? text.slice(7, -1) : text;

  // 为语音格式生成波形
  const duration = Math.max(2, Math.min(10, Math.ceil(displayText.length / 5)));
  const barCount = Math.max(8, Math.min(16, duration * 2));
  let bars = '';
  for (let i = 0; i < barCount; i++) {
    const h = 3 + Math.floor(Math.random() * 10);
    bars += `<span style="display:inline-block;width:2px;height:${h}px;background:currentColor;border-radius:1px;opacity:0.6;"></span>`;
  }

  const avatarHtml = avatar
    ? `<img src="${avatar}">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:12px;">${sender.charAt(0)}</div>`;

  const div = document.createElement('div');
  div.className = `voicecall-msg ${type}`;
  div.innerHTML = `
    <div class="voicecall-msg-avatar">${avatarHtml}</div>
    <div>
      ${type === 'received' ? `<div class="voicecall-msg-sender">${ChatUtils.escapeHtml(sender)}</div>` : ''}
      <div class="voicecall-msg-bubble" onclick="this.querySelector('.vc-expand')?.classList.toggle('show')" style="cursor:pointer;">
        <div style="display:flex;align-items:center;gap:4px;">
          <span style="font-size:14px;">🔊</span>
          <span style="display:flex;align-items:center;gap:1px;">${bars}</span>
          <span style="font-size:11px;opacity:0.7;">${duration}″</span>
        </div>
        <div class="vc-expand" style="display:none;padding-top:6px;margin-top:6px;border-top:1px solid rgba(128,128,128,0.2);font-size:12px;opacity:0.85;">${ChatUtils.escapeHtml(displayText)}</div>
      </div>
    </div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // 为展开功能添加样式切换
  const expandEl = div.querySelector('.vc-expand');
  const bubble = div.querySelector('.voicecall-msg-bubble');
  if (bubble && expandEl) {
    bubble.onclick = () => {
      expandEl.style.display = expandEl.style.display === 'none' ? 'block' : 'none';
    };
  }
}

async function endVoiceCall() {
  if (!_voiceCallActive) return;
  _voiceCallActive = false;

  if (_voiceCallTimer) {
    clearInterval(_voiceCallTimer);
    _voiceCallTimer = null;
  }

  document.getElementById('voicecall-overlay').classList.remove('active');

  // 如果有消息记录，生成总结
  if (_voiceCallMessages.length > 0) {
    const char = ChatCore.currentCharacter;
    const memberNames = _voiceCallMembers.map(m => m.name).join('、');
    const duration = formatCallDuration(_voiceCallSeconds);

    // 尝试用AI总结
    let summaryText = '';
    try {
      const apiConfig = ChatCore.getAPIConfig();
      if (apiConfig.apiKey) {
        const transcript = _voiceCallMessages.map(m => `${m.sender}: ${m.content}`).join('\n');
        const summaryMessages = [
          { role: 'system', content: '请用一段简短的话（50-100字）总结以下语音通话内容，不要加标签：' },
          { role: 'user', content: transcript }
        ];
        summaryText = await ChatAI.callAPI(summaryMessages, apiConfig);
        // 清理可能的标签
        summaryText = summaryText.replace(/<[^>]+>/g, '').trim();
      }
    } catch(e) {
      console.error('总结语音通话失败:', e);
    }

    if (!summaryText) {
      summaryText = `与${memberNames}进行了${duration}的语音通话，共${_voiceCallMessages.length}条消息。`;
    }

    const fullSummary = `📞 语音通话 (${duration})\n参与：${memberNames}\n${summaryText}`;

    // 添加到主对话区（系统消息格式）
    const msgId = ChatUtils.generateMsgId();
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'message system';
    div.dataset.msgId = msgId;
    div.innerHTML = `<div class="voicecall-summary">${ChatUtils.escapeHtml(fullSummary)}</div>`;
    container.appendChild(div);
    ChatUI.scrollToBottom();

    // 保存到数据库
    await ChatCore.saveMessage({
      id: msgId,
      chatId: ChatCore.currentChatId,
      content: `[voicecall-summary:${fullSummary}]`,
      type: 'system',
      sender: '系统',
      timestamp: Date.now()
    });
  }

  _voiceCallMessages = [];
  _voiceCallMembers = [];
  ChatUtils.showToast('语音通话已结束');
}

function formatCallDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}秒`;
  return `${m}分${s}秒`;
}

// ========== 主动发言 ==========
async function checkProactiveSpeaking() {
  const char = ChatCore.currentCharacter;
  if (!char || !char.proactiveSettings?.enabled) return;

  const interval = (char.proactiveSettings.intervalHours || 4) * 3600 * 1000;
  const lastProactive = char._lastProactiveTime || 0;
  const now = Date.now();

  if (now - lastProactive < interval) return;

  // 更新时间戳（先写入防止重复触发）
  char._lastProactiveTime = now;
  ChatCore.saveCharacter();

  // 延迟一小段时间，让页面完全加载
  setTimeout(async () => {
    try {
      const apiConfig = ChatCore.getAPIConfig();
      if (!apiConfig.apiKey) return;

      const contextMsgs = await ChatCore.getContextMessages();
      const messages = ChatAI.buildMessages({
        character: char,
        userSettings: ChatCore.userSettings,
        contextMsgs,
        summary: char.summaryContent?.text || '',
        userMessage: '[系统提示：用户已有一段时间没说话了，请根据你的性格主动找用户聊天，可以分享日常、提问、撒娇、吐槽等，自然一些]'
      });

      ChatUI.showTyping(char);
      const reply = await ChatAI.callAPI(messages, apiConfig);
      ChatUI.hideTyping();

      const parsed = ChatAI.parseResponse(reply);

      if (parsed.status) {
        const s = parsed.status;
        if (s.affection !== undefined)
          char.affection = Math.max(0, Math.min(100, (char.affection || 50) + s.affection));
        if (s.mood !== undefined)
          char.mood = Math.max(0, Math.min(100, (char.mood || 70) + s.mood));
        if (s.thought) char.thought = s.thought;
        if (s.outfit) char.outfit = s.outfit;
        if (s.location) char.location = s.location;
        ChatCore.saveCharacter();
        ChatUI.updateTopbar(char);
      }

      for (const content of parsed.floors) {
        if (!content) continue;
        const replyId = ChatUtils.generateMsgId();
        let processedContent = ChatUtils.stripThinking(content);
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

        await ChatCore.saveMessage({
          id: replyId,
          chatId: ChatCore.currentChatId,
          content: processedContent,
          type: 'received',
          sender: char.name,
          avatar: char.avatar,
          timestamp: Date.now()
        });
      }

      ChatUI.scrollToBottom();
    } catch (e) {
      console.error('主动发言失败:', e);
      ChatUI.hideTyping();
    }
  }, 2000);
}
