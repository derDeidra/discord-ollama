import { ApplicationCommandOptionType, Client, ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { SlashCommand, UserCommand } from '../utils/index.js'
import Config from '../config.js'

export const MessageStream: SlashCommand = {
    name: 'message-stream',
    description: 'change preference on message streaming from ollama. WARNING: can be very slow due to Discord limits.',

    // user option(s) for setting stream
    options: [
        {
            name: 'stream',
            description: 'enable or disable message streaming',
            type: ApplicationCommandOptionType.Boolean,
            required: true
        }
    ],

    // change preferences based on command
    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        // verify channel
        const channel = await client.channels.fetch(interaction.channelId)
        if (!channel || !UserCommand.includes(channel.type)) return

        // save value to channel-level config
        await Config.updateChannelConfig(interaction.channelId, {
            messageStream: interaction.options.getBoolean('stream') as boolean
        })

        interaction.reply({
            content: `Message streaming for this channel is now set to: \`${interaction.options.getBoolean('stream')}\``,
            flags: MessageFlags.Ephemeral
        })
    }
}