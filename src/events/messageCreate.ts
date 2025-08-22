import { TextChannel } from 'discord.js'
import { event, Events, normalMessage, UserMessage, clean, blockResponse } from '../utils/index.js'
import Keys from '../keys.js'
import {
    getChannelInfo, getServerConfig, getChannelConfig, openChannelInfo,
    openConfig, openConfigMultiple, ChannelConfig, ServerConfig, getAttachmentData, getTextFileAttachmentData
} from '../utils/index.js'

/** 
 * Max Message length for free users is 2000 characters (bot or not).
 * Bot supports infinite lengths for normal messages.
 * 
 * @param message the message received from the channel
 */
export default event(Events.MessageCreate, async ({ log, ollama, client, defaultModel }, message) => {
    const clientId = client.user!!.id
    let cleanedMessage = clean(message.content, clientId)
    log(`Message \"${cleanedMessage}\" from ${message.author.tag} in channel/thread ${message.channelId}.`)

    // Do not respond if bot talks in the chat
    if (message.author.username === message.client.user.username) return

    // Save User Chat even if not for the bot
    let channelHistory: UserMessage[] = await new Promise((resolve) => {
        getChannelInfo(message.channelId, (channelInfo) => {
            if (channelInfo?.messages)
                resolve(channelInfo.messages)
            else {
                log(`Channel/Thread ${message.channel} channel-context does not exist. File will be created shortly...`)
                resolve([])
            }
        })
    })

    if (channelHistory.length === 0) {
        channelHistory = await new Promise((resolve) => {
            openChannelInfo(
                message.channelId,
                message.channel as TextChannel
            )
            getChannelInfo(message.channelId, (channelInfo) => {
                if (channelInfo?.messages)
                    resolve(channelInfo.messages)
                else {
                    log(`Channel/Thread ${message.channel} channel-context does not exist. File will be created shortly...`)
                }
            })
        })
    }

    // get message attachment if exists
    const attachment = message.attachments.first()
    let messageAttachment: string[] = []

    if (attachment && attachment.name?.endsWith(".txt"))
        cleanedMessage += ' ' + await getTextFileAttachmentData(attachment)
    else if (attachment)
        messageAttachment = await getAttachmentData(attachment)

    // Trim channel history to fit within the configured token window.
    // We use a simple token estimator (split on whitespace) as an approximation.
    function estimateTokens(text: string): number {
        if (!text) return 0
        // split on whitespace and punctuation-ish characters to approximate tokens
        return text.split(/\s+|(?=[.,!?;:\-()\[\]{}])/).filter(Boolean).length
    }

    // Calculate current token usage of the channel history
    let totalTokens = channelHistory.reduce((sum, m) => sum + estimateTokens(m.content), 0)
    const maxTokens = (Keys as any).maxContextTokens

    // If history exceeds max tokens, remove oldest messages until within budget
    while (totalTokens > maxTokens && channelHistory.length > 0) {
        const removed = channelHistory.shift()!
        totalTokens -= estimateTokens(removed.content)
    }

    // push user response to channel history
    channelHistory.push({
        role: 'user',
        content: cleanedMessage,
        images: messageAttachment || [],
        userId: message.author.id
    })

    // Only respond if message mentions the bot
    if (!message.mentions.has(clientId)){
        // Store in Channel Context even if not responding
        openChannelInfo(
            message.channelId, 
            message.channel as TextChannel,
            channelHistory
        )
        return
    } 

    // default stream to false
    let shouldStream = false

    // Params for Preferences Fetching
    const maxRetries = 3
    const delay = 1000 // in millisecons

    try {
        // Retrieve Server/Guild Preferences
        let attempt = 0
        let serverConfig: ServerConfig | undefined
        while (attempt < maxRetries) {
            try {
                serverConfig = await new Promise((resolve, reject) => {
                    getServerConfig(`${message.guildId}-config.json`, (config) => {
                        // check if config.json exists
                        if (config === undefined) {
                            // Allowing chat options to be available
                            openConfig(`${message.guildId}-config.json`, 'toggle-chat', true)
                            reject(new Error('Failed to locate or create Server Preferences\n\nPlease try chatting again...'))
                        }

                        // check if chat is disabled
                        else if (!config.options['toggle-chat'])
                            reject(new Error('Admin(s) have disabled chat features.\n\n Please contact your server\'s admin(s).'))
                        else
                            resolve(config)
                    })
                })
                break // successful
            } catch (error) {
                ++attempt
                if (attempt < maxRetries) {
                    log(`Attempt ${attempt} failed for Server Preferences. Retrying in ${delay}ms...`)
                    await new Promise(ret => setTimeout(ret, delay))
                } else
                    throw new Error(`Could not retrieve Server Preferences, please try chatting again...`)
            }
        }

        // Attempt to fetch channel-level config
        attempt = 0
        let channelConfig: ChannelConfig | undefined
        while (attempt < maxRetries) {
            try {
                channelConfig = await new Promise((resolve) => {
                    getChannelConfig(`${message.channelId}-config.json`, (config) => {
                        if (config === undefined) {
                            // create defaults silently if missing (do all at once)
                            const defaults: { [key: string]: any } = {
                                'switch-model': defaultModel,
                            }
                            // seed system-prompt from server if present
                            if (serverConfig?.options['system-prompt'])
                                defaults['system-prompt'] = serverConfig.options['system-prompt']

                            openConfigMultiple(`${message.channelId}-config.json`, defaults)
                            resolve(undefined)
                            return
                        }
                        resolve(config)
                    })
                })
                break
            } catch (error) {
                ++attempt
                if (attempt < maxRetries) {
                    log(`Attempt ${attempt} failed for Channel Preferences. Retrying in ${delay}ms...`)
                    await new Promise(ret => setTimeout(ret, delay))
                } else
                    throw new Error(`Could not retrieve Channel Preferences, please try chatting again...`)
            }
        }

        // Determine final model and capacity with precedence: channel -> default
        // set stream state from channel config if present
        shouldStream = (channelConfig?.options['message-stream'] as boolean) || false
        const finalModel: string = `${(channelConfig?.options['switch-model'] as string) || defaultModel}`

        // Ensure the channel-scoped history (channelHistory) has the server/channel system prompt as the first message
        if (channelConfig?.options['system-prompt'] && (channelHistory.length === 0  || channelHistory[0].role !== 'system')) {
            const systemPrompt = channelConfig.options['system-prompt'] as string
            channelHistory.unshift({ role: 'system', content: systemPrompt, images: [], userId: client.user!!.id })
        }

        // First message is now the system prompt
        // If there are more than 3 non-system prompt messages, we will summarize the history beyond those 3 messages + except for the system prompt
        if (channelHistory.length > 5) {
            // Grab all of the messages except the first system prompt and the last 3 messages
            const summarizer_system_prompt = `Paraphrase the recent conversation into brief bullet points capturing facts, constraints, decisions, and user preferences. Do NOT copy sentences verbatim. 5–10 bullets max. Do NOT mention the base system prompt. But continue to pass along information in any previous summaries.`
            // Add the summarizer system prompt as the first message
            const summarizer_prompt = [
                { 
                    role: 'system', 
                    content: summarizer_system_prompt, 
                    images: [], 
                    userId: 'system' 
                },
                { 
                    role: 'user', 
                    content: summarizer_system_prompt + channelHistory.slice(1).map(m => {
                        if (m.role === 'user'){
                            return `[user ${m.userId}]: ` + m.content
                        } else if (m.role === 'assistant') {
                            return `[assistant]: ` + m.content
                        } else if (m.role === 'system') {
                            return `[system]: ` + m.content
                        }
                    }).join('\n') + summarizer_system_prompt,
                    images: [],
                    userId: 'user'
                }
            ]
            // Summarize the messages
            const summary = await blockResponse({
                model: finalModel,
                ollama: ollama,
                msgHist: summarizer_prompt
            })
            // Replace summarized messages with the summary
            channelHistory = [
                channelHistory[0], // Keep the system prompt
                { role: 'assistant', content: 'SUMMARY: ' + summary.message.content, images: [], userId: 'assistant' },
                ...channelHistory.filter(msg => !msg.content.startsWith('SUMMARY: ')).slice(-3) // Keep the last 3 messages that are not summaries
            ]
        }

        // If no model resolved, fail with guidance
        if (!finalModel)
            throw new Error(`Failed to initialize a Model. Please set a model by running \`/switch-model <model of choice>\` or configure a channel model.`)

        // get message attachment if exists
        const attachment = message.attachments.first()
        let messageAttachment: string[] = []

        if (attachment && attachment.name?.endsWith(".txt"))
            cleanedMessage += await getTextFileAttachmentData(attachment)
        else if (attachment)
            messageAttachment = await getAttachmentData(attachment)

        const model: string = finalModel

        // response string for ollama to put its response
        var response: string = await normalMessage(message, ollama, model, channelHistory, shouldStream)

        // If something bad happened, stop without modifying persisted history
        if (response == undefined) return

        // successful query, save assistant response in channel history
        channelHistory.push({
            role: 'assistant',
            content: response,
            images: messageAttachment || [],
            userId: 'assistant'
        })

        // write final output to channel history
        openChannelInfo(message.channelId,
            message.channel as TextChannel,
            channelHistory
        )
    } catch (error: any) {
        channelHistory.pop() // remove message because of failure
        openChannelInfo(message.channelId,
            message.channel as TextChannel,
            channelHistory
        )
        message.reply(`**Error Occurred:**\n\n**Reason:** *${error.message}*`)
    }
})