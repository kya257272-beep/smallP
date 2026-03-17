/* scripts/chat-room/index.js - 入口文件 */

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof openChatDB !== 'function') {
    console.error('chat.js 未加载');
    return;
  }
  await ChatCore.init();
});

function toggleCollapse(header) {
  header.parentElement.classList.toggle('open');
}

function selectFrequency(el) {
  document.querySelectorAll('.frequency-option').forEach(opt => opt.classList.remove('selected'));
  el.classList.add('selected');
}

function goBack() { ChatCore.goBack(); }
function sendMessage() { ChatCore.sendMessage(); }
function openSettingsModal() { ChatSettings.openSettings(); }
function closeSettingsModal() { ChatSettings.closeSettings(); }
function openEditCharacter() { ChatSettings.openEditCharacter(); }
function openUserSettings() { ChatSettings.openUserSettings(); }
function openPresetSettings() { ChatSettings.openPresetSettings(); }
function openWorldBook() { ChatSettings.openWorldBook(); }
function openChatBackground() { ChatSettings.openChatBackground(); }
function openAvatarFrameSettings() { ChatSettings.openAvatarFrameSettings(); }
function openContextSettings() { ChatSettings.openContextSettings(); }
function summarizeContext() { ChatSummary.openSummarySettings(); }
function goOfflineMode() { ChatSettings.toggleOfflineMode(); }
function clearChatHistory() { ChatCore.clearHistory(); }
function deleteCharacter() { ChatSettings.deleteCharacter(); }
function closeEditModal() { ChatUI.hideModal('edit-modal'); }
function openMoreActions() { ChatUI.showModal('more-actions-modal'); }
function closeMoreActions() { ChatUI.hideModal('more-actions-modal'); }
function regenerateReply() { closeMoreActions(); ChatCore.regenerateReply(); }
function continueGenerate() { closeMoreActions(); ChatCore.continueGenerate(); }
function sendImage() { closeMoreActions(); document.getElementById('image-input').click(); }
function editLastMessage() { closeMoreActions(); ChatUtils.showToast('功能开发中'); }
function openGroupChatModal() { ChatGroup.openGroupModal(); }
function closeGroupChatModal() { ChatGroup.closeGroupModal(); }

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
    const content = `[img:${e.target.result}]`;
    const msgId = ChatUtils.generateMsgId();
    const user = ChatCore.userSettings;
    ChatUI.addMessage({ content, type: 'sent', sender: user.name || '我', avatar: user.avatar, msgId });
    await ChatCore.saveMessage({
      id: msgId, chatId: ChatCore.currentChatId, content, type: 'sent',
      sender: user.name || '我', avatar: user.avatar, timestamp: Date.now()
    });
    ChatUI.scrollToBottom();
    await ChatCore.generateReply('(用户发送了一张图片)');
  };
  reader.readAsDataURL(file);
}

function viewImage(src) {
  window.open(src, '_blank');
}
