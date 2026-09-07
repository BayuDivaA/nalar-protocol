import { Hono } from 'hono'

import { publicClient } from '../lib/viem'

export const healthRoute = new Hono()

healthRoute.get('/', async (c) => {
    try {
        const blockNumber = await publicClient.getBlockNumber()

        return c.json({
            ok: true,
            service: 'txsentry-api',
            blockchain: {
                chain: 'BNB Smart Chain Testnet',
                blockNumber: blockNumber.toString(),
            },
        })
    } catch (error) {
        console.error('Blockchain health check failed:', error)

        return c.json(
            {
                ok: false,
                service: 'txsentry-api',
                blockchain: {
                    connected: false,
                },
            },
            503,
        )
    }
})