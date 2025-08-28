import { ChannelType } from 'discord.js'
import { UserMessage } from './index.js'

/**
 * Configuration options scoped to a specific channel/thread.
 * Properties are camelCased for strong typing and self-documenting access.
 */
export interface ChannelConfiguration {
    messageStream?: boolean,
    modifyCapacity?: number,
    switchModel: string,
    systemPrompt?: string,
    maxMessages?: number
}

/**
 * Configuration options scoped to an entire server/guild.
 */
export interface ServerConfiguration {
    toggleChat?: boolean,
    systemPrompt?: string,
    /**
     * Maps command names to arrays of Discord role IDs allowed to execute them.
     * Each command should list the roles that are permitted to run it.
     */
    commandRoles?: Record<string, string[]>,
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
    // Resolved options contain both server and channel-scoped settings
    options: ChannelConfiguration & ServerConfiguration
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
    return ['toggleChat', 'systemPrompt', 'commandRoles'].includes(key);
}
