/* scripts/chat-room/utils.js - 工具函数 */

const ChatUtils = {
  generateMsgId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  formatTime(timestamp) {
    const d = new Date(timestamp);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  },

  showToast(msg) {
    let toast = document.querySelector('.toast-message');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast-message';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  },

  parseMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[img:(.+?)\]/g, '<img src="$1" onclick="viewImage(\'$1\')">')
      .replace(/\n/g, '<br>');
  },

  getTimeContext() {
    const h = new Date().getHours();
    if (h >= 5 && h < 9) return '清晨';
    if (h >= 9 && h < 12) return '上午';
    if (h >= 12 && h < 14) return '中午';
    if (h >= 14 && h < 18) return '下午';
    if (h >= 18 && h < 22) return '晚上';
    return '深夜';
  },

  getDateContext() {
    const d = new Date();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
  },

  async getWeatherContext() {
    try {
      const stored = localStorage.getItem('weatherData');
      if (stored) {
        const data = JSON.parse(stored);
        if (Date.now() - data.timestamp < 3600000) return data.weather;
      }
    } catch (e) {}
    return '天气未知';
  }
};

window.ChatUtils = ChatUtils;
