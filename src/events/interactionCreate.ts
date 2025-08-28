import { MessageFlags } from 'discord.js'
import { event, Events } from '../utils/index.js'
import Config from '../config.js'
import commands from '../commands/index.js'


/**
 * Interaction creation listener for the client
 * @param interaction the interaction received from the server
 */
export default event(Events.InteractionCreate, async ({ log, client }, interaction) => {
    if (!interaction.isCommand() || !interaction.isChatInputCommand()) return

    log(`Interaction called \'${interaction.commandName}\' from ${interaction.user.tag}.`)

    // ensure command exists, otherwise kill event
    const command = commands.find(command => command.name === interaction.commandName)
    if (!command) return

        // Guard: verify default permissions
    if (command.defaultMemberPermissions && !interaction.memberPermissions?.has(command.defaultMemberPermissions)) {
        interaction.reply({ content: 'You do not have permission to run this command.', flags: MessageFlags.Ephemeral })
        return
    }

    // Guard: verify role-based access from server configuration
    if (interaction.guildId) {
        const serverConfig = await Config.getServerConfig(interaction.guildId)

        const commandRoles = serverConfig?.options.commandRoles || {}
        const requiredRoleIds: string[] = commandRoles[command.name] || []

        if (requiredRoleIds.length > 0) {
            const memberRolesRaw: any = (interaction.member as any)?.roles
            const memberRoleIds: string[] = Array.isArray(memberRolesRaw)
                ? memberRolesRaw
                : memberRolesRaw?.cache?.map((r: any) => r.id) ?? []

            const hasRole = requiredRoleIds.some(id => memberRoleIds.includes(id))

            if (!hasRole) {
                interaction.reply({ content: 'You do not have the required role for this command.', flags: MessageFlags.Ephemeral })
                return
            }
        }
    }

    // the command exists, execute it
    command.run(client, interaction)
})
