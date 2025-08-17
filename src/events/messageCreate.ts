import { TextChannel } from 'discord.js'
import { event, Events, normalMessage, UserMessage, clean, addToChannelContext } from '../utils/index.js'
import {
    getChannelInfo, getServerConfig, getChannelConfig, openChannelInfo,
    openConfig, ChannelConfig, ServerConfig, getAttachmentData, getTextFileAttachmentData
} from '../utils/index.js'

/** 
 * Max Message length for free users is 2000 characters (bot or not).
 * Bot supports infinite lengths for normal messages.
 * 
 * @param message the message received from the channel
 */
export default event(Events.MessageCreate, async ({ log, msgHist, channelHistory, ollama, client, defaultModel }, message) => {
    const clientId = client.user!!.id
    let cleanedMessage = clean(message.content, clientId)
    log(`Message \"${cleanedMessage}\" from ${message.author.tag} in channel/thread ${message.channelId}.`)

    // Do not respond if bot talks in the chat
    if (message.author.username === message.client.user.username) return

    // Save User Chat even if not for the bot
    let channelContextHistory: UserMessage[] = await new Promise((resolve) => {
        getChannelInfo(`${message.channelId}-context.json`, (channelInfo) => {
            if (channelInfo?.messages)
                resolve(channelInfo.messages)
            else {
                log(`Channel/Thread ${message.channel}-context does not exist. File will be created shortly...`)
                resolve([])
            }
        })
    })

    if (channelContextHistory.length === 0) {
        channelContextHistory = await new Promise((resolve) => {
            addToChannelContext(message.channelId,
                message.channel as TextChannel
            )
            getChannelInfo(`${message.channelId}-context.json`, (channelInfo) => {
                if (channelInfo?.messages)
                    resolve(channelInfo.messages)
                else {
                    log(`Channel/Thread ${message.channel}-context does not exist. File will be created shortly...`)
                }
            })
        })
    }

    // Set Channel History Queue
    channelHistory.setQueue(channelContextHistory)

    // get message attachment if exists
    const attachment = message.attachments.first()
    let messageAttachment: string[] = []

    if (attachment && attachment.name?.endsWith(".txt"))
        cleanedMessage += ' ' + await getTextFileAttachmentData(attachment)
    else if (attachment)
        messageAttachment = await getAttachmentData(attachment)

    while (channelHistory.size() >= channelHistory.capacity) channelHistory.dequeue()

    // push user response to channel history
    console.log
    channelHistory.enqueue({
        role: 'user',
        content: cleanedMessage,
        images: messageAttachment || []
    })

    // Store in Channel Context
    addToChannelContext(message.channelId,
        message.channel as TextChannel,
        channelHistory.getItems()
    )

    // Only respond if message mentions the bot
    if (!message.mentions.has(clientId)) return

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
                            // create defaults silently if missing
                            openConfig(`${message.channelId}-config.json`, 'switch-model', defaultModel)
                            openConfig(`${message.channelId}-config.json`, 'modify-capacity', msgHist.capacity)
                            // seed system-prompt from server if present
                            if (serverConfig?.options['system-prompt'])
                                openConfig(`${message.channelId}-config.json`, 'system-prompt', serverConfig.options['system-prompt'])
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

    // (no per-user preferences anymore) -- channelConfig holds channel-level options


        // Use a single, channel-scoped history file so the thread context is shared by everyone
        const channelFilename = `${message.channelId}-channel.json`
        let chatMessages: UserMessage[] = await new Promise((resolve) => {
            // set new queue to modify
            getChannelInfo(channelFilename, (channelInfo) => {
                if (channelInfo?.messages)
                    resolve(channelInfo.messages)
                else {
                    log(`Channel/Thread ${message.channel} does not exist. File will be created shortly...`)
                    resolve([])
                }
            })
        })

        if (chatMessages.length === 0) {
            chatMessages = await new Promise((resolve, reject) => {
                // create/open a channel-scoped history file (user set to 'channel')
                openChannelInfo(message.channelId,
                    message.channel as TextChannel,
                    'channel'
                )
                getChannelInfo(channelFilename, (channelInfo) => {
                    if (channelInfo?.messages)
                        resolve(channelInfo.messages)
                    else {
                        log(`Channel/Thread ${message.channel} does not exist. File will be created shortly...`)
                        reject(new Error(`Failed to find channel history. Try chatting again.`))
                    }
                })
            })
        }

        // If channel history is empty and channelConfig has a system-prompt, seed it
        if (chatMessages.length === 0 && channelConfig?.options['system-prompt']) {
            const systemPrompt = channelConfig.options['system-prompt'] as string
            msgHist.setQueue([])
            msgHist.enqueue({ role: 'system', content: systemPrompt, images: [] })
            // persist initial system prompt into channel history file
            openChannelInfo(message.channelId,
                message.channel as TextChannel,
                'channel',
                msgHist.getItems()
            )
            // set chatMessages from queue
            chatMessages = msgHist.getItems()
        }


    // Determine final model and capacity with precedence: channel -> default
    // set stream state from channel config if present
    shouldStream = (channelConfig?.options['message-stream'] as boolean) || false
    const finalModel: string = `${(channelConfig?.options['switch-model'] as string) || defaultModel}`

        // Channel-level capacity overrides user-level
        if (typeof channelConfig?.options['modify-capacity'] === 'number') {
            msgHist.capacity = channelConfig!.options['modify-capacity'] as number
            log(`Applying channel-level capacity: ${msgHist.capacity}`)
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

        // set up new queue
        msgHist.setQueue(chatMessages)

        // check if we can push, if not, remove oldest
        while (msgHist.size() >= msgHist.capacity) msgHist.dequeue()

        // push user response before ollama query
        msgHist.enqueue({
            role: 'user',
            content: cleanedMessage,
            images: messageAttachment || []
        })

        // response string for ollama to put its response
        var response: string = await normalMessage(message, ollama, model, msgHist, shouldStream)

        // If something bad happened, remove user query and stop
        if (response == undefined) { msgHist.pop(); return }
        if (response == '') {
            response = 'I am sorry, but I could not understand your message. Please try rephrasing it or ask a different question.';
        }

        // if queue is full, remove the oldest message
        while (msgHist.size() >= msgHist.capacity) msgHist.dequeue()

        // successful query, save it in context history
        msgHist.enqueue({
            role: 'assistant',
            content: response,
            images: messageAttachment || []
        })

        // only update the channel-scoped json on success
        openChannelInfo(message.channelId,
            message.channel as TextChannel,
            'channel',
            msgHist.getItems()
        )
    } catch (error: any) {
        msgHist.pop() // remove message because of failure
        message.reply(`**Error Occurred:**\n\n**Reason:** *${error.message}*`)
    }
})