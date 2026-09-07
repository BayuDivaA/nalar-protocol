import type {
    Address,
    Hex,
} from 'viem'

import { publicClient } from '../lib/viem'

export interface SimulationInput {
    from: Address
    to: Address
    value: bigint
    data: Hex
}

export interface SimulationResult {
    success: boolean
    gasEstimate: string | null
    returnData: Hex | null
    error: string | null
}

export async function simulateTransaction(
    tx: SimulationInput,
): Promise<SimulationResult> {
    try {
        /**
         * Execute the transaction as an eth_call.
         *
         * IMPORTANT:
         * This does NOT broadcast a transaction.
         *
         * The RPC node executes the call
         * against the current blockchain state
         * and throws away the state changes.
         */
        const result = await publicClient.call({
            account: tx.from,
            to: tx.to,
            value: tx.value,
            data: tx.data,
        })

        let gasEstimate: bigint | null = null

        try {
            gasEstimate =
                await publicClient.estimateGas({
                    account: tx.from,
                    to: tx.to,
                    value: tx.value,
                    data: tx.data,
                })
        } catch {
            /**
             * Gas estimation failure should not
             * hide a successful eth_call.
             */
            gasEstimate = null
        }

        return {
            success: true,

            gasEstimate:
                gasEstimate?.toString() ?? null,

            returnData:
                result.data ?? null,

            error: null,
        }
    } catch (error) {
        return {
            success: false,
            gasEstimate: null,
            returnData: null,
            error: extractSimulationError(error),
        }
    }
}

function extractSimulationError(
    error: unknown,
): string {
    if (error instanceof Error) {
        return error.message
    }

    return 'Transaction simulation reverted.'
}