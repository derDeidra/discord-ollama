import { TextChannel, ThreadChannel } from 'discord.js'
import { Configuration, Channel, UserMessage } from '../index.js'
import fs from 'fs'
import path from 'path'

/**
 * Method to check if a thread history file exists
 * 
 * @param channel parent thread of the requested thread (can be GuildText)
 * @returns true if channel does not exist, false otherwise
 */
async function checkChannelInfoExists(channel: TextChannel) {
    const fullFileName = `data/${channel.id}-channel-context.json`
    return fs.existsSync(fullFileName)
}

/**
 * Method to clear channel history for requesting user
 * 
 * @param filename guild id string
 * @param channel the TextChannel in the Guild
 * @param user username of user
 * @returns nothing
 */
export async function clearChannelInfo(filename: string, channel: TextChannel, userId: string): Promise<boolean> {
    const channelInfoExists: boolean = await checkChannelInfoExists(channel)

    // If thread does not exist, file can't be found
    if (!channelInfoExists) return false

    // Attempt to clear user's messages from channel context
    const fullFileName = `data/${filename}-channel-context.json`
    try {
        const data = fs.readFileSync(fullFileName, 'utf8')
        const object = JSON.parse(data)
        const originalLen = (object['messages'] || []).length
        object['messages'] = (object['messages'] || []).filter((m: any) => m.userId !== userId)
        const newLen = object['messages'].length
        if (newLen === originalLen) return false
        fs.writeFileSync(fullFileName, JSON.stringify(object, null, 2))
        return true
    } catch (err) {
        console.log(`[Error: clearChannelInfo] ${err}`)
        return false
    }
}

/**
 * Method to open the channel history
 * 
 * @param filename name of the json file for the channel by user
 * @param channel the text channel info
 * @param messages their messages
 */
export async function openChannelInfo(filename: string, channel: TextChannel | ThreadChannel, messages: UserMessage[] = []): Promise<void> {
    const fullFileName = `data/${filename}-channel-context.json`
    if (fs.existsSync(fullFileName)) {
        try {
            const data = fs.readFileSync(fullFileName, 'utf8')
            const object = JSON.parse(data)
            if (!object['messages'] || object['messages'].length === 0)
                object['messages'] = messages as []
            else if (object['messages'].length !== 0 && messages.length !== 0)
                object['messages'] = messages as []
            fs.writeFileSync(fullFileName, JSON.stringify(object, null, 2))
        } catch (err) {
            console.log(`[Error: openChannelInfo] Incorrect file format`)
        }
    } else { // file doesn't exist, create it
        const object: Configuration = JSON.parse(
            `{ 
                \"id\": \"${channel?.id}\", 
                \"name\": \"${channel?.name}\", 
                \"messages\": []
            }`
        )

        const directory = path.dirname(fullFileName)
        if (!fs.existsSync(directory))
            fs.mkdirSync(directory, { recursive: true })

        // only creating it, no need to add anything
        fs.writeFileSync(fullFileName, JSON.stringify(object, null, 2))
        console.log(`[Util: openChannelInfo] Created '${fullFileName}' in working directory`)
    }
}

/**
 * Method to get the channel information/history
 * 
 * @param filename name of the json file for the channel by user
 * @param callback function to handle resolving message history
 */
export async function getChannelInfo(filenameOrId: string, callback: (config: Channel | undefined) => void): Promise<void> {
    // Accept either a full filename (e.g. "123-channel-context.json") or a raw channel id ("123")
    const fullFileName = filenameOrId.endsWith('.json') ? `data/${filenameOrId}` : `data/${filenameOrId}-channel-context.json`
    if (fs.existsSync(fullFileName)) {
        try {
            const data = fs.readFileSync(fullFileName, 'utf8')
            callback(JSON.parse(data))
        } catch (err) {
            callback(undefined)
        }
    } else {
        callback(undefined) // file not found
    }
}