/* scripts/chat-room/group.js - 群聊功能 */

const ChatGroup = {
  async openGroupModal() {
    ChatSettings.closeSettings();

    const db = await openChatDB();
    const tx = db.transaction(CHAR_STORE, 'readonly');
    const request = tx.objectStore(CHAR_STORE).getAll();

    request.onsuccess = () => {
      const characters = request.result || [];
      const currentId = ChatCore.currentChatId;

      let listHtml = characters.map(c => {
        const isCurrent = c.id === currentId;
        const avatarHtml = c.avatar ? `<img src="${c.avatar}">` : `<span>${c.name.charAt(0)}</span>`;
        return `
          <label class="character-select-item">
            <input type="checkbox" value="${c.id}" ${isCurrent ? 'checked disabled' : ''}>
            <div class="char-avatar">${avatarHtml}</div>
            <span class="char-name">${c.name}</span>
            ${isCurrent ? '<span class="current-tag">当前</span>' : ''}
          </label>
        `;
      }).join('');

      document.getElementById('group-chat-body').innerHTML = `
        <div class="form-group">
          <label>群聊名称</label>
          <input type="text" id="group-name" placeholder="输入群聊名称">
        </div>
        <div class="form-group">
          <label>选择角色</label>
          <div class="character-select-list">${listHtml}</div>
        </div>
        <button class="save-btn" onclick="ChatGroup.createGroup()">创建群聊</button>
      `;

      ChatUI.showModal('group-chat-modal');
    };
  },

  closeGroupModal() {
    ChatUI.hideModal('group-chat-modal');
  },

  async createGroup() {
    const name = document.getElementById('group-name').value.trim();
    if (!name) {
      ChatUtils.showToast('请输入群聊名称');
      return;
    }

    const checkboxes = document.querySelectorAll('.character-select-list input:checked');
    const memberIds = Array.from(checkboxes).map(cb => cb.value);

    if (memberIds.length < 2) {
      ChatUtils.showToast('请至少选择2个角色');
      return;
    }

    const groupId = 'group_' + Date.now();
    const groupChar = {
      id: groupId,
      name: name,
      isGroup: true,
      memberIds: memberIds,
      avatar: null,
      description: `群聊: ${memberIds.length}人`,
      createTime: Date.now(),
      settings: {}
    };

    const db = await openChatDB();
    const tx = db.transaction(CHAR_STORE, 'readwrite');
    tx.objectStore(CHAR_STORE).put(groupChar);

    tx.oncomplete = () => {
      ChatUtils.showToast('群聊创建成功');
      this.closeGroupModal();
      window.location.href = `chat-room.html?id=${groupId}`;
    };
  }
};

window.ChatGroup = ChatGroup;
