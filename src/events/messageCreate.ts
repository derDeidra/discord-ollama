import { event, Events, normalMessage, UserMessage, clean, blockResponse } from '../utils/index.js'
import { ChannelConfig, getAttachmentData, getTextFileAttachmentData } from '../utils/index.js'
import { ChannelStorage } from '../storage/index.js'
import Config from '../config.js'

/** 
 * Max Message length for free users is 2000 characters (bot or not).
 * Bot supports infinite lengths for normal messages.
 * 
 * @param message the message received from the channel
 */
export default event(Events.MessageCreate, async ({ log, ollama, client }, message) => {
    const clientId = client.user!!.id
    let cleanedMessage = clean(message.content, clientId)
    if (cleanedMessage.length < 5) return // ignore messages that are too short after cleaning
    log(`Message \"${cleanedMessage}\" from ${message.author.tag} in channel/thread ${message.channelId}.`)

    // Do not respond if bot talks in the chat
    if (message.author.username === message.client.user.username) return

    // Save User Chat even if not for the bot
    let channelHistory: UserMessage[] = await ChannelStorage.getHistory(message.channelId)

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
    const maxTokens = Config.getMaxContextTokens()

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
        await ChannelStorage.writeHistory(message.channelId, channelHistory)
        return
    }

    // default stream to false
    let shouldStream = false

      try {
          const channelConfig: ChannelConfig = await Config.getChannelConfig(
              message.guildId!,
              message.channelId
          )

        if (!channelConfig.options.toggleChat)
            throw new Error('Admin(s) have disabled chat features.\n\n Please contact your server\'s admin(s).')

        // Determine final model and capacity with precedence: channel -> default
        // set stream state from channel config if present
        shouldStream = channelConfig.options.messageStream || false
        const finalModel: string = channelConfig.options.switchModel

        // Ensure the channel-scoped history (channelHistory) has the server/channel system prompt as the first message
        if (channelConfig.options.systemPrompt && (channelHistory.length === 0  || channelHistory[0].role !== 'system')) {
            const systemPrompt = channelConfig.options.systemPrompt
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
        await ChannelStorage.writeHistory(message.channelId, channelHistory)
    } catch (error: any) {
        channelHistory.pop() // remove message because of failure
        await ChannelStorage.writeHistory(message.channelId, channelHistory)
        message.reply(`**Error Occurred:**\n\n**Reason:** *${error.message}*`)
    }
})
