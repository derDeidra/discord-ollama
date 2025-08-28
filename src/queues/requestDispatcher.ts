import { ChatResponse } from 'ollama'
import { AbortableAsyncIterator } from 'ollama/src/utils.js'
import { blockResponse, streamResponse } from '../utils/handlers/streamHandler.js'
import { ChatParams } from '../utils/events.js'

export type LLMTask<T> = () => Promise<T>

interface QueueItem<T> {
    fn: LLMTask<T>
    resolve: (value: T) => void
    reject: (reason?: any) => void
}

/**
 * Central dispatcher for all LLM requests. Maintains a global queue
 * and limits the number of concurrent executions.
 */
export class RequestDispatcher {
    private static instance: RequestDispatcher
    private queue: QueueItem<any>[] = []
    private active = 0

    // Maximum number of concurrent LLM executions allowed
    private readonly concurrency: number

    private constructor(concurrency = 2) {
        this.concurrency = concurrency
    }

    /**
     * Access singleton instance
     */
    static getInstance(concurrency = 2): RequestDispatcher {
        if (!RequestDispatcher.instance)
            RequestDispatcher.instance = new RequestDispatcher(concurrency)
        return RequestDispatcher.instance
    }

    /**
     * Enqueue a task for execution. If the task is not picked up within the
     * provided timeout, it will reject with a rate limit error.
     * @param fn async task to execute
     * @param timeout time in ms to wait before rejecting
     */
    private enqueue<T>(fn: LLMTask<T>, timeout = 10000): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            let timer: NodeJS.Timeout
            const item: QueueItem<T> = {
                fn,
                resolve: (val: T) => { clearTimeout(timer); resolve(val) },
                reject: (err: any) => { clearTimeout(timer); reject(err) }
            }

            // timeout for waiting in queue
            timer = setTimeout(() => {
                const idx = this.queue.indexOf(item)
                if (idx !== -1) {
                    this.queue.splice(idx, 1)
                    item.reject(new Error('Rate limit exceeded: request timed out while waiting in queue.'))
                }
            }, timeout)

            this.queue.push(item)
            this.process()
        })
    }

    /**
     * Request a non-streaming LLM response through the dispatcher
     */
    async blockResponse(params: ChatParams, timeout = 10000): Promise<ChatResponse> {
        return this.enqueue(() => blockResponse(params), timeout)
    }

    /**
     * Request a streaming LLM response through the dispatcher
     */
    async streamResponse(params: ChatParams, timeout = 10000): Promise<AbortableAsyncIterator<ChatResponse>> {
        return this.enqueue(() => streamResponse(params), timeout)
    }

    private process(): void {
        while (this.active < this.concurrency && this.queue.length > 0) {
            const item = this.queue.shift()!
            this.active++
            item.fn()
                .then(res => item.resolve(res))
                .catch(err => item.reject(err))
                .finally(() => {
                    this.active--
                    this.process()
                })
        }
    }
}

// Export a default singleton for convenience
export const requestDispatcher = RequestDispatcher.getInstance()
