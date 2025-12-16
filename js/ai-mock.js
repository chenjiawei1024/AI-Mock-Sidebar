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
        return {
          supported: false,
          error: '您的浏览器不支持Gemini Nano。请使用Chrome 127或更高版本。'
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
          message: '已检测到可用的Gemini Nano模型！'
        };
      } else if (availability === 'downloading') {
        // 模型正在下载, 等待下载完成
        this.isSupported = false;
        return {
          supported: false,
          error: 'Gemini Nano模型正在下载中，请等待下载完成后刷新页面。'
        };
      } else {
        // Try to request model download
        try {
          await window.LanguageModel.requestModel();
          this.isSupported = false;
          this.modelStatus = 'downloading';
          return {
            supported: false,
            error: 'Gemini Nano模型已开始下载，请等待下载完成后刷新页面。'
          };
        } catch (downloadError) {
          this.isSupported = false;
          this.modelStatus = 'unavailable';
          return {
            supported: false,
            error: '下载Gemini Nano模型失败。请检查网络连接或手动在Chrome设置中启用Gemini Nano。'
          };
        }
      }
    } catch (error) {
      console.error('检查Gemini Nano支持时出错:', error);
      this.isSupported = false;
      this.modelStatus = 'unavailable';
      return {
        supported: false,
        error: '检查Gemini Nano支持时出错。请确保您使用的是支持的Chrome版本。'
      };
    }
  }

  // 创建模型会话
  async createSession() {
    try {
      // 创建模型会话
      this.aiSession = await window.LanguageModel.create({
        initialPrompts: [
          {
            role: 'system',
            content: '你是一个专业的API mock数据生成助手，能够根据JSON结构生成合理的mock数据。请用中文进行回复，确保生成的JSON数据符合要求。'
          }
        ],
        expectedInputs: [{ type: 'text' }]
      });
      
      this.modelStatus = 'available';
    } catch (error) {
      console.error('创建模型会话失败:', error);
      this.modelStatus = 'unavailable';
      throw new Error('创建模型会话失败。请检查模型是否可用。');
    }
  }

  // 生成用于AI Mock数据生成的提示
  generatePrompt(responseText) {
    return `请根据以下包含注释的JSON响应报文格式，生成一个合理的、真实可用的mock数据：

${responseText}

注释格式说明：
每个@开头的字段包含一个注释，格式为：/* req, xs:类型, note:描述 */
其中：
- xs: 表示字段的数据类型（如integer、string、object、array等）
- note: 表示字段的业务描述和含义

要求：
1. 仔细阅读每个字段的注释，理解字段的业务含义
2. 根据xs字段类型生成对应的数据类型
3. 根据note字段解释生成贴近业务含义的真实数据
4. 忽略所有 /* */ 格式的注释内容
5. 忽略所有以 @ 开头的字段（如 @ResponseStatus、@ErrorModule），只处理实际的数据字段
6. 生成的数据必须符合给定的JSON结构
7. 所有字段都要赋值，保持数据类型一致
8. 生成的数值应该是合理的、真实可用的
9. 字符串值应该是有意义的，符合字段名称和业务描述的语义
10. 如果有数组，生成1-3个合理的数组项，每个项都要有真实的业务数据
11. 保留ResponseStatus和ErrorCode等错误相关字段的合理默认值
12. 只返回纯净的JSON格式数据，不要添加任何其他解释、说明或注释
13. 确保生成的JSON是可直接解析的有效格式
14. 生成的数据要符合实际业务场景，避免生成无意义的随机值`;
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
      
      // 使用AI生成mock数据
      const aiResponse = await this.aiSession.prompt(prompt);
      
      // 提取响应文本
      let generatedText = aiResponse;
      // let generatedText = '';
      // for (const part of aiResponse.parts) {
      //   if (part.text) {
      //     generatedText += part.text;
      //   }
      // }
      
      // 清理响应文本（移除任何Markdown、额外文本和注释）
      let cleanText = generatedText.replace(/```json|```/g, '').trim();
      
      // Further clean up: remove any remaining /* */ comments
      cleanText = cleanText.replace(/\/\*.*?\*\//gs, '').trim();
      
      // 解析生成的JSON
      const generatedMock = JSON.parse(cleanText);
      
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