import { Configuration, ServerConfig, ChannelConfig, isServerConfigurationKey } from '../index.js'
import fs from 'fs'
import path from 'path'

const ALL_COMMAND_NAMES = [
    'thread',
    'private-thread',
    'message-stream',
    'toggle-chat',
    'shutoff',
    'modify-capacity',
    'clear-user-channel-history',
    'pull-model',
    'switch-model',
    'delete-model',
    'set-system-prompt'
]

/**
 * Method to open a file in the working directory and modify/create it
 * 
 * @param filename name of the file
 * @param key key value to access
 * @param value new value to assign
 */
// add type of change (server, user)
export function openConfig(filename: string, key: string, value: any) {
    const fullFileName = `data/${filename}`

    // check if the file exists, if not then make the config file
    if (fs.existsSync(fullFileName)) {
        fs.readFile(fullFileName, 'utf8', (error, data) => {
            if (error)
                console.log(`[Error: openConfig] Incorrect file format`)
            else {
                const object = JSON.parse(data)
                object['options'][key] = value
                fs.writeFileSync(fullFileName, JSON.stringify(object, null, 2))
            }
        })
    } else { // work on dynamic file creation
        let object: Configuration
        if (isServerConfigurationKey(key))
            object = JSON.parse('{ \"name\": \"Server Confirgurations\" }')
        else
            object = JSON.parse('{ \"name\": \"User Confirgurations\" }')

        // set standard information for config file and options
        object['options'] = {
            [key]: value
        }

        const directory = path.dirname(fullFileName)
        if (!fs.existsSync(directory))
            fs.mkdirSync(directory, { recursive: true })

        fs.writeFileSync(`data/${filename}`, JSON.stringify(object, null, 2))
        console.log(`[Util: openConfig] Created '${filename}' in working directory`)
    }
}

/**
 * Method to open or create a config file and apply multiple option key/values at once.
 *
 * @param filename name of the file
 * @param options object containing key/value pairs to set
 */
export function openConfigMultiple(filename: string, options: { [key: string]: any }) {
    const fullFileName = `data/${filename}`

    if (fs.existsSync(fullFileName)) {
        try {
            const data = fs.readFileSync(fullFileName, 'utf8')
            const object = JSON.parse(data)
            object['options'] = object['options'] ?? {}
            for (const k in options)
                object['options'][k] = options[k]
            fs.writeFileSync(fullFileName, JSON.stringify(object, null, 2))
        } catch (err) {
            console.log(`[Error: openConfigMultiple] Incorrect file format`)
        }
    } else {
        // Build a default Configuration object depending on whether any key is a server key
        // Use the first key to decide server vs channel config naming
        const sampleKey = Object.keys(options)[0] ?? 'switch-model'
        let object: Configuration
        if (isServerConfigurationKey(sampleKey))
            object = JSON.parse('{ "name": "Server Confirgurations" }')
        else
            object = JSON.parse('{ "name": "User Confirgurations" }')

        object['options'] = options

        const directory = path.dirname(fullFileName)
        if (!fs.existsSync(directory))
            fs.mkdirSync(directory, { recursive: true })

        fs.writeFileSync(fullFileName, JSON.stringify(object, null, 2))
        console.log(`[Util: openConfigMultiple] Created '${filename}' in working directory`)
    }
}

/**
 * Method to obtain the configurations of the message chat/thread
 * 
 * @param filename name of the configuration file to get
 * @param callback function to allow a promise from getting the config
 */
export async function getServerConfig(filename: string, callback: (config: ServerConfig | undefined) => void): Promise<void> {
    const fullFileName = `data/${filename}`

    // attempt to read the file and get the configuration
    if (fs.existsSync(fullFileName)) {
        fs.readFile(fullFileName, 'utf8', (error, data) => {
            if (error) {
                callback(undefined)
                return // something went wrong... stop
            }
            callback(JSON.parse(data))
        })
    } else {
        // If a server config file doesn't exist, provide a sensible default.
        // Use SYSTEM_PROMPT from the environment if present to seed the server config.
        const envSystemPrompt = process.env['SYSTEM_PROMPT']
        const defaultConfig: ServerConfig = {
            name: 'Server Confirgurations',
            options: {
                'toggle-chat': true,
                ...(envSystemPrompt ? { 'system-prompt': envSystemPrompt } : {}),
                'command-roles': Object.fromEntries(ALL_COMMAND_NAMES.map(name => [name, [] as string[]]))
            }
        }
        callback(defaultConfig)
    }
}

/**
 * Method to obtain the configurations of the message chat/thread
 * 
 * @param filename name of the configuration file to get
 * @param callback function to allow a promise from getting the config
 */
export async function getChannelConfig(filename: string, callback: (config: ChannelConfig | undefined) => void): Promise<void> {
    const fullFileName = `data/${filename}`

    // attempt to read the file and get the configuration
    if (fs.existsSync(fullFileName)) {
        fs.readFile(fullFileName, 'utf8', (error, data) => {
            if (error) {
                callback(undefined)
                return // something went wrong... stop
            }
            callback(JSON.parse(data))
        })
    } else {
        callback(undefined) // file not found
    }
}
