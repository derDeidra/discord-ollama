import { Channel, Client, CommandInteraction, MessageFlags } from 'discord.js'
import { SlashCommand, UserCommand } from '../utils/index.js'
import { ChannelStorage } from '../storage/index.js'

export const ClearChannelHistory: SlashCommand = {
    name: 'clear-channel-history',
    description: 'clears the full chat history for this channel',

    run: async (client: Client, interaction: CommandInteraction) => {
        const channel: Channel | null = await client.channels.fetch(interaction.channelId)

        if (!channel || !UserCommand.includes(channel.type)) return

        await ChannelStorage.writeHistory(interaction.channelId, [])

        interaction.reply({
            content: `Chat history cleared for this channel.`,
            flags: MessageFlags.Ephemeral
        })
    }
}