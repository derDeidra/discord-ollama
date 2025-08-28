# Command Permissions

This guide explains how to control which Discord roles can run specific slash commands.

## Available commands

The following commands can have role restrictions applied:

- `thread`
- `private-thread`
- `message-stream`
- `toggle-chat`
- `shutoff`
- `modify-capacity`
- `clear-user-channel-history`
- `pull-model`
- `switch-model`
- `delete-model`
- `set-system-prompt`

## Server command role mapping

Server configuration files at `data/<guild-id>-config.json` include a `command-roles` map. Each command is listed with an array of Discord role IDs that are allowed to run it. The default configuration lists all commands with empty arrays so you can fill in the appropriate roles.

```json
{
  "command-roles": {
    "thread": [],
    "private-thread": [],
    "message-stream": [],
    "toggle-chat": [],
    "shutoff": [],
    "modify-capacity": [],
    "clear-user-channel-history": [],
    "pull-model": [],
    "switch-model": [],
    "delete-model": [],
    "set-system-prompt": []
  }
}
```

A ready-to-edit example config file listing all commands is available at [`sample-guild-config.json`](./sample-guild-config.json).

## Permission guard

Before executing a command, the bot checks `command-roles` for that command. If any role IDs are specified, the member must have at least one of them. Any Discord `defaultMemberPermissions` declared on the command are also enforced.

## Updating roles without code changes

To grant or revoke access, modify the role IDs in the server config file and reload the bot. No code changes or redeployment are required.

