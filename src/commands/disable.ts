import { Client, ChatInputCommandInteraction, ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js'
import { AdminCommand, SlashCommand } from '../utils/index.js'
import Config from '../config.js'


export const Disable: SlashCommand = {
    name: 'toggle-chat',
    description: 'toggle all chat features. Adminstrator Only.',
    defaultMemberPermissions: PermissionFlagsBits.Administrator,

    // set available user options to pass to the command
    options: [
        {
            name: 'enabled',
            description: 'true = enabled, false = disabled',
            type: ApplicationCommandOptionType.Boolean,
            required: true
        }
    ],

    // Query for message information and set the style
    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        // fetch channel and message
        const channel = await client.channels.fetch(interaction.channelId)
        if (!channel || !AdminCommand.includes(channel.type)) return

        // set state of bot chat features
        await Config.updateServerConfig(interaction.guildId!, {
            toggleChat: interaction.options.getBoolean('enabled') as boolean
        })

        interaction.reply({
            content: `${client.user?.username} is now **${interaction.options.getBoolean('enabled') ? "enabled" : "disabled"}**.`,
            flags: MessageFlags.Ephemeral
        })
    }
}
