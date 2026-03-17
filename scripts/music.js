// scripts/music.js
// 音乐播放器 - 与 Shell 层通信版本

(function() {
  'use strict';

  /* -------------------- 环境检测 -------------------- */
  const isInShell = window.parent !== window;

  /* -------------------- 主题相关 -------------------- */
  const themeColors = {
    pink:   { topbar:"#f8cbd0", bg: 'url("https://iili.io/KYiqrVj.webp")' },
    blue:   { topbar:"#a7c8f2", bg: 'url("images/blue.jpg")' },
    green:  { topbar:"#b8d6a2", bg: 'url("images/green.jpg")' },
    yellow: { topbar:"#f7d26d", bg: 'url("images/yellow.jpg")' },
    purple: { topbar:"#c3b0e6", bg: 'url("images/purple.jpg")' },
    black:  { topbar:"#333333", bg: 'url("images/black.jpg")' }
  };

  function shadeColor(hex, percent) {
    try {
      if (!hex) return hex;
      if (hex.length === 4) hex = '#' + hex[1]+hex[1] + hex[2]+hex[2] + hex[3]+hex[3];
      const r = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(1,3),16) * (100 + percent) / 100)));
      const g = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(3,5),16) * (100 + percent) / 100)));
      const b = Math.min(255, Math.max(0, Math.round(parseInt(hex.slice(5,7),16) * (100 + percent) / 100)));
      return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
    } catch (e) { return hex; }
  }

  function applyThemeFromName(themeName) {
    const t = themeColors[themeName] || themeColors.pink;
    const root = document.documentElement;
    const customBtnColor = localStorage.getItem('buttonColor');
    const color = customBtnColor || t.topbar;
    
    root.style.setProperty('--topbar-color', color);
    root.style.setProperty('--btn-color', color);
    root.style.setProperty('--btn-hover', shadeColor(color, -12));
    root.style.setProperty('--btn-active', shadeColor(color, -22));
    root.style.setProperty('--progress-fill', color);
    root.style.setProperty('--bg-image', t.bg || 'none');

    const top = document.querySelector('.topbar');
    if (top) top.style.background = color;
  }

  function loadCustomButtonColor() {
    const savedColor = localStorage.getItem('buttonColor');
    if (savedColor) {
      const root = document.documentElement;
      root.style.setProperty('--topbar-color', savedColor);
      root.style.setProperty('--btn-color', savedColor);
      root.style.setProperty('--btn-hover', shadeColor(savedColor, -12));
      root.style.setProperty('--btn-active', shadeColor(savedColor, -22));
      root.style.setProperty('--progress-fill', savedColor);
      
      const top = document.querySelector('.topbar');
      if (top) top.style.background = savedColor;
    }
  }

  function loadCustomCSS() {
    let styleEl = document.getElementById('custom-user-css');
    if (styleEl) styleEl.remove();
    const enabled = localStorage.getItem('customCSSEnabled');
    if (enabled !== 'true') return;
    const savedCSS = localStorage.getItem('customCSS');
    if (savedCSS && savedCSS.trim()) {
      styleEl = document.createElement('style');
      styleEl.id = 'custom-user-css';
      styleEl.textContent = savedCSS;
      document.head.appendChild(styleEl);
    }
  }

  window.addEventListener('storage', function(e) {
    if (e.key === 'theme') applyThemeFromName(e.newValue || 'pink');
    if (e.key === 'buttonColor') {
      if (e.newValue) loadCustomButtonColor();
      else applyThemeFromName(localStorage.getItem('theme') || 'pink');
    }
    if (e.key === 'customCSS' || e.key === 'customCSSEnabled' || e.key === 'cssToggleSync') {
      loadCustomCSS();
    }
  });

  /* -------------------- IndexedDB -------------------- */
  const DB_NAME = 'MusicPlayerDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'audioFiles';
  const STORAGE_KEY = 'my_music_playlist_v3';
  const MODE_KEY = 'my_music_playmode';
  const STATE_KEY = 'global_music_state';
  const ENABLED_KEY = 'global_music_enabled';

  let db = null;

  function openDB() {
    return new Promise(function(resolve, reject) {
      if (db) { resolve(db); return; }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = function() { reject(request.error); };
      request.onsuccess = function() { db = request.result; resolve(db); };
      request.onupgradeneeded = function(e) {
        const database = e.target.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  function saveAudioToDB(id, blob) {
    return openDB().then(function(database) {
      return new Promise(function(resolve, reject) {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({ id: id, blob: blob });
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }

  function getAudioFromDB(id) {
    return openDB().then(function(database) {
      return new Promise(function(resolve, reject) {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = function() { resolve(request.result ? request.result.blob : null); };
        request.onerror = function() { reject(request.error); };
      });
    });
  }

  function deleteAudioFromDB(id) {
    return openDB().then(function(database) {
      return new Promise(function(resolve, reject) {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { reject(tx.error); };
      });
    });
  }

  /* -------------------- 播放器核心 -------------------- */
  let audioPlayer = null;  // 仅在独立模式下使用
  let trackTitle = null;
  let trackArtist = null;
  let prevBtn = null;
  let playBtn = null;
  let nextBtn = null;
  let fileInput = null;
  let playlistEl = null;
  let addUrlBtn = null;
  let playModeSelect = null;
  let progressBar = null;
  let progressFill = null;
  let progressHandle = null;
  let currentTimeEl = null;
  let totalTimeEl = null;
  let volumeSlider = null;
  let volumeIcon = null;
  let volumeValue = null;
  let playlistCount = null;
  let clearAllBtn = null;
  let saveOrderBtn = null;
  let dragHint = null;
  let floatToggleBtn = null;

  let playlist = [];
  let currentIndex = -1;
  let playMode = 'list';
  let playHistory = [];
  const sessionBlobs = {};

  // Shell 模式下的状态
  let shellState = {
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    volume: 0.8
  };

  function uid() { 
    return Date.now().toString(36) + Math.random().toString(36).slice(2,8); 
  }

  /* -------------------- Toast -------------------- */
  function showToast(message, duration) {
    duration = duration || 2000;
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, duration);
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + secs.toString().padStart(2, '0');
  }

  /* -------------------- Shell 通信 -------------------- */
  function sendToShell(type, data) {
    if (isInShell) {
      try {
        window.parent.postMessage({ type: type, ...(data || {}) }, '*');
      } catch(e) {
        console.warn('[MusicPage] Failed to send message to shell:', e);
      }
    }
  }

  function handleShellMessage(event) {
    const data = event.data;
    if (!data || !data.type) return;

    switch(data.type) {
      case 'shell:state':
        shellState.currentTime = data.currentTime || 0;
        shellState.duration = data.duration || 0;
        shellState.isPlaying = data.isPlaying || false;
        shellState.volume = data.volume || 0.8;
        if (data.currentIndex !== undefined && data.currentIndex >= 0) {
          currentIndex = data.currentIndex;
          if (trackTitle && playlist[currentIndex]) {
            trackTitle.textContent = playlist[currentIndex].name;
          }
          renderPlaylist();
        }
        updateProgressFromShell();
        updatePlayButtonState();
        break;

      case 'shell:progress':
        shellState.currentTime = data.current || 0;
        shellState.duration = data.duration || 0;
        updateProgressFromShell();
        break;

      case 'shell:play':
      case 'shell:playing':
        shellState.isPlaying = true;
        if (data.index !== undefined && data.index >= 0) {
          currentIndex = data.index;
          if (trackTitle && data.name) {
            trackTitle.textContent = data.name;
          } else if (trackTitle && playlist[currentIndex]) {
            trackTitle.textContent = playlist[currentIndex].name;
          }
          renderPlaylist();
        }
        updatePlayButtonState();
        if (data.name) {
          showToast('正在播放: ' + data.name);
        }
        break;

      case 'shell:pause':
        shellState.isPlaying = false;
        updatePlayButtonState();
        break;
    }
  }

  function updateProgressFromShell() {
    if (currentTimeEl) currentTimeEl.textContent = formatTime(shellState.currentTime);
    if (totalTimeEl) totalTimeEl.textContent = formatTime(shellState.duration);
    
    if (progressFill && progressHandle && shellState.duration > 0) {
      const percent = (shellState.currentTime / shellState.duration) * 100;
      progressFill.style.width = percent + '%';
      progressHandle.style.left = percent + '%';
    }
  }

  function updatePlayButtonState() {
    if (!playBtn) return;
    
    if (isInShell) {
      playBtn.textContent = shellState.isPlaying ? '⏸️' : '▶️';
    } else if (audioPlayer) {
      playBtn.textContent = audioPlayer.paused ? '▶️' : '⏸️';
    }
  }

  /* -------------------- 状态同步（独立模式）-------------------- */
  function saveGlobalState() {
    if (!audioPlayer || isInShell) return;
    const item = playlist[currentIndex];
    const state = {
      currentIndex: currentIndex,
      currentTime: audioPlayer.currentTime || 0,
      isPlaying: !audioPlayer.paused,
      volume: audioPlayer.volume,
      trackName: item ? item.name : '',
      timestamp: Date.now()
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }

  /* -------------------- 存储操作 -------------------- */
  function savePlaylistMeta() {
    const serial = playlist.map(function(it) {
      return {
        id: it.id,
        name: it.name,
        type: it.type,
        url: it.type === 'url' ? it.url : null
      };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serial));
    
    // 通知 shell 重新加载播放列表
    if (isInShell) {
      sendToShell('music:reloadPlaylist');
    }
  }

  function savePlayMode() {
    localStorage.setItem(MODE_KEY, JSON.stringify({ mode: playMode }));
    if (isInShell) {
      sendToShell('music:setMode', { mode: playMode });
    }
  }

  function loadPlaylistMeta() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const arr = JSON.parse(raw);
      playlist = arr.map(function(it) {
        return {
          id: it.id || uid(),
          name: it.name || 'unknown',
          type: it.type || 'url',
          url: it.url || null
        };
      });
    } catch (e) {
      console.warn('Failed to parse playlist meta', e);
      playlist = [];
    }
  }

  function loadPlayMode() {
    const raw = localStorage.getItem(MODE_KEY);
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      playMode = data.mode || 'list';
      if (playModeSelect) playModeSelect.value = playMode;
    } catch (e) {
      console.warn('Failed to parse play mode', e);
    }
  }

  function loadLocalFilesFromDB() {
    const promises = [];
    playlist.forEach(function(item) {
      if (item.type === 'file') {
        const p = getAudioFromDB(item.id).then(function(blob) {
          if (blob) {
            sessionBlobs[item.id] = URL.createObjectURL(blob);
          }
        }).catch(function(e) {
          console.warn('Failed to load audio from DB:', item.id, e);
        });
        promises.push(p);
      }
    });
    return Promise.all(promises);
  }

  /* -------------------- 悬浮球控制 -------------------- */
  function isFloatEnabled() {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  }

  function toggleFloatEnabled() {
    const enabled = isFloatEnabled();
    const newEnabled = !enabled;
    localStorage.setItem(ENABLED_KEY, newEnabled ? 'true' : 'false');
    updateFloatToggleButton();
    
    if (isInShell) {
      sendToShell(newEnabled ? 'music:enableFloat' : 'music:disableFloat');
    }
    
    if (newEnabled) {
      showToast('悬浮球已开启，返回主界面可见');
    } else {
      showToast('悬浮球已关闭');
    }
  }

  function updateFloatToggleButton() {
    if (!floatToggleBtn) return;
    const enabled = isFloatEnabled();
    floatToggleBtn.textContent = enabled ? '🎵 悬浮球: 开' : '🎵 悬浮球: 关';
    floatToggleBtn.classList.toggle('active', enabled);
  }

  /* -------------------- 重命名歌曲 -------------------- */
  function renameEntry(index) {
    const item = playlist[index];
    if (!item) return;
    
    const currentName = item.name;
    const newName = window.prompt('请输入新的歌曲名称：', currentName);
    
    if (newName === null) return;
    
    const trimmedName = newName.trim();
    if (!trimmedName) {
      showToast('名称不能为空');
      return;
    }
    
    if (trimmedName === currentName) return;
    
    item.name = trimmedName;
    savePlaylistMeta();
    renderPlaylist();
    
    if (index === currentIndex && trackTitle) {
      trackTitle.textContent = trimmedName;
    }
    
    showToast('已重命名为: ' + trimmedName);
  }

  /* -------------------- 渲染播放列表 -------------------- */
  function renderPlaylist() {
    if (!playlistEl) return;
    playlistEl.innerHTML = '';
    
    if (playlistCount) playlistCount.textContent = playlist.length;
    
    const isCustomMode = playMode === 'custom';
    if (dragHint) dragHint.style.display = isCustomMode ? 'block' : 'none';
    if (saveOrderBtn) saveOrderBtn.style.display = isCustomMode ? 'inline-block' : 'none';

    const isPlaying = isInShell ? shellState.isPlaying : (audioPlayer && !audioPlayer.paused);

    playlist.forEach(function(item, idx) {
      const li = document.createElement('li');
      li.className = 'playlist-item';
      if (idx === currentIndex) li.classList.add('active');
      li.dataset.index = idx;
      li.draggable = isCustomMode;

      const left = document.createElement('div');
      left.className = 'item-left';

      if (isCustomMode) {
        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.textContent = '☰';
        left.appendChild(dragHandle);
      }

      const indexSpan = document.createElement('span');
      indexSpan.className = 'item-index';
      indexSpan.textContent = (idx + 1) + '.';
      left.appendChild(indexSpan);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'item-name';
      nameSpan.textContent = item.name;
      nameSpan.title = item.name;
      left.appendChild(nameSpan);

      const typeSpan = document.createElement('small');
      typeSpan.className = 'item-type';
      typeSpan.textContent = item.type === 'url' ? '(网络)' : '(本地)';
      left.appendChild(typeSpan);

      const controls = document.createElement('div');
      controls.className = 'item-controls';

      const playButton = document.createElement('button');
      playButton.textContent = (idx === currentIndex && isPlaying) ? '⏸' : '▶';
      playButton.title = '播放';
      playButton.addEventListener('click', function(e) {
        e.stopPropagation();
        if (idx === currentIndex && isPlaying) {
          pausePlayback();
        } else {
          playEntry(idx);
        }
      });

      const renameBtn = document.createElement('button');
      renameBtn.className = 'rename-btn';
      renameBtn.textContent = '✏️';
      renameBtn.title = '重命名';
      renameBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        renameEntry(idx);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'del-btn';
      delBtn.textContent = '✕';
      delBtn.title = '删除';
      delBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        removeEntry(idx);
      });

      controls.appendChild(playButton);
      controls.appendChild(renameBtn);
      controls.appendChild(delBtn);

      li.appendChild(left);
      li.appendChild(controls);

      li.addEventListener('click', function() { playEntry(idx); });

      if (isCustomMode) {
        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragover', handleDragOver);
        li.addEventListener('dragleave', handleDragLeave);
        li.addEventListener('drop', handleDrop);
        li.addEventListener('dragend', handleDragEnd);
      }

      playlistEl.appendChild(li);
    });
  }

  /* -------------------- 拖拽排序 -------------------- */
  let draggedIndex = null;

  function handleDragStart(e) {
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
  }

  function handleDragLeave() {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    const targetIndex = parseInt(this.dataset.index);
    
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      const movedItem = playlist.splice(draggedIndex, 1)[0];
      playlist.splice(targetIndex, 0, movedItem);
      
      if (currentIndex === draggedIndex) {
        currentIndex = targetIndex;
      } else if (draggedIndex < currentIndex && targetIndex >= currentIndex) {
        currentIndex--;
      } else if (draggedIndex > currentIndex && targetIndex <= currentIndex) {
        currentIndex++;
      }
      
      savePlaylistMeta();
      renderPlaylist();
      showToast('顺序已调整');
    }
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.playlist-item').forEach(function(item) {
      item.classList.remove('drag-over');
    });
    draggedIndex = null;
  }

  /* -------------------- 播放控制 -------------------- */
  function playEntry(index) {
    if (index < 0 || index >= playlist.length) return;
    
    const item = playlist[index];
    currentIndex = index;
    playHistory.push(index);
    
    if (trackTitle) trackTitle.textContent = item.name;
    if (trackArtist) trackArtist.textContent = '';
    
    if (isInShell) {
      // Shell 模式：发送消息给 shell 控制播放
      sendToShell('music:play', { index: index });
      renderPlaylist();
    } else {
      // 独立模式：直接播放
      playEntryStandalone(item);
    }
  }

  function playEntryStandalone(item) {
    if (!audioPlayer) return;
    
    let src;
    if (item.type === 'url') {
      src = item.url;
    } else if (item.type === 'file') {
      src = sessionBlobs[item.id];
      if (!src) {
        showToast('音频文件未加载，请稍后重试');
        return;
      }
    }
    
    audioPlayer.src = src;
    audioPlayer.load();
    audioPlayer.play().then(function() {
      if (playBtn) playBtn.textContent = '⏸️';
      showToast('正在播放: ' + item.name);
      saveGlobalState();
    }).catch(function(e) {
      console.warn('播放失败:', e);
      showToast('播放失败，请重试');
    });
    
    renderPlaylist();
  }

  function pausePlayback() {
    if (isInShell) {
      sendToShell('music:pause');
    } else if (audioPlayer) {
      audioPlayer.pause();
    }
    if (playBtn) playBtn.textContent = '▶️';
    renderPlaylist();
  }

  function togglePlayback() {
    if (isInShell) {
      if (currentIndex < 0 && playlist.length > 0) {
        playEntry(0);
      } else if (shellState.isPlaying) {
        sendToShell('music:pause');
      } else {
        sendToShell('music:play', { index: currentIndex });
      }
    } else {
      if (!audioPlayer) return;
      
      if (currentIndex < 0 && playlist.length > 0) {
        playEntry(0);
        return;
      }
      
      if (audioPlayer.paused) {
        audioPlayer.play().then(function() {
          if (playBtn) playBtn.textContent = '⏸️';
          saveGlobalState();
        }).catch(function() {
          showToast('播放失败');
        });
      } else {
        audioPlayer.pause();
        if (playBtn) playBtn.textContent = '▶️';
        saveGlobalState();
      }
    }
  }

  function playNext() {
    if (!playlist.length) {
      showToast('播放列表为空');
      return;
    }
    
    if (isInShell) {
      sendToShell('music:next');
      return;
    }
    
    let nextIndex;
    
    switch (playMode) {
      case 'single':
        nextIndex = currentIndex >= 0 ? currentIndex : 0;
        if (audioPlayer) {
          audioPlayer.currentTime = 0;
          audioPlayer.play().catch(function() {});
        }
        return;
      case 'random':
        if (playlist.length === 1) {
          nextIndex = 0;
        } else {
          do {
            nextIndex = Math.floor(Math.random() * playlist.length);
          } while (nextIndex === currentIndex && playlist.length > 1);
        }
        break;
      case 'loop':
      case 'custom':
        nextIndex = (currentIndex + 1) % playlist.length;
        break;
      case 'list':
      default:
        nextIndex = currentIndex + 1;
        if (nextIndex >= playlist.length) {
          showToast('播放列表已结束');
          return;
        }
        break;
    }
    
    playEntry(nextIndex);
  }

  function playPrev() {
    if (!playlist.length) {
      showToast('播放列表为空');
      return;
    }
    
    if (isInShell) {
      sendToShell('music:prev');
      return;
    }
    
    let prevIndex;
    
    if (playMode === 'random' && playHistory.length > 1) {
      playHistory.pop();
      prevIndex = playHistory.pop() || 0;
    } else {
      prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    }
    
    playEntry(prevIndex);
  }

  /* -------------------- 添加歌曲 -------------------- */
  function addUrlEntry(url) {
    if (!url) {
      showToast('URL不能为空');
      return;
    }
    
    url = url.trim();
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showToast('请输入有效的URL（以http://或https://开头）');
      return;
    }
    
    let defaultName;
    try {
      defaultName = decodeURIComponent(url.split('/').pop().split('?')[0]) || '网络音乐';
    } catch(e) {
      defaultName = url.split('/').pop().split('?')[0] || '网络音乐';
    }
    
    const customName = window.prompt('请输入歌曲名称（留空使用默认名称）：', defaultName);
    
    if (customName === null) return;
    
    const finalName = customName.trim() || defaultName;
    
    const entry = { id: uid(), name: finalName, type: 'url', url: url };
    playlist.push(entry);
    savePlaylistMeta();
    renderPlaylist();
    showToast('已添加: ' + finalName);
    
    if (playlist.length === 1) {
      playEntry(0);
    }
  }

  function addLocalFile(file) {
    const id = uid();
    const blobUrl = URL.createObjectURL(file);
    sessionBlobs[id] = blobUrl;
    
    let defaultName = file.name;
    const lastDot = defaultName.lastIndexOf('.');
    if (lastDot > 0) {
      defaultName = defaultName.substring(0, lastDot);
    }
    
    const customName = window.prompt('请输入歌曲名称（留空使用默认名称）：', defaultName);
    
    if (customName === null) {
      URL.revokeObjectURL(blobUrl);
      delete sessionBlobs[id];
      return Promise.resolve();
    }
    
    const finalName = customName.trim() || defaultName;
    
    return saveAudioToDB(id, file).then(function() {
      console.log('Audio saved to DB');
    }).catch(function(e) {
      console.warn('Failed to save audio to DB:', e);
    }).then(function() {
      const entry = { id: id, name: finalName, type: 'file', url: null };
      playlist.push(entry);
      savePlaylistMeta();
      renderPlaylist();
      showToast('已添加: ' + finalName);
      
      if (playlist.length === 1) {
        playEntry(0);
      }
    });
  }

  function removeEntry(index) {
    const item = playlist[index];
    if (!item) return;
    
    const wasPlaying = (index === currentIndex);
    
    let promise = Promise.resolve();
    
    if (item.type === 'file') {
      if (sessionBlobs[item.id]) {
        URL.revokeObjectURL(sessionBlobs[item.id]);
        delete sessionBlobs[item.id];
      }
      promise = deleteAudioFromDB(item.id).catch(function(e) {
        console.warn('Failed to delete audio from DB:', e);
      });
    }
    
    return promise.then(function() {
      playlist.splice(index, 1);
      
      if (wasPlaying) {
        if (isInShell) {
          sendToShell('music:pause');
        } else if (audioPlayer) {
          audioPlayer.pause();
        }
        if (playBtn) playBtn.textContent = '▶️';
        
        if (playlist.length > 0) {
          currentIndex = Math.min(index, playlist.length - 1);
        } else {
          currentIndex = -1;
          if (trackTitle) trackTitle.textContent = '选择音乐播放';
        }
      } else if (index < currentIndex) {
        currentIndex--;
      }
      
      savePlaylistMeta();
      renderPlaylist();
      showToast('已删除');
    });
  }

  function clearAllEntries() {
    if (!playlist.length) {
      showToast('播放列表已为空');
      return;
    }
    
    if (!confirm('确定要清空整个播放列表吗？')) return;
    
    const promises = [];
    playlist.forEach(function(item) {
      if (item.type === 'file') {
        if (sessionBlobs[item.id]) {
          URL.revokeObjectURL(sessionBlobs[item.id]);
          delete sessionBlobs[item.id];
        }
        promises.push(deleteAudioFromDB(item.id).catch(function(){}));
      }
    });
    
    Promise.all(promises).then(function() {
      playlist = [];
      currentIndex = -1;
      
      if (isInShell) {
        sendToShell('music:pause');
      } else if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.src = '';
      }
      
      if (playBtn) playBtn.textContent = '▶️';
      if (trackTitle) trackTitle.textContent = '选择音乐播放';
      if (currentTimeEl) currentTimeEl.textContent = '0:00';
      if (totalTimeEl) totalTimeEl.textContent = '0:00';
      if (progressFill) progressFill.style.width = '0%';
      if (progressHandle) progressHandle.style.left = '0%';
      
      savePlaylistMeta();
      renderPlaylist();
      showToast('播放列表已清空');
    });
  }

  /* -------------------- 进度条控制 -------------------- */
  function updateProgress() {
    if (isInShell) {
      updateProgressFromShell();
      return;
    }
    
    if (!audioPlayer || !progressFill || !progressHandle) return;
    
    const current = audioPlayer.currentTime;
    const duration = audioPlayer.duration;
    
    if (currentTimeEl) currentTimeEl.textContent = formatTime(current);
    if (totalTimeEl) totalTimeEl.textContent = formatTime(duration);
    
    if (duration > 0) {
      const percent = (current / duration) * 100;
      progressFill.style.width = percent + '%';
      progressHandle.style.left = percent + '%';
    }
  }

  function seekTo(e) {
    if (!progressBar) return;
    
    const rect = progressBar.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    
    if (isInShell) {
      sendToShell('music:seekPercent', { percent: percent });
    } else if (audioPlayer) {
      const duration = audioPlayer.duration;
      if (duration > 0) {
        audioPlayer.currentTime = percent * duration;
        updateProgress();
        saveGlobalState();
      }
    }
  }

  let isDraggingProgress = false;

  function startProgressDrag(e) {
    isDraggingProgress = true;
    if (progressHandle) progressHandle.classList.add('dragging');
    seekTo(e);
  }

  function moveProgressDrag(e) {
    if (!isDraggingProgress) return;
    seekTo(e);
  }

  function endProgressDrag() {
    isDraggingProgress = false;
    if (progressHandle) progressHandle.classList.remove('dragging');
  }

  /* -------------------- 音量控制 -------------------- */
  function updateVolume() {
    if (!volumeSlider) return;
    
    const vol = volumeSlider.value / 100;
    
    if (isInShell) {
      sendToShell('music:volume', { volume: vol });
    } else if (audioPlayer) {
      audioPlayer.volume = vol;
    }
    
    updateVolumeUI();
    localStorage.setItem('music_volume', volumeSlider.value);
  }

  function updateVolumeUI() {
    if (!volumeSlider) return;
    
    const vol = volumeSlider.value / 100;
    
    if (volumeValue) volumeValue.textContent = volumeSlider.value + '%';
    
    if (volumeIcon) {
      if (vol === 0) volumeIcon.textContent = '🔇';
      else if (vol < 0.3) volumeIcon.textContent = '🔈';
      else if (vol < 0.7) volumeIcon.textContent = '🔉';
      else volumeIcon.textContent = '🔊';
    }
  }

  function toggleMute() {
    if (!volumeSlider) return;
    
    const currentVol = parseInt(volumeSlider.value);
    if (currentVol > 0) {
      volumeSlider.dataset.prevVolume = volumeSlider.value;
      volumeSlider.value = 0;
    } else {
      volumeSlider.value = volumeSlider.dataset.prevVolume || 80;
    }
    updateVolume();
  }

  /* -------------------- 初始化 -------------------- */
  function init() {
    console.log('[MusicPage] Initializing... isInShell:', isInShell);
    
    // 获取DOM元素
    audioPlayer = document.getElementById('audio-player');
    trackTitle = document.getElementById('track-title');
    trackArtist = document.getElementById('track-artist');
    prevBtn = document.getElementById('prev-track');
    playBtn = document.getElementById('play-pause');
    nextBtn = document.getElementById('next-track');
    fileInput = document.getElementById('file-input');
    playlistEl = document.getElementById('playlist');
    addUrlBtn = document.getElementById('add-url-btn');
    playModeSelect = document.getElementById('play-mode');
    progressBar = document.getElementById('progress-bar');
    progressFill = document.getElementById('progress-fill');
    progressHandle = document.getElementById('progress-handle');
    currentTimeEl = document.getElementById('current-time');
    totalTimeEl = document.getElementById('total-time');
    volumeSlider = document.getElementById('volume-slider');
    volumeIcon = document.getElementById('volume-icon');
    volumeValue = document.getElementById('volume-value');
    playlistCount = document.getElementById('playlist-count');
    clearAllBtn = document.getElementById('clear-all-btn');
    saveOrderBtn = document.getElementById('save-order-btn');
    dragHint = document.getElementById('drag-hint');
    floatToggleBtn = document.getElementById('float-toggle-btn');

    // Shell 模式：隐藏本地 audio 元素（使用 shell 的 audio）
    if (isInShell && audioPlayer) {
      audioPlayer.style.display = 'none';
      audioPlayer.pause();
      audioPlayer.src = '';
    }

    // 初始化主题
    const savedTheme = localStorage.getItem('theme') || 'pink';
    applyThemeFromName(savedTheme);
    loadCustomButtonColor();
    loadCustomCSS();

    // 加载播放列表和播放模式
    loadPlaylistMeta();
    loadPlayMode();
    
    loadLocalFilesFromDB().then(function() {
      renderPlaylist();
      
      // 恢复播放状态
      const state = localStorage.getItem(STATE_KEY);
      if (state) {
        try {
          const s = JSON.parse(state);
          if (s.currentIndex >= 0 && s.currentIndex < playlist.length) {
            currentIndex = s.currentIndex;
            if (trackTitle) {
              trackTitle.textContent = playlist[currentIndex].name;
            }
            renderPlaylist();
          }
        } catch(e) {}
      }
      
      // 如果在 shell 中，请求当前状态
      if (isInShell) {
        sendToShell('music:getState');
      }
    });

    // 恢复音量
    const savedVolume = localStorage.getItem('music_volume');
    if (savedVolume && volumeSlider) {
      volumeSlider.value = savedVolume;
    }
    if (volumeSlider) {
      updateVolumeUI();
      if (isInShell) {
        sendToShell('music:volume', { volume: volumeSlider.value / 100 });
      } else if (audioPlayer) {
        audioPlayer.volume = volumeSlider.value / 100;
      }
    }

    // 悬浮球开关按钮
    if (floatToggleBtn) {
      updateFloatToggleButton();
      floatToggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        toggleFloatEnabled();
      });
    }

    // 文件输入事件
    if (fileInput) {
      fileInput.addEventListener('change', function(e) {
        const files = e.target.files;
        if (!files || !files.length) return;
        
        let processPromise = Promise.resolve();
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          processPromise = processPromise.then(function() {
            return addLocalFile(file);
          });
        }
        
        processPromise.then(function() {
          fileInput.value = '';
        });
      });
    }

    // URL添加事件
    if (addUrlBtn) {
      addUrlBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const url = window.prompt('请输入音乐链接（MP3/音频文件URL）：');
        if (url && url.trim()) {
          addUrlEntry(url.trim());
        }
      });
    }

    // 播放控制按钮
    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        playPrev();
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        playNext();
      });
    }
    
    if (playBtn) {
      playBtn.addEventListener('click', function() {
        togglePlayback();
      });
    }

    // 播放模式切换
    if (playModeSelect) {
      playModeSelect.addEventListener('change', function() {
        playMode = playModeSelect.value;
        playHistory = [];
        savePlayMode();
        renderPlaylist();
        
        const modeNames = {
          list: '列表顺序',
          loop: '列表循环',
          single: '单曲循环',
          random: '随机播放',
          custom: '自定义顺序'
        };
        showToast('已切换为: ' + modeNames[playMode]);
      });
    }

    // 进度条事件
    if (progressBar) {
      progressBar.addEventListener('click', seekTo);
      progressBar.addEventListener('mousedown', startProgressDrag);
      progressBar.addEventListener('touchstart', function(e) {
        isDraggingProgress = true;
        if (progressHandle) progressHandle.classList.add('dragging');
        seekTo(e);
      });
    }
    
    document.addEventListener('mousemove', moveProgressDrag);
    document.addEventListener('mouseup', endProgressDrag);
    document.addEventListener('touchmove', function(e) {
      if (!isDraggingProgress) return;
      seekTo(e);
    });
    document.addEventListener('touchend', endProgressDrag);

    // 音量控制
    if (volumeSlider) {
      volumeSlider.addEventListener('input', updateVolume);
    }
    if (volumeIcon) {
      volumeIcon.addEventListener('click', toggleMute);
    }

    // 清空列表
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', clearAllEntries);
    }

    // 保存顺序按钮
    if (saveOrderBtn) {
      saveOrderBtn.addEventListener('click', function() {
        savePlaylistMeta();
        showToast('顺序已保存');
      });
    }

    // 独立模式：绑定音频播放器事件
    if (!isInShell && audioPlayer) {
      audioPlayer.addEventListener('timeupdate', updateProgress);
      
      audioPlayer.addEventListener('loadedmetadata', function() {
        if (totalTimeEl) totalTimeEl.textContent = formatTime(audioPlayer.duration);
      });
      
      audioPlayer.addEventListener('ended', function() {
        playNext();
      });
      
      audioPlayer.addEventListener('play', function() {
        if (playBtn) playBtn.textContent = '⏸️';
        renderPlaylist();
        saveGlobalState();
      });
      
      audioPlayer.addEventListener('pause', function() {
        if (playBtn) playBtn.textContent = '▶️';
        renderPlaylist();
        saveGlobalState();
      });
      
      audioPlayer.addEventListener('error', function(e) {
        console.error('Audio error:', e);
        showToast('音频加载失败');
      });
    }

    // Shell 模式：监听来自 shell 的消息
    if (isInShell) {
      window.addEventListener('message', handleShellMessage);
    }

    // 页面卸载时保存状态
    window.addEventListener('beforeunload', function() {
      if (!isInShell) {
        saveGlobalState();
      }
    });

    // 键盘快捷键
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayback();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          playPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          playNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (volumeSlider) {
            volumeSlider.value = Math.min(100, parseInt(volumeSlider.value) + 5);
            updateVolume();
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (volumeSlider) {
            volumeSlider.value = Math.max(0, parseInt(volumeSlider.value) - 5);
            updateVolume();
          }
          break;
      }
    });

    console.log('[MusicPage] Initialized successfully');
  }

  // 等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
