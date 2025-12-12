// API Mock Sidebar 扩展的侧边栏脚本

// DOM元素
const mockForm = document.getElementById('mockForm');
const urlInput = document.getElementById('urlInput');
const methodSelect = document.getElementById('methodSelect');
const responseInput = document.getElementById('responseInput');
const mockDataSection = document.querySelector('.mock-data-section');
const mockDataContainer = document.getElementById('mockDataContainer');
const saveMockBtn = document.getElementById('saveMockBtn');
const savedMocksList = document.getElementById('savedMocksList');
const globalToggle = document.getElementById('globalToggle');
const harFileInput = document.getElementById('harFileInput');
const harImportBtn = document.querySelector('.har-import');
const aiMockBtn = document.getElementById('aiMockBtn');

// 模拟数据生成函数 - 现在返回真实响应的原始数据
function generateMockData(structure) {
  // 对于真实响应数据，直接返回，不生成新的模拟值
  // 这保留了用户输入的原始值
  if (Array.isArray(structure)) {
    return structure.map(item => generateMockData(item));
  } else if (typeof structure === 'object' && structure !== null) {
    const mockData = {};
    for (const key in structure) {
      // 递归处理嵌套对象/数组
      mockData[key] = generateMockData(structure[key]);
    }
    return mockData;
  } else {
    // 对于原始值，返回结构中的原始值
    // 这保留了用户响应中的实际数据
    return structure;
  }
}

function generateMockValue(value) {
  const type = typeof value;
  switch (type) {
    case 'string':
      // 根据上下文生成更真实的字符串值
      if (value.toLowerCase().includes('name')) {
        return 'Mock Name';
      } else if (value.toLowerCase().includes('id')) {
        return 'mock_id_123';
      } else if (value.toLowerCase().includes('serial')) {
        return 'SERIAL-123456789';
      } else if (value.toLowerCase().includes('version')) {
        return '1.0.0';
      } else if (value.toLowerCase().includes('model')) {
        return 'Mock-Model-X';
      } else if (value.toLowerCase().includes('temperature')) {
        return '25°C';
      } else {
        return 'mock_string_value';
      }
    case 'number':
      // 生成真实的数字
      if (value === 0) {
        // 如果默认值是0，生成一个真实的正数
        return Math.floor(Math.random() * 100) + 1;
      } else if (value % 1 !== 0) {
        // 对于小数
        return parseFloat((Math.random() * 10).toFixed(1));
      } else {
        return value;
      }
    case 'boolean':
      // 随机布尔值
      return Math.random() > 0.5;
    case 'object':
      if (value === null) return null;
      if (Array.isArray(value)) {
        // 如果数组有现有项，生成类似的项
        if (value.length > 0) {
          return [generateMockValue(value[0])];
        } else {
          return [];
        }
      }
      return {};
    default:
      return '';
  }
}

// 从用户输入中解析响应结构
function parseResponseStructure(responseText) {
  try {
    // 先移除注释
    let cleanedText = responseText.replace(/\/\*.*?\*\//gs, '').trim();
    
    // 解析JSON
    let parsedJson = JSON.parse(cleanedText);
    
    // 过滤掉@前缀的字段（注释字段），只保留实际数据字段
    function filterCommentFields(obj) {
      if (Array.isArray(obj)) {
        return obj.map(item => filterCommentFields(item));
      } else if (typeof obj === 'object' && obj !== null) {
        const filtered = {};
        for (const key in obj) {
          // 跳过@前缀的字段（注释字段）
          if (!key.startsWith('@')) {
            const value = obj[key];
            // 递归过滤嵌套对象/数组
            filtered[key] = filterCommentFields(value);
          }
        }
        return filtered;
      }
      // 原始值保持不变
      return obj;
    }
    
    // 应用过滤以移除注释字段
    const filteredJson = filterCommentFields(parsedJson);
    return filteredJson;
  } catch (error) {
    console.error('解析响应结构错误:', error);
    // 使用showErrorMessage函数代替alert，保持一致的交互体验
    showErrorMessage('无效的JSON格式。请检查您的响应结构。');
    return null;
  }
}

// 处理URL以支持两种输入格式
function processUrl(url, method) {
  let path = '';
  let mtParam = '';
  
  // 检查URL是否以http(s)://开头（完整URL）
  if (url.match(/^https?:\/\//)) {
    // 完整URL格式: https://example.com/api/20?MT=GET
    const urlObj = new URL(url);
    
    // 提取路径和MT参数，忽略原点（协议 + IP/主机）
    path = urlObj.pathname;
    mtParam = urlObj.searchParams.get('MT') || method;
  } else {
    // 仅路径格式: /api/<ID>/resource?MT=GET
    const [pathPart, queryPart] = url.split('?');
    path = pathPart;
    
    // 如果存在查询字符串，提取MT参数
    if (queryPart) {
      const mtMatch = queryPart.match(/MT=([^&]+)/);
      mtParam = mtMatch ? mtMatch[1] : method;
    } else {
      mtParam = method;
    }
  }
  
  // 将<ID>和其他类似占位符替换为*通配符
  let processedPath = path.replace(/<[^>]+>/g, '*');
  
  // 将路径中的所有数字ID替换为*通配符（支持多个ID）
  // 如果第一个段只是数字，则不替换（避免开头出现/*/）
  if (processedPath.startsWith('/')) {
    // 将路径分割为段
    const segments = processedPath.split('/').filter(Boolean);
    // 处理除第一个段以外的每个段
    const processedSegments = segments.map((segment, index) => {
      // 仅替换不是第一个段的数字段
      if (index > 0 && /^\d+$/.test(segment)) {
        return '*';
      }
      return segment;
    });
    // 重建路径
    processedPath = '/' + processedSegments.join('/');
  } else {
    // 非绝对路径的回退处理
    processedPath = processedPath.replace(/\/\d+(?=\/|$)/g, '/*');
  }
  
  // 仅使用路径和MT参数重建URL，忽略协议和IP
  return `${processedPath}?MT=${mtParam.toUpperCase()}`;
}

// 渲染带有可折叠部分和数组管理功能的模拟数据编辑器
function renderMockDataEditor(mockData, parentElement, path = '') {
  parentElement.innerHTML = '';
  
  for (const key in mockData) {
    const value = mockData[key];
    const currentPath = path ? `${path}.${key}` : key;
    
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'mock-field-container';
    
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        // 处理带有可折叠部分和添加/删除功能的数组
        const arrayField = document.createElement('div');
        arrayField.className = 'mock-field';
        
        // 创建可折叠头部
        const collapsibleHeader = document.createElement('div');
        collapsibleHeader.className = 'collapsible-header';
        collapsibleHeader.textContent = `${key} (数组, ${value.length} 项)`;
        arrayField.appendChild(collapsibleHeader);
        
        // Create array content container
        const arrayContainer = document.createElement('div');
        arrayContainer.className = 'mock-array';
        
        // Render array items
        value.forEach((item, index) => {
          const itemContainer = document.createElement('div');
          itemContainer.className = 'mock-array-item';
          
          // Add remove button
          const removeBtn = document.createElement('button');
          removeBtn.className = 'remove-item-btn';
          removeBtn.textContent = '删除';
          removeBtn.addEventListener('click', () => {
            value.splice(index, 1);
            renderMockDataEditor(mockData, parentElement, path);
          });
          itemContainer.appendChild(removeBtn);
          
          // Render item content
          renderMockDataEditor(item, itemContainer, `${currentPath}[${index}]`);
          arrayContainer.appendChild(itemContainer);
        });
        
        // Add array actions (add item)
        const arrayActions = document.createElement('div');
        arrayActions.className = 'array-actions';
        
        const addBtn = document.createElement('button');
        addBtn.textContent = '增加项';
        addBtn.addEventListener('click', () => {
          let newItem;
          
          if (value.length > 0) {
            // If array has existing items, use their structure
            newItem = JSON.parse(JSON.stringify(value[0]));
          } else {
            // If array is empty, try to get structure from original response structure
            try {
              // Get the corresponding structure from the original response structure
              const structurePath = path ? `${path}.${key}` : key;
              const structureParts = structurePath.split('.');
              let currentStructure = window.currentMock?.responseStructure;
              
              // Navigate to the array structure
              for (const part of structureParts) {
                if (currentStructure && typeof currentStructure === 'object') {
                  const arrayMatch = part.match(/(\w+)\[(\d+)\]/);
                  if (arrayMatch) {
                    const arrayName = arrayMatch[1];
                    if (Array.isArray(currentStructure[arrayName])) {
                      currentStructure = currentStructure[arrayName][0];
                    } else {
                      currentStructure = null;
                    }
                  } else {
                    currentStructure = currentStructure[part];
                  }
                } else {
                  currentStructure = null;
                  break;
                }
              }
              
              // Generate mock data from the structure
              if (currentStructure && typeof currentStructure === 'object') {
                newItem = generateMockData(currentStructure);
              } else {
                // Fallback to empty object if structure not found
                newItem = {};
              }
            } catch (error) {
              console.error('Error generating new array item:', error);
              newItem = {};
            }
          }
          
          // Add the new item to the array
          value.push(newItem);
          renderMockDataEditor(mockData, parentElement, path);
        });
        arrayActions.appendChild(addBtn);
        arrayContainer.appendChild(arrayActions);
        
        arrayField.appendChild(arrayContainer);
        fieldContainer.appendChild(arrayField);
        
        // Add collapse functionality
        collapsibleHeader.addEventListener('click', () => {
          collapsibleHeader.classList.toggle('collapsed');
          arrayContainer.classList.toggle('collapsed');
        });
      } else {
        // Handle objects with collapsible sections
        const objectField = document.createElement('div');
        objectField.className = 'mock-field';
        
        // Create collapsible header
        const collapsibleHeader = document.createElement('div');
        collapsibleHeader.className = 'collapsible-header';
        collapsibleHeader.textContent = key;
        objectField.appendChild(collapsibleHeader);
        
        // Create object content container
        const objectContainer = document.createElement('div');
        objectContainer.className = 'mock-object';
        
        // Render object properties
        renderMockDataEditor(value, objectContainer, currentPath);
        objectField.appendChild(objectContainer);
        fieldContainer.appendChild(objectField);
        
        // Add collapse functionality
        collapsibleHeader.addEventListener('click', () => {
          collapsibleHeader.classList.toggle('collapsed');
          objectContainer.classList.toggle('collapsed');
        });
      }
    } else {
        // Handle primitive values
        const primitiveField = document.createElement('div');
        primitiveField.className = 'mock-field';
        
        const fieldLabel = document.createElement('label');
        fieldLabel.textContent = key;
        primitiveField.appendChild(fieldLabel);
        
        const fieldInput = document.createElement('input');
        fieldInput.type = typeof value === 'boolean' ? 'checkbox' : 'text';
        fieldInput.value = typeof value === 'boolean' ? value : String(value);
        fieldInput.checked = typeof value === 'boolean' ? value : false;
        fieldInput.dataset.path = currentPath;
        
        // Set default values for ErrorModule and ErrorCode
        if (key === 'ErrorModule' || key === 'ErrorCode') {
          fieldInput.value = '0';
        }
        
        // Add data-value attribute for boolean fields to show current value
        if (typeof value === 'boolean') {
          primitiveField.dataset.value = value ? 'true' : 'false';
          
          // Update data-value when checkbox is toggled
          fieldInput.addEventListener('change', () => {
            primitiveField.dataset.value = fieldInput.checked ? 'true' : 'false';
          });
        }
        
        primitiveField.appendChild(fieldInput);
        fieldContainer.appendChild(primitiveField);
      }
    
    parentElement.appendChild(fieldContainer);
  }
}

// 从编辑器更新模拟数据
function updateMockDataFromEditor(mockData, container) {
  const inputs = container.querySelectorAll('input[data-path]');
  
  inputs.forEach(input => {
    const path = input.dataset.path;
    const value = input.type === 'checkbox' ? input.checked : 
                 input.value === '' ? '' :
                 isNaN(input.value) ? input.value : Number(input.value);
    
    // 使用路径更新模拟数据
    const pathParts = path.split('.');
    let current = mockData;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      const arrayMatch = part.match(/(\w+)\[(\d+)\]/);
      if (arrayMatch) {
        const arrayName = arrayMatch[1];
        const index = parseInt(arrayMatch[2]);
        current = current[arrayName][index];
      } else {
        current = current[part];
      }
    }
    
    const lastPart = pathParts[pathParts.length - 1];
    const arrayMatch = lastPart.match(/(\w+)\[(\d+)\]/);
    if (arrayMatch) {
      const arrayName = arrayMatch[1];
      const index = parseInt(arrayMatch[2]);
      const fieldName = arrayMatch[1];
      current[arrayName][index] = value;
    } else {
      current[lastPart] = value;
    }
  });
  
  return mockData;
}

// 渲染已保存的模拟列表
function renderSavedMocks() {
  chrome.runtime.sendMessage({ action: 'getMocks' }, (response) => {
    const mocks = response.mocks;
    savedMocksList.innerHTML = '';
    
    if (mocks.length === 0) {
    savedMocksList.innerHTML = '<p>无保存的模拟</p>';
    return;
  }
    
    mocks.forEach(mock => {
      const mockItem = document.createElement('div');
      mockItem.className = 'mock-item';
      
      const mockHeader = document.createElement('div');
      mockHeader.className = 'mock-header';
      
      // 创建状态指示器（启用为绿色点，禁用为红色点）
      const statusIndicator = document.createElement('div');
      statusIndicator.className = `status-indicator ${mock.enabled ? 'enabled' : 'disabled'}`;
      
      // 创建URL和方法信息的容器
      const urlInfoContainer = document.createElement('div');
      urlInfoContainer.className = 'url-info-container';
      
      // 处理URL以仅显示带ID占位符的路径
      let displayUrl = mock.originalUrl || mock.url;
      try {
        // 检查URL是否包含<ID>或类似占位符
        const hasPlaceholders = /<[^>]+>/.test(displayUrl);
        
        // 从mock的原始URL中提取MT参数（如果可用）
        let mtParam = 'GET';
        let path = '';
        
        // 尝试从URL中提取MT参数，无论是否有占位符
        if (displayUrl.includes('?')) {
          const queryPart = displayUrl.split('?')[1];
          const mtMatch = queryPart.match(/MT=([^&]+)/);
          if (mtMatch) {
            mtParam = mtMatch[1].toUpperCase();
          }
        }
        
        if (hasPlaceholders) {
          // 特殊处理带有占位符的URL以保留它们
          // 从URL中提取路径
          const [pathPart] = displayUrl.split('?');
          path = pathPart;
        } else {
          // 对没有占位符的URL进行正常处理
          const urlObj = new URL(displayUrl, 'http://example.com');
          path = urlObj.pathname;
          
          // 将数字ID替换为<ID>占位符
          path = path.replace(/\/\d+(?=\/|$)/g, '/<ID>');
        }
        
        // 创建URL显示元素
        const mockUrl = document.createElement('div');
        mockUrl.className = 'mock-url';
        mockUrl.textContent = path;
        
        // 创建方法徽章
        const methodBadge = document.createElement('span');
        methodBadge.className = `method-badge ${mtParam.toLowerCase()}`;
        methodBadge.textContent = mtParam;
        
        // 添加到容器
        urlInfoContainer.appendChild(mockUrl);
        urlInfoContainer.appendChild(methodBadge);
      } catch (error) {
        // 无效URL的回退处理
        const mockUrl = document.createElement('div');
        mockUrl.className = 'mock-url';
        mockUrl.textContent = displayUrl;
        urlInfoContainer.appendChild(mockUrl);
      }
      
      const mockActions = document.createElement('div');
      mockActions.className = 'mock-actions';
      
      const toggleBtn = document.createElement('button');
      toggleBtn.className = `toggle-btn ${mock.enabled ? 'enabled' : 'disabled'}`;
      toggleBtn.textContent = mock.enabled ? '已启用' : '已禁用';
      toggleBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'toggleMock', mockId: mock.id }, (response) => {
          if (response.success) {
            renderSavedMocks();
          }
        });
      });
      
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.textContent = '编辑';
      editBtn.addEventListener('click', () => {
        // 编辑按钮点击处理程序
        editMock(mock);
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '删除';
      deleteBtn.addEventListener('click', () => {
        if (confirm('确定要删除这个模拟吗？')) {
          chrome.runtime.sendMessage({ action: 'deleteMock', mockId: mock.id }, (response) => {
            if (response.success) {
              renderSavedMocks();
            }
          });
        }
      });
      
      mockActions.appendChild(editBtn);
      mockActions.appendChild(toggleBtn);
      mockActions.appendChild(deleteBtn);
      
      mockHeader.appendChild(statusIndicator);
      mockHeader.appendChild(urlInfoContainer);
      mockHeader.appendChild(mockActions);
      
      mockItem.appendChild(mockHeader);
      savedMocksList.appendChild(mockItem);
    });
  });
}

// 事件监听器
// 带有提示消息的表单验证函数
function validateForm() {
  const originalUrl = urlInput.value.trim();
  const responseText = responseInput.value.trim();
  
  // 清除之前的错误样式
  urlInput.style.borderColor = '';
  responseInput.style.borderColor = '';
  
  if (!originalUrl && !responseText) {
    showErrorMessage('请填写URL和响应结构。');
    urlInput.style.borderColor = '#f56565';
    responseInput.style.borderColor = '#f56565';
    return false;
  } else if (!originalUrl) {
    showErrorMessage('请填写URL。');
    urlInput.style.borderColor = '#f56565';
    return false;
  } else if (!responseText) {
    showErrorMessage('请填写响应结构。');
    responseInput.style.borderColor = '#f56565';
    return false;
  }
  
  // 验证URL格式（支持完整URL或仅路径格式）
  const urlPattern = /^(https?:\/\/[^\s]+|\/[^\s?]+(\?[^\s]*)?)$/;
  if (!urlPattern.test(originalUrl)) {
    showErrorMessage('请输入有效的URL格式，支持完整URL或路径格式。');
    urlInput.style.borderColor = '#f56565';
    return false;
  }
  
  // 验证响应结构（必须是有效的JSON）
  try {
    // 先移除注释（与parseResponseStructure相同）
    let cleanedText = responseText.replace(/\/\*.*?\*\//gs, '').trim();
    // 尝试解析为JSON
    JSON.parse(cleanedText);
  } catch (error) {
    showErrorMessage('请输入有效的JSON格式作为响应结构。');
    responseInput.style.borderColor = '#f56565';
    return false;
  }
  
  return true;
}

mockForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  if (!validateForm()) {
    return;
  }
  
  const originalUrl = urlInput.value.trim();
  const selectedMethod = methodSelect.value;
  const responseText = responseInput.value.trim();
  
  // Show loading state
  const submitBtn = e.submitter;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Generating...';
  submitBtn.disabled = true;
  
  // Process URL to support both formats
  const processedUrl = processUrl(originalUrl, selectedMethod);
  
  // Parse response structure
  const responseStructure = parseResponseStructure(responseText);
  if (!responseStructure) {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    return;
  }
  
  // Generate mock data
  let mockData = generateMockData(responseStructure);
  
  // Ensure ErrorModule and ErrorCode are 0
  if (mockData.ResponseStatus) {
    mockData.ResponseStatus.ErrorModule = 0;
    mockData.ResponseStatus.ErrorCode = 0;
  }
  
  // Render mock data editor with animation
  renderMockDataEditor(mockData, mockDataContainer);
  
  // Show mock data section with slide-in animation
  mockDataSection.style.display = 'block';
  mockDataSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  // Save mock data and original structure for later use
  window.currentMock = {
    originalUrl,
    url: processedUrl,
    method: selectedMethod,
    mockData,
    responseStructure // Save original structure for generating new array items
  };
  
  // Restore button state
  submitBtn.textContent = originalText;
  submitBtn.disabled = false;
});

saveMockBtn.addEventListener('click', () => {
  if (!window.currentMock) return;
  
  // Update mock data from editor
  const updatedMockData = updateMockDataFromEditor(window.currentMock.mockData, mockDataContainer);
  
  // Create mock object with 32-bit integer ID (1 to 2147483647)
  const mock = {
    id: window.currentMock.id || (Date.now() + Math.random() * 1000).toString().replace('.', ''),
    originalUrl: window.currentMock.originalUrl,
    url: window.currentMock.url,
    method: window.currentMock.method,
    mockData: updatedMockData,
    enabled: true
  };
  
  // Show saving state
  const originalText = saveMockBtn.textContent;
  saveMockBtn.textContent = 'Saving...';
  saveMockBtn.disabled = true;
  
  // Save mock to storage
  chrome.runtime.sendMessage({ action: 'saveMock', mock }, (response) => {
    if (response.success) {
      // Show success message with animation
      const successMsg = document.createElement('div');
      successMsg.textContent = 'Mock saved successfully!';
      successMsg.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        animation: slideInRight 0.3s ease-out;
      `;
      
      // Add animation keyframes
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(successMsg);
      
      // Hide message after 3 seconds
      setTimeout(() => {
        successMsg.remove();
        style.remove();
      }, 3000);
      
      // Reset form and hide mock section
      mockForm.reset();
      mockDataSection.style.display = 'none';
      window.currentMock = null;
      renderSavedMocks();
    } else {
        alert('保存模拟失败。请重试。');
      }
    
    // Restore button state
    saveMockBtn.textContent = originalText;
    saveMockBtn.disabled = false;
  });
});

// Edit mock function
function editMock(mock) {
  // Populate form fields with mock data
  urlInput.value = mock.originalUrl || mock.url;
  
  // Extract method from MT parameter or use default GET
  let method = 'GET';
  if (mock.url) {
    const urlObj = new URL(mock.url, 'http://example.com');
    const mtParam = urlObj.searchParams.get('MT');
    if (mtParam) {
      method = mtParam.toUpperCase();
    }
  }
  methodSelect.value = method;
  
  // Convert mock data to JSON string for response input
  const responseText = JSON.stringify(mock.mockData, null, 2);
  responseInput.value = responseText;
  
  // Parse response structure and generate mock data
  const responseStructure = parseResponseStructure(responseText);
  if (responseStructure) {
    let mockData = generateMockData(responseStructure);
    
    // Ensure ErrorModule and ErrorCode are 0
    if (mockData.ResponseStatus) {
      mockData.ResponseStatus.ErrorModule = 0;
      mockData.ResponseStatus.ErrorCode = 0;
    }
    
    // Render mock data editor
    renderMockDataEditor(mockData, mockDataContainer);
    
    // Show mock data section
    mockDataSection.style.display = 'block';
    mockDataSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Save mock data and original structure for later use, including the original mock id
  window.currentMock = {
    id: mock.id,
    originalUrl: mock.originalUrl || mock.url,
    url: mock.url,
    method: mock.method || method, // Use saved method or extracted method
    mockData,
    responseStructure
  };
  }
}

// 初始化全局模拟开关状态
function initGlobalToggle() {
  // 从存储中获取全局开关状态
  chrome.runtime.sendMessage({ action: 'getGlobalState' }, (response) => {
    if (response && typeof response.enabled !== 'undefined') {
      globalToggle.checked = response.enabled;
      // 根据全局状态显示/隐藏已保存的模拟
      toggleSavedMocksVisibility(response.enabled);
    }
  });
  
  // 为全局开关变化添加事件监听器
  globalToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.runtime.sendMessage({ action: 'setGlobalState', enabled });
    // 根据开关状态显示/隐藏已保存的模拟
    toggleSavedMocksVisibility(enabled);
  });
}

// 切换已保存模拟可见性的辅助函数
function toggleSavedMocksVisibility(show) {
  const savedMocksContainer = savedMocksList.parentElement;
  if (show) {
    savedMocksList.style.display = 'block';
  } else {
    savedMocksList.style.display = 'none';
  }
}

// 初始化HAR导入功能
function initHarImport() {
  // 处理HAR文件选择
  harFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 验证文件扩展名
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.har')) {
      showErrorMessage('请选择HAR格式的文件');
      harFileInput.value = '';
      return;
    }
    
    try {
      // 显示加载状态
      harImportBtn.style.pointerEvents = 'none';
      harImportBtn.style.opacity = '0.6';
      
      // 读取并解析HAR文件
      const content = await readFileAsText(file);
      const harData = JSON.parse(content);
      
      // 处理HAR数据并提取模拟
      const mocks = extractMocksFromHar(harData);
      
      // 保存模拟到存储
      if (mocks.length > 0) {
        for (const mock of mocks) {
          await saveMockToStorage(mock);
        }
        
        // 显示成功消息
        showSuccessMessage(`成功从HAR文件导入${mocks.length}个模拟`);
        
        // 刷新已保存的模拟列表
        renderSavedMocks();
      } else {
        showErrorMessage('在HAR文件中未找到有效的API请求');
      }
    } catch (error) {
      console.error('导入HAR文件错误:', error);
      showErrorMessage('导入HAR文件失败。请检查文件格式。');
    } finally {
      // 重置文件输入和按钮状态
      harFileInput.value = '';
      harImportBtn.style.pointerEvents = 'auto';
      harImportBtn.style.opacity = '1';
    }
  });
}

// 将文件读取为文本的辅助函数
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// 从HAR数据中提取模拟的辅助函数
function extractMocksFromHar(harData) {
  const mocks = [];
  
  // 检查HAR数据是否有条目
  if (!harData.log || !harData.log.entries) {
    return mocks;
  }
  
  // 处理HAR文件中的每个条目
  harData.log.entries.forEach((entry) => {
    try {
      // 跳过非HTTP请求或没有响应的请求
      if (!entry.request || !entry.response) return;
      
      // 获取请求URL
      const url = entry.request.url;
      
      // 跳过没有有效URL的请求
      if (!url || typeof url !== 'string') return;
      
      // 跳过非API请求（您可以根据需要调整此过滤器）
      if (!url.includes('ISAPI')) return;
      
      // 获取响应状态和内容
      const status = entry.response.status;
      const content = entry.response.content;
      
      // 跳过没有内容的响应
      if (!content || !content.text) return;
      
      // 尝试将响应内容解析为JSON
      let mockData;
      try {
        mockData = JSON.parse(content.text);
      } catch (parseError) {
        // 跳过不是有效JSON的响应
        return;
      }
      
      // 从URL中提取MT参数（如果存在）
      let mtParam = 'GET'; // 默认使用GET
      try {
        const urlObj = new URL(url);
        const mt = urlObj.searchParams.get('MT');
        if (mt) {
          mtParam = mt.toUpperCase();
        }
      } catch (urlParseError) {
        // 跳过无效URL
        return;
      }
      
      // 处理URL以匹配我们的模拟格式
      const processedUrl = processUrl(url, mtParam);
      
      // 创建模拟对象
      const mock = {
        id: (Date.now() + Math.random() * 1000).toString().replace('.', ''),
        originalUrl: url,
        url: processedUrl,
        method: mtParam.toUpperCase(), // 对HAR导入使用MT参数值作为方法
        mockData,
        enabled: true
      };
      
      // 将模拟添加到列表
      mocks.push(mock);
    } catch (error) {
      console.error('处理HAR条目错误:', error);
    }
  });
  
  return mocks;
}

// 将模拟保存到存储的辅助函数
function saveMockToStorage(mock) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'saveMock', mock }, (response) => {
      if (response && response.success) {
        resolve(response);
      } else {
        reject(new Error('保存模拟失败'));
      }
    });
  });
}

// 辅助函数：显示成功消息  
function showSuccessMessage(message) {
  const successMsg = document.createElement('div');
  successMsg.textContent = message;
  successMsg.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    animation: slideInRight 0.3s ease-out;
  `;
  
  // 如果动画关键帧不存在，则添加
  if (!document.getElementById('slideInKeyframes')) {
    const style = document.createElement('style');
    style.id = 'slideInKeyframes';
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(successMsg);
  
  // 3秒后隐藏消息
  setTimeout(() => {
    successMsg.remove();
  }, 3000);
}

// 辅助函数：显示错误消息
function showErrorMessage(message) {
  const errorMsg = document.createElement('div');
  errorMsg.textContent = message;
  errorMsg.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    animation: slideInRight 0.3s ease-out;
  `;
  
  document.body.appendChild(errorMsg);
  
  // 3秒后隐藏消息
  setTimeout(() => {
    errorMsg.remove();
  }, 3000);
}

// 创建AIMock实例
const aiMock = new AIMock();

// 初始化AI Mock功能
async function initAIMock() {
  const supportResult = await aiMock.checkSupport();
  
  if (supportResult.supported) {
    // 启用AI模拟按钮
    aiMockBtn.disabled = false;
    showSuccessMessage(supportResult.message);
    
    // 添加点击事件监听器
    aiMockBtn.addEventListener('click', async () => {
      await handleAIMockClick();
    });
  } else {
    // 如果不支持，禁用AI模拟按钮
    aiMockBtn.disabled = true;
    showErrorMessage(supportResult.error);
  }
}

// 处理AI模拟按钮点击
async function handleAIMockClick() {
  if (!validateForm()) {
    return;
  }
  
  const responseText = responseInput.value.trim();
  
  try {
    // 显示加载状态
    aiMockBtn.textContent = '生成中...';
    aiMockBtn.disabled = true;
    
    // 使用AI生成模拟数据
    const generatedMock = await aiMock.generateMockData(responseText);
    
    // 使用现有的generateMockData函数处理模拟数据
    const mockData = aiMock.processMockData(generatedMock, generateMockData);
    
    // 渲染模拟数据编辑器（带动画效果）
    renderMockDataEditor(mockData, mockDataContainer);
    
    // 显示模拟数据部分（带动画效果）
    mockDataSection.style.display = 'block';
    mockDataSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // 保存模拟数据和原始结构供以后使用
    window.currentMock = {
      originalUrl: urlInput.value.trim(),
      url: '', // 稍后处理
      method: methodSelect.value, // 使用下拉选择的方法
      mockData,
      responseStructure: generatedMock // 保存原始结构，用于生成新的数组项
    };
    
    showSuccessMessage('AI mock数据生成成功！');
  } catch (error) {
    console.error('生成AI mock数据时出错:', error);
    showErrorMessage(error.message);
  } finally {
    // 恢复按钮状态
    aiMockBtn.textContent = 'AI 生成模拟';
    aiMockBtn.disabled = false;
  }
}

// 初始化所有功能
async function init() {
  renderSavedMocks();
  initGlobalToggle();
  initHarImport();
  await initAIMock();
  
  // 添加URL输入框失去焦点事件监听器，根据MT参数自动更新方法选择
  urlInput.addEventListener('blur', () => {
    const originalUrl = urlInput.value;
    const trimmedUrl = originalUrl.trim();
    
    // 保存修剪后的URL回输入框
    if (originalUrl !== trimmedUrl) {
      urlInput.value = trimmedUrl;
    }
    
    if (!trimmedUrl) return;
    
    try {
      let mtParam = '';
      
      // 检查URL是否以http(s)://开头（完整URL）
      if (trimmedUrl.match(/^https?:\/\//)) {
        // 完整URL格式：https://example.com/api/20?MT=GET
        const urlObj = new URL(trimmedUrl);
        mtParam = urlObj.searchParams.get('MT');
      } else {
        // 路径仅格式：/api/<ID>/resource?MT=GET
        const [, queryPart] = trimmedUrl.split('?');
        if (queryPart) {
          const mtMatch = queryPart.match(/MT=([^&]+)/);
          if (mtMatch) {
            mtParam = mtMatch[1];
          }
        }
      }
      
      // 如果MT参数存在且是有效方法，更新方法选择
      if (mtParam) {
        const method = mtParam.toUpperCase();
        // 检查方法是否在选择选项中
        const optionExists = Array.from(methodSelect.options).some(option => option.value === method);
        if (optionExists) {
          methodSelect.value = method;
        }
      }
    } catch (error) {
      console.error('解析URL时出错，无法更新方法选择:', error);
      // 静默失败，不更新方法选择
    }
  });
}

// 开始初始化所有功能
init();