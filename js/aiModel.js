import { ref } from "/node_modules/.vite/deps/vue.js?v=cdb424dd"

/**
 * Gemini Nano 模型管理工具类 - 支持流式输出
 */
export class GeminiModelManager {
  constructor() {
    this.modelStatus = ref('checking')
    this.downloadProgress = ref(0)
    this.aiSession = ref(null)
    this.isGeneratingSummary = ref(false)
    this.summaryError = ref(null)
    this.summaryResult = ref(null)
    this.abortController = null
  }

  /**
   * 初始化模型
   */
  async initializeModel() {
    this.modelStatus.value = 'checking'

    // 检查浏览器兼容性
    if (!window.LanguageModel) {
      this.modelStatus.value = 'unavailable'
      throw new Error('浏览器不支持 Gemini Nano 模型')
    }

    try {
      const availability = await window.LanguageModel.availability()
      this.modelStatus.value = availability

      if (availability === 'available') {
        await this.createSession()
      } else if (availability === 'downloading') {
        this.monitorDownload()
      }
    } catch (error) {
      this.modelStatus.value = 'unavailable'
      throw error
    }
  }

  /**
   * 创建模型会话
   */
  async createSession() {
    try {
      const monitor = (m) => {
        m.addEventListener('downloadprogress', (e) => {
          this.downloadProgress.value = Math.round(e.loaded * 100)
        })
      }

      this.aiSession.value = await window.LanguageModel.create({
        monitor,
        initialPrompts: [
          {
            role: 'system',
            content:
              '你是一个专业的AI助手，能够进行自然对话并回答各种问题。请用中文进行回复，确保回答准确、有帮助。',
          },
        ],
        expectedInputs: [{ type: 'text' }, { type: 'image' }],
      })

      this.modelStatus.value = 'available'
    } catch (error) {
      this.modelStatus.value = 'unavailable'
      throw error
    }
  }

  /**
   * 监控下载进度
   */
  monitorDownload() {
    const interval = setInterval(() => {
      if (this.downloadProgress.value < 100) {
        this.downloadProgress.value += 10
      } else {
        clearInterval(interval)
        this.modelStatus.value = 'available'
        this.createSession()
      }
    }, 500)
  }

  /**
   * 发送消息进行对话 - 流式版本
   */
  async sendMessageStream(message) {
    if (!this.aiSession.value) {
      this.summaryError.value = '会话未就绪'
      throw new Error('会话未就绪')
    }

    // 创建新的AbortController用于停止流式输出
    this.abortController = new AbortController()

    this.isGeneratingSummary.value = true
    this.summaryError.value = null

    try {
      // 添加用户消息到会话
      await this.aiSession.value.append([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              value: message,
            },
          ],
        },
      ])

      // 使用流式API
      const stream = this.aiSession.value.promptStreaming(message, {
        signal: this.abortController.signal,
      })

      return stream
    } catch (error) {
      this.summaryError.value = '消息发送失败: ' + error.message
      console.error('发送消息失败:', error)
      throw error
    } finally {
      this.isGeneratingSummary.value = false
    }
  }

  /**
   * 停止当前流式输出
   */
  stopStreaming() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
      this.isGeneratingSummary.value = false
    }
  }

  /**
   * 处理大数据量情况
   */
  async processLargeData(compressedData) {
    const maxSize = 10000
    if (!compressedData || compressedData.length === 0) {
      return compressedData
    }

    const dataStr = JSON.stringify(compressedData)
    if (dataStr.length <= maxSize) {
      return compressedData
    }

    let accumulated = []
    let currentLength = 0

    for (const item of compressedData) {
      const itemStr = JSON.stringify(item)
      const newLength = currentLength + itemStr.length
      if (newLength > maxSize) {
        break
      }
      accumulated.push(item)
      currentLength = newLength
    }

    if (accumulated.length === 0 && compressedData.length > 0) {
      accumulated.push(compressedData[0])
    }

    return accumulated
  }

  /**
   * Base64转File对象
   */
  base64ToFile(base64String, filename = 'image.png') {
    const arr = base64String.split(',')
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new File([u8arr], filename, { type: mime })
  }

  /**
   * 下载Base64图片
   */
  downloadBase64Image(base64Data, filename = 'image.png') {
    const link = document.createElement('a')
    link.href = base64Data
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /**
   * 销毁会话
   */
  destroySession() {
    // 停止任何正在进行的流式输出
    this.stopStreaming()

    if (this.aiSession.value) {
      try {
        this.aiSession.value.destroy()
        this.aiSession.value = null
        this.modelStatus.value = 'unavailable'
      } catch (error) {
        console.error('销毁会话失败:', error)
      }
    }
  }

  /**
   * 复制文本内容
   */
  async copyText(text) {
    if (!text) {
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      console.error('复制失败:', error)
      return false
    }
  }

  /**
   * 上传图片到会话
   */
  async uploadImage(file, textNote = '') {
    if (!this.aiSession.value) {
      throw new Error('会话未就绪')
    }

    try {
      // 构建消息内容
      const content = []

      if (textNote) {
        content.push({
          type: 'text',
          value: textNote,
        })
      }

      content.push({
        type: 'image',
        value: file,
      })

      // 附加图片到会话
      await this.aiSession.value.append([
        {
          role: 'user',
          content: content,
        },
      ])

      return true
    } catch (error) {
      console.error('上传图片失败:', error)
      throw new Error('图片上传失败: ' + error.message)
    }
  }

  /**
   * 发送包含图片的消息
   */
  async sendMessageWithImage(message, file, textNote = '') {
    if (!this.aiSession.value) {
      this.summaryError.value = '会话未就绪'
      throw new Error('会话未就绪')
    }

    this.abortController = new AbortController()
    this.isGeneratingSummary.value = true
    this.summaryError.value = null

    try {
      // 如果有图片，先上传图片
      if (file) {
        await this.uploadImage(file, textNote)
      }

      // 使用流式API发送文本消息
      const stream = this.aiSession.value.promptStreaming(message, {
        signal: this.abortController.signal,
      })

      return stream
    } catch (error) {
      this.summaryError.value = '消息发送失败: ' + error.message
      console.error('发送消息失败:', error)
      throw error
    } finally {
      this.isGeneratingSummary.value = false
    }
  }

  /**
   * 检查文件类型和大小
   */
  validateFile(file, maxSize = 10 * 1024 * 1024) {
    // 默认10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      throw new Error('不支持的文件类型，请上传 JPEG、PNG、GIF 或 WebP 格式的图片')
    }

    if (file.size > maxSize) {
      throw new Error(`文件大小不能超过 ${maxSize / 1024 / 1024}MB`)
    }

    return true
  }
}

/**
 * 创建模型管理器实例
 */
export function useGeminiModel() {
  return new GeminiModelManager()
}
