import { Hono } from 'hono'

import { env } from './config/env'
import { healthRoute } from './routes/health'
import { transactionRoute } from './routes/transactions'

const app = new Hono()

app.get('/', (c) => {
    return c.json({
        name: 'TxSentry API',
        version: '0.1.0',
        description:
            'AI-powered transaction intent firewall for Web3',
    })
})

app.route('/health', healthRoute)
app.route('/api/transactions', transactionRoute)

export default {
    port: env.PORT,
    fetch: app.fetch,
}