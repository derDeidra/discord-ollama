import fs from 'fs'

/**
 * Simple file-based locking using lock files. Ensures only one process
 * can read/write a file at a time.
 */
export async function withLock(filePath: string, fn: () => Promise<any>) {
    const lockPath = `${filePath}.lock`
    while (true) {
        try {
            const handle = await fs.promises.open(lockPath, 'wx')
            try {
                return await fn()
            } finally {
                await handle.close()
                await fs.promises.unlink(lockPath)
            }
        } catch (err: any) {
            if (err.code === 'EEXIST') {
                await new Promise(res => setTimeout(res, 50))
                continue
            }
            throw err
        }
    }
}
