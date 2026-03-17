// scripts/frame-helper.js
// 子页面与shell通信辅助脚本

(function() {
  'use strict';

  // 检查是否在iframe中
  const isInIframe = window.self !== window.top;

  // 如果不在iframe中，跳转到shell
  if (!isInIframe) {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    // 如果当前不是shell.html，则跳转
    if (currentPage !== 'shell.html') {
      window.location.href = 'shell.html';
      return;
    }
  }

  // 暴露全局API给子页面使用
  window.ShellMusic = {
    // 播放指定曲目
    play: function(index) {
      window.parent.postMessage({ type: 'music:play', index }, '*');
    },
    
    // 暂停
    pause: function() {
      window.parent.postMessage({ type: 'music:pause' }, '*');
    },
    
    // 播放/暂停切换
    toggle: function() {
      window.parent.postMessage({ type: 'music:play' }, '*');
    },
    
    // 下一首
    next: function() {
      window.parent.postMessage({ type: 'music:next' }, '*');
    },
    
    // 上一首
    prev: function() {
      window.parent.postMessage({ type: 'music:prev' }, '*');
    },
    
    // 跳转到指定时间
    seek: function(time) {
      window.parent.postMessage({ type: 'music:seek', time }, '*');
    },
    
    // 设置音量
    setVolume: function(volume) {
      window.parent.postMessage({ type: 'music:volume', volume }, '*');
    },
    
    // 设置播放模式
    setMode: function(mode) {
      window.parent.postMessage({ type: 'music:setMode', mode }, '*');
    },
    
    // 启用悬浮球
    enableFloat: function() {
      window.parent.postMessage({ type: 'music:enableFloat' }, '*');
    },
    
    // 禁用悬浮球
    disableFloat: function() {
      window.parent.postMessage({ type: 'music:disableFloat' }, '*');
    },
    
    // 重新加载播放列表
    reloadPlaylist: function() {
      window.parent.postMessage({ type: 'music:reloadPlaylist' }, '*');
    },
    
    // 获取当前状态
    getState: function() {
      window.parent.postMessage({ type: 'music:getState' }, '*');
    },
    
    // 导航到其他页面
    navigate: function(url) {
      window.parent.postMessage({ type: 'navigate', url }, '*');
    },
    
    // 检查是否在iframe中
    isInShell: function() {
      return isInIframe;
    },
    
    // 状态回调
    _stateCallback: null,
    _progressCallback: null,
    _playCallback: null,
    _pauseCallback: null,
    
    onState: function(callback) {
      this._stateCallback = callback;
    },
    
    onProgress: function(callback) {
      this._progressCallback = callback;
    },
    
    onPlay: function(callback) {
      this._playCallback = callback;
    },
    
    onPause: function(callback) {
      this._pauseCallback = callback;
    }
  };

  // 监听来自shell的消息
  window.addEventListener('message', function(event) {
    const data = event.data;
    if (!data || !data.type) return;
    
    if (data.type === 'shell:state' && window.ShellMusic._stateCallback) {
      window.ShellMusic._stateCallback(data);
    }
    if (data.type === 'shell:progress' && window.ShellMusic._progressCallback) {
      window.ShellMusic._progressCallback(data);
    }
    if (data.type === 'shell:play' && window.ShellMusic._playCallback) {
      window.ShellMusic._playCallback(data);
    }
    if (data.type === 'shell:pause' && window.ShellMusic._pauseCallback) {
      window.ShellMusic._pauseCallback(data);
    }
    if (data.type === 'shell:playing' && window.ShellMusic._playCallback) {
      window.ShellMusic._playCallback(data);
    }
  });

  console.log('[FrameHelper] Initialized, isInShell:', isInIframe);

})();
