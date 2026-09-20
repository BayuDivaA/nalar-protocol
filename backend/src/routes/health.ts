import { Hono } from 'hono'

import { publicClient } from '../lib/viem'

export const healthRoute = new Hono()

healthRoute.get('/', async (c) => {
    let blockNumber: string | null = null;
    try {
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('RPC query timeout')), 2500),
        );
        const bn = await Promise.race([publicClient.getBlockNumber(), timeoutPromise]);
        blockNumber = bn.toString();
    } catch (error) {
        console.warn('[HEALTH] RPC blockNumber probe timed out or failed:', error instanceof Error ? error.message : String(error));
    }

    return c.json({
        ok: true,
        service: 'txsentry-api',
        blockchain: {
            chain: 'BNB Smart Chain Testnet',
            connected: blockNumber !== null,
            ...(blockNumber ? { blockNumber } : {}),
        },
    });
});