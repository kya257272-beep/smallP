// scripts/api-config.js
// API 配置页面逻辑（固定服务商：api.daidaibird.top）
// 支持多密钥配置管理 + 高级参数设置 + 功能模型绑定 + 独立测试

/* ========== 常量配置 ========== */
const API_BASE = 'https://api.daidaibird.top/v1';
const STORAGE_KEY = 'apiConfigs';
const ACTIVE_KEY = 'activeConfigId';
const BINDINGS_KEY = 'modelBindings';

/* ========== 功能类型定义 ========== */
const FUNCTION_TYPES = ['chat', 'summary', 'diary', 'moments', 'interface', 'image', 'offline'];

/* ========== 主题颜色表 ========== */
const themeColors = {
  pink:   { topbar: "#f8cbd0" },
  blue:   { topbar: "#a7c8f2" },
  green:  { topbar: "#b8d6a2" },
  yellow: { topbar: "#f7d26d" },
  purple: { topbar: "#c3b0e6" },
  black:  { topbar: "#333333" }
};

/* ========== 状态管理 ========== */
let configs = [];
let activeConfigId = null;
let editingConfigId = null;

// 功能绑定状态
let modelBindings = {
  chat: { configId: '', model: '' },
  summary: { configId: '', model: '' },
  diary: { configId: '', model: '' },
  moments: { configId: '', model: '' },
  interface: { configId: '', model: '' },
  image: { configId: '', model: '' },
  offline: { configId: '', model: '' }
};

/* ========== 工具函数 ========== */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function maskKey(key) {
  if (!key || key.length < 10) return '***';
  return key.substring(0, 6) + '****' + key.substring(key.length - 4);
}

function shadeColor(color, percent) {
  if (!color || color[0] !== '#') return color;
  
  let hex = color;
  if (hex.length === 4) {
    hex = '#' + hex[1]+hex[1] + hex[2]+hex[2] + hex[3]+hex[3];
  }
  
  let R = parseInt(hex.substring(1,3), 16);
  let G = parseInt(hex.substring(3,5), 16);
  let B = parseInt(hex.substring(5,7), 16);

  R = Math.min(255, Math.max(0, Math.round(R * (100 + percent) / 100)));
  G = Math.min(255, Math.max(0, Math.round(G * (100 + percent) / 100)));
  B = Math.min(255, Math.max(0, Math.round(B * (100 + percent) / 100)));

  return "#" + [R, G, B].map(v => v.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ========== 主题应用 ========== */
function applyTheme(themeName) {
  const t = themeColors[themeName] || themeColors.pink;
  const customBtnColor = localStorage.getItem('buttonColor');
  const color = customBtnColor || t.topbar;

  const root = document.documentElement;
  root.style.setProperty('--topbar-color', color);
  root.style.setProperty('--btn-color', color);
  root.style.setProperty('--btn-hover', shadeColor(color, -15));
  root.style.setProperty('--btn-active', shadeColor(color, -25));

  const header = document.querySelector('.header');
  if (header) header.style.background = color;
}

/* ========== 加载自定义按钮颜色 ========== */
function loadCustomButtonColor() {
  const savedColor = localStorage.getItem('buttonColor');
  if (savedColor) {
    const root = document.documentElement;
    root.style.setProperty('--topbar-color', savedColor);
    root.style.setProperty('--btn-color', savedColor);
    root.style.setProperty('--btn-hover', shadeColor(savedColor, -15));
    root.style.setProperty('--btn-active', shadeColor(savedColor, -25));
    
    const header = document.querySelector('.header');
    if (header) header.style.background = savedColor;
  }
}

/* ========== 加载自定义 CSS ========== */
function loadCustomCSS() {
  let styleEl = document.getElementById('custom-user-css');
  if (styleEl) {
    styleEl.remove();
  }
  
  const enabled = localStorage.getItem('customCSSEnabled');
  if (enabled !== 'true') {
    return;
  }
  
  const savedCSS = localStorage.getItem('customCSS');
  if (savedCSS && savedCSS.trim()) {
    styleEl = document.createElement('style');
    styleEl.id = 'custom-user-css';
    styleEl.textContent = savedCSS;
    document.head.appendChild(styleEl);
  }
}

/* ========== 配置存储 ========== */
function saveConfigs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  localStorage.setItem(ACTIVE_KEY, activeConfigId || '');
}

function loadConfigs() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      configs = JSON.parse(saved);
    }
    activeConfigId = localStorage.getItem(ACTIVE_KEY) || null;
    
    if (activeConfigId && !configs.find(c => c.id === activeConfigId)) {
      activeConfigId = configs.length > 0 ? configs[0].id : null;
    }
  } catch (e) {
    console.warn('加载配置失败:', e);
    configs = [];
    activeConfigId = null;
  }
}

function getActiveConfig() {
  return configs.find(c => c.id === activeConfigId) || null;
}

/* ========== 功能绑定存储 ========== */
function saveBindings() {
  localStorage.setItem(BINDINGS_KEY, JSON.stringify(modelBindings));
}

function loadBindings() {
  try {
    const saved = localStorage.getItem(BINDINGS_KEY);
    if (saved) {
      modelBindings = { ...modelBindings, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('加载功能绑定失败:', e);
  }
}

/* ========== 获取指定功能的模型配置（供其他模块调用） ========== */
function getModelForFunction(funcType) {
  const binding = modelBindings[funcType];
  if (!binding || !binding.configId) return null;
  
  const config = configs.find(c => c.id === binding.configId);
  if (!config) return null;
  
  return {
    apiKey: config.key,
    model: binding.model,
    configName: config.name,
    configId: config.id
  };
}

// 暴露给全局使用
window.getModelForFunction = getModelForFunction;

window.getAllModelBindings = function() {
  return JSON.parse(JSON.stringify(modelBindings));
};

window.getApiConfigs = function() {
  return JSON.parse(JSON.stringify(configs));
};

/* ========== 高级参数存储 ========== */
function saveAdvancedParams() {
  const temp = document.getElementById('temperature').value;
  const topP = document.getElementById('top-p').value;
  const maxTokens = document.getElementById('max-tokens').value;
  const streamEnabled = document.getElementById('stream-enabled').checked;
  const webSearchEnabled = document.getElementById('web-search-enabled').checked;

  localStorage.setItem('ai_temperature', temp);
  localStorage.setItem('ai_top_p', topP);
  localStorage.setItem('ai_max_tokens', maxTokens);
  localStorage.setItem('ai_stream', streamEnabled);
  localStorage.setItem('webSearchEnabled', webSearchEnabled);
}

function loadAdvancedParams() {
  const temp = localStorage.getItem('ai_temperature') || '0.7';
  const topP = localStorage.getItem('ai_top_p') || '1';
  const maxTokens = localStorage.getItem('ai_max_tokens') || '2048';
  const streamEnabled = localStorage.getItem('ai_stream');
  const webSearchEnabled = localStorage.getItem('webSearchEnabled');

  document.getElementById('temperature').value = temp;
  document.getElementById('temp-value').textContent = temp;

  document.getElementById('top-p').value = topP;
  document.getElementById('topp-value').textContent = topP;

  document.getElementById('max-tokens').value = maxTokens;

  document.getElementById('stream-enabled').checked =
    streamEnabled === null ? true : streamEnabled === 'true';

  document.getElementById('web-search-enabled').checked =
    webSearchEnabled === 'true';
}

/* ========== Toast提示 ========== */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

/* ========== 渲染功能绑定区域 ========== */
function renderBindings() {
  FUNCTION_TYPES.forEach(funcType => {
    const configSelect = document.getElementById(`bind-${funcType}-config`);
    const modelSelect = document.getElementById(`bind-${funcType}-model`);
    
    if (!configSelect || !modelSelect) return;
    
    // 填充配置选项
    configSelect.innerHTML = '<option value="">-- 选择配置 --</option>';
    configs.forEach(config => {
      const opt = document.createElement('option');
      opt.value = config.id;
      opt.textContent = config.name || '未命名配置';
      configSelect.appendChild(opt);
    });
    
    // 恢复已保存的选择
    const binding = modelBindings[funcType];
    if (binding && binding.configId) {
      configSelect.value = binding.configId;
      populateBindingModels(funcType, binding.configId, binding.model);
    }
  });
}

/* ========== 填充绑定区域的模型下拉框 ========== */
async function populateBindingModels(funcType, configId, selectedModel = '') {
  const modelSelect = document.getElementById(`bind-${funcType}-model`);
  if (!modelSelect) return;
  
  const config = configs.find(c => c.id === configId);
  if (!config || !config.key) {
    modelSelect.innerHTML = '<option value="">-- 请先选择配置 --</option>';
    return;
  }
  
  modelSelect.innerHTML = '<option value="">加载中...</option>';
  
  try {
    const response = await fetch(`${API_BASE}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error('拉取失败');
    
    const data = await response.json();
    let models = [];
    if (Array.isArray(data.data)) models = data.data;
    else if (Array.isArray(data.models)) models = data.models;
    else if (Array.isArray(data)) models = data;
    
    modelSelect.innerHTML = '<option value="">-- 选择模型 --</option>';
    models.forEach(model => {
      const id = typeof model === 'string' ? model : (model.id || model.name || '');
      if (id) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id;
        modelSelect.appendChild(opt);
      }
    });
    
    if (selectedModel) {
      modelSelect.value = selectedModel;
    }
    
  } catch (err) {
    console.warn('拉取模型列表失败:', err);
    modelSelect.innerHTML = '<option value="">拉取失败</option>';
  }
}

/* ========== 测试绑定的模型 ========== */
async function testBindingModel(funcType) {
  const configSelect = document.getElementById(`bind-${funcType}-config`);
  const modelSelect = document.getElementById(`bind-${funcType}-model`);
  const resultEl = document.getElementById(`test-result-${funcType}`);
  const testBtn = document.querySelector(`.btn-test[data-func="${funcType}"]`);
  
  if (!configSelect || !modelSelect || !resultEl) return;
  
  const configId = configSelect.value;
  const model = modelSelect.value;
  
  if (!configId) {
    resultEl.className = 'binding-test-result error';
    resultEl.textContent = '❌ 请先选择配置';
    return;
  }
  
  if (!model) {
    resultEl.className = 'binding-test-result error';
    resultEl.textContent = '❌ 请先选择模型';
    return;
  }
  
  const config = configs.find(c => c.id === configId);
  if (!config) {
    resultEl.className = 'binding-test-result error';
    resultEl.textContent = '❌ 配置不存在';
    return;
  }
  
  // 显示加载状态
  testBtn.disabled = true;
  testBtn.textContent = '⏳';
  resultEl.className = 'binding-test-result loading';
  resultEl.textContent = `⏳ 正在测试 ${model}...`;
  
  try {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.key}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 50,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    if (reply) {
      resultEl.className = 'binding-test-result success';
      resultEl.textContent = `✅ 测试成功: "${reply.substring(0, 50)}${reply.length > 50 ? '...' : ''}"`;
      showToast(`${funcType} 模型测试成功！`);
    } else {
      throw new Error('模型返回内容为空');
    }

  } catch (error) {
    resultEl.className = 'binding-test-result error';
    resultEl.textContent = `❌ 测试失败: ${error.message}`;
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = '🧪 测试';
  }
}

/* ========== 保存绑定设置 ========== */
function saveBindingSettings() {
  FUNCTION_TYPES.forEach(funcType => {
    const configSelect = document.getElementById(`bind-${funcType}-config`);
    const modelSelect = document.getElementById(`bind-${funcType}-model`);
    
    if (configSelect && modelSelect) {
      modelBindings[funcType] = {
        configId: configSelect.value,
        model: modelSelect.value
      };
    }
  });
  
  saveBindings();
  showToast('功能绑定已保存！');
}

/* ========== 绑定区域事件初始化 ========== */
function initBindingEvents() {
  // 配置选择变化时，加载对应模型
  FUNCTION_TYPES.forEach(funcType => {
    const configSelect = document.getElementById(`bind-${funcType}-config`);
    if (configSelect) {
      configSelect.addEventListener('change', (e) => {
        const configId = e.target.value;
        // 清除测试结果
        const resultEl = document.getElementById(`test-result-${funcType}`);
        if (resultEl) {
          resultEl.className = 'binding-test-result';
          resultEl.textContent = '';
        }
        
        if (configId) {
          populateBindingModels(funcType, configId);
        } else {
          const modelSelect = document.getElementById(`bind-${funcType}-model`);
          if (modelSelect) {
            modelSelect.innerHTML = '<option value="">-- 请先选择配置 --</option>';
          }
        }
      });
    }
  });
  
  // 测试按钮事件
  document.querySelectorAll('.btn-test[data-func]').forEach(btn => {
    btn.addEventListener('click', () => {
      const funcType = btn.dataset.func;
      testBindingModel(funcType);
    });
  });
  
  // 保存按钮
  const saveBtn = document.getElementById('save-bindings');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveBindingSettings);
  }
}

/* ========== 界面渲染 ========== */
function renderConfigList() {
  const listEl = document.getElementById('config-list');
  if (!listEl) return;

  if (configs.length === 0) {
    listEl.innerHTML = '<div class="no-configs">暂无保存的配置，点击「新建配置」添加</div>';
    renderBindings();
    return;
  }

  listEl.innerHTML = configs.map(config => `
    <div class="config-item ${config.id === activeConfigId ? 'active' : ''}" data-id="${config.id}">
      <div class="config-item-left">
        <div class="config-item-name">${escapeHtml(config.name || '未命名配置')}</div>
        <div class="config-item-key">${maskKey(config.key)}</div>
      </div>
      <div class="config-item-actions">
        <button class="btn-small" data-action="use" data-id="${config.id}">
          ${config.id === activeConfigId ? '✓ 当前' : '查看额度'}
        </button>
        <button class="btn-small btn-secondary" data-action="edit" data-id="${config.id}">编辑</button>
        <button class="btn-small btn-delete" data-action="delete" data-id="${config.id}">删除</button>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      
      if (action === 'use') activateConfig(id);
      else if (action === 'edit') startEditConfig(id);
      else if (action === 'delete') deleteConfig(id);
    });
  });

  listEl.querySelectorAll('.config-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.config-item-actions')) return;
      activateConfig(item.dataset.id);
    });
  });

  renderBindings();
}

function showForm(show = true, isEdit = false) {
  const formSection = document.getElementById('config-form-section');
  const formTitle = document.getElementById('form-title');
  
  if (formSection) {
    formSection.style.display = show ? 'block' : 'none';
    if (show) {
      // 滚动到表单位置
      setTimeout(() => {
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }
  if (formTitle) formTitle.textContent = isEdit ? '✏️ 编辑配置' : '➕ 新建配置';
}

function clearForm() {
  document.getElementById('api-name').value = '';
  document.getElementById('api-key').value = '';
  document.getElementById('api-status').textContent = '';
  editingConfigId = null;
}

function fillForm(config) {
  document.getElementById('api-name').value = config.name || '';
  document.getElementById('api-key').value = config.key || '';
}

/* ========== 配置操作 ========== */
function activateConfig(id) {
  const config = configs.find(c => c.id === id);
  if (!config) return;

  activeConfigId = id;
  saveConfigs();
  renderConfigList();
  queryBalance(config.key);
  showToast('已查看: ' + config.name);
}

function startEditConfig(id) {
  const config = configs.find(c => c.id === id);
  if (!config) return;

  editingConfigId = id;
  fillForm(config);
  showForm(true, true);
}

function startNewConfig() {
  editingConfigId = null;
  clearForm();
  showForm(true, false);
}

function deleteConfig(id) {
  const config = configs.find(c => c.id === id);
  if (!config) return;

  if (!confirm(`确定要删除配置「${config.name || '未命名'}」吗？`)) return;

  configs = configs.filter(c => c.id !== id);
  
  if (activeConfigId === id) {
    activeConfigId = configs.length > 0 ? configs[0].id : null;
  }
  
  // 清理使用该配置的绑定
  FUNCTION_TYPES.forEach(funcType => {
    if (modelBindings[funcType] && modelBindings[funcType].configId === id) {
      modelBindings[funcType] = { configId: '', model: '' };
    }
  });
  saveBindings();
  
  saveConfigs();
  renderConfigList();
  showToast('配置已删除');
  
  const active = getActiveConfig();
  if (active) {
    queryBalance(active.key);
  } else {
    document.getElementById('balance-display').textContent = '请添加配置';
    document.getElementById('used-display').textContent = '--';
  }
}

function saveCurrentConfig() {
  const statusEl = document.getElementById('api-status');
  const name = document.getElementById('api-name').value.trim();
  const key = document.getElementById('api-key').value.trim();

  if (!key) {
    statusEl.textContent = '请填写 API 密钥';
    statusEl.className = 'status error';
    return;
  }

  if (!name) {
    statusEl.textContent = '请填写配置名称';
    statusEl.className = 'status error';
    return;
  }

  if (editingConfigId) {
    const idx = configs.findIndex(c => c.id === editingConfigId);
    if (idx !== -1) {
      configs[idx] = { ...configs[idx], name, key };
    }
  } else {
    const newConfig = {
      id: generateId(),
      name,
      key,
      createdAt: Date.now()
    };
    configs.push(newConfig);
    activeConfigId = newConfig.id;
  }

  saveConfigs();
  renderConfigList();
  
  statusEl.textContent = '✓ 配置已保存';
  statusEl.className = 'status success';
  showToast('配置已保存！');

  queryBalance(key);

  setTimeout(() => {
    showForm(false);
    clearForm();
  }, 800);
}

/* ========== 测试密钥（拉取模型验证） ========== */
async function testApiKey(apiKey) {
  const statusEl = document.getElementById('api-status');
  const fetchBtn = document.getElementById('fetch-models');
  
  if (!apiKey) {
    statusEl.textContent = '请填写 API 密钥';
    statusEl.className = 'status error';
    return;
  }

  statusEl.textContent = '正在测试密钥...';
  statusEl.className = 'status';
  fetchBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401 || response.status === 403) {
      statusEl.textContent = '❌ API 密钥无效或无权限';
      statusEl.className = 'status error';
      fetchBtn.disabled = false;
      return;
    }

    if (!response.ok) {
      statusEl.textContent = `❌ 请求失败 (HTTP ${response.status})`;
      statusEl.className = 'status error';
      fetchBtn.disabled = false;
      return;
    }

    const data = await response.json();
    let models = [];
    if (Array.isArray(data.data)) models = data.data;
    else if (Array.isArray(data.models)) models = data.models;
    else if (Array.isArray(data)) models = data;

    statusEl.textContent = `✓ 密钥有效！可用模型: ${models.length} 个`;
    statusEl.className = 'status success';
    
    // 同时查询额度
    queryBalance(apiKey);

  } catch (err) {
    statusEl.textContent = '❌ 网络错误或 CORS 限制';
    statusEl.className = 'status error';
  }

  fetchBtn.disabled = false;
}

/* ========== 额度查询 ========== */
async function queryBalance(apiKey) {
  const balanceEl = document.getElementById('balance-display');
  const usedEl = document.getElementById('used-display');
  const queryBtn = document.getElementById('query-balance');

  if (!apiKey) {
    balanceEl.textContent = '请先输入密钥';
    balanceEl.className = 'info-value';
    usedEl.textContent = '--';
    return;
  }

  balanceEl.textContent = '查询中...';
  balanceEl.className = 'info-value loading';
  usedEl.textContent = '查询中...';
  if (queryBtn) queryBtn.disabled = true;

  const baseUrl = API_BASE.replace('/v1', '');
  const endpoints = [
    `${baseUrl}/v1/dashboard/billing/subscription`,
    `${baseUrl}/dashboard/billing/subscription`,
    `${baseUrl}/v1/dashboard/billing/credit_grants`,
    `${baseUrl}/v1/balance`,
    `${baseUrl}/balance`,
    `${baseUrl}/v1/user/balance`,
    `${baseUrl}/user/balance`
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) continue;

      const data = await response.json();
      
      let balance = null;
      let used = null;

      if (data.object === 'billing_subscription') {
        const total = data.hard_limit_usd || data.system_hard_limit_usd || 0;
        
        const now = new Date();
        const startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
        const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        
        const usageUrl = url.replace('/subscription', '/usage') + 
                         `?start_date=${startStr}&end_date=${endStr}`;
        
        try {
            const usageResp = await fetch(usageUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (usageResp.ok) {
                const usageData = await usageResp.json();
                if (usageData.total_usage !== undefined) {
                    used = usageData.total_usage / 100;
                }
            }
        } catch (err) {
            used = 0;
        }

        if (used === null) used = 0;
        balance = total - used;
      }
      else if (data.total_available !== undefined) {
        balance = data.total_available;
        used = data.total_used || 0;
      } else if (data.grants && Array.isArray(data.grants.data)) {
        balance = data.grants.data.reduce((sum, g) => sum + (g.grant_amount - g.used_amount), 0);
        used = data.grants.data.reduce((sum, g) => sum + g.used_amount, 0);
      } else if (data.balance !== undefined) {
        balance = data.balance;
        used = data.used || data.used_balance || 0;
      } else if (data.data && data.data.balance !== undefined) {
        balance = data.data.balance;
        used = data.data.used_balance || 0;
      } else if (data.remaining_balance !== undefined) {
        balance = data.remaining_balance;
        used = data.used_balance || 0;
      }

      if (balance !== null) {
        balanceEl.textContent = `$${Number(balance).toFixed(4)}`;
        balanceEl.className = 'info-value balance';
        usedEl.textContent = used !== null ? `$${Number(used).toFixed(4)}` : '--';
        if (queryBtn) queryBtn.disabled = false;
        return;
      }
    } catch (err) {
      console.warn('[queryBalance] 失败:', url, err);
    }
  }

  balanceEl.textContent = '查询失败（请访问官网）';
  balanceEl.className = 'info-value';
  usedEl.textContent = '--';
  if (queryBtn) queryBtn.disabled = false;
}

/* ========== 初始化 ========== */
document.addEventListener('DOMContentLoaded', () => {
  // 1) 应用主题
  const savedTheme = localStorage.getItem('theme') || 'pink';
  applyTheme(savedTheme);
  
  // 2) 加载自定义按钮颜色
  loadCustomButtonColor();
  
  // 3) 加载自定义 CSS
  loadCustomCSS();

  // 4) 加载配置
  loadConfigs();
  
  // 5) 加载功能绑定
  loadBindings();
  
  // 6) 渲染配置列表
  renderConfigList();
  
  // 7) 初始化绑定区域事件
  initBindingEvents();

  // 8) 加载高级参数
  loadAdvancedParams();

  // 9) 如果有激活的配置，查询额度
  const activeConfig = getActiveConfig();
  if (activeConfig) {
    queryBalance(activeConfig.key);
  }

  // 10) 返回按钮
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (window.ShellMusic && window.ShellMusic.isInShell()) {
        window.ShellMusic.navigate('index.html');
      } else {
        window.location.href = 'index.html';
      }
    });
  }

  // 11) 新建配置按钮
  const addNewBtn = document.getElementById('add-new-btn');
  if (addNewBtn) {
    addNewBtn.addEventListener('click', startNewConfig);
  }

  // 12) 取消编辑按钮
  const cancelBtn = document.getElementById('cancel-edit');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      showForm(false);
      clearForm();
    });
  }

  // 13) 测试密钥按钮
  const fetchBtn = document.getElementById('fetch-models');
  if (fetchBtn) {
    fetchBtn.addEventListener('click', () => {
      const apiKey = document.getElementById('api-key').value.trim();
      testApiKey(apiKey);
    });
  }

  // 14) 查询额度按钮
  const queryBtn = document.getElementById('query-balance');
  if (queryBtn) {
    queryBtn.addEventListener('click', () => {
      const apiKey = document.getElementById('api-key').value.trim();
      queryBalance(apiKey);
    });
  }

  // 15) 保存配置按钮
  const saveBtn = document.getElementById('save-config');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveCurrentConfig);
  }

  // 16) 密钥显示/隐藏切换
  const toggleBtn = document.getElementById('toggle-key');
  const keyInput = document.getElementById('api-key');
  if (toggleBtn && keyInput) {
    toggleBtn.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleBtn.textContent = '隐藏';
      } else {
        keyInput.type = 'password';
        toggleBtn.textContent = '显示';
      }
    });
  }

  // 17) 高级参数事件绑定
  const tempSlider = document.getElementById('temperature');
  const tempValue = document.getElementById('temp-value');
  if (tempSlider && tempValue) {
    tempSlider.addEventListener('input', (e) => {
      tempValue.textContent = e.target.value;
      saveAdvancedParams();
    });
  }

  const topPSlider = document.getElementById('top-p');
  const topPValue = document.getElementById('topp-value');
  if (topPSlider && topPValue) {
    topPSlider.addEventListener('input', (e) => {
      topPValue.textContent = e.target.value;
      saveAdvancedParams();
    });
  }

  const maxTokensInput = document.getElementById('max-tokens');
  if (maxTokensInput) {
    maxTokensInput.addEventListener('change', saveAdvancedParams);
  }

  const streamCheckbox = document.getElementById('stream-enabled');
  if (streamCheckbox) {
    streamCheckbox.addEventListener('change', saveAdvancedParams);
  }

  const webSearchCheckbox = document.getElementById('web-search-enabled');
  if (webSearchCheckbox) {
    webSearchCheckbox.addEventListener('change', saveAdvancedParams);
  }
});

/* ========== 跨标签页同步 ========== */
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') {
    applyTheme(e.newValue || 'pink');
  }
  if (e.key === 'buttonColor') {
    if (e.newValue) {
      loadCustomButtonColor();
    } else {
      const theme = localStorage.getItem('theme') || 'pink';
      applyTheme(theme);
    }
  }
  if (e.key === 'customCSS' || e.key === 'customCSSEnabled') {
    loadCustomCSS();
  }
  if (e.key === STORAGE_KEY) {
    loadConfigs();
    renderConfigList();
  }
  if (e.key === BINDINGS_KEY) {
    loadBindings();
    renderBindings();
  }
});
