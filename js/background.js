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
    
    // 优先使用mock.method，mtParam作为备选
    const requestMethod = mock.method || mtParam || 'GET';
    
    // 确保mtParam使用requestMethod的值，因为mock.url可能已经没有MT参数了
    mtParam = requestMethod;
    
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
    if (requestMethod) {
      // 使用类似正则的语法匹配精确的MT参数
      // 确保MT参数值完全匹配
      // 仅在不存在?时添加?
      const separator = fullUrlFilter.includes('?') ? '&' : '?';
      fullUrlFilter = `${fullUrlFilter}${separator}MT=${requestMethod}*`;
    }
    
    // 获取HTTP请求方法 - 转换为小写以符合Chrome API要求
    // 注意：项目请求协议永远是POST，只会在URL参数MT上传入真实的请求类型
    const httpMethod = 'post'; // 硬编码为post，因为实际HTTP请求方法总是POST
    
    const condition = {
      urlFilter: fullUrlFilter, // 匹配包含MT参数的精确路径
      resourceTypes: ['xmlhttprequest'],
      requestMethods: [httpMethod] // 硬编码为post，因为实际HTTP请求方法总是POST
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
    case 'deleteAllMocks':
      deleteAllMocks().then(sendResponse);
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
    case 'updateMockMethod':
      updateMockMethod(message.mockId, message.newMethod).then(sendResponse);
      return true;
    case 'updateMockUrl':
      updateMockUrl(message.mockId, message.newUrl).then(sendResponse);
      return true;
  }
});

// 更新模拟的请求方法
async function updateMockMethod(mockId, newMethod) {
  const { mocks } = await chrome.storage.local.get(['mocks']);
  const mockIndex = mocks.findIndex(m => m.id === mockId);
  
  if (mockIndex !== -1) {
    mocks[mockIndex].method = newMethod;
    await chrome.storage.local.set({ mocks });
    await updateRules();
    return { success: true, mocks };
  }
  
  return { success: false };
}

// 更新模拟的URL
async function updateMockUrl(mockId, newUrl) {
  const { mocks } = await chrome.storage.local.get(['mocks']);
  const mockIndex = mocks.findIndex(m => m.id === mockId);
  
  if (mockIndex !== -1) {
    // 获取旧URL，用于比较
    const oldUrl = mocks[mockIndex].url;
    
    // 替换URL中的<ID>为*，用于内部处理
    const processedUrl = newUrl.replace(/<[^>]+>/g, '*');
    
    mocks[mockIndex].url = processedUrl;
    
    await chrome.storage.local.set({ mocks });
    
    // 只有当URL真正改变时，才更新规则
    if (processedUrl !== oldUrl) {
      await updateRules();
    }
    
    return { success: true, mocks };
  }
  
  return { success: false };
}

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

async function deleteAllMocks() {
  await chrome.storage.local.set({ mocks: [] });
  return { success: true, mocks: [] };
}

async function getMocks() {
  const { mocks } = await chrome.storage.local.get(['mocks']);
  return { mocks };
}