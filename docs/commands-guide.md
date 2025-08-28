## Commands Guide
This is a guide to all of the slash commands for the app.

* Action Commands are commands that do not affect a user's `preference file`.
* Guild Commands can also be considered action commands.

> [!NOTE]
> Administrator commands are only usable by actual administrators on the Discord server.

> [!TIP]
> Server owners can map Discord role IDs to commands in `data/<guild-id>-config.json` under the `commandRoles` section.
> Each command lists the roles allowed to run it. See [Command Permissions](./command-permissions.md) for configuration details.

### Guild Commands (Administrator)
1. Disable (or Toggle Chat)  
    This command will `enable` or `disable` whether or not the app will respond to users.  

    ```
    /toggle-chat enabled true
    ```

2. Shutoff  
    This command will shutoff the app so no users can converse with it.  
    The app must be manually restarted upon being shutoff.

    Below shuts off the app by putting `true` in the `are-your-sure` field.

    ```
    /shutoff are-you-sure true
    ```

3. Set System Prompt
    This command sets a server-wide system prompt which will be applied to newly-created channels and threads. Only administrators can run this command.

    ```
    /set-system-prompt prompt "You are a helpful assistant that speaks concisely."
    ```

### Action Commands
1. Clear Channel (Message) History  
    This command clears the stored chat history for the current channel/thread (affects everyone). Running the command in any channel will clear that channel's message history.

    ```
    /clear-user-channel-history
    ```

2. Pull Model  
    This command will pull a model that exists on the [Ollama Model Library](https://ollama.com/library). If it does not exist there, it will throw a hissy fit.

    Below trys to pull the `codellama` model.

    ```
    /pull-model model-to-pull codellama
    ```

3. Thread Create  
    This command creates a public thread to talk with the app instead of using a `GuildText` channel.

    ```
    /thread
    ```

4. (Private) Thread Create  
    This command creates a private thread to talk with the bot privately.  
    Invite others to the channel and they will be able to talk to the app as well.

    ```
    /private-thread
    ```

### Channel Preference Commands
1. Capacity  
    Change how much context the bot will keep for this channel's conversations. This applies to the current and future chats in this channel/thread.

    Below sets the message history capacity for the channel to at most 5 messages.

    ```
    /modify-capacity context-capacity 5
    ```

2. Message Stream  
    Toggle whether the app will "stream" a response in this channel. Streaming updates can be slow due to Discord rate limits.

    ```
    /message-stream stream true
    ```

3. Message Style  
    Choose whether the bot's responses in this channel are embedded or plain messages.

    ```
    /message-style embed true
    ```

    ```
    /message-style embed false
    ```

4. Switch Model  
    Switch the model that this channel will use (must exist locally or in the Ollama Model Library).

    ```
    /switch-model model-to-use llama3.2:1.3b
    ```

