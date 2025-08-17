import { ActivityType } from 'discord.js'
import { event, Events, registerCommands } from '../utils/index.js'
import commands from '../commands/index.js'
import Keys from '../keys.js'

// Log when the bot successfully logs in and export it
export default event(Events.ClientReady, ({ log }, client) => {
    // Register the commands associated with the bot upon loggin in
    registerCommands(client, commands)

    // set status of the bot
    client.user.setActivity({
        name: 'Powered by Ollama',
        type: ActivityType.Custom
    })

    log(`Logged in as ${client.user.username}.`)
    // Log system prompt from environment if available (helpful for debugging)
    if (Keys.systemPrompt && Keys.systemPrompt.trim().length > 0) {
        log(`SYSTEM_PROMPT (from .env): ${Keys.systemPrompt}`)
    }
})