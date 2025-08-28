import { Client, ChatInputCommandInteraction, ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js'
import { AdminCommand, openConfig, SlashCommand } from '../utils/index.js'

export const SetSystemPrompt: SlashCommand = {
    name: 'set-system-prompt',
    description: 'Set a global system prompt applied to new channels/threads. Administrator only.',
    defaultMemberPermissions: PermissionFlagsBits.Administrator,

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

        const prompt = interaction.options.getString('prompt') as string

        openConfig(`${interaction.guildId}-config.json`, 'system-prompt', prompt)

        interaction.reply({
            content: `Server system prompt was set. New channels will inherit this prompt.`,
            flags: MessageFlags.Ephemeral
        })
    }
}
