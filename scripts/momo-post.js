// scripts/momo-post.js
// MoMo 帖子详情页逻辑（适配新系统）

(function() {
  'use strict';

  const API_BASE = 'https://api.daidaibird.top/v1';
  const CACHE_PREFIX = 'momoPostCache_';
  const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

  let currentPost = null;
  let allComments = [];
  let displayedComments = 0;
  let isLoading = false;
  const COMMENTS_PER_LOAD = 20;

  const elements = {
    postDetail: null,
    commentsList: null,
    loadMoreBtn: null,
    endMessage: null,
    likeBtn: null,
    collectBtn: null,
    shareBtn: null,
    commentInput: null,
    sendBtn: null,
    toast: null,
    themeToggle: null
  };

  function init() {
    cacheElements();
    bindEvents();
    loadTheme();
    loadPost();
  }

  function cacheElements() {
    elements.postDetail = document.getElementById('post-detail');
    elements.commentsList = document.getElementById('comments-list');
    elements.loadMoreBtn = document.getElementById('load-more-btn');
    elements.endMessage = document.getElementById('end-message');
    elements.likeBtn = document.getElementById('like-btn');
    elements.collectBtn = document.getElementById('collect-btn');
    elements.shareBtn = document.getElementById('share-btn');
    elements.commentInput = document.getElementById('comment-input');
    elements.sendBtn = document.getElementById('send-btn');
    elements.toast = document.getElementById('toast');
    elements.themeToggle = document.getElementById('theme-toggle');
  }

  function bindEvents() {
    document.getElementById('back-btn').addEventListener('click', () => {
      window.history.back();
    });

    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.likeBtn.addEventListener('click', handleLike);
    elements.collectBtn.addEventListener('click', handleCollect);
    elements.shareBtn.addEventListener('click', handleShare);
    elements.sendBtn.addEventListener('click', sendComment);
    elements.commentInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendComment();
    });
    elements.loadMoreBtn.addEventListener('click', loadMoreComments);

    // ② 点击头像跳转个人主页（通过 sessionStorage 传递参数回 momo.html）
    document.addEventListener('click', e => {
      const avatar = e.target.closest('.clickable-avatar');
      if (avatar) {
        e.stopPropagation();
        const username = avatar.dataset.username;
        const avatarEmoji = avatar.dataset.avatar || '👤';
        if (username) {
          sessionStorage.setItem('momoOpenProfile', JSON.stringify({ username, avatar: avatarEmoji }));
          window.history.back();
        }
      }
    });
  }

  function loadTheme() {
    const isDark = localStorage.getItem('momoTheme') === 'dark';
    if (isDark) {
      document.body.classList.add('dark-mode');
      elements.themeToggle.textContent = '☀️';
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('momoTheme', isDark ? 'dark' : 'light');
    elements.themeToggle.textContent = isDark ? '☀️' : '🌙';
  }

  /* ---------- Custom Style Helper ---------- */
  function getCustomStyle() {
    try {
      return JSON.parse(localStorage.getItem('momoCustomStyle') || 'null');
    } catch { return null; }
  }

  /* ---------- Model Config ---------- */
  function getInterfaceModel() {
    if (typeof window.getModelForFunction === 'function') {
      const binding = window.getModelForFunction('interface');
      if (binding && binding.apiKey && binding.model) return binding;
    }

    const configs = JSON.parse(localStorage.getItem('apiConfigs') || '[]');
    const bindings = JSON.parse(localStorage.getItem('modelBindings') || '{}');

    if (bindings.interface && bindings.interface.configId) {
      const config = configs.find(c => c.id === bindings.interface.configId);
      if (config) {
        return { apiKey: config.key, model: bindings.interface.model };
      }
    }

    if (configs.length > 0) {
      return { apiKey: configs[0].key, model: 'gpt-4o-mini' };
    }
    return null;
  }

  function getAdvancedParams() {
    try {
      return JSON.parse(localStorage.getItem('advancedParams') || 'null') || {};
    } catch { return {}; }
  }

  /* ---------- LLM Call ---------- */
  async function callLLM(messages, options = {}) {
    const modelConfig = options.modelConfig || getInterfaceModel();
    if (!modelConfig) throw new Error('未配置模型');

    const adv = getAdvancedParams();
    const body = {
      model: modelConfig.model,
      messages,
      temperature: options.temperature ?? adv.temperature ?? 0.9,
      max_tokens: options.max_tokens ?? adv.maxTokens ?? 2048,
    };

    // Web search support
    const webSearch = localStorage.getItem('webSearchEnabled') === 'true';
    if (webSearch) {
      body.tools = [{ type: 'web_search' }];
    }

    const resp = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /* ---------- Post Loading ---------- */
  async function loadPost() {
    const postData = sessionStorage.getItem('currentPost');
    if (!postData) {
      showToast('未找到帖子数据');
      setTimeout(() => window.history.back(), 1500);
      return;
    }

    currentPost = JSON.parse(postData);

    // ① 自己的帖子直接用原内容，不调用模型
    if (currentPost.isMyPost && currentPost.content) {
      currentPost.fullContent = currentPost.content;
      renderPost();
      if (currentPost.generatedComments && currentPost.generatedComments.length > 0) {
        allComments = currentPost.generatedComments;
        document.getElementById('comment-count').textContent = allComments.length;
        renderComments(COMMENTS_PER_LOAD);
      } else {
        await loadComments();
      }
      return;
    }

    const cached = getCachedPost(currentPost.id);

    if (cached) {
      currentPost.fullContent = cached.fullContent;
      allComments = cached.comments;
      renderPost();
      document.getElementById('comment-count').textContent = allComments.length;
      renderComments(COMMENTS_PER_LOAD);
    } else {
      const fullContent = await generateFullContent(currentPost);
      currentPost.fullContent = fullContent;
      renderPost();
      await loadComments();
      cachePost(currentPost.id, {
        fullContent: currentPost.fullContent,
        comments: allComments
      });
    }
  }

  function getCachedPost(postId) {
    const cacheKey = CACHE_PREFIX + postId;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    try {
      const data = JSON.parse(cached);
      if (Date.now() - data.timestamp > CACHE_EXPIRY) {
        localStorage.removeItem(cacheKey);
        return null;
      }
      return data.content;
    } catch { return null; }
  }

  function cachePost(postId, content) {
    const cacheKey = CACHE_PREFIX + postId;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), content }));
    } catch (e) {
      console.warn('缓存失败:', e);
    }
  }

  /* ---------- Content Generation ---------- */
  async function generateFullContent(post) {
    const modelConfig = getInterfaceModel();
    if (!modelConfig) return post.summary || '内容加载失败';

    const style = getCustomStyle();
    let styleHint = '';
    if (style) {
      const parts = [];
      if (style.narrative) parts.push(`叙事风格：${style.narrative}`);
      if (style.topic) parts.push(`讨论主题：${style.topic}`);
      if (style.content) parts.push(`内容方向：${style.content}`);
      if (parts.length) styleHint = '\n用户偏好的风格：\n' + parts.join('\n');
    }

    const prompt = `你是一个社交论坛的内容扩展器。用户点开了以下帖子，请将缩略内容扩展为完整的长文帖子。

标题：${post.title}
缩略内容：${post.summary}
${styleHint}

要求：
1. 扩展到300-800字的完整长文
2. 保持原有的标题悬念，把故事讲完整
3. 风格可以是：反转向、抽象搞笑、正经分享、发癫向、悬疑向
4. 加入丰富细节：对话、心理活动、场景描写、时间线
5. 保持网友口吻：语气词、网络梗、emoji、可以有口语化表达
6. 故事要完整，有起承转合

直接返回扩展后的完整长文内容，无需其他说明。`;

    try {
      return await callLLM([{ role: 'user', content: prompt }], { modelConfig, max_tokens: 2000 });
    } catch (error) {
      console.error('生成完整内容失败:', error);
      return post.summary || '';
    }
  }

  /* ---------- Render Post ---------- */
  function getRandomAvatarGradient() {
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    ];
    return gradients[Math.floor(Math.random() * gradients.length)];
  }

  function getRandomColor() {
    const colors = ['#ff6b9d', '#667eea', '#38ef7d', '#ffd93d', '#ff6b6b', '#4ecdc4', '#a8edea', '#ffeaa7'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function renderPost() {
    // Image: prefer base64 image, then imagePrompt placeholder, then nothing
    let imageHtml = '';
    if (currentPost.image && currentPost.image.startsWith('data:')) {
      imageHtml = `<div class="detail-image"><img src="${currentPost.image}" alt="帖子配图" style="width:100%;height:auto;border-radius:12px;display:block;"></div>`;
    } else if (currentPost.imagePrompt || currentPost.imageDesc) {
      const desc = currentPost.imagePrompt || currentPost.imageDesc;
      imageHtml = `
        <div class="detail-image-placeholder" style="background: linear-gradient(135deg, ${getRandomColor()}66, ${getRandomColor()}88); border-radius:12px; padding:30px; text-align:center; margin-bottom:16px;">
          <span style="color:rgba(255,255,255,0.9); font-size:0.95rem; text-shadow:0 1px 4px rgba(0,0,0,0.2);">${escapeHtml(desc)}</span>
        </div>`;
    }

    const avatarGradient = getRandomAvatarGradient();

    elements.postDetail.innerHTML = `
      <div class="detail-header">
        <div class="detail-avatar clickable-avatar" style="background: ${avatarGradient}" data-username="${escapeHtml(currentPost.username)}" data-avatar="${escapeHtml(currentPost.avatar || '👤')}">${currentPost.avatar || '👤'}</div>
        <div class="detail-user-info">
          <div class="detail-username">${escapeHtml(currentPost.username)}</div>
          <div class="detail-time">${currentPost.time || ''}</div>
        </div>
      </div>
      ${currentPost.title ? `<h1 class="detail-title">${escapeHtml(currentPost.title)}</h1>` : ''}
      ${imageHtml}
      <div class="detail-content">${escapeHtml(currentPost.fullContent)}</div>
      ${currentPost.tags && currentPost.tags.length ? `
        <div class="detail-tags">
          ${currentPost.tags.map(tag => `<span class="detail-tag">#${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
      <div class="detail-stats">
        <span>${formatNumber(currentPost.likes || 0)} 点赞</span>
        <span>${formatNumber(currentPost.comments || 0)} 评论</span>
      </div>
    `;

    if (currentPost.liked) {
      elements.likeBtn.classList.add('active');
      elements.likeBtn.querySelector('.btn-icon').textContent = '♥';
      document.getElementById('like-text').textContent = formatNumber(currentPost.likes || 0);
    }
    if (currentPost.collected) {
      elements.collectBtn.classList.add('active');
      elements.collectBtn.querySelector('.btn-icon').textContent = '⭐';
    }
  }

  /* ---------- Comments ---------- */
  async function loadComments() {
    const modelConfig = getInterfaceModel();
    if (!modelConfig) {
      elements.commentsList.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">评论加载失败</p>';
      return;
    }

    const style = getCustomStyle();
    const commentCount = (style && style.commentCount) ? parseInt(style.commentCount) || 20 : Math.floor(Math.random() * 30) + 20;

    let styleHint = '';
    if (style) {
      const parts = [];
      if (style.narrative) parts.push(`叙事风格偏好：${style.narrative}`);
      if (style.topic) parts.push(`讨论主题偏好：${style.topic}`);
      if (parts.length) styleHint = '\n评论风格参考：\n' + parts.join('\n');
    }

    const prompt = `为以下帖子生成${commentCount}条真实、有网感的评论。

原帖标题：${currentPost.title}
原帖内容：${currentPost.fullContent}
${styleHint}

内容要求：
1. 符合年轻网友口吻：
   - 语气词：hhh/救命/绷不住了/awsl/yyds/真的会谢
   - emoji、颜文字、网络梗
   - 缩写：xswl/u1s1/nsdd
2. 评论可以互相呼应、形成对话
3. 长短搭配：有一句话的，也有展开说的
4. 时间随机分布
5. 评论间可能形成：骂战/互怼、接梗/玩梗、暖心互动、歪楼跑题、求后续

返回JSON数组，每条包含：
- username: 用户名（活泼网名）
- avatar: 单个emoji
- content: 评论内容（10-150字）
- time: 随机时间（刚刚/X分钟前/X小时前/X天前）

直接返回JSON数组，无需其他说明。`;

    try {
      const content = await callLLM([{ role: 'user', content: prompt }], { modelConfig, temperature: 1.0, max_tokens: 4000 });

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        allComments = JSON.parse(jsonMatch[0]);
        document.getElementById('comment-count').textContent = allComments.length;
        renderComments(COMMENTS_PER_LOAD);
      } else {
        throw new Error('无法解析评论');
      }
    } catch (error) {
      console.error('生成评论失败:', error);
      elements.commentsList.innerHTML = `<p style="text-align:center;color:#999;padding:40px;">评论加载失败: ${error.message}</p>`;
    }
  }

  function renderComments(count) {
    elements.commentsList.innerHTML = '';

    const commentsToShow = allComments.slice(0, displayedComments + count);
    displayedComments = commentsToShow.length;

    commentsToShow.forEach(comment => {
      const commentEl = document.createElement('div');
      commentEl.className = 'comment-item';
      const avatarGradient = getRandomAvatarGradient();
      commentEl.innerHTML = `
        <div class="comment-avatar clickable-avatar" style="background: ${avatarGradient}" data-username="${escapeHtml(comment.username)}" data-avatar="${escapeHtml(comment.avatar || '👤')}">${comment.avatar || '👤'}</div>
        <div class="comment-body">
          <div class="comment-username">${escapeHtml(comment.username)}</div>
          <div class="comment-text">${escapeHtml(comment.content)}</div>
          <div class="comment-time">${comment.time}</div>
        </div>
      `;
      elements.commentsList.appendChild(commentEl);
    });

    if (displayedComments < allComments.length) {
      document.getElementById('load-more-comments').style.display = 'block';
      elements.endMessage.style.display = 'none';
    } else {
      document.getElementById('load-more-comments').style.display = 'none';
      elements.endMessage.style.display = 'block';
    }
  }

  function loadMoreComments() {
    if (isLoading) return;
    isLoading = true;
    elements.loadMoreBtn.disabled = true;
    elements.loadMoreBtn.textContent = '加载中...';

    setTimeout(() => {
      renderComments(COMMENTS_PER_LOAD);
      isLoading = false;
      elements.loadMoreBtn.disabled = false;
      elements.loadMoreBtn.textContent = '加载更多评论';
    }, 500);
  }

  /* ---------- Actions ---------- */
  function handleLike() {
    currentPost.liked = !currentPost.liked;
    currentPost.likes = currentPost.liked ? (currentPost.likes || 0) + 1 : Math.max(0, (currentPost.likes || 1) - 1);

    elements.likeBtn.classList.toggle('active', currentPost.liked);
    elements.likeBtn.querySelector('.btn-icon').textContent = currentPost.liked ? '♥' : '♡';
    document.getElementById('like-text').textContent = currentPost.liked ? formatNumber(currentPost.likes) : '点赞';

    showToast(currentPost.liked ? '已点赞 ❤️' : '已取消点赞');

    const statsEl = elements.postDetail.querySelector('.detail-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <span>${formatNumber(currentPost.likes || 0)} 点赞</span>
        <span>${formatNumber(currentPost.comments || 0)} 评论</span>
      `;
    }
  }

  function handleCollect() {
    currentPost.collected = !currentPost.collected;
    elements.collectBtn.classList.toggle('active', currentPost.collected);
    elements.collectBtn.querySelector('.btn-icon').textContent = currentPost.collected ? '⭐' : '☆';
    showToast(currentPost.collected ? '已收藏 ⭐' : '已取消收藏');
  }

  function handleShare() {
    showToast('分享功能开发中...');
  }

  function sendComment() {
    const text = elements.commentInput.value.trim();
    if (!text) { showToast('请输入评论内容'); return; }

    const userComment = {
      username: '游客',
      avatar: '👤',
      content: text,
      time: '刚刚'
    };

    allComments.unshift(userComment);
    displayedComments++;
    document.getElementById('comment-count').textContent = allComments.length;
    renderComments(0);
    elements.commentInput.value = '';
    showToast('评论成功！');
  }

  /* ---------- Utilities ---------- */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatNumber(num) {
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  }

  function showToast(message) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    setTimeout(() => elements.toast.classList.remove('show'), 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
