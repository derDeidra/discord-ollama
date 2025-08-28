import { Client, ChatInputCommandInteraction, ApplicationCommandOptionType, MessageFlags } from 'discord.js'
import { AdminCommand, SlashCommand } from '../utils/index.js'
import Config from '../config.js'

export const SetSystemPrompt: SlashCommand = {
    name: 'set-system-prompt',
    description: 'Set a global system prompt applied to new channels/threads. Administrator only.',

    options: [
        {
            name: 'prompt',
            description: 'The system prompt text to apply to new channels',
            type: ApplicationCommandOptionType.String,
            required: true
        }
    ],

    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        // fetch channel and message
        const channel = await client.channels.fetch(interaction.channelId)
        if (!channel || !AdminCommand.includes(channel.type)) return

        // check permissions
        if (!interaction.memberPermissions?.has('Administrator')) {
            interaction.reply({
                content: `${interaction.commandName} is an admin command. Please contact an admin to use this command for you.`,
                flags: MessageFlags.Ephemeral
            })
            return
        }

        const prompt = interaction.options.getString('prompt') as string

        await Config.updateServerConfig(interaction.guildId!, { systemPrompt: prompt })

        interaction.reply({
            content: `Server system prompt was set. New channels will inherit this prompt.`,
            flags: MessageFlags.Ephemeral
        })
    }
}
