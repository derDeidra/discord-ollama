import fs from 'fs'
import path from 'path'
import { TextChannel, ThreadChannel } from 'discord.js'
import { UserMessage } from '../utils/index.js'
import { withLock } from './lock.js'

function buildFilePath(channelId: string) {
    return path.join('data', `${channelId}-channel-context.json`)
}

export class ChannelStorage {
    /** Ensure history file exists and return the messages */
    static async getHistory(channelId: string): Promise<UserMessage[]> {
        const filePath = buildFilePath(channelId)
        return await withLock(filePath, async () => {
            try {
                const data = await fs.promises.readFile(filePath, 'utf8')
                const parsed = JSON.parse(data)
                return parsed.messages || []
            } catch {
                await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
                const initial = { id: channelId, name: '', messages: [] }
                await fs.promises.writeFile(filePath, JSON.stringify(initial, null, 2))
                return []
            }
        })
    }

    /** Overwrite channel history with provided messages */
    static async writeHistory(channelId: string, messages: UserMessage[]): Promise<void> {
        const filePath = buildFilePath(channelId)
        await withLock(filePath, async () => {
            const obj = { id: channelId, name: '', messages }
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
            await fs.promises.writeFile(filePath, JSON.stringify(obj, null, 2))
        })
    }

    /** Append a single message to channel history */
    static async appendMessage(channelId: string, message: UserMessage): Promise<UserMessage[]> {
        const filePath = buildFilePath(channelId)
        return await withLock(filePath, async () => {
            let obj: { id: string; name: string; messages: UserMessage[] }
            try {
                const data = await fs.promises.readFile(filePath, 'utf8')
                obj = JSON.parse(data)
                obj.messages = obj.messages || []
            } catch {
                obj = { id: channelId, name: '', messages: [] }
            }
            obj.messages.push(message)
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
            await fs.promises.writeFile(filePath, JSON.stringify(obj, null, 2))
            return obj.messages
        })
    }

    /** Remove all messages from a user in the channel history */
    static async clearUserMessages(channelId: string, userId: string): Promise<boolean> {
        const filePath = buildFilePath(channelId)
        return await withLock(filePath, async () => {
            try {
                const data = await fs.promises.readFile(filePath, 'utf8')
                const obj = JSON.parse(data)
                const before = (obj.messages || []).length
                obj.messages = (obj.messages || []).filter((m: any) => m.userId !== userId)
                const after = obj.messages.length
                if (before === after) return false
                await fs.promises.writeFile(filePath, JSON.stringify(obj, null, 2))
                return true
            } catch {
                return false
            }
        })
    }
}

export async function ensureChannelInfo(channelId: string, channel: TextChannel | ThreadChannel) {
    // Retained for compatibility with existing command handlers
    await ChannelStorage.getHistory(channelId)
}
