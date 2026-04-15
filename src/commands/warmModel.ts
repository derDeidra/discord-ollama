import { ApplicationCommandOptionType, Client, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js'
import { ollama } from '../client.js'
import { AdminCommand, SlashCommand } from '../utils/index.js'
import Config from '../config.js'

export const WarmModel: SlashCommand = {
    name: 'warm-model',
    description: 'loads the configured model into VRAM. Administrator Only.',
    defaultMemberPermissions: PermissionFlagsBits.Administrator,

    options: [
        {
            name: 'duration',
            description: 'how long to keep the model loaded (e.g. 30m, 1h). Defaults to 30m.',
            type: ApplicationCommandOptionType.String,
            required: false
        }
    ],

    run: async (client: Client, interaction: ChatInputCommandInteraction) => {
        await interaction.deferReply()

        const channel = await client.channels.fetch(interaction.channelId)
        if (!channel || !AdminCommand.includes(channel.type)) return

        const duration = interaction.options.getString('duration') ?? '30m'

        try {
            const channelConfig = await Config.getChannelConfig(interaction.guildId!, interaction.channelId)
            const model = channelConfig.options.switchModel

            await interaction.editReply({ content: `Warming up **${model}** for ${duration}...` })

            // Send a minimal request — keep_alive loads the model into VRAM without
            // generating output and holds it for the specified duration.
            await ollama.chat({
                model,
                messages: [{ role: 'user', content: ' ' }],
                options: { num_predict: 0 },
                keep_alive: duration
            })

            await interaction.editReply({ content: `**${model}** is loaded and will stay warm for ${duration}.` })
        } catch (error: any) {
            if (error.message?.includes('fetch failed'))
                error.message = 'The Ollama service is not running.'
            await interaction.editReply({ content: `Failed to warm model.\n\n${error.message}` })
        }
    }
}
