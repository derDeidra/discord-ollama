import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { openConfigMultiple } from '../src/utils/handlers/configHandler.js'

const testFile = 'data/test-guild-config.json'

describe('Config Handler - openConfigMultiple', () => {
    beforeEach(() => {
        // ensure clean state
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile)
    })

    afterEach(() => {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile)
    })

    it('creates a new config file with provided options', () => {
        openConfigMultiple('test-guild-config.json', { toggleChat: true, systemPrompt: 'hello' })
        expect(fs.existsSync(testFile)).toBe(true)
        const data = JSON.parse(fs.readFileSync(testFile, 'utf8'))
        expect(data.options.toggleChat).toBe(true)
        expect(data.options.systemPrompt).toBe('hello')
    })

    it('updates an existing config file with multiple keys', () => {
        // create initial file
        fs.writeFileSync(testFile, JSON.stringify({ name: 'Server Confirgurations', options: { toggleChat: true } }))
        openConfigMultiple('test-guild-config.json', { systemPrompt: 'new prompt', toggleChat: false })
        const data = JSON.parse(fs.readFileSync(testFile, 'utf8'))
        expect(data.options.systemPrompt).toBe('new prompt')
        expect(data.options.toggleChat).toBe(false)
    })

    it('stores command role mappings', () => {
        openConfigMultiple('test-guild-config.json', { commandRoles: { 'pull-model': ['1', '2'] } })
        const data = JSON.parse(fs.readFileSync(testFile, 'utf8'))
        expect(data.options.commandRoles['pull-model']).toEqual(['1', '2'])
    })
})

