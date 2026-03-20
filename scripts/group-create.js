/* scripts/group-create.js - 群聊创建页面逻辑 */

let allFriends = [];
let groupAvatarData = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Load theme
  const theme = JSON.parse(localStorage.getItem('qqTheme') || '{}');
  if (theme.topbarColor) {
    document.documentElement.style.setProperty('--topbar-color', theme.topbarColor);
    const topbar = document.querySelector('.gc-topbar');
    if (topbar) topbar.style.background = hexToRgba(theme.topbarColor, 0.6);
  }

  await loadFriendList();
});

async function loadFriendList() {
  const characters = await getAllCharacters();
  allFriends = characters.filter(c => !c.isGroup);

  const list = document.getElementById('gc-member-list');
  if (allFriends.length === 0) {
    list.innerHTML = '<div class="gc-loading">还没有好友，请先添加角色</div>';
    return;
  }

  list.innerHTML = allFriends.map(c => `
    <label class="gc-member-item" data-id="${c.id}">
      <input type="checkbox" class="gc-member-checkbox" value="${c.id}" onchange="updateSelectedCount()">
      <div class="gc-member-avatar">
        ${c.avatar ? `<img src="${c.avatar}" alt="">` : c.name.charAt(0).toUpperCase()}
      </div>
      <div class="gc-member-name">${escapeHtml(c.name)}</div>
    </label>
  `).join('');
}

function updateSelectedCount() {
  const count = document.querySelectorAll('.gc-member-checkbox:checked').length;
  document.getElementById('gc-selected-count').textContent = `已选 ${count} 人`;
}

async function previewGroupAvatar(input) {
  if (!input.files || !input.files[0]) return;
  const compressed = await compressAvatar(input.files[0], 256);
  if (compressed) {
    const preview = document.getElementById('gc-avatar-preview');
    preview.innerHTML = `<img src="${compressed}">`;
    groupAvatarData = compressed;
  }
}

async function createGroup() {
  const name = document.getElementById('gc-name').value.trim();
  if (!name) {
    alert('请输入群聊名称');
    return;
  }

  const checkboxes = document.querySelectorAll('.gc-member-checkbox:checked');
  if (checkboxes.length < 2) {
    alert('请至少选择2个群成员');
    return;
  }

  const selectedIds = Array.from(checkboxes).map(cb => cb.value);
  const selectedMembers = allFriends.filter(f => selectedIds.includes(f.id));

  const description = document.getElementById('gc-desc').value.trim();

  const group = {
    id: 'group_' + Date.now(),
    name: name,
    avatar: groupAvatarData || null,
    description: description,
    isGroup: true,
    memberIds: selectedIds,
    members: selectedMembers.map(m => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar || null,
      role: 'member',
      muted: false,
      persona: m.description || '',
      frequency: 'normal'
    })),
    autoChat: {
      enabled: false,
      mode: 'random',
      fixedInterval: 60,
      randomMin: 30,
      randomMax: 180
    },
    groupMuted: false,
    createdAt: Date.now(),
    lastMsgTime: Date.now(),
    lastMessage: null,
    settings: {}
  };

  await saveCharacterToDB(group);
  window.location.href = `chat-room.html?id=${group.id}`;
}
