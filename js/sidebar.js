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
const submitMockBtn = document.getElementById('submitMockBtn');
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

// 渲染VSCode风格的JSON编辑器
function renderMockDataEditor(mockData, parentElement, path = '') {
  parentElement.innerHTML = '';
  
  const jsonElement = document.createElement('div');
  jsonElement.className = 'json-editor';
  parentElement.appendChild(jsonElement);
  
  // 渲染JSON结构
  renderJsonValue(mockData, jsonElement, mockData, path);
}

// 渲染JSON值
function renderJsonValue(value, container, rootData, path = '') {
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      renderJsonArray(value, container, rootData, path);
    } else {
      renderJsonObject(value, container, rootData, path);
    }
  } else {
    renderJsonPrimitive(value, container, rootData, path);
  }
}

// 渲染JSON对象
function renderJsonObject(obj, container, rootData, path = '') {
  const objectContainer = document.createElement('div');
  objectContainer.className = 'json-object';
  
  // 只有非最外层响应体才显示折叠/展开按钮
  if (path !== '') {
    // 添加折叠/展开按钮 - 放在花括号左侧
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-btn';
    collapseBtn.style.marginRight = '4px';
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      collapseBtn.classList.toggle('collapsed');
      const content = objectContainer.querySelector('.collapsible-content');
      const placeholder = objectContainer.querySelector('.collapsed-placeholder');
      if (collapseBtn.classList.contains('collapsed')) {
        content.classList.add('collapsed-content');
        placeholder.style.display = 'inline';
      } else {
        content.classList.remove('collapsed-content');
        placeholder.style.display = 'none';
      }
    });
    objectContainer.appendChild(collapseBtn);
  }
  
  // 渲染左花括号
  const leftBrace = document.createElement('span');
  leftBrace.className = 'json-punctuation';
  leftBrace.textContent = '{';
  objectContainer.appendChild(leftBrace);
  
  // 创建可折叠内容容器
  const collapsibleContent = document.createElement('div');
  collapsibleContent.className = 'collapsible-content';
  
  // 渲染对象内容
  const contentContainer = document.createElement('div');
  contentContainer.className = 'json-container';
  
  const keys = Object.keys(obj);
  keys.forEach((key, index) => {
    const keyContainer = document.createElement('div');
    keyContainer.className = 'json-property';
    
    // 渲染可编辑的键
    const keySpan = document.createElement('span');
    keySpan.className = 'json-key editable';
    keySpan.textContent = `"${key}"`;
    keySpan.dataset.path = path;
    keySpan.dataset.originalKey = key;
    keyContainer.appendChild(keySpan);
    
    // 单独渲染冒号，不包含在键的高亮范围内
    const colon = document.createElement('span');
    colon.className = 'json-punctuation';
    colon.textContent = ': ';
    keyContainer.appendChild(colon);
    
    // 添加键编辑功能
    keySpan.addEventListener('click', () => {
      enableKeyEditMode(keySpan, key, rootData, path);
    });
    
    // 渲染值
    const valuePath = path ? `${path}.${key}` : key;
    renderJsonValue(obj[key], keyContainer, rootData, valuePath);
    
    // 渲染逗号 - 紧跟在值后面，最后一个元素不添加逗号
    if (index < keys.length - 1) {
      const comma = document.createElement('span');
      comma.className = 'json-punctuation';
      comma.textContent = ',';
      keyContainer.appendChild(comma);
    }
    
    contentContainer.appendChild(keyContainer);
    
    // 添加字段分隔线，用于生成新字段
    const addFieldLine = document.createElement('div');
    addFieldLine.className = 'add-field-line';
    addFieldLine.dataset.path = path;
    addFieldLine.dataset.index = index;
    addFieldLine.addEventListener('click', () => {
      addEmptyField(obj, contentContainer, rootData, path, index + 1);
    });
    contentContainer.appendChild(addFieldLine);
  });
  
  // 在最后一个字段后添加添加字段线
  if (keys.length > 0) {
    const addFieldLine = document.createElement('div');
    addFieldLine.className = 'add-field-line';
    addFieldLine.dataset.path = path;
    addFieldLine.dataset.index = keys.length;
    addFieldLine.addEventListener('click', () => {
      addEmptyField(obj, contentContainer, rootData, path, keys.length);
    });
    contentContainer.appendChild(addFieldLine);
  }
  
  // 将内容容器添加到可折叠容器中
  collapsibleContent.appendChild(contentContainer);
  objectContainer.appendChild(collapsibleContent);
  
  // 只有非最外层响应体才显示折叠占位符
  if (path !== '') {
    // 添加折叠占位符
    const placeholder = document.createElement('span');
    placeholder.className = 'collapsed-placeholder';
    placeholder.textContent = `...${keys.length}items`;
    placeholder.style.display = 'none';
    placeholder.style.marginLeft = '16px';
    objectContainer.appendChild(placeholder);
  }
  
  // 渲染右花括号 - 最外层响应体不添加末尾逗号
  const rightBrace = document.createElement('span');
  rightBrace.className = 'json-punctuation';
  rightBrace.textContent = '}';
  objectContainer.appendChild(rightBrace);
  
  container.appendChild(objectContainer);
}

// 渲染JSON数组
function renderJsonArray(arr, container, rootData, path = '') {
  const arrayContainer = document.createElement('div');
  arrayContainer.className = 'json-array';
  
  // 只有非最外层响应体才显示折叠/展开按钮
  if (path !== '') {
    // 添加折叠/展开按钮 - 放在中括号左侧
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-btn';
    collapseBtn.style.marginRight = '4px';
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      collapseBtn.classList.toggle('collapsed');
      const content = arrayContainer.querySelector('.collapsible-content');
      const placeholder = arrayContainer.querySelector('.collapsed-placeholder');
      if (collapseBtn.classList.contains('collapsed')) {
        content.classList.add('collapsed-content');
        placeholder.style.display = 'inline';
      } else {
        content.classList.remove('collapsed-content');
        placeholder.style.display = 'none';
      }
    });
    arrayContainer.appendChild(collapseBtn);
  }
  
  // 渲染左中括号
  const leftBracket = document.createElement('span');
  leftBracket.className = 'json-punctuation';
  leftBracket.textContent = '[';
  arrayContainer.appendChild(leftBracket);
  
  // 创建可折叠内容容器
  const collapsibleContent = document.createElement('div');
  collapsibleContent.className = 'collapsible-content';
  
  // 渲染数组内容
  const contentContainer = document.createElement('div');
  contentContainer.className = 'json-container';
  
  arr.forEach((item, index) => {
    const itemContainer = document.createElement('div');
    itemContainer.className = 'json-array-item';
    
    // 渲染值
    const itemPath = path ? `${path}[${index}]` : `[${index}]`;
    renderJsonValue(item, itemContainer, rootData, itemPath);
    
    // 渲染逗号 - 紧跟在值后面，最后一个元素不添加逗号
    if (index < arr.length - 1) {
      const comma = document.createElement('span');
      comma.className = 'json-punctuation';
      comma.textContent = ',';
      itemContainer.appendChild(comma);
    }
    
    contentContainer.appendChild(itemContainer);
  });
  
  // 将内容容器添加到可折叠容器中
  collapsibleContent.appendChild(contentContainer);
  arrayContainer.appendChild(collapsibleContent);
  
  // 只有非最外层响应体才显示折叠占位符
  if (path !== '') {
    // 添加折叠占位符
    const placeholder = document.createElement('span');
    placeholder.className = 'collapsed-placeholder';
    placeholder.textContent = `...${arr.length}items`;
    placeholder.style.display = 'none';
    placeholder.style.marginLeft = '16px';
    arrayContainer.appendChild(placeholder);
  }
  
  // 渲染右中括号 - 最外层响应体不添加末尾逗号
  const rightBracket = document.createElement('span');
  rightBracket.className = 'json-punctuation';
  rightBracket.textContent = ']';
  arrayContainer.appendChild(rightBracket);
  
  container.appendChild(arrayContainer);
}

// 渲染JSON原始值
function renderJsonPrimitive(value, container, rootData, path = '') {
  const valueContainer = document.createElement('span');
  valueContainer.className = 'json-value';
  valueContainer.dataset.path = path;
  
  let valueText = '';
  let valueClass = '';
  
  switch (typeof value) {
    case 'string':
      valueText = `"${value}"`;
      valueClass = 'json-string';
      break;
    case 'number':
      valueText = String(value);
      valueClass = 'json-number';
      break;
    case 'boolean':
      valueText = String(value);
      valueClass = 'json-boolean';
      break;
    case 'null':
      valueText = 'null';
      valueClass = 'json-null';
      break;
    default:
      valueText = String(value);
      valueClass = 'json-string';
  }
  
  valueContainer.innerHTML = `<span class="${valueClass}">${valueText}</span>`;
  
  // 添加点击编辑功能
  valueContainer.addEventListener('click', () => {
    if (!valueContainer.classList.contains('editing')) {
      enableEditMode(valueContainer, value, rootData, path);
    }
  });
  
  container.appendChild(valueContainer);
}

// 启用编辑模式
function enableEditMode(element, value, rootData, path) {
  // 移除所有其他编辑模式
  document.querySelectorAll('.json-value.editing').forEach(el => {
    cancelEdit(el);
  });
  
  element.classList.add('editing');
  
  const valueType = typeof value;
  const currentValue = valueType === 'boolean' ? String(value) : valueType === 'string' ? value : String(value);
  
  // 创建输入框
  const input = document.createElement('input');
  input.className = 'json-edit-input';
  input.type = 'text';
  input.value = currentValue;
  input.style.width = 'auto';
  
  // 替换内容
  element.innerHTML = '';
  element.appendChild(input);
  
  // 聚焦输入框
  input.focus();
  input.select();
  
  // 阻止输入框点击事件冒泡，防止触发父元素的点击事件
  input.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // 处理输入事件
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveEdit(element, input, rootData, path, valueType);
    } else if (e.key === 'Escape') {
      cancelEdit(element, value);
    }
  });
  
  // 处理失焦事件
  input.addEventListener('blur', () => {
    saveEdit(element, input, rootData, path, valueType);
  });
  
  // 根据字符串长度计算输入框宽度
  const charWidth = 8; // 每个字符的估计宽度
  const textLength = currentValue.length;
  const calculatedWidth = textLength * charWidth;
  
  // 调整输入框宽度以适应内容，同时避免换行
  const containerWidth = element.parentElement.offsetWidth;
  const minWidth = 60; // 最小宽度
  const maxInputWidth = Math.min(120, containerWidth - 20); // 减小最大宽度
  const finalWidth = Math.min(maxInputWidth, Math.max(minWidth, calculatedWidth + 16)); // +16 用于内边距和边框
  
  input.style.width = `${finalWidth}px`;
}

// 保存编辑
function saveEdit(element, input, rootData, path, originalType) {
  let newValue = input.value.trim();
  
  // 转换值类型
  if (originalType === 'number') {
    newValue = isNaN(newValue) ? 0 : Number(newValue);
  } else if (originalType === 'boolean') {
    newValue = newValue.toLowerCase() === 'true';
  } else if (originalType === 'string') {
    // 移除引号（如果有）
    if ((newValue.startsWith('"') && newValue.endsWith('"')) || 
        (newValue.startsWith("'") && newValue.endsWith("'"))) {
      newValue = newValue.substring(1, newValue.length - 1);
    }
  }
  
  // 更新数据
  updateValueByPath(rootData, path, newValue);
  
  // 重新渲染编辑器
  renderMockDataEditor(window.currentMock.mockData, mockDataContainer);
}

// 取消编辑
function cancelEdit(element, originalValue) {
  element.classList.remove('editing');
  element.innerHTML = '';
  
  let valueText = '';
  let valueClass = '';
  
  switch (typeof originalValue) {
    case 'string':
      valueText = `"${originalValue}"`;
      valueClass = 'json-string';
      break;
    case 'number':
      valueText = String(originalValue);
      valueClass = 'json-number';
      break;
    case 'boolean':
      valueText = String(originalValue);
      valueClass = 'json-boolean';
      break;
    case 'null':
      valueText = 'null';
      valueClass = 'json-null';
      break;
    default:
      valueText = String(originalValue);
      valueClass = 'json-string';
  }
  
  element.innerHTML = `<span class="${valueClass}">${valueText}</span>`;
}

// 通过路径更新值
function updateValueByPath(obj, path, value) {
  const pathParts = path.split('.');
  let current = obj;
  
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
    current[arrayName][index] = value;
  } else {
    current[lastPart] = value;
  }
}

// 启用键编辑模式
function enableKeyEditMode(element, key, rootData, path) {
  // 移除所有其他编辑模式
  document.querySelectorAll('.json-key.editing').forEach(el => {
    cancelKeyEdit(el);
  });
  
  element.classList.add('editing');
  
  // 创建输入框
  const input = document.createElement('input');
  input.className = 'json-key-input';
  input.type = 'text';
  input.value = key;
  input.style.width = 'auto';
  
  // 替换内容
  element.innerHTML = '';
  element.appendChild(input);
  
  // 根据字符串长度计算输入框宽度
  const charWidth = 8; // 每个字符的估计宽度
  const textLength = key.length;
  const calculatedWidth = textLength * charWidth;
  
  // 动态调整输入框宽度
  const containerWidth = element.parentElement.offsetWidth;
  const minWidth = 60; // 最小宽度
  const maxInputWidth = Math.min(120, containerWidth - 20); // 减小最大宽度
  const finalWidth = Math.min(maxInputWidth, Math.max(minWidth, calculatedWidth + 16)); // +16 用于内边距和边框
  
  input.style.width = `${finalWidth}px`;
  
  // 聚焦输入框
  input.focus();
  input.select();
  
  // 阻止输入框点击事件冒泡，防止触发父元素的点击事件
  input.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // 处理输入事件
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveKeyEdit(element, input, key, rootData, path);
    } else if (e.key === 'Escape') {
      cancelKeyEdit(element);
    }
  });
  
  // 处理失焦事件
  input.addEventListener('blur', () => {
    saveKeyEdit(element, input, key, rootData, path);
  });
}

// 保存键编辑
function saveKeyEdit(element, input, originalKey, rootData, path) {
  const newValue = input.value.trim();
  element.classList.remove('editing');
  
  if (newValue === '' || newValue === originalKey) {
    // 如果值为空或未改变，恢复原始键，只保留字段名，不包含冒号
    element.innerHTML = `<span class="json-key">"${originalKey}"</span>`;
  } else {
    // 更新对象中的键
    const obj = path ? getObjectByPath(rootData, path) : rootData;
    if (obj) {
      // 创建新对象，保留原有顺序
      const newObj = {};
      for (const key in obj) {
        if (key === originalKey) {
          newObj[newValue] = obj[key];
        } else {
          newObj[key] = obj[key];
        }
      }
      
      // 替换旧对象
      if (path) {
        // 对于嵌套对象，需要更新父对象
        const parentPath = path.split('.').slice(0, -1).join('.');
        const parentObj = getObjectByPath(rootData, parentPath);
        const lastPart = path.split('.').pop();
        parentObj[lastPart] = newObj;
      } else {
        // 对于根对象，直接替换
        Object.assign(rootData, newObj);
      }
      
      // 重新渲染编辑器
      renderMockDataEditor(rootData, mockDataContainer);
    }
  }
}

// 取消键编辑
function cancelKeyEdit(element) {
  const originalKey = element.dataset.originalKey;
  element.classList.remove('editing');
  // 恢复原始键，只保留字段名，不包含冒号
  element.innerHTML = `<span class="json-key">"${originalKey}"</span>`;
}

// 获取路径对应的对象
function getObjectByPath(obj, path) {
  if (!path) return obj;
  
  const pathParts = path.split('.');
  let current = obj;
  
  for (const part of pathParts) {
    const arrayMatch = part.match(/(\w+)\[(\d+)\]/);
    if (arrayMatch) {
      const arrayName = arrayMatch[1];
      const index = parseInt(arrayMatch[2]);
      current = current[arrayName][index];
    } else {
      current = current[part];
    }
    
    if (current === undefined) break;
  }
  
  return current;
}

// 添加空字段
function addEmptyField(obj, container, rootData, path, index) {
  // 创建空字段容器
  const emptyFieldContainer = document.createElement('div');
  emptyFieldContainer.className = 'json-property json-empty-field';
  
  // 创建键输入框
  const keyInput = document.createElement('input');
  keyInput.className = 'json-key-input empty';
  keyInput.type = 'text';
  keyInput.placeholder = '字段名';
  
  // 创建冒号
  const colon = document.createElement('span');
  colon.className = 'json-punctuation';
  colon.textContent = ': ';
  
  // 创建值输入框
  const valueInput = document.createElement('input');
  valueInput.className = 'json-edit-input empty';
  valueInput.type = 'text';
  valueInput.placeholder = '字段值';
  
  // 创建逗号
  const comma = document.createElement('span');
  comma.className = 'json-punctuation';
  comma.textContent = ',';
  
  // 组装空字段
  emptyFieldContainer.appendChild(keyInput);
  emptyFieldContainer.appendChild(colon);
  emptyFieldContainer.appendChild(valueInput);
  emptyFieldContainer.appendChild(comma);
  
  // 插入到指定位置
  const children = container.children;
  let insertIndex = index * 2; // 每个字段后有一个分隔线
  if (insertIndex >= children.length) {
    container.appendChild(emptyFieldContainer);
  } else {
    container.insertBefore(emptyFieldContainer, children[insertIndex]);
  }
  
  // 聚焦到键输入框
  keyInput.focus();
  
  // 处理失焦事件
  let isSaving = false;
  
  function handleBlur() {
    if (isSaving) return;
    isSaving = true;
    
    const key = keyInput.value.trim();
    const value = valueInput.value.trim();
    
    // 检查是否有输入框为空
    const isKeyEmpty = key === '';
    const isValueEmpty = value === '';
    
    if (isKeyEmpty && isValueEmpty) {
      // 两个输入框都为空，删除空字段
      emptyFieldContainer.remove();
    } else if (isKeyEmpty || isValueEmpty) {
      // 有一个输入框为空，输入框爆红
      if (isKeyEmpty) {
        keyInput.style.borderColor = '#f56565';
        keyInput.style.boxShadow = '0 0 0 2px rgba(245, 101, 101, 0.2)';
      } else {
        keyInput.style.borderColor = '#667eea';
        keyInput.style.boxShadow = '0 0 0 2px rgba(102, 126, 234, 0.2)';
      }
      
      if (isValueEmpty) {
        valueInput.style.borderColor = '#f56565';
        valueInput.style.boxShadow = '0 0 0 2px rgba(245, 101, 101, 0.2)';
      } else {
        valueInput.style.borderColor = '#667eea';
        valueInput.style.boxShadow = '0 0 0 2px rgba(102, 126, 234, 0.2)';
      }
    } else {
      // 两个输入框都有值，生成新字段
      const parsedValue = parseJsonValue(value);
      
      // 获取父对象
      const parentObj = path ? getObjectByPath(rootData, path) : rootData;
      
      // 添加新字段
      parentObj[key] = parsedValue;
      
      // 重新渲染编辑器
      renderMockDataEditor(rootData, mockDataContainer);
    }
    
    isSaving = false;
  }
  
  // 延迟处理失焦，确保点击事件能先触发
  keyInput.addEventListener('blur', handleBlur);
  valueInput.addEventListener('blur', handleBlur);
  
  // 处理回车键
  keyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (keyInput.value.trim() === '') {
        keyInput.style.borderColor = '#f56565';
        keyInput.style.boxShadow = '0 0 0 2px rgba(245, 101, 101, 0.2)';
        return;
      }
      valueInput.focus();
    }
  });
  
  valueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  });
}

// 解析JSON值
function parseJsonValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (/^\d+\.?\d*$/.test(value)) return parseFloat(value);
  if (value.startsWith('{') && value.endsWith('}')) {
    try { return JSON.parse(value); }
    catch (e) { return value; }
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    try { return JSON.parse(value); }
    catch (e) { return value; }
  }
  return value;
}

// 从编辑器更新模拟数据
function updateMockDataFromEditor(mockData, container) {
  // 在VSCode风格编辑器中，数据直接通过点击编辑更新到window.currentMock.mockData中
  // 这里直接返回当前的mockData
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
  
  // 禁用AI生成模拟按钮
  aiMockBtn.disabled = true;
  
  // 禁用其他相关控件，防止在生成过程中修改
  urlInput.disabled = true;
  methodSelect.disabled = true;
  responseInput.disabled = true;
  
  // Process URL to support both formats
  const processedUrl = processUrl(originalUrl, selectedMethod);
  
  // Parse response structure
  const responseStructure = parseResponseStructure(responseText);
  if (!responseStructure) {
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
    
    // 恢复AI生成模拟按钮
    aiMockBtn.disabled = false;
    
    // 恢复其他相关控件
    urlInput.disabled = false;
    methodSelect.disabled = false;
    responseInput.disabled = false;
    
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
  
  // Restore all controls state
  submitBtn.textContent = originalText;
  submitBtn.disabled = false;
  // 恢复AI生成模拟按钮
  aiMockBtn.disabled = false;
  
  // 恢复其他相关控件
  urlInput.disabled = false;
  methodSelect.disabled = false;
  responseInput.disabled = false;
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
    submitMockBtn.disabled = true;
    
    // 禁用其他相关控件，防止在生成过程中修改
    urlInput.disabled = true;
    methodSelect.disabled = true;
    responseInput.disabled = true;
    
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
    // 恢复所有控件状态
    aiMockBtn.textContent = 'AI 生成模拟';
    aiMockBtn.disabled = false;
    submitMockBtn.disabled = false;
    
    // 恢复其他相关控件
    urlInput.disabled = false;
    methodSelect.disabled = false;
    responseInput.disabled = false;
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