// scripts/momo.js
// MoMo 论坛社区 — 全面重构版 + 细节完善
// 小红书双列瀑布流 + 自定义风格 + AI生图 + 帖主主页 + 私聊 + 多预设 + 个人主页 + 发帖 + QQ联动

(function() {
  'use strict';

  const API_BASE = 'https://api.daidaibird.top/v1';

  // ==================== State ====================
  let posts = [];
  let currentPage = 'home';
  let currentSearchQuery = '';
  let activeTag = 'all';
  let customFilterTags = [];
  let isLoading = false;
  let currentDrawerPost = null;
  let currentChatUser = null;
  let publishImageData = null;

  // ==================== DOM Cache ====================
  const $ = id => document.getElementById(id);

  // ==================== Init ====================
  function init() {
    loadTheme();
    loadPresets();
    loadImageGenToggle();
    loadMyProfile();
    restorePostsFromSession();
    bindEvents();
    checkOpenProfileFromPost();
  }

  // Check if returning from post detail with a profile-open request
  function checkOpenProfileFromPost() {
    const data = sessionStorage.getItem('momoOpenProfile');
    if (data) {
      sessionStorage.removeItem('momoOpenProfile');
      try {
        const { username, avatar } = JSON.parse(data);
        if (username) {
          setTimeout(() => openUserProfile(username, avatar), 200);
        }
      } catch { /* ignore */ }
    }
  }

  // ==================== ① Post List Retention ====================
  function restorePostsFromSession() {
    const saved = sessionStorage.getItem('momoPosts');
    if (saved) {
      try {
        posts = JSON.parse(saved);
        if (posts.length > 0) {
          $('empty-state').classList.add('hidden');
          renderAllPosts();
          $('waterfall-container').classList.remove('hidden');
          $('load-more-wrap').classList.remove('hidden');
        }
      } catch { /* ignore */ }
    }
  }

  function savePostsToSession() {
    try {
      sessionStorage.setItem('momoPosts', JSON.stringify(posts));
    } catch { /* quota exceeded, ignore */ }
  }

  // ==================== Theme ====================
  function loadTheme() {
    const isDark = localStorage.getItem('momoTheme') === 'dark';
    if (isDark) {
      document.body.classList.add('dark-mode');
      $('theme-toggle').textContent = '☀️';
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('momoTheme', isDark ? 'dark' : 'light');
    $('theme-toggle').textContent = isDark ? '☀️' : '🌙';
  }

  // ==================== Event Binding ====================
  function bindEvents() {
    // Header — clear session on back to desktop
    $('back-btn').addEventListener('click', () => {
      sessionStorage.removeItem('momoPosts');
      window.location.href = 'index.html';
    });
    $('theme-toggle').addEventListener('click', toggleTheme);

    // Search
    $('search-btn').addEventListener('click', doSearch);
    $('search-input').addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });

    // Tag filter
    document.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.id === 'tag-custom-btn') {
          openCustomTagModal();
          return;
        }
        document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeTag = chip.dataset.tag;
        currentSearchQuery = '';
        $('search-input').value = '';
        refreshPosts();
      });
    });

    // Refresh & Load more
    $('refresh-btn').addEventListener('click', refreshPosts);
    $('load-more-btn').addEventListener('click', loadMorePosts);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => switchPage(item.dataset.page));
    });

    // Comment drawer
    $('drawer-overlay').addEventListener('click', closeDrawer);
    $('drawer-close').addEventListener('click', closeDrawer);
    $('drawer-send').addEventListener('click', sendDrawerComment);
    $('drawer-input').addEventListener('keypress', e => { if (e.key === 'Enter') sendDrawerComment(); });

    // Profile: image gen toggle
    $('image-gen-toggle').addEventListener('change', () => {
      localStorage.setItem('momoImageGenEnabled', $('image-gen-toggle').checked);
      showToast($('image-gen-toggle').checked ? 'AI生图已开启' : 'AI生图已关闭');
    });

    // Profile: save style (saves to current preset)
    $('style-save-btn').addEventListener('click', saveCustomStyle);
    $('style-ai-btn').addEventListener('click', aiRefineStyle);

    // Style Presets
    $('preset-select').addEventListener('change', onPresetChange);
    $('preset-save-new').addEventListener('click', saveAsNewPreset);
    $('preset-delete').addEventListener('click', deleteCurrentPreset);

    // User profile overlay
    $('user-profile-back').addEventListener('click', closeUserProfile);
    $('user-block-btn').addEventListener('click', blockUser);
    $('user-chat-btn').addEventListener('click', startChatFromProfile);
    $('user-friend-btn').addEventListener('click', addFriend);

    // Chat interface
    $('chat-back-btn').addEventListener('click', closeChatInterface);
    $('chat-send-btn').addEventListener('click', sendChatMessage);
    $('chat-msg-input').addEventListener('keypress', e => { if (e.key === 'Enter') sendChatMessage(); });

    // Custom tag modal
    const tagModal = $('tag-custom-modal');
    tagModal.querySelector('.modal-close').addEventListener('click', () => tagModal.classList.remove('active'));
    tagModal.querySelector('.modal-overlay').addEventListener('click', () => tagModal.classList.remove('active'));
    $('new-custom-tag').addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val && !customFilterTags.includes(val)) {
          customFilterTags.push(val);
          renderCustomTagList();
        }
        e.target.value = '';
      }
    });
    $('clear-custom-tags').addEventListener('click', () => {
      customFilterTags = [];
      renderCustomTagList();
    });
    $('apply-custom-tags').addEventListener('click', () => {
      tagModal.classList.remove('active');
      if (customFilterTags.length > 0) {
        document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
        $('tag-custom-btn').classList.add('active');
        activeTag = 'custom';
        refreshPosts();
      }
    });

    // ④⑤ My Profile editing
    $('profile-bg-area').addEventListener('click', () => $('profile-bg-input').click());
    $('profile-bg-input').addEventListener('change', handleProfileBgUpload);
    $('profile-avatar-large').addEventListener('click', () => $('profile-avatar-input').click());
    $('profile-avatar-input').addEventListener('change', handleProfileAvatarUpload);
    $('profile-edit-name-btn').addEventListener('click', toggleNicknameEdit);

    // My Posts & Publish
    $('publish-entry-btn').addEventListener('click', openPublishOverlay);
    $('publish-close').addEventListener('click', closePublishOverlay);
    $('publish-submit').addEventListener('click', submitPublishPost);
    $('publish-add-image').addEventListener('click', () => $('publish-image-input').click());
    $('publish-image-input').addEventListener('change', handlePublishImage);
  }

  // ==================== Page Navigation ====================
  function switchPage(page) {
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
    document.querySelectorAll('.page-section').forEach(section => {
      section.classList.toggle('active', section.id === `page-${page}`);
    });

    // Hide chat interface when switching pages
    $('chat-interface').classList.remove('active');

    if (page === 'chat') {
      renderChatList();
    }
    if (page === 'profile') {
      loadMyProfile();
      renderMyPosts();
    }
  }

  // ==================== Model Helpers ====================
  function getModelConfig(funcType) {
    const configs = JSON.parse(localStorage.getItem('apiConfigs') || '[]');
    const bindings = JSON.parse(localStorage.getItem('modelBindings') || '{}');

    if (bindings[funcType] && bindings[funcType].configId) {
      const config = configs.find(c => c.id === bindings[funcType].configId);
      if (config) {
        return { apiKey: config.key, model: bindings[funcType].model };
      }
    }

    // Fallback: use first config
    if (configs.length > 0) {
      return { apiKey: configs[0].key, model: bindings[funcType]?.model || 'gpt-4o-mini' };
    }
    return null;
  }

  async function callLLM(funcType, messages, opts = {}) {
    const config = getModelConfig(funcType);
    if (!config) {
      showToast('请先在API配置中设置模型');
      return null;
    }

    const body = {
      model: config.model,
      messages,
      temperature: opts.temperature || 0.9,
      max_tokens: opts.max_tokens || 4000,
      stream: false,
    };

    // Web search support
    if (opts.webSearch && localStorage.getItem('webSearchEnabled') === 'true') {
      body.tools = [{ type: 'web_search' }];
    }

    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // ==================== ③ Multi Style Presets ====================
  function getPresets() {
    try { return JSON.parse(localStorage.getItem('momoStylePresets') || '[]'); }
    catch { return []; }
  }

  function savePresets(presets) {
    localStorage.setItem('momoStylePresets', JSON.stringify(presets));
  }

  function getActivePresetId() {
    return localStorage.getItem('momoActivePresetId') || '';
  }

  function setActivePresetId(id) {
    localStorage.setItem('momoActivePresetId', id);
  }

  function loadPresets() {
    let presets = getPresets();
    // Migrate: if no presets but old momoCustomStyle exists, create one
    if (presets.length === 0) {
      const old = (() => { try { return JSON.parse(localStorage.getItem('momoCustomStyle') || 'null'); } catch { return null; } })();
      const defaultPreset = {
        id: 'preset_default',
        name: '默认风格',
        content: old?.content || '',
        narrative: old?.narrative || '',
        topic: old?.topic || '',
        count: old?.count || 6,
        commentCount: old?.commentCount || 15,
        imageStyle: old?.imageStyle || ''
      };
      presets = [defaultPreset];
      savePresets(presets);
      setActivePresetId(defaultPreset.id);
    }

    renderPresetSelect();
    loadCustomStyle();
  }

  function renderPresetSelect() {
    const select = $('preset-select');
    const presets = getPresets();
    const activeId = getActivePresetId();
    select.innerHTML = presets.map(p =>
      `<option value="${p.id}" ${p.id === activeId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
    ).join('');
  }

  function onPresetChange() {
    const id = $('preset-select').value;
    setActivePresetId(id);
    loadCustomStyle();
    showToast('已切换预设');
  }

  function saveAsNewPreset() {
    const name = prompt('请输入新预设名称：');
    if (!name || !name.trim()) return;

    const style = readStyleForm();
    const preset = {
      id: 'preset_' + Date.now(),
      name: name.trim(),
      ...style
    };

    const presets = getPresets();
    presets.push(preset);
    savePresets(presets);
    setActivePresetId(preset.id);
    renderPresetSelect();
    showToast('已保存为新预设: ' + name.trim());
  }

  function deleteCurrentPreset() {
    let presets = getPresets();
    if (presets.length <= 1) {
      showToast('至少保留一个预设');
      return;
    }
    const activeId = getActivePresetId();
    const preset = presets.find(p => p.id === activeId);
    if (!confirm(`确定删除预设"${preset?.name || ''}"？`)) return;

    presets = presets.filter(p => p.id !== activeId);
    savePresets(presets);
    setActivePresetId(presets[0].id);
    renderPresetSelect();
    loadCustomStyle();
    showToast('已删除预设');
  }

  function getCustomStyle() {
    const presets = getPresets();
    const activeId = getActivePresetId();
    return presets.find(p => p.id === activeId) || presets[0] || null;
  }

  function readStyleForm() {
    return {
      content: $('style-content').value.trim(),
      narrative: $('style-narrative').value.trim(),
      topic: $('style-topic').value.trim(),
      count: parseInt($('style-count').value) || 6,
      commentCount: parseInt($('style-comment-count').value) || 15,
      imageStyle: $('style-image').value.trim()
    };
  }

  function loadCustomStyle() {
    const style = getCustomStyle();
    if (style) {
      $('style-content').value = style.content || '';
      $('style-narrative').value = style.narrative || '';
      $('style-topic').value = style.topic || '';
      $('style-count').value = style.count || 6;
      $('style-comment-count').value = style.commentCount || 15;
      $('style-image').value = style.imageStyle || '';
    }
  }

  function saveCustomStyle() {
    const presets = getPresets();
    const activeId = getActivePresetId();
    const idx = presets.findIndex(p => p.id === activeId);
    if (idx < 0) return;

    const style = readStyleForm();
    presets[idx] = { ...presets[idx], ...style };
    savePresets(presets);
    // Also save to old key for backward compat
    localStorage.setItem('momoCustomStyle', JSON.stringify(style));
    showToast('风格设置已保存');
  }

  async function aiRefineStyle() {
    const btn = $('style-ai-btn');
    btn.disabled = true;
    btn.textContent = '🤖 AI思考中...';

    try {
      const current = {
        content: $('style-content').value.trim(),
        narrative: $('style-narrative').value.trim(),
        topic: $('style-topic').value.trim()
      };

      const prompt = `用户正在设置一个社交论坛的帖子风格。请帮助完善以下描述，让它更生动、更有吸引力。

用户当前设置：
- 帖子内容方向：${current.content || '（未填写）'}
- 叙事风格：${current.narrative || '（未填写）'}
- 讨论主题：${current.topic || '（未填写）'}

请返回JSON格式：
{
  "content": "完善后的内容方向描述（30-80字）",
  "narrative": "完善后的叙事风格描述（10-30字）",
  "topic": "完善后的讨论主题（10-30字）"
}

如果用户未填写，请根据当前流行趋势推荐一个有趣的风格。直接返回JSON。`;

      const result = await callLLM('interface', [{ role: 'user', content: prompt }], { temperature: 0.8, max_tokens: 500 });
      if (result) {
        const match = result.match(/\{[\s\S]*\}/);
        if (match) {
          const refined = JSON.parse(match[0]);
          if (refined.content) $('style-content').value = refined.content;
          if (refined.narrative) $('style-narrative').value = refined.narrative;
          if (refined.topic) $('style-topic').value = refined.topic;
          showToast('AI已帮你完善描述');
        }
      }
    } catch (e) {
      console.error('AI完善失败:', e);
      showToast('AI完善失败: ' + e.message);
    }

    btn.disabled = false;
    btn.textContent = '🤖 AI帮我完善描述';
  }

  // ==================== Image Gen Toggle ====================
  function loadImageGenToggle() {
    $('image-gen-toggle').checked = localStorage.getItem('momoImageGenEnabled') === 'true';
  }

  // ==================== ④ My Profile Editing ====================
  function getMyProfile() {
    try { return JSON.parse(localStorage.getItem('momoMyProfile') || 'null'); }
    catch { return null; }
  }

  function saveMyProfile(profile) {
    localStorage.setItem('momoMyProfile', JSON.stringify(profile));
  }

  function loadMyProfile() {
    const profile = getMyProfile() || { nickname: 'MoMo用户', avatar: null, bgImage: null };
    const usernameEl = $('profile-username');
    usernameEl.textContent = profile.nickname;

    const avatarEl = $('profile-avatar-large');
    if (profile.avatar) {
      avatarEl.innerHTML = `<img src="${profile.avatar}" alt="头像"><div class="profile-avatar-edit-hint">换</div><input type="file" id="profile-avatar-input" accept="image/*" style="display:none;">`;
      // Re-bind since we replaced innerHTML
      $('profile-avatar-input').addEventListener('change', handleProfileAvatarUpload);
    }

    const bgArea = $('profile-bg-area');
    if (profile.bgImage) {
      bgArea.style.backgroundImage = `url(${profile.bgImage})`;
      bgArea.style.backgroundSize = 'cover';
      bgArea.style.backgroundPosition = 'center';
    }
  }

  function handleProfileBgUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImageFile(file, 800).then(dataUrl => {
      if (!dataUrl) return;
      const profile = getMyProfile() || { nickname: 'MoMo用户', avatar: null, bgImage: null };
      profile.bgImage = dataUrl;
      saveMyProfile(profile);
      $('profile-bg-area').style.backgroundImage = `url(${dataUrl})`;
      $('profile-bg-area').style.backgroundSize = 'cover';
      $('profile-bg-area').style.backgroundPosition = 'center';
      showToast('背景已更新');
    });
  }

  function handleProfileAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImageFile(file, 256).then(dataUrl => {
      if (!dataUrl) return;
      const profile = getMyProfile() || { nickname: 'MoMo用户', avatar: null, bgImage: null };
      profile.avatar = dataUrl;
      saveMyProfile(profile);
      const avatarEl = $('profile-avatar-large');
      avatarEl.innerHTML = `<img src="${dataUrl}" alt="头像"><div class="profile-avatar-edit-hint">换</div><input type="file" id="profile-avatar-input" accept="image/*" style="display:none;">`;
      $('profile-avatar-input').addEventListener('change', handleProfileAvatarUpload);
      showToast('头像已更新');
    });
  }

  function toggleNicknameEdit() {
    const el = $('profile-username');
    if (el.contentEditable === 'true') {
      el.contentEditable = 'false';
      const name = el.textContent.trim() || 'MoMo用户';
      el.textContent = name;
      const profile = getMyProfile() || { nickname: 'MoMo用户', avatar: null, bgImage: null };
      profile.nickname = name;
      saveMyProfile(profile);
      $('profile-edit-name-btn').textContent = '✏️';
      showToast('昵称已保存');
    } else {
      el.contentEditable = 'true';
      el.focus();
      $('profile-edit-name-btn').textContent = '✓';
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function compressImageFile(file, maxSize) {
    return new Promise(resolve => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
        else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => { URL.revokeObjectURL(img.src); resolve(null); };
      img.src = URL.createObjectURL(file);
    });
  }

  // ==================== ⑤ My Posts ====================
  function getMyPosts() {
    try { return JSON.parse(localStorage.getItem('momoMyPosts') || '[]'); }
    catch { return []; }
  }

  function saveMyPosts(myPosts) {
    localStorage.setItem('momoMyPosts', JSON.stringify(myPosts));
  }

  function renderMyPosts() {
    const container = $('my-posts-list');
    const myPosts = getMyPosts();

    if (myPosts.length === 0) {
      container.innerHTML = '<div class="my-posts-empty">还没有发布过帖子</div>';
      return;
    }

    container.innerHTML = '';
    myPosts.forEach((post, idx) => {
      const card = document.createElement('div');
      card.className = 'my-post-card';

      const gradient = getRandomGradient();
      const thumbStyle = post.image
        ? `background-image:url(${post.image})`
        : `background:${gradient}`;

      card.innerHTML = `
        <div class="my-post-thumb" style="${thumbStyle}">${post.image ? '' : '📝'}</div>
        <div class="my-post-info">
          <div class="my-post-title">${escapeHtml(post.title)}</div>
          <div class="my-post-meta">❤️ ${formatNumber(post.likes || 0)} · 💬 ${post.generatedComments?.length || 0}条评论</div>
        </div>
        <button class="my-post-delete" data-idx="${idx}">🗑️</button>
      `;

      card.addEventListener('click', e => {
        if (e.target.closest('.my-post-delete')) {
          e.stopPropagation();
          deleteMyPost(idx);
          return;
        }
        openPostDetail(post);
      });

      container.appendChild(card);
    });
  }

  function deleteMyPost(idx) {
    if (!confirm('确定永久删除这条帖子？')) return;
    const myPosts = getMyPosts();
    myPosts.splice(idx, 1);
    saveMyPosts(myPosts);
    renderMyPosts();
    showToast('帖子已删除');
  }

  // ==================== Publish Post ====================
  function openPublishOverlay() {
    $('publish-overlay').classList.add('active');
    $('publish-post-title').value = '';
    $('publish-post-content').value = '';
    $('publish-image-preview').innerHTML = '';
    publishImageData = null;
  }

  function closePublishOverlay() {
    $('publish-overlay').classList.remove('active');
  }

  function handlePublishImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImageFile(file, 600).then(dataUrl => {
      if (!dataUrl) return;
      publishImageData = dataUrl;
      $('publish-image-preview').innerHTML = `<img src="${dataUrl}" alt="预览">`;
    });
  }

  async function submitPublishPost() {
    const title = $('publish-post-title').value.trim();
    const content = $('publish-post-content').value.trim();
    if (!title) { showToast('请输入标题'); return; }

    const btn = $('publish-submit');
    btn.disabled = true;
    btn.textContent = '发布中...';

    const profile = getMyProfile() || { nickname: 'MoMo用户', avatar: null };

    const post = {
      id: `mypost-${Date.now()}`,
      username: profile.nickname,
      avatar: '👤',
      title,
      summary: content.substring(0, 60),
      content,
      tags: [],
      likes: Math.floor(Math.random() * 500) + 10,
      comments: 0,
      time: '刚刚',
      liked: false,
      image: publishImageData,
      generatedComments: [],
      isMyPost: true
    };

    // Generate comments via AI
    try {
      const commentPrompt = `为以下帖子生成5到10条简短评论。

标题：${title}
内容：${content || '（无正文）'}

要求：
1. 评论10-60字，符合年轻网友口吻
2. 类型多样：赞美、共鸣、提问、玩梗等
3. 头像用单个emoji

返回JSON数组，每条包含：username, avatar, content, time

直接返回JSON数组。`;

      const result = await callLLM('interface', [{ role: 'user', content: commentPrompt }], {
        temperature: 0.95, max_tokens: 1500
      });

      if (result) {
        const match = result.match(/\[[\s\S]*\]/);
        if (match) {
          post.generatedComments = JSON.parse(match[0]);
          post.comments = post.generatedComments.length;
        }
      }
    } catch (e) {
      console.error('生成评论失败:', e);
    }

    // Save to my posts
    const myPosts = getMyPosts();
    myPosts.unshift(post);
    saveMyPosts(myPosts);

    btn.disabled = false;
    btn.textContent = '发布';
    closePublishOverlay();
    renderMyPosts();
    showToast('帖子已发布');
  }

  // ==================== Search ====================
  function doSearch() {
    const query = $('search-input').value.trim();
    if (!query) {
      showToast('请输入搜索内容');
      return;
    }
    currentSearchQuery = query;
    document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
    refreshPosts();
  }

  // ==================== Post Generation ====================
  function buildPostPrompt(count) {
    const style = getCustomStyle();
    const tagMap = {
      'hot': '热门话题、火爆讨论、引发争议的事件',
      'funny': '搞笑、整活、抽象、玩梗、沙雕日常',
      'love': '恋爱、暗恋、表白、情感、CP',
      'game': '游戏、电竞、开黑、上分、游戏八卦',
      'anime': '动漫、二次元、cos、番剧、漫画',
      'tech': '科技、数码、编程、AI、手机电脑',
      'emo': '深夜emo、情感宣泄、伤感、孤独'
    };

    let contentDirection = '';
    if (currentSearchQuery) {
      contentDirection = `所有帖子必须与"${currentSearchQuery}"强相关。`;
    } else if (activeTag === 'custom' && customFilterTags.length > 0) {
      contentDirection = `所有帖子必须与以下标签强相关：${customFilterTags.join('、')}`;
    } else if (activeTag !== 'all' && tagMap[activeTag]) {
      contentDirection = `帖子主题倾向：${tagMap[activeTag]}`;
    }

    let styleHint = '';
    if (style && (style.content || style.narrative || style.topic)) {
      styleHint = `\n\n用户自定义风格要求：
- 内容方向：${style.content || '不限'}
- 叙事风格：${style.narrative || '不限'}
- 讨论主题：${style.topic || '不限'}
请在生成内容时融入以上风格偏好。`;
    }

    const webSearchHint = localStorage.getItem('webSearchEnabled') === 'true'
      ? '\n\n如果你支持联网搜索，请搜索最新的热门话题并融入生成的帖子中。'
      : '';

    return `你是一个社交论坛（类似小红书）的内容生成器。生成${count}条真实、有网感的帖子预览。

${contentDirection}${styleHint}${webSearchHint}

要求：
1. 标题吸引眼球（10-30字），使用悬念、反转、数字等技巧
2. 摘要（30-60字），只透露开头或高潮，留悬念
3. 融入网络热梗、语气词（hhh/救命/绷不住了/芭比Q了）
4. 加入真实场景（时间/地点/人物关系）
5. 情感真实强烈
6. 头像使用单个emoji
7. 每条帖子都要有imagePrompt字段——用英文写一段简短的生图提示词（20-40词），描述一张吸引人的配图，风格${style?.imageStyle || '随机'}

返回JSON数组，每条包含：
- username: 用户名（活泼网名）
- avatar: 单个emoji
- title: 标题
- summary: 摘要
- tags: 标签数组（2-3个）
- likes: 随机100-50000
- comments: 随机10-2000
- imagePrompt: 英文生图提示词（隐藏，不展示给用户）

直接返回JSON数组。`;
  }

  async function generatePosts(count) {
    if (!count) {
      const style = getCustomStyle();
      count = style?.count || 6;
    }

    const prompt = buildPostPrompt(count);

    try {
      const content = await callLLM('interface', [{ role: 'user', content: prompt }], {
        temperature: 0.95,
        max_tokens: 4000,
        webSearch: true
      });

      if (!content) return [];

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const postsData = JSON.parse(jsonMatch[0]);
        return postsData.map((post, i) => ({
          id: `post-${Date.now()}-${i}`,
          ...post,
          time: getRandomTime(),
          liked: false,
          image: null // will be filled by image gen
        }));
      }
      throw new Error('无法解析');
    } catch (e) {
      console.error('生成帖子失败:', e);
      showToast('生成帖子失败: ' + e.message);
      return [];
    }
  }

  // ==================== Image Generation ====================
  async function generateImage(imagePrompt) {
    const config = getModelConfig('image');
    if (!config) return null;

    try {
      const response = await fetch(`${API_BASE}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          prompt: imagePrompt,
          n: 1,
          size: '512x512',
          response_format: 'b64_json'
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      if (data.data && data.data[0]) {
        if (data.data[0].b64_json) {
          return 'data:image/png;base64,' + data.data[0].b64_json;
        }
        if (data.data[0].url) {
          return data.data[0].url;
        }
      }
      return null;
    } catch (e) {
      console.error('生图失败:', e);
      return null;
    }
  }

  async function generateImagesForPosts(newPosts) {
    if (localStorage.getItem('momoImageGenEnabled') !== 'true') return;

    const promises = newPosts.map(async post => {
      if (post.imagePrompt) {
        try {
          const img = await generateImage(post.imagePrompt);
          post.image = img;
        } catch (e) {
          post.image = null;
        }
        // Update card if already rendered
        updateCardImage(post);
      }
    });

    await Promise.allSettled(promises);
  }

  function updateCardImage(post) {
    const card = document.querySelector(`[data-post-id="${post.id}"] .card-image-placeholder`);
    if (card && post.image) {
      const img = document.createElement('img');
      img.className = 'card-image';
      img.src = post.image;
      img.alt = post.title;
      img.loading = 'lazy';
      card.parentNode.replaceChild(img, card);
    }
  }

  // ==================== Rendering ====================
  function getRandomGradient() {
    const gradients = [
      'linear-gradient(135deg, #667eea, #764ba2)',
      'linear-gradient(135deg, #f093fb, #f5576c)',
      'linear-gradient(135deg, #4facfe, #00f2fe)',
      'linear-gradient(135deg, #43e97b, #38f9d7)',
      'linear-gradient(135deg, #fa709a, #fee140)',
      'linear-gradient(135deg, #a8edea, #fed6e3)',
      'linear-gradient(135deg, #ff9a9e, #fecfef)',
      'linear-gradient(135deg, #ffecd2, #fcb69f)',
      'linear-gradient(135deg, #30cfd0, #330867)',
      'linear-gradient(135deg, #ff6e7f, #bfe9ff)',
      'linear-gradient(135deg, #fbc2eb, #a6c1ee)',
      'linear-gradient(135deg, #84fab0, #8fd3f4)',
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  }

  function getRandomLightColor() {
    const colors = [
      '#FFE4E1', '#E0F0FF', '#E8F5E9', '#FFF3E0', '#F3E5F5',
      '#E0F7FA', '#FFF8E1', '#FCE4EC', '#E8EAF6', '#F1F8E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function renderWaterfallCard(post) {
    const card = document.createElement('div');
    card.className = 'waterfall-card';
    card.dataset.postId = post.id;

    const gradient = getRandomGradient();
    const avatarGradient = getRandomGradient();

    // Image section
    let imageHtml;
    if (post.image) {
      imageHtml = `<img class="card-image" src="${post.image}" alt="${escapeHtml(post.title)}" loading="lazy">`;
    } else {
      const placeholderBg = gradient;
      const summaryText = post.summary ? post.summary.substring(0, 50) : post.title;
      imageHtml = `<div class="card-image-placeholder" style="background:${placeholderBg};">${escapeHtml(summaryText)}</div>`;
    }

    card.innerHTML = `
      ${imageHtml}
      <div class="card-body">
        <div class="card-title">${escapeHtml(post.title)}</div>
      </div>
      <div class="card-footer">
        <div class="card-author">
          <div class="card-avatar" style="background:${avatarGradient}" data-username="${escapeHtml(post.username)}">${post.avatar || '👤'}</div>
          <span class="card-username">${escapeHtml(post.username)}</span>
        </div>
        <div class="card-likes ${post.liked ? 'liked' : ''}" data-post-id="${post.id}">
          <span>${post.liked ? '♥' : '♡'}</span>
          <span>${formatNumber(post.likes || 0)}</span>
        </div>
      </div>
    `;

    // Click card -> post detail
    card.addEventListener('click', e => {
      if (e.target.closest('.card-likes')) {
        e.stopPropagation();
        toggleLike(post);
        return;
      }
      if (e.target.closest('.card-avatar')) {
        e.stopPropagation();
        openUserProfile(post.username, post.avatar);
        return;
      }
      openPostDetail(post);
    });

    return card;
  }

  function renderAllPosts() {
    const container = $('waterfall-container');
    container.innerHTML = '';

    const blockedUsers = getBlockedUsers();

    posts.forEach(post => {
      if (blockedUsers.includes(post.username)) return;
      container.appendChild(renderWaterfallCard(post));
    });
  }

  function toggleLike(post) {
    post.liked = !post.liked;
    post.likes = post.liked ? (post.likes || 0) + 1 : Math.max(0, (post.likes || 1) - 1);

    const likesEl = document.querySelector(`.card-likes[data-post-id="${post.id}"]`);
    if (likesEl) {
      likesEl.classList.toggle('liked', post.liked);
      likesEl.innerHTML = `<span>${post.liked ? '♥' : '♡'}</span><span>${formatNumber(post.likes)}</span>`;
    }
  }

  // ==================== Post Loading ====================
  async function refreshPosts() {
    if (isLoading) return;
    isLoading = true;

    $('empty-state').classList.add('hidden');
    $('waterfall-container').classList.add('hidden');
    $('load-more-wrap').classList.add('hidden');
    $('loading-indicator').classList.remove('hidden');

    posts = [];
    const newPosts = await generatePosts();

    $('loading-indicator').classList.add('hidden');

    if (newPosts.length > 0) {
      posts = newPosts;
      renderAllPosts();
      $('waterfall-container').classList.remove('hidden');
      $('load-more-wrap').classList.remove('hidden');

      // Save to session for retention (①)
      savePostsToSession();

      // Generate images in background
      generateImagesForPosts(newPosts);
    } else {
      $('empty-state').classList.remove('hidden');
    }

    isLoading = false;
  }

  async function loadMorePosts() {
    if (isLoading) return;
    isLoading = true;

    const btn = $('load-more-btn');
    btn.disabled = true;
    btn.textContent = '加载中...';

    const newPosts = await generatePosts();
    if (newPosts.length > 0) {
      posts.push(...newPosts);
      const container = $('waterfall-container');
      const blockedUsers = getBlockedUsers();
      newPosts.forEach(post => {
        if (!blockedUsers.includes(post.username)) {
          container.appendChild(renderWaterfallCard(post));
        }
      });

      // Save to session (①)
      savePostsToSession();

      generateImagesForPosts(newPosts);
    }

    btn.disabled = false;
    btn.textContent = '加载更多';
    isLoading = false;
  }

  // ==================== Post Detail ====================
  function openPostDetail(post) {
    // ① Save posts to session before navigating
    savePostsToSession();
    sessionStorage.setItem('currentPost', JSON.stringify(post));
    window.location.href = 'momo-post.html';
  }

  // ==================== Comment Drawer ====================
  async function openCommentDrawer(post) {
    currentDrawerPost = post;
    $('comment-drawer').classList.add('active');
    document.body.style.overflow = 'hidden';

    $('drawer-comment-count').textContent = post.comments || 0;
    $('drawer-comments').innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>加载评论中...</p></div>';

    const style = getCustomStyle();
    const commentCount = style?.commentCount || 15;

    try {
      const prompt = `为以下帖子生成${commentCount}条简短评论。

标题：${post.title}
摘要：${post.summary}

要求：
1. 评论10-80字，符合年轻网友口吻
2. 类型多样：吐槽、共鸣、玩梗、暖心、杠精等
3. 头像用单个emoji

返回JSON数组，每条包含：username, avatar, content, time

直接返回JSON数组。`;

      const result = await callLLM('interface', [{ role: 'user', content: prompt }], {
        temperature: 0.95, max_tokens: 2000
      });

      if (result) {
        const match = result.match(/\[[\s\S]*\]/);
        if (match) {
          const comments = JSON.parse(match[0]);
          renderDrawerComments(comments);
          return;
        }
      }
      $('drawer-comments').innerHTML = '<p style="text-align:center;color:var(--momo-text-muted);padding:40px;">暂无评论</p>';
    } catch (e) {
      console.error('生成评论失败:', e);
      $('drawer-comments').innerHTML = '<p style="text-align:center;color:var(--momo-text-muted);padding:40px;">评论加载失败</p>';
    }
  }

  function renderDrawerComments(comments) {
    const container = $('drawer-comments');
    container.innerHTML = '';
    comments.forEach(c => {
      const el = document.createElement('div');
      el.className = 'comment-item';
      el.innerHTML = `
        <div class="comment-avatar clickable-avatar" style="background:${getRandomGradient()}" data-username="${escapeHtml(c.username)}" data-avatar="${escapeHtml(c.avatar || '👤')}">${c.avatar || '👤'}</div>
        <div class="comment-body">
          <div class="comment-username">${escapeHtml(c.username)}</div>
          <div class="comment-text">${escapeHtml(c.content)}</div>
          <div class="comment-time">${c.time || getRandomTime()}</div>
        </div>
      `;
      el.querySelector('.clickable-avatar').addEventListener('click', e => {
        e.stopPropagation();
        closeDrawer();
        openUserProfile(c.username, c.avatar);
      });
      container.appendChild(el);
    });
  }

  function closeDrawer() {
    $('comment-drawer').classList.remove('active');
    document.body.style.overflow = '';
    currentDrawerPost = null;
  }

  function sendDrawerComment() {
    const text = $('drawer-input').value.trim();
    if (!text) { showToast('请输入评论内容'); return; }

    const el = document.createElement('div');
    el.className = 'comment-item';
    el.innerHTML = `
      <div class="comment-avatar" style="background:${getRandomGradient()}">👤</div>
      <div class="comment-body">
        <div class="comment-username">我</div>
        <div class="comment-text">${escapeHtml(text)}</div>
        <div class="comment-time">刚刚</div>
      </div>
    `;
    $('drawer-comments').insertBefore(el, $('drawer-comments').firstChild);
    $('drawer-input').value = '';

    if (currentDrawerPost) {
      currentDrawerPost.comments = (currentDrawerPost.comments || 0) + 1;
      $('drawer-comment-count').textContent = currentDrawerPost.comments;
    }
    showToast('评论成功');
  }

  // ==================== Custom Tag Modal ====================
  function openCustomTagModal() {
    $('tag-custom-modal').classList.add('active');
    renderCustomTagList();
  }

  function renderCustomTagList() {
    const container = $('custom-tag-list');
    container.innerHTML = '';
    customFilterTags.forEach(tag => {
      const el = document.createElement('div');
      el.className = 'tag-item selected';
      el.innerHTML = `${escapeHtml(tag)} <span style="margin-left:6px;cursor:pointer;color:#999;">×</span>`;
      el.querySelector('span').addEventListener('click', e => {
        e.stopPropagation();
        customFilterTags = customFilterTags.filter(t => t !== tag);
        renderCustomTagList();
      });
      container.appendChild(el);
    });
  }

  // ==================== User Profile ====================
  function getUserProfiles() {
    try { return JSON.parse(localStorage.getItem('momoUserProfiles') || '{}'); }
    catch { return {}; }
  }

  function saveUserProfiles(profiles) {
    localStorage.setItem('momoUserProfiles', JSON.stringify(profiles));
  }

  function getOrCreateProfile(username, avatar) {
    const profiles = getUserProfiles();
    if (profiles[username]) return profiles[username];

    // Generate random profile
    const profile = {
      username,
      avatar: avatar || '👤',
      qid: String(Math.floor(100000 + Math.random() * 900000)),
      bio: '', // will be generated
      bannerColor: getRandomLightColor(),
      avatarGradient: getRandomGradient()
    };
    profiles[username] = profile;
    saveUserProfiles(profiles);
    return profile;
  }

  async function openUserProfile(username, avatar) {
    const overlay = $('user-profile-overlay');
    overlay.classList.add('active');
    overlay.dataset.username = username;

    const profile = getOrCreateProfile(username, avatar);

    $('user-profile-banner').style.background = profile.avatarGradient;
    $('user-profile-avatar').style.background = profile.avatarGradient;
    $('user-profile-avatar').textContent = profile.avatar;
    $('user-profile-name').textContent = username;
    $('user-profile-qid').textContent = 'QID: ' + profile.qid;

    // Update friend button text
    const friends = JSON.parse(localStorage.getItem('momoFriends') || '[]');
    $('user-friend-btn').textContent = friends.includes(username) ? '✓ 已添加' : '➕ 加好友';

    // Update block button text
    const blocked = getBlockedUsers();
    $('user-block-btn').textContent = blocked.includes(username) ? '✓ 已拉黑' : '🚫 拉黑';

    // Generate bio if empty
    if (!profile.bio) {
      $('user-profile-bio').textContent = '正在生成人设...';
      try {
        const bioPrompt = `为一个社交论坛用户"${username}"生成一个有趣的个人简介（50-100字）。要求有个性、有特点，可以包含爱好、座右铭、性格特点等。直接返回简介文本。`;
        const bio = await callLLM('interface', [{ role: 'user', content: bioPrompt }], { temperature: 0.9, max_tokens: 200 });
        profile.bio = bio || '这个人很神秘，什么都没写。';
        const profiles = getUserProfiles();
        profiles[username] = profile;
        saveUserProfiles(profiles);
      } catch {
        profile.bio = '这个人很神秘，什么都没写。';
      }
    }
    $('user-profile-bio').textContent = profile.bio;

    // Generate user's posts
    $('user-profile-posts').innerHTML = '<div class="loading-indicator"><div class="spinner"></div><p>加载帖子中...</p></div>';

    try {
      const postsPrompt = `你是社交论坛用户"${username}"，个人简介：${profile.bio}

请以这个人设生成4条帖子预览。帖子内容要符合这个人的性格和爱好。

返回JSON数组，每条包含：title, summary, tags(2-3个), likes(100-5000), comments(10-500)

直接返回JSON数组。`;

      const result = await callLLM('interface', [{ role: 'user', content: postsPrompt }], {
        temperature: 0.9, max_tokens: 2000
      });

      if (result) {
        const match = result.match(/\[[\s\S]*\]/);
        if (match) {
          const userPosts = JSON.parse(match[0]);
          $('user-profile-posts').innerHTML = '';
          userPosts.forEach(p => {
            const card = document.createElement('div');
            card.className = 'waterfall-card';
            card.innerHTML = `
              <div class="card-image-placeholder" style="background:${getRandomGradient()}">${escapeHtml(p.summary?.substring(0, 40) || p.title)}</div>
              <div class="card-body"><div class="card-title">${escapeHtml(p.title)}</div></div>
              <div class="card-footer">
                <div class="card-author">
                  <div class="card-avatar" style="background:${profile.avatarGradient}">${profile.avatar}</div>
                  <span class="card-username">${escapeHtml(username)}</span>
                </div>
                <div class="card-likes"><span>♡</span><span>${formatNumber(p.likes || 0)}</span></div>
              </div>
            `;
            $('user-profile-posts').appendChild(card);
          });
        }
      }
    } catch (e) {
      $('user-profile-posts').innerHTML = '<p style="text-align:center;color:var(--momo-text-muted);padding:20px;">加载失败</p>';
    }
  }

  function closeUserProfile() {
    $('user-profile-overlay').classList.remove('active');
  }

  // ==================== Block / Friend ====================
  function getBlockedUsers() {
    try { return JSON.parse(localStorage.getItem('momoBlockedUsers') || '[]'); }
    catch { return []; }
  }

  function blockUser() {
    const username = $('user-profile-overlay').dataset.username;
    if (!username) return;

    let blocked = getBlockedUsers();
    if (blocked.includes(username)) {
      blocked = blocked.filter(u => u !== username);
      $('user-block-btn').textContent = '🚫 拉黑';
      showToast('已取消拉黑 ' + username);
    } else {
      blocked.push(username);
      $('user-block-btn').textContent = '✓ 已拉黑';
      showToast('已拉黑 ' + username);
    }
    localStorage.setItem('momoBlockedUsers', JSON.stringify(blocked));

    // Re-render posts to hide blocked users
    renderAllPosts();
  }

  // ==================== ⑦ Add Friend → Jump to QQ ====================
  function addFriend() {
    const username = $('user-profile-overlay').dataset.username;
    if (!username) return;

    let friends = JSON.parse(localStorage.getItem('momoFriends') || '[]');
    if (friends.includes(username)) {
      friends = friends.filter(u => u !== username);
      $('user-friend-btn').textContent = '➕ 加好友';
      showToast('已取消好友 ' + username);
      localStorage.setItem('momoFriends', JSON.stringify(friends));
      return;
    }

    friends.push(username);
    $('user-friend-btn').textContent = '✓ 已添加';
    localStorage.setItem('momoFriends', JSON.stringify(friends));

    // Get profile and store for QQ
    const profile = getOrCreateProfile(username);
    const friendData = {
      username: profile.username,
      avatar: profile.avatar,
      bio: profile.bio || '',
      qid: profile.qid,
      avatarGradient: profile.avatarGradient
    };
    sessionStorage.setItem('momoToQQFriend', JSON.stringify(friendData));

    showToast('已添加好友，正在跳转QQ...');
    setTimeout(() => {
      window.location.href = 'chat.html';
    }, 800);
  }

  // ==================== DM / Chat System ====================
  function getDMs() {
    try { return JSON.parse(localStorage.getItem('momoDMs') || '{}'); }
    catch { return {}; }
  }

  function saveDMs(dms) {
    localStorage.setItem('momoDMs', JSON.stringify(dms));
  }

  function startChatFromProfile() {
    const username = $('user-profile-overlay').dataset.username;
    if (!username) return;
    closeUserProfile();
    switchPage('chat');
    openChatInterface(username);
  }

  function renderChatList() {
    const dms = getDMs();
    const listEl = $('chat-list');
    const emptyEl = $('chat-empty');

    const usernames = Object.keys(dms);
    if (usernames.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    listEl.innerHTML = '';

    // Sort by last message time
    usernames.sort((a, b) => {
      const lastA = dms[a]?.[dms[a].length - 1]?.timestamp || 0;
      const lastB = dms[b]?.[dms[b].length - 1]?.timestamp || 0;
      return lastB - lastA;
    });

    usernames.forEach(username => {
      const msgs = dms[username];
      const lastMsg = msgs[msgs.length - 1];
      const profile = getOrCreateProfile(username);

      const item = document.createElement('div');
      item.className = 'chat-list-item';
      item.innerHTML = `
        <div class="chat-item-avatar clickable-avatar" style="background:${profile.avatarGradient}" data-username="${escapeHtml(username)}" data-avatar="${escapeHtml(profile.avatar)}">${profile.avatar}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">${escapeHtml(username)}</div>
          <div class="chat-item-last">${escapeHtml(lastMsg?.content?.substring(0, 30) || '')}</div>
        </div>
        <div class="chat-item-time">${formatChatTime(lastMsg?.timestamp)}</div>
      `;
      // Avatar click → profile, rest of row → chat
      item.querySelector('.clickable-avatar').addEventListener('click', e => {
        e.stopPropagation();
        openUserProfile(username, profile.avatar);
      });
      item.addEventListener('click', () => openChatInterface(username));
      listEl.appendChild(item);
    });
  }

  function openChatInterface(username) {
    currentChatUser = username;
    $('chat-interface').classList.add('active');
    $('page-chat').classList.remove('active');
    $('chat-header-name').textContent = username;

    // Render existing messages
    const dms = getDMs();
    const msgs = dms[username] || [];
    const container = $('chat-messages');
    container.innerHTML = '';

    const profile = getOrCreateProfile(username);

    msgs.forEach(msg => {
      const el = document.createElement('div');
      el.className = `chat-msg ${msg.role === 'user' ? 'sent' : 'received'}`;
      el.innerHTML = `
        <div class="chat-msg-avatar ${msg.role !== 'user' ? 'clickable-avatar' : ''}" style="background:${msg.role === 'user' ? getRandomGradient() : profile.avatarGradient}" ${msg.role !== 'user' ? `data-username="${escapeHtml(username)}" data-avatar="${escapeHtml(profile.avatar)}"` : ''}>${msg.role === 'user' ? '👤' : profile.avatar}</div>
        <div class="chat-msg-bubble">${escapeHtml(msg.content)}</div>
      `;
      if (msg.role !== 'user') {
        el.querySelector('.clickable-avatar').addEventListener('click', e => {
          e.stopPropagation();
          openUserProfile(username, profile.avatar);
        });
      }
      container.appendChild(el);
    });

    container.scrollTop = container.scrollHeight;
    $('chat-msg-input').focus();
  }

  function closeChatInterface() {
    $('chat-interface').classList.remove('active');
    $('page-chat').classList.add('active');
    currentChatUser = null;
    renderChatList();
  }

  // ==================== ② Short Chat Messages ====================
  async function sendChatMessage() {
    const input = $('chat-msg-input');
    const text = input.value.trim();
    if (!text || !currentChatUser) return;

    input.value = '';

    // Add user message
    const dms = getDMs();
    if (!dms[currentChatUser]) dms[currentChatUser] = [];
    dms[currentChatUser].push({ role: 'user', content: text, timestamp: Date.now() });
    saveDMs(dms);

    // Render user message
    const container = $('chat-messages');
    const userEl = document.createElement('div');
    userEl.className = 'chat-msg sent';
    userEl.innerHTML = `
      <div class="chat-msg-avatar" style="background:${getRandomGradient()}">👤</div>
      <div class="chat-msg-bubble">${escapeHtml(text)}</div>
    `;
    container.appendChild(userEl);
    container.scrollTop = container.scrollHeight;

    // Generate reply using interface model with short-message instructions
    const profile = getOrCreateProfile(currentChatUser);
    const systemPrompt = `你是"${currentChatUser}"，一个社交论坛用户。个人简介：${profile.bio || '一个有趣的人'}

请以这个人设的性格和口吻来回复消息。要求：
- 回复自然、口语化，符合年轻人QQ/微信聊天风格
- 可以使用网络用语和emoji
- 重要：把回复拆分成多条短消息（像QQ聊天一样），每条消息用中文引号""包裹
- 每条消息5-30字，共2-5条
- 示例格式："哈哈哈真的吗""我也遇到过""太离谱了吧"`;

    // Build message history
    const history = (dms[currentChatUser] || []).slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    try {
      const reply = await callLLM('interface', [
        { role: 'system', content: systemPrompt },
        ...history
      ], { temperature: 0.9, max_tokens: 300 });

      if (reply) {
        // Parse short messages from quotes
        let shortMsgs = [];
        const quoteRegex = /["\u201c]([^"\u201d]+)["\u201d]/g;
        let match;
        while ((match = quoteRegex.exec(reply)) !== null) {
          const msg = match[1].trim();
          if (msg) shortMsgs.push(msg);
        }

        // Fallback: split by punctuation if no quotes matched
        if (shortMsgs.length === 0) {
          shortMsgs = reply.split(/[。！？!?\n]+/).map(s => s.trim()).filter(s => s.length > 0);
        }

        // If still just one long message, use it as-is
        if (shortMsgs.length === 0) shortMsgs = [reply];

        // Render each short message with delay
        const updatedDMs = getDMs();
        if (!updatedDMs[currentChatUser]) updatedDMs[currentChatUser] = [];

        for (let i = 0; i < shortMsgs.length; i++) {
          const msgText = shortMsgs[i];

          await new Promise(resolve => setTimeout(resolve, i === 0 ? 0 : 300));

          // Save each short message independently
          updatedDMs[currentChatUser].push({ role: 'assistant', content: msgText, timestamp: Date.now() + i });
          saveDMs(updatedDMs);

          // Render bubble
          const replyEl = document.createElement('div');
          replyEl.className = 'chat-msg received';
          replyEl.innerHTML = `
            <div class="chat-msg-avatar clickable-avatar" style="background:${profile.avatarGradient}" data-username="${escapeHtml(currentChatUser)}" data-avatar="${escapeHtml(profile.avatar)}">${profile.avatar}</div>
            <div class="chat-msg-bubble">${escapeHtml(msgText)}</div>
          `;
          replyEl.querySelector('.clickable-avatar').addEventListener('click', ev => {
            ev.stopPropagation();
            openUserProfile(currentChatUser, profile.avatar);
          });
          container.appendChild(replyEl);
          container.scrollTop = container.scrollHeight;
        }
      }
    } catch (e) {
      console.error('聊天回复失败:', e);
      showToast('回复失败: ' + e.message);
    }
  }

  // ==================== Utilities ====================
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatNumber(num) {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return String(num);
  }

  function getRandomTime() {
    const times = [
      '刚刚', '1分钟前', '3分钟前', '8分钟前', '15分钟前', '半小时前',
      '1小时前', '2小时前', '3小时前', '5小时前', '8小时前',
      '昨天 23:47', '昨天 18:32', '2天前', '3天前', '一周前'
    ];
    return times[Math.floor(Math.random() * times.length)];
  }

  function formatChatTime(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    return Math.floor(diff / 86400000) + '天前';
  }

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // ==================== Start ====================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
