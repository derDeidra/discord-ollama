import fs from 'fs'
import path from 'path'
import { getEnvVar } from './utils/env.js'
import { withLock } from './storage/lock.js'
import { ChannelConfig, ChannelConfiguration, ServerConfig, ServerConfiguration } from './utils/configInterfaces.js'

export class Config {
  private static env = {
    clientToken: getEnvVar('CLIENT_TOKEN'),
    ipAddress: getEnvVar('OLLAMA_IP', '127.0.0.1'),
    portAddress: getEnvVar('OLLAMA_PORT', '11434'),
    defaultModel: getEnvVar('MODEL', 'llama3.2'),
    systemPrompt: getEnvVar(
      'SYSTEM_PROMPT',
      'You are a discord assistant bot. Be helpful, informative, and engaging. Do not engage in any illegal, harmful, or inappropriate activities.'
    ),
    maxContextTokens: Number.parseInt(getEnvVar('MAX_CONTEXT_TOKENS', '4096'), 10)
  }

  private static filePathFor(name: string) {
    return path.join('data', name)
  }

  private static async read<T>(fileName: string): Promise<T | undefined> {
    const filePath = this.filePathFor(fileName)
    try {
      return await withLock(filePath, async () => {
        const data = await fs.promises.readFile(filePath, 'utf8')
        return JSON.parse(data) as T
      })
    } catch {
      return undefined
    }
  }

  private static async update<T>(fileName: string, updates: Partial<T>, name: string) {
    const filePath = this.filePathFor(fileName)
    await withLock(filePath, async () => {
      let obj: { name: string; options: T }
      try {
        const data = await fs.promises.readFile(filePath, 'utf8')
        obj = JSON.parse(data)
      } catch {
        obj = { name, options: {} as T }
      }
      obj.options = { ...obj.options, ...updates }
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
      await fs.promises.writeFile(filePath, JSON.stringify(obj, null, 2))
    })
  }

  static async getServerConfig(guildId: string): Promise<ServerConfig | undefined> {
    return await this.read<ServerConfig>(`${guildId}-config.json`)
  }

  private static async getChannelConfigFile(channelId: string): Promise<ChannelConfig | undefined> {
    return await this.read<ChannelConfig>(`${channelId}-config.json`)
  }

  static async updateServerConfig(guildId: string, updates: Partial<ServerConfiguration>) {
    await this.update<ServerConfiguration>(`${guildId}-config.json`, updates, 'Server Confirgurations')
  }

  static async updateChannelConfig(channelId: string, updates: Partial<ChannelConfiguration>) {
    await this.update<ChannelConfiguration>(`${channelId}-config.json`, updates, 'User Confirgurations')
  }

  static async getChannelConfig(guildId: string, channelId: string): Promise<ChannelConfig> {
    const baseline: ChannelConfiguration & ServerConfiguration = {
      switchModel: this.env.defaultModel,
      toggleChat: true
    }
    if (this.env.systemPrompt) baseline.systemPrompt = this.env.systemPrompt

    let serverConfig = await this.getServerConfig(guildId)
    if (!serverConfig) {
      await this.updateServerConfig(guildId, {
        toggleChat: true,
        ...(this.env.systemPrompt ? { systemPrompt: this.env.systemPrompt } : {})
      })
      serverConfig = await this.getServerConfig(guildId)
    }

    if (serverConfig?.options) Object.assign(baseline, serverConfig.options)

    let channelConfig = await this.getChannelConfigFile(channelId)
    if (!channelConfig) {
      const defaults: Partial<ChannelConfiguration> = { switchModel: baseline.switchModel }
      if (baseline.systemPrompt) defaults.systemPrompt = baseline.systemPrompt
      await this.updateChannelConfig(channelId, defaults)
      channelConfig = await this.getChannelConfigFile(channelId)
    } else {
      channelConfig.options = channelConfig.options || ({} as ChannelConfiguration & ServerConfiguration)
      if (baseline.systemPrompt && !channelConfig.options.systemPrompt) {
        await this.updateChannelConfig(channelId, { systemPrompt: baseline.systemPrompt })
        channelConfig.options.systemPrompt = baseline.systemPrompt
      }
      if (!channelConfig.options.switchModel) {
        await this.updateChannelConfig(channelId, { switchModel: baseline.switchModel })
        channelConfig.options.switchModel = baseline.switchModel
      }
    }

    const options = { ...baseline, ...(channelConfig?.options || {}) }
    return { name: channelConfig?.name ?? 'User Confirgurations', options }
  }

  static getClientToken() {
    return this.env.clientToken
  }

  static getOllamaUrl() {
    return `http://${this.env.ipAddress}:${this.env.portAddress}`
  }

  static getDefaultModel() {
    return this.env.defaultModel
  }

  static getSystemPrompt() {
    return this.env.systemPrompt
  }

  static getMaxContextTokens() {
    return this.env.maxContextTokens
  }
}

export default Config

