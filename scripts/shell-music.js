// scripts/shell-music.js
// Shell层全局音乐控制器 - 统一管理所有音乐播放（主题同步版）

(function() {
  'use strict';

  // ==================== 常量 ====================
  const PLAYLIST_KEY = 'my_music_playlist_v3';
  const STATE_KEY = 'global_music_state';
  const ENABLED_KEY = 'global_music_enabled';
  const MODE_KEY = 'my_music_playmode';
  const DB_NAME = 'MusicPlayerDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'audioFiles';

  // ==================== 主题颜色配置 ====================
  const themeColors = {
    pink:   { topbar: "#f8cbd0" },
    blue:   { topbar: "#a7c8f2" },
    green:  { topbar: "#b8d6a2" },
    yellow: { topbar: "#f7d26d" },
    purple: { topbar: "#c3b0e6" },
    black:  { topbar: "#333333" }
  };

  // ==================== 状态变量 ====================
  let db = null;
  let audioPlayer = null;
  let playlist = [];
  let currentIndex = -1;
  let playMode = 'list';
  const sessionBlobs = {};

  // UI元素
  let floatContainer = null;
  let floatMini = null;
  let floatPanel = null;
  let panelVisible = false;

  // iframe 引用
  let contentFrame = null;

  // ==================== 主题工具函数 ====================
  function shadeColor(hex, percent) {
    if (!hex) return hex;
    try {
      if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }
      const r = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (100 + percent) / 100)));
      const g = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (100 + percent) / 100)));
      const b = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (100 + percent) / 100)));
      return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      return hex;
    }
  }

  function hexToRgba(hex, alpha) {
    if (!hex) return 'rgba(248,203,208,' + alpha + ')';
    try {
      if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    } catch (e) {
      return 'rgba(248,203,208,' + alpha + ')';
    }
  }

  function getCurrentColor() {
    const customBtnColor = localStorage.getItem('buttonColor');
    if (customBtnColor) {
      return customBtnColor;
    }
    const themeName = localStorage.getItem('theme') || 'pink';
    const t = themeColors[themeName] || themeColors.pink;
    return t.topbar;
  }

  function applyThemeToFloat() {
    const color = getCurrentColor();
    const hoverColor = shadeColor(color, -12);
    const activeColor = shadeColor(color, -22);
    const glowColor = hexToRgba(color, 0.7);
    const bgLightColor = hexToRgba(color, 0.2);

    const root = document.documentElement;
    root.style.setProperty('--float-btn-color', color);
    root.style.setProperty('--float-btn-hover', hoverColor);
    root.style.setProperty('--float-btn-active', activeColor);
    root.style.setProperty('--float-glow-color', glowColor);
    root.style.setProperty('--float-bg-light', bgLightColor);

    console.log('[ShellMusic] Theme applied:', color);
  }

  // ==================== IndexedDB ====================
  function openDB() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { db = request.result; resolve(db); };
      request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  function getAudioFromDB(id) {
    return openDB().then(database => {
      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result ? request.result.blob : null);
        request.onerror = () => reject(request.error);
      });
    });
  }

  // ==================== 状态管理 ====================
  function saveState() {
    if (!audioPlayer) return;
    const state = {
      currentIndex: currentIndex,
      currentTime: audioPlayer.currentTime || 0,
      isPlaying: !audioPlayer.paused,
      volume: audioPlayer.volume,
      timestamp: Date.now()
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) {
      return null;
    }
  }

  function loadPlaylist() {
    try {
      const raw = localStorage.getItem(PLAYLIST_KEY);
      playlist = raw ? JSON.parse(raw) : [];
    } catch(e) {
      playlist = [];
    }
  }

  function loadPlayMode() {
    try {
      const raw = localStorage.getItem(MODE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        playMode = data.mode || 'list';
      }
    } catch(e) {
      playMode = 'list';
    }
  }

  function isEnabled() {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  }

  // ==================== 加载本地文件 ====================
  function loadLocalFiles() {
    const promises = [];
    playlist.forEach(item => {
      if (item.type === 'file' && !sessionBlobs[item.id]) {
        const p = getAudioFromDB(item.id).then(blob => {
          if (blob) {
            sessionBlobs[item.id] = URL.createObjectURL(blob);
          }
        }).catch(e => {
          console.warn('[ShellMusic] Failed to load audio:', item.id, e);
        });
        promises.push(p);
      }
    });
    return Promise.all(promises);
  }

  // ==================== 播放控制 ====================
  function getTrackSource(item) {
    if (!item) return null;
    if (item.type === 'url') {
      return item.url;
    } else if (item.type === 'file') {
      return sessionBlobs[item.id] || null;
    }
    return null;
  }

  function playTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    
    const item = playlist[index];
    const src = getTrackSource(item);
    
    if (!src) {
      console.warn('[ShellMusic] Audio source not available:', item.id);
      showToast('音频加载失败');
      return;
    }
    
    currentIndex = index;
    
    if (audioPlayer) {
      audioPlayer.src = src;
      audioPlayer.play().then(() => {
        saveState();
        updateUI();
        notifyIframe('shell:playing', { index, name: item.name });
        showToast('正在播放: ' + item.name);
      }).catch(e => {
        console.warn('[ShellMusic] Play failed:', e);
        showToast('播放失败');
      });
    }
  }

  function togglePlay() {
    if (!audioPlayer) return;
    
    if (audioPlayer.paused) {
      if (currentIndex < 0 && playlist.length > 0) {
        playTrack(0);
      } else if (audioPlayer.src) {
        audioPlayer.play().catch(() => {});
      } else if (currentIndex >= 0) {
        playTrack(currentIndex);
      }
    } else {
      audioPlayer.pause();
    }
  }

  function playNext() {
    if (!playlist.length) return;
    
    let next;
    switch(playMode) {
      case 'single':
        next = currentIndex >= 0 ? currentIndex : 0;
        if (audioPlayer) {
          audioPlayer.currentTime = 0;
          audioPlayer.play().catch(() => {});
        }
        return;
      case 'random':
        if (playlist.length === 1) {
          next = 0;
        } else {
          do {
            next = Math.floor(Math.random() * playlist.length);
          } while (next === currentIndex && playlist.length > 1);
        }
        break;
      case 'loop':
      case 'custom':
        next = (currentIndex + 1) % playlist.length;
        break;
      default:
        next = currentIndex + 1;
        if (next >= playlist.length) {
          showToast('播放列表已结束');
          return;
        }
    }
    playTrack(next);
  }

  function playPrev() {
    if (!playlist.length) return;
    const prev = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(prev);
  }

  function seekTo(time) {
    if (audioPlayer && audioPlayer.duration) {
      audioPlayer.currentTime = Math.max(0, Math.min(time, audioPlayer.duration));
      saveState();
    }
  }

  function setVolume(vol) {
    if (audioPlayer) {
      audioPlayer.volume = Math.max(0, Math.min(1, vol));
      saveState();
    }
  }

  // ==================== iframe 通信 ====================
  function setContentFrame(frame) {
    contentFrame = frame;
  }

  function notifyIframe(type, data) {
    if (contentFrame && contentFrame.contentWindow) {
      contentFrame.contentWindow.postMessage({ type, ...data }, '*');
    }
  }

  function sendStateToIframe() {
    const state = {
      currentIndex,
      currentTime: audioPlayer ? audioPlayer.currentTime : 0,
      duration: audioPlayer ? audioPlayer.duration : 0,
      isPlaying: audioPlayer ? !audioPlayer.paused : false,
      volume: audioPlayer ? audioPlayer.volume : 0.8,
      trackName: currentIndex >= 0 && playlist[currentIndex] ? playlist[currentIndex].name : ''
    };
    notifyIframe('shell:state', state);
  }

  function handleIframeMessage(event) {
    const data = event.data;
    if (!data || !data.type) return;

    console.log('[ShellMusic] Received message:', data.type, data);

    switch(data.type) {
      case 'music:play':
        if (data.index !== undefined) {
          playTrack(data.index);
        } else {
          togglePlay();
        }
        break;
      case 'music:pause':
        if (audioPlayer && !audioPlayer.paused) {
          audioPlayer.pause();
        }
        break;
      case 'music:next':
        playNext();
        break;
      case 'music:prev':
        playPrev();
        break;
      case 'music:seek':
        if (data.time !== undefined) {
          seekTo(data.time);
        }
        break;
      case 'music:seekPercent':
        if (data.percent !== undefined && audioPlayer && audioPlayer.duration) {
          seekTo(data.percent * audioPlayer.duration);
        }
        break;
      case 'music:volume':
        if (data.volume !== undefined) {
          setVolume(data.volume);
        }
        break;
      case 'music:setMode':
        if (data.mode) {
          playMode = data.mode;
        }
        break;
      case 'music:enableFloat':
        localStorage.setItem(ENABLED_KEY, 'true');
        if (!floatContainer) {
          createFloatUI();
          restorePosition();
        }
        updateUI();
        break;
      case 'music:disableFloat':
        localStorage.setItem(ENABLED_KEY, 'false');
        if (floatContainer) {
          hideFloat();
        }
        break;
      case 'music:reloadPlaylist':
        loadPlaylist();
        loadLocalFiles().then(() => {
          updatePlaylistUI();
        });
        break;
      case 'music:getState':
        sendStateToIframe();
        break;
      case 'navigate':
        if (data.url && contentFrame) {
          contentFrame.src = data.url;
        }
        break;
    }
  }

  // ==================== Toast ====================
  function showToast(message, duration) {
    duration = duration || 2000;
    let toast = document.querySelector('.shell-music-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'shell-music-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, duration);
  }

  // ==================== UI创建 ====================
  function createFloatUI() {
    if (floatContainer) return;
    
    // 先应用主题
    applyThemeToFloat();
    
    floatContainer = document.createElement('div');
    floatContainer.className = 'music-float';
    floatContainer.id = 'shell-music-float';
    
    floatMini = document.createElement('button');
    floatMini.className = 'music-float-mini';
    floatMini.innerHTML = '🎵';
    floatMini.title = '点击展开音乐控制';
    
    floatPanel = document.createElement('div');
    floatPanel.className = 'music-float-panel';
    floatPanel.innerHTML = `
      <div class="mfp-header">
        <span class="mfp-header-title">🎵 音乐播放器</span>
        <div class="mfp-header-btns">
          <button class="mfp-header-btn mfp-minimize" title="收起">−</button>
          <button class="mfp-header-btn mfp-close" title="关闭悬浮球">×</button>
        </div>
      </div>
      <div class="mfp-track">
        <div class="mfp-track-name">未播放</div>
      </div>
      <div class="mfp-progress">
        <div class="mfp-progress-bar">
          <div class="mfp-progress-fill"></div>
        </div>
        <div class="mfp-time">
          <span class="mfp-current">0:00</span>
          <span class="mfp-total">0:00</span>
        </div>
      </div>
      <div class="mfp-controls">
        <button class="mfp-ctrl-btn mfp-prev" title="上一首">⏮️</button>
        <button class="mfp-ctrl-btn main mfp-play" title="播放/暂停">▶️</button>
        <button class="mfp-ctrl-btn mfp-next" title="下一首">⏭️</button>
      </div>
      <div class="mfp-playlist"></div>
    `;
    
    floatContainer.appendChild(floatMini);
    floatContainer.appendChild(floatPanel);
    document.body.appendChild(floatContainer);
    
    bindFloatEvents();
    makeDraggable();
  }

  function bindFloatEvents() {
    floatMini.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });
    
    const minimizeBtn = floatPanel.querySelector('.mfp-minimize');
    const closeBtn = floatPanel.querySelector('.mfp-close');
    const prevBtn = floatPanel.querySelector('.mfp-prev');
    const playBtn = floatPanel.querySelector('.mfp-play');
    const nextBtn = floatPanel.querySelector('.mfp-next');
    const progressBar = floatPanel.querySelector('.mfp-progress-bar');
    
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hidePanel();
    });
    
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeFloat();
    });
    
    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playPrev();
    });
    
    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });
    
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playNext();
    });
    
    progressBar.addEventListener('click', (e) => {
      if (!audioPlayer || !audioPlayer.duration) return;
      const rect = progressBar.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audioPlayer.currentTime = percent * audioPlayer.duration;
      saveState();
    });
    
    document.addEventListener('click', (e) => {
      if (panelVisible && floatContainer && !floatContainer.contains(e.target)) {
        hidePanel();
      }
    });
  }

  function makeDraggable() {
    let isDragging = false;
    let startX, startY, initialX, initialY;
    
    floatMini.addEventListener('mousedown', startDrag);
    floatMini.addEventListener('touchstart', startDrag, { passive: false });
    
    function startDrag(e) {
      if (e.type === 'mousedown' && e.button !== 0) return;
      
      const touch = e.touches ? e.touches[0] : e;
      startX = touch.clientX;
      startY = touch.clientY;
      
      const rect = floatContainer.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;
      
      isDragging = false;
      
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchmove', onDrag, { passive: false });
      document.addEventListener('touchend', endDrag);
    }
    
    function onDrag(e) {
      const touch = e.touches ? e.touches[0] : e;
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        isDragging = true;
        floatContainer.classList.add('dragging');
        
        let newX = initialX + deltaX;
        let newY = initialY + deltaY;
        
        const maxX = window.innerWidth - floatMini.offsetWidth;
        const maxY = window.innerHeight - floatMini.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        floatContainer.style.left = newX + 'px';
        floatContainer.style.right = 'auto';
        floatContainer.style.top = newY + 'px';
        floatContainer.style.bottom = 'auto';
        
        e.preventDefault();
      }
    }
    
    function endDrag(e) {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', endDrag);
      document.removeEventListener('touchmove', onDrag);
      document.removeEventListener('touchend', endDrag);
      
      floatContainer.classList.remove('dragging');
      
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = floatContainer.getBoundingClientRect();
        localStorage.setItem('music_float_position', JSON.stringify({
          left: rect.left,
          top: rect.top
        }));
      }
      
      isDragging = false;
    }
  }

  function restorePosition() {
    try {
      const pos = JSON.parse(localStorage.getItem('music_float_position'));
      if (pos && floatContainer) {
        floatContainer.style.left = pos.left + 'px';
        floatContainer.style.right = 'auto';
        floatContainer.style.top = pos.top + 'px';
        floatContainer.style.bottom = 'auto';
      }
    } catch(e) {}
  }

  function togglePanel() {
    if (panelVisible) {
      hidePanel();
    } else {
      showPanel();
    }
  }

  function showPanel() {
    panelVisible = true;
    floatPanel.classList.add('active');
    updatePlaylistUI();
  }

  function hidePanel() {
    panelVisible = false;
    floatPanel.classList.remove('active');
  }

  function hideFloat() {
    if (floatContainer) {
      floatContainer.style.display = 'none';
    }
  }

  function showFloat() {
    if (floatContainer) {
      floatContainer.style.display = 'block';
    }
  }

  function closeFloat() {
    localStorage.setItem(ENABLED_KEY, 'false');
    hideFloat();
    showToast('悬浮球已关闭，可在音乐页面重新开启');
  }

  // ==================== UI更新 ====================
  function updateUI() {
    if (!floatPanel) return;
    
    const trackName = floatPanel.querySelector('.mfp-track-name');
    const playBtn = floatPanel.querySelector('.mfp-play');
    
    if (currentIndex >= 0 && currentIndex < playlist.length) {
      trackName.textContent = playlist[currentIndex].name;
    } else {
      trackName.textContent = '未播放';
    }
    
    if (audioPlayer) {
      playBtn.textContent = audioPlayer.paused ? '▶️' : '⏸️';
    }
    
    if (floatMini && audioPlayer) {
      if (!audioPlayer.paused) {
        floatMini.classList.add('playing');
      } else {
        floatMini.classList.remove('playing');
      }
    }
    
    updatePlaylistUI();
  }

  function updateProgress() {
    if (!audioPlayer) return;
    
    const current = audioPlayer.currentTime || 0;
    const duration = audioPlayer.duration || 0;
    
    // 更新悬浮球进度
    if (floatPanel) {
      const fill = floatPanel.querySelector('.mfp-progress-fill');
      const currentEl = floatPanel.querySelector('.mfp-current');
      const totalEl = floatPanel.querySelector('.mfp-total');
      
      if (currentEl) currentEl.textContent = formatTime(current);
      if (totalEl) totalEl.textContent = formatTime(duration);
      if (fill && duration > 0) {
        fill.style.width = (current / duration * 100) + '%';
      }
    }
    
    // 通知 iframe 进度更新
    notifyIframe('shell:progress', { current, duration });
  }

  function updatePlaylistUI() {
    if (!floatPanel) return;
    
    const container = floatPanel.querySelector('.mfp-playlist');
    if (!container) return;
    
    if (!playlist.length) {
      container.innerHTML = `
        <div class="mfp-empty">
          <div class="mfp-empty-icon">🎵</div>
          <p>播放列表为空</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    playlist.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'mfp-playlist-item';
      if (idx === currentIndex) div.classList.add('active');
      
      div.innerHTML = `
        <span class="mfp-pl-index">${idx + 1}</span>
        <span class="mfp-pl-name" title="${item.name}">${item.name}</span>
        <span class="mfp-pl-type">${item.type === 'url' ? '网络' : '本地'}</span>
      `;
      
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        playTrack(idx);
      });
      container.appendChild(div);
    });
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + secs.toString().padStart(2, '0');
  }

  // ==================== 初始化 ====================
  function init() {
    console.log('[ShellMusic] Initializing...');
    
    // 先应用主题
    applyThemeToFloat();
    
    // 创建全局唯一的 audio 元素
    audioPlayer = document.createElement('audio');
    audioPlayer.id = 'shell-audio-player';
    audioPlayer.preload = 'auto';
    document.body.appendChild(audioPlayer);
    
    // 绑定 audio 事件
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', playNext);
    audioPlayer.addEventListener('play', () => {
      saveState();
      updateUI();
      notifyIframe('shell:play', { index: currentIndex });
    });
    audioPlayer.addEventListener('pause', () => {
      saveState();
      updateUI();
      notifyIframe('shell:pause', {});
    });
    audioPlayer.addEventListener('loadedmetadata', updateProgress);
    
    // 加载数据
    loadPlaylist();
    loadPlayMode();
    
    // 加载本地文件
    loadLocalFiles().then(() => {
      // 如果启用了悬浮球，创建UI
      if (isEnabled()) {
        createFloatUI();
        restorePosition();
      }
      
      // 恢复播放状态
      const state = loadState();
      if (state && audioPlayer) {
        currentIndex = state.currentIndex;
        audioPlayer.volume = state.volume || 0.8;
        
        if (state.isPlaying && currentIndex >= 0 && currentIndex < playlist.length) {
          const item = playlist[currentIndex];
          const src = getTrackSource(item);
          
          if (src) {
            audioPlayer.src = src;
            audioPlayer.addEventListener('loadedmetadata', function onLoaded() {
              audioPlayer.removeEventListener('loadedmetadata', onLoaded);
              if (state.currentTime) {
                audioPlayer.currentTime = Math.max(0, state.currentTime - 0.5);
              }
              audioPlayer.play().catch(e => {
                console.log('[ShellMusic] Auto-play blocked:', e);
              });
            });
            audioPlayer.load();
          }
        }
        
        updateUI();
      }
      
      console.log('[ShellMusic] Initialized successfully');
    });
    
    // 监听 iframe 消息
    window.addEventListener('message', handleIframeMessage);
    
    // 页面卸载时保存状态
    window.addEventListener('beforeunload', saveState);
    
    // 监听 storage 变化
    window.addEventListener('storage', (e) => {
      if (e.key === PLAYLIST_KEY) {
        loadPlaylist();
        loadLocalFiles().then(() => {
          updatePlaylistUI();
        });
      }
      if (e.key === MODE_KEY) {
        loadPlayMode();
      }
      if (e.key === ENABLED_KEY) {
        if (e.newValue === 'true') {
          if (!floatContainer) {
            createFloatUI();
            restorePosition();
          } else {
            showFloat();
          }
        } else {
          hideFloat();
        }
      }
      // 监听主题变化
      if (e.key === 'theme' || e.key === 'buttonColor') {
        applyThemeToFloat();
      }
    });
  }

  // 暴露给 shell.html 使用
  window.ShellMusicController = {
    init,
    setContentFrame,
    isEnabled,
    applyTheme: applyThemeToFloat  // 暴露主题应用方法
  };

})();
