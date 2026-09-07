import type {
  Address,
  Hex,
} from 'viem'

import { env } from '../config/env'

interface TraceInput {
  from: Address
  to: Address
  value: bigint
  data: Hex
}

interface TraceResult {
  success: boolean
  error: string | null
  structLogs: unknown[]
}

export async function traceTransaction(
  tx: TraceInput,
): Promise<TraceResult> {
  try {
    const response = await fetch(
      env.BNB_RPC_URL,
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'debug_traceCall',
          params: [
            {
              from: tx.from,
              to: tx.to,
              value: `0x${tx.value.toString(16)}`,
              data: tx.data,
            },
            'latest',
            {
              tracer: 'callTracer',
              timeout: '10s',
            },
          ],
        }),
      },
    )

    if (!response.ok) {
      return {
        success: false,
        error: `RPC returned ${response.status}`,
        structLogs: [],
      }
    }

    const json = await response.json()

    if (json.error) {
      return {
        success: false,
        error:
          json.error.message ??
          'Trace request failed.',
        structLogs: [],
      }
    }

    return {
      success: true,
      error: null,
      structLogs: json.result
        ? [json.result]
        : [],
    }
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Trace request failed.',
      structLogs: [],
    }
  }
}