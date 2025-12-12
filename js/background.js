// API Mock Sidebar 扩展的背景脚本

// 当点击扩展图标时打开侧边栏
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// 如果存储不存在则初始化
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['mocks'], (result) => {
    if (!result.mocks) {
      chrome.storage.local.set({ mocks: [] });
    }
  });
});

// 当模拟数据变化时更新 declarativeNetRequest 规则
async function updateRules() {
  const { mocks, globalEnabled } = await chrome.storage.local.get(['mocks', 'globalEnabled']);
  
  // 检查全局模拟开关是否禁用
  if (!globalEnabled) {
    // 如果全局开关禁用则移除所有规则
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const extensionRuleIds = existingRules
      .filter(rule => rule.id >= 1 && rule.id <= 65535)
      .map(rule => rule.id);
    
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: extensionRuleIds,
      addRules: []
    });
    return;
  }
  
  // 为启用的模拟创建规则
  const rules = mocks.filter(mock => mock.enabled).map((mock, index) => {
    // 解析URL以提取路径和MT参数
    let path = '';
    let mtParam = '';
    
    try {
      // 尝试解析为URL（大多数情况下也适用于仅路径URL）
      const urlObj = new URL(mock.url, 'http://example.com'); // 为仅路径URL使用虚拟源
      path = urlObj.pathname;
      mtParam = urlObj.searchParams.get('MT') || '';
    } catch (error) {
      // 边缘情况的备用解析
      const [pathPart, queryPart] = mock.url.split('?');
      path = pathPart;
      
      // 如果存在查询字符串，提取MT参数
      if (queryPart) {
        const mtMatch = queryPart.match(/MT=([^&]+)/);
        if (mtMatch) {
          mtParam = mtMatch[1];
        }
      }
    }
    
    // 使用mock.method（如果可用），否则使用mtParam
    const requestMethod = mock.method || mtParam || 'GET';
    
    // 创建匹配任何源 + 路径的URL过滤器
    // * 前缀匹配任何协议 + 域 + 端口
    // 确保路径以/开头且过滤器没有双斜杠
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const urlFilter = `*${normalizedPath}`;
    
    // 创建带有模拟数据的重定向操作
    const redirectAction = {
      type: 'redirect',
      redirect: {
        url: `data:application/json,${encodeURIComponent(JSON.stringify(mock.mockData))}`
      }
    };
    
    // 构建条件对象
    // 结合路径过滤器和MT参数匹配
    let fullUrlFilter = urlFilter;
    
    // 如果存在MT参数，添加精确匹配
    if (mtParam) {
      // 使用类似正则的语法匹配精确的MT参数
      // 确保MT参数值完全匹配
      // 仅在不存在?时添加?
      const separator = fullUrlFilter.includes('?') ? '&' : '?';
      fullUrlFilter = `${fullUrlFilter}${separator}MT=${mtParam}*`;
    }
    
    // 获取HTTP请求方法 - 转换为小写以符合Chrome API要求
    const httpMethod = requestMethod.toLowerCase();
    
    const condition = {
      urlFilter: fullUrlFilter, // 匹配包含MT参数的精确路径
      resourceTypes: ['xmlhttprequest'],
      requestMethods: [httpMethod] // 使用实际请求方法，项目请求协议永远是post，只会在url参数MT上传入真实的请求类型，以确保安全性
    };
    
    // 确保ID是有效的32位整数（1到2147483647）
    let ruleId = parseInt(mock.id);
    // 确保ID为正数且在范围内
    ruleId = Math.abs(ruleId) % 65535;
    // 确保ID至少为1
    ruleId = ruleId || 1;
    
    return {
      id: ruleId,
      priority: 1,
      action: redirectAction,
      condition: condition
    };
  });
  
  // 更新 declarativeNetRequest API 中的规则
  // 只管理本扩展创建的规则
  // 获取所有现有的动态规则
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  
  // 只移除符合我们规则ID模式的规则（1-65535，由我们的扩展生成）
  // 这确保我们不会干扰其他扩展或手动规则
  const extensionRuleIds = existingRules
    .filter(rule => rule.id >= 1 && rule.id <= 65535) // 我们的规则使用此范围内的ID
    .map(rule => rule.id);
  
  // 更新规则：只移除我们扩展的规则，然后添加新规则
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: extensionRuleIds,
    addRules: rules
  });
}

// 在扩展安装时初始化规则
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['mocks', 'globalEnabled'], (result) => {
    if (!result.mocks) {
      chrome.storage.local.set({ mocks: [] });
    }
    
    // 如果不存在全局模拟开关状态，则初始化
    if (typeof result.globalEnabled === 'undefined') {
      chrome.storage.local.set({ globalEnabled: true });
    }
    
    // 无论如何更新规则
    updateRules();
  });
});

// 监听存储变化以更新规则
chrome.storage.onChanged.addListener((changes) => {
  if (changes.mocks) {
    updateRules();
  }
});

// 处理来自侧边栏的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'saveMock':
      saveMock(message.mock).then(sendResponse);
      return true;
    case 'toggleMock':
      toggleMock(message.mockId).then(sendResponse);
      return true;
    case 'deleteMock':
      deleteMock(message.mockId).then(sendResponse);
      return true;
    case 'getMocks':
      getMocks().then(sendResponse);
      return true;
    case 'getGlobalState':
      getGlobalState().then(sendResponse);
      return true;
    case 'setGlobalState':
      setGlobalState(message.enabled).then(sendResponse);
      return true;
  }
});

// 全局状态辅助函数
async function getGlobalState() {
  const { globalEnabled } = await chrome.storage.local.get(['globalEnabled']);
  return { enabled: globalEnabled !== false }; // 如果未设置，默认返回true
}

async function setGlobalState(enabled) {
  await chrome.storage.local.set({ globalEnabled: enabled });
  await updateRules();
  return { success: true, enabled };
}

// 辅助函数
async function saveMock(mock) {
  const { mocks } = await chrome.storage.local.get(['mocks']);
  
  // 如果不存在ID，则生成唯一ID
  if (!mock.id) {
    // 生成唯一ID
    mock.id = (Date.now() + Math.random() * 1000).toString().replace('.', '');
  }
  
  // 检查模拟是否已存在
  const existingIndex = mocks.findIndex(m => m.id === mock.id);
  
  if (existingIndex !== -1) {
    // 更新现有模拟
    mocks[existingIndex] = mock;
  } else {
    // 添加新模拟
    mocks.push(mock);
  }
  
  await chrome.storage.local.set({ mocks });
  return { success: true, mocks };
}

async function toggleMock(mockId) {
  const { mocks } = await chrome.storage.local.get(['mocks']);
  const mock = mocks.find(m => m.id === mockId);
  
  if (mock) {
    mock.enabled = !mock.enabled;
    await chrome.storage.local.set({ mocks });
    return { success: true, mocks };
  }
  
  return { success: false };
}

async function deleteMock(mockId) {
  const { mocks } = await chrome.storage.local.get(['mocks']);
  const updatedMocks = mocks.filter(m => m.id !== mockId);
  await chrome.storage.local.set({ mocks: updatedMocks });
  return { success: true, mocks: updatedMocks };
}

async function getMocks() {
  const { mocks } = await chrome.storage.local.get(['mocks']);
  return { mocks };
}