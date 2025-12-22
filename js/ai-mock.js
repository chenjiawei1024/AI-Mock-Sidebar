// AI Mock functionality for API Mock Sidebar Extension

class AIMock {
  constructor() {
    this.isSupported = false;
    this.modelStatus = 'checking';
    this.aiSession = null;
    this.abortController = null;
  }

  // 判断浏览器是否支持Gemini Nano
  async checkSupport() {
    try {
      // 判断浏览器是否支持LanguageModel API
      if (!window.LanguageModel) {
        this.isSupported = false;
        this.modelStatus = 'unavailable';
        const message = '您的浏览器当前不支持模型。请前往{0}后，使用ai功能。';
        const url = 'https://10.16.32.105:5173/gemini-nano';
        const urlText = '下载模型';
        this.showGuidance(message, url, urlText);
        return {
          supported: false,
          error: ''
        };
      }

      // 判断模型可用性状态
      const availability = await window.LanguageModel.availability();
      this.modelStatus = availability;
      
      if (availability === 'available') {
        // 创建会话如果模型可用
        await this.createSession();
        this.isSupported = true;
        return {
          supported: true,
          message: '已检测到可用的模型！'
        };
      } else if (availability === 'downloading') {
        // 模型正在下载，显示进度条(目前模型的进度和状态展示有点问题，因此不展示进度，直接提示到components页面查看)
        this.isSupported = false;
        const message = '模型正在下载中，待下载完成后,重新打开插件方可使用ai功能，下载状态可访问{0}的Optimization Guide On Device Model';
        const url = 'chrome://components/';
        this.showGuidance(message, url);
        // this.showDownloadProgress();
        return {
          supported: false,
          error: ''
        };
      } else if (availability === 'downloadable') {
        // 模型可下载，显示带有下载按钮的提示
        this.isSupported = false;
        // this.showDownloadPrompt();
        const message = '模型已准备好下载，请前往{0}。';
        const url = 'https://10.16.32.105:5173/gemini-nano';
        const urlText = '下载模型';
        this.showGuidance(message, url, urlText);
        return {
          supported: false,
          error: ''
        };
      } else {
        // 其他未知状态
        this.isSupported = false;
        this.modelStatus = 'unavailable';
        return {
          supported: false,
          error: '模型状态未知。请确保您使用的是支持的Chrome版本。'
        };
      }
    } catch (error) {
      console.error('检查模型支持时出错:', error);
      this.isSupported = false;
      this.modelStatus = 'unavailable';
      return {
        supported: false,
        error: '检查模型支持时出错。请确保您使用的是支持的Chrome版本。'
      };
    }
  }

  // 创建模型会话
  async createSession() {
    try {
      // 创建模型会话，添加进度监控
      this.aiSession = await window.LanguageModel.create({
        initialPrompts: [
          {
            role: 'system',
            content: '你是一个专业的API mock数据生成助手，能够根据JSON结构生成合理的mock数据。请用中文进行回复，确保生成的JSON数据符合要求，同时生成的mock数据尽可能符合语义。'
          }
        ],
        expectedInputs: [{ type: 'text' }],
        // monitor: (model) => {
        //   model.addEventListener('downloadprogress', (e) => {
        //     const progress = e.loaded || 0;
        //     this.updateDownloadProgress(progress);
        //   });
        // }
      });
      
      this.modelStatus = 'available';
      this.hideDownloadProgress();
    } catch (error) {
      this.modelStatus = 'downloading';
      this.hideDownloadProgress();
    }
  }
  
  // 更新下载进度
  updateDownloadProgress(progress) {
    let progressBar = document.getElementById('modelDownloadProgress');
    let progressText = document.getElementById('modelDownloadText');
    
    // 如果进度条不存在，创建它
    if (!progressBar) {
      this.showDownloadProgress();
      progressBar = document.getElementById('modelDownloadProgress');
      progressText = document.getElementById('modelDownloadText');
    }
    
    // 更新进度
    const percentage = Math.round(progress * 100);
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `模型下载中: ${percentage}%`;
    
    // 如果下载完成，隐藏进度条
    if (percentage >= 100) {
      setTimeout(() => {
        this.hideDownloadProgress();
      }, 1000);
    }
  }
  
  // 显示下载提示（带有下载按钮）
  showDownloadPrompt() {
    // 检查提示是否已存在
    if (document.getElementById('modelDownloadAlert')) {
      return;
    }
    
    // 创建提示容器
    const alertContainer = document.createElement('div');
    alertContainer.id = 'modelDownloadAlert';
    alertContainer.className = 'model-download-alert';
    alertContainer.innerHTML = `
      <div class="alert-content">
        <span class="progress-text">AI 模型已准备好下载</span>
        <p>点击下载开始下载模型，用于AI生成模拟数据。</p>
        <div class="alert-actions">
          <button id="startDownloadBtn" class="download-btn">下载模型</button>
        </div>
      </div>
      <button id="closeProgressBtn" class="close-btn" title="关闭">×</button>
    `;
    
    // 添加到页面顶部
    document.body.insertBefore(alertContainer, document.body.firstChild);
    
    // 添加下载按钮点击事件监听
    document.getElementById('startDownloadBtn').addEventListener('click', async () => {
      await this.startModelDownload();
    });
    
    // 添加关闭事件监听
    document.getElementById('closeProgressBtn').addEventListener('click', () => {
      this.hideDownloadProgress();
    });
  }
  
  // 显示下载进度条
  showDownloadProgress() {
    // 检查进度条是否已存在
    if (document.getElementById('modelDownloadAlert')) {
      return;
    }
    
    // 创建进度条容器
    const alertContainer = document.createElement('div');
    alertContainer.id = 'modelDownloadAlert';
    alertContainer.className = 'model-download-alert';
    alertContainer.innerHTML = `
      <div class="alert-content">
        <span id="modelDownloadText" class="progress-text">模型下载中: 0%</span>
        <div class="progress-container">
          <div id="modelDownloadProgress" class="progress-bar" style="width: 0%"></div>
        </div>
      </div>
      <button id="closeProgressBtn" class="close-btn" title="关闭">×</button>
    `;
    
    // 添加到页面顶部
    document.body.insertBefore(alertContainer, document.body.firstChild);
    
    // 添加关闭事件监听
    document.getElementById('closeProgressBtn').addEventListener('click', () => {
      this.hideDownloadProgress();
    });
  }

  // 模型不可用时，显示引导
  showGuidance(message, url, urlText) {
    // Alert是否已存在
    if (document.getElementById('modelDownloadAlert')) {
      return;
    }
    
    // 创建进度条容器
    const alertContainer = document.createElement('div');
    alertContainer.id = 'modelDownloadAlert';
    alertContainer.className = 'model-download-alert';
    alertContainer.innerHTML = `
      <span class="progress-text">${message.replace('{0}', `<a href="${url}" target="_blank">${urlText || url}</a>`)}</span>
      <button id="closeProgressBtn" class="close-btn" title="关闭">×</button>
    `;
    
    // 添加到页面顶部
    document.body.insertBefore(alertContainer, document.body.firstChild);
    
    // 添加关闭事件监听
    document.getElementById('closeProgressBtn').addEventListener('click', () => {
      this.hideDownloadProgress();
    });
  }
  
  // 开始模型下载
  async startModelDownload() {
    // 隐藏下载提示
    this.hideDownloadProgress();
    
    // 显示下载进度
    this.showDownloadProgress();
    
    try {
      // 调用createSession方法开始下载模型
      await this.createSession();
      
      // 如果成功，启用AI模拟按钮
      const aiMockBtn = document.getElementById('aiMockBtn');
      if (aiMockBtn) {
        aiMockBtn.disabled = false;
        this.showSuccessMessage('模型下载成功！AI模拟功能已启用。');
      }
    } catch (error) {
      this.hideDownloadProgress();
      this.showErrorMessage('模型下载失败。请重试或检查网络连接。');
    }
  }
  
  // 显示成功消息
  showSuccessMessage(message) {
    this.showToast(message, 'success');
  }
  
  // 显示错误消息
  showErrorMessage(message) {
    this.showToast(message, 'error');
  }
  
  // 显示Toast消息
  showToast(message, type = 'info') {
    // 创建Toast元素
    const toast = document.createElement('div');
    toast.className = `ai-toast ai-toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 60px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      z-index: 10001;
      animation: slideInRight 0.3s ease-out;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
      ${type === 'success' ? 'background: #48bb78;' : type === 'error' ? 'background: #f56565;' : 'background: #667eea;'}
    `;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 3秒后自动移除
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
  
  // 隐藏下载进度条
  hideDownloadProgress() {
    const alertContainer = document.getElementById('modelDownloadAlert');
    if (alertContainer) {
      alertContainer.remove();
    }
  }

  // 处理注释，只保留xs和note信息
  processComments(responseText) {
    // 正则表达式：匹配/* */注释内容
    const commentRegex = /\/\*([^*]|\*(?!\/))*\*\//g;
    
    // 替换所有注释，只保留xs和note信息
    return responseText.replace(commentRegex, (match) => {
      // 提取注释内容
      let commentContent = match.slice(2, -2).trim();
      
      // 解析注释内容，提取xs和note
      const xsMatch = commentContent.match(/xs:([^,\/]*)[\/,]/);
      const noteMatch = commentContent.match(/note:([^,\/]*)[\/,]/);
      
      // 构建新的注释内容
      let newComment = '/*';
      
      if (xsMatch) {
        newComment += ` xs:${xsMatch[1].trim()}`;
      }
      
      if (noteMatch) {
        newComment += `, note:${noteMatch[1].trim()}`;
      }
      
      newComment += ' */';
      
      // 如果没有xs和note信息，返回空字符串
      return newComment === '/* */' ? '' : newComment;
    });
  }

  // 生成用于AI Mock数据生成的提示
  generatePrompt(responseText) {
    // 处理注释，只保留xs和note信息
    const processedResponseText = this.processComments(responseText);
    
    return `请根据以下包含注释的JSON响应报文格式，生成一个合理的、真实可用的mock数据：

${processedResponseText}

注释格式说明：
每个@开头的字段包含一个注释，格式为：/* xs:类型, note:描述 */
其中：
- xs: 表示字段的数据类型（如integer、string、object、array等）
- note: 表示字段的业务描述和含义

要求：
1. 仔细阅读每个字段的注释，理解字段的业务含义
2. 根据xs字段类型生成对应的数据类型
3. 根据note字段解释生成贴近业务含义的真实数据
4. 生成的数据必须符合给定的JSON结构
5. 所有字段都要赋值，保持数据类型一致
6. 字符串值应该是有意义的，符合字段名称和业务描述的语义
7. 数字值尽量不要赋值0, 1等简单值，应该生成符合描述和业务场景的数值
8. 如果有数组，生成1-3个合理的数组项，每个项都要有真实的业务数据
9. 保留ResponseStatus和ErrorCode等错误相关字段的合理默认值
10. 只返回纯净的JSON格式数据，不要添加任何其他解释、说明或注释
11. 确保生成的JSON是可直接解析的有效格式
12. 生成的数据要符合实际业务场景，避免生成无意义的随机值`;
  }

  // 根据responseText生成JSON架构
  generateJsonSchema(responseText) {
    // 清理responseText，移除注释和@字段
    let cleanText = responseText;
    
    // 1. 移除/* */注释
    cleanText = cleanText.replace(/\/\*.*?\*\//gs, '').trim();
    
    // 2. 移除所有@开头的字段，无论其值是什么
    cleanText = cleanText.replace(/\s*"@[^"]+"\s*:\s*"[^"]*"\s*,?\s*/g, '');
    
    // 3. 再次移除可能遗留的@字段（处理值为数字、对象等情况）
    cleanText = cleanText.replace(/\s*"@[^"]+"\s*:\s*[^,\}\]]+\s*,?\s*/g, '');
    
    // 3. 移除末尾可能的多余逗号
    cleanText = cleanText.replace(/,\s*}/g, '}');
    cleanText = cleanText.replace(/,\s*\]/g, ']');
    
    // 简单的JSON Schema生成，基于responseText的结构
    // 这里实现一个简单的递归生成器
    function generateSchema(value) {
      if (Array.isArray(value)) {
        const itemSchema = value.length > 0 ? generateSchema(value[0]) : { "type": "string" };
        return {
          "type": "array",
          "items": itemSchema
        };
      } else if (value !== null && typeof value === "object") {
        const properties = {};
        for (const [key, val] of Object.entries(value)) {
          // 跳过空字符串键
          if (key !== '') {
            properties[key] = generateSchema(val);
          }
        }
        return {
          "type": "object",
          "properties": properties,
          "required": Object.keys(properties),
          "additionalProperties": false
        };
      } else if (typeof value === "string") {
        return { "type": "string" };
      } else if (typeof value === "number") {
        return { "type": "number" };
      } else if (typeof value === "boolean") {
        return { "type": "boolean" };
      } else if (value === null) {
        return { "type": "null" };
      } else {
        return { "type": "string" };
      }
    }
    
    try {
      // 解析cleanText为JSON对象
      const parsedJson = JSON.parse(cleanText);
      // 生成JSON Schema
      return generateSchema(parsedJson);
    } catch (error) {
      console.error('生成JSON Schema时出错:', error);
      console.error('清理后的文本:', cleanText);
      // 如果解析失败，返回一个通用的JSON对象Schema
      return {
        "type": "object",
        "additionalProperties": true
      };
    }
  }

  // 使用AI生成Mock数据
  async generateMockData(responseText) {
    if (!this.isSupported) {
      throw new Error('Gemini Nano is not supported');
    }

    if (!responseText) {
      throw new Error('请先输入包含注释的JSON响应报文格式。');
    }

    try {
      // 创建会话如果还未创建
      if (!this.aiSession) {
        await this.createSession();
      }

      // 生成提示
      const prompt = this.generatePrompt(responseText);
      
      // 生成JSON Schema用于responseConstraint
      const schema = this.generateJsonSchema(responseText);
      
      // 使用AI生成mock数据，添加responseConstraint参数
      const aiResponse = await this.aiSession.prompt(prompt, {
        responseConstraint: schema
      });
      
      // 提取响应文本
      let generatedText = aiResponse;
      
      // 清理响应文本（移除任何Markdown、额外文本和注释）
      let cleanText = generatedText.replace(/```json|```/g, '').trim();
      
      // 1. 移除/* */注释
      cleanText = cleanText.replace(/\/\*.*?\*\//gs, '').trim();
      
      // 2. 移除所有@开头的字段，无论其值是什么
      cleanText = cleanText.replace(/\s*"@[^"]+"\s*:\s*"[^"]*"\s*,?\s*/g, '');
      cleanText = cleanText.replace(/\s*"@[^"]+"\s*:\s*[^,\}\]]+\s*,?\s*/g, '');
      
      // 3. 移除" "字段
      cleanText = cleanText.replace(/\s*" "\s*:\s*""\s*,?\s*/g, '');
      
      // 4. 移除末尾可能的多余逗号
      cleanText = cleanText.replace(/,\s*}/g, '}');
      cleanText = cleanText.replace(/,\s*\]/g, ']');
      
      // 5. 解析JSON对象
      let generatedMock = JSON.parse(cleanText);
      
      // 递归清理生成的JSON对象，移除所有" "字段
      function cleanJson(obj) {
        if (Array.isArray(obj)) {
          return obj.map(item => cleanJson(item));
        } else if (obj !== null && typeof obj === 'object') {
          const cleaned = {};
          for (const [key, value] of Object.entries(obj)) {
            if (key !== ' ') {
              cleaned[key] = cleanJson(value);
            }
          }
          return cleaned;
        } else {
          return obj;
        }
      }
      
      // 清理生成的JSON对象
      generatedMock = cleanJson(generatedMock);
      
      // 确保ErrorModule和ErrorCode为0
      if (generatedMock.ResponseStatus) {
        generatedMock.ResponseStatus.ErrorModule = 0;
        generatedMock.ResponseStatus.ErrorCode = 0;
      }
      
      return generatedMock;
    } catch (error) {
      console.error('生成AI mock数据时出错:', error);
      throw new Error('生成AI mock数据时出错。请检查输入格式或重试。');
    }
  }

  // Process generated mock data
  processMockData(mockData, generateMockDataFn) {
    // Use the provided generateMockData function to process the AI-generated data
    return generateMockDataFn(mockData);
  }

  // Stop current AI generation
  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // Destroy session
  destroySession() {
    // Stop any ongoing generation
    this.stopGeneration();

    if (this.aiSession) {
      try {
        this.aiSession.destroy();
        this.aiSession = null;
        this.modelStatus = 'unavailable';
        this.isSupported = false;
      } catch (error) {
        console.error('销毁会话失败:', error);
      }
    }
  }

  // Get support status
  getSupportStatus() {
    return {
      isSupported: this.isSupported,
      modelStatus: this.modelStatus
    };
  }
}

// Export the class for use in other files
window.AIMock = AIMock;