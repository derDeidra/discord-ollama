import { Client, ChatInputCommandInteraction, ApplicationCommandOptionType, MessageFlags } from 'discord.js'
import { SlashCommand, UserCommand } from '../utils/index.js'
import Config from '../config.js'

export const Capacity: SlashCommand = {
    name: 'modify-capacity',
    description: 'maximum amount messages bot will hold for context.',

    // set available user options to pass to the command
    options: [
        {
            name: 'context-capacity',
            description: 'number of allowed messages to remember',
            type: ApplicationCommandOptionType.Number,
            required: true
        }
    ],

    // Query for message information and set the style
    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        // fetch channel and message
        const channel = await client.channels.fetch(interaction.channelId)
        if (!channel || !UserCommand.includes(channel.type)) return

        // save channel-level capacity
        await Config.updateChannelConfig(interaction.channelId, {
            modifyCapacity: interaction.options.getNumber('context-capacity') as number
        })

        interaction.reply({
            content: `Max message history for this channel is now set to \`${interaction.options.get('context-capacity')?.value}\``,
            flags: MessageFlags.Ephemeral
        })
    }
}