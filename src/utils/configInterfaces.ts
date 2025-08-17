import { ChannelType } from 'discord.js'
import { UserMessage } from './index.js'

export interface ChannelConfiguration {
    'message-stream'?: boolean,
    'modify-capacity': number,
    'switch-model': string,
    'system-prompt'?: string,
    'max-messages'?: number
}

export interface ServerConfiguration {
    'toggle-chat'?: boolean,
    'system-prompt'?: string,
}

/**
 * Parent Configuration interface
 * 
 * @see ServerConfiguration server settings per guild
 * @see ChannelConfiguration channel-scoped configurations
 */
export interface Configuration {
    readonly name: string
    options: ChannelConfiguration | ServerConfiguration
}

/**
 * Channel config to use outside of this file
 */
export interface ChannelConfig {
    readonly name: string
    options: ChannelConfiguration
}

export interface ServerConfig {
    readonly name: string
    options: ServerConfiguration
}

export interface Channel {
    readonly id: string
    readonly name: string
    readonly user: string
    messages: UserMessage[]
}

/**
 * The following 2 types is allow for better readability in commands
 * Admin Command -> Don't run in Threads
 * User Command -> Used anywhere
 */
export const AdminCommand = [
    ChannelType.GuildText
]

export const UserCommand = [
    ChannelType.GuildText,
    ChannelType.PublicThread,
    ChannelType.PrivateThread
]

/**
 * Check if the configuration we are editing/taking from is a Server Config
 * @param key name of command we ran
 * @returns true if command is from Server Config, false otherwise
 */
export function isServerConfigurationKey(key: string): key is keyof ServerConfiguration {
    return ['toggle-chat', 'system-prompt'].includes(key);
}