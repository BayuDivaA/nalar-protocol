import type {
    Address,
} from 'viem'

import type {
    TransactionImpact,
} from '../types/impact'

export interface AnalyzeImpactInput {
    from: Address
    to: Address
    value: bigint
}

export function analyzeBasicImpact(
    input: AnalyzeImpactInput,
): TransactionImpact {
    return {
        nativeValueSpent: input.value,

        tokenTransfers: [],

        approvals: [],

        nftTransfers: [],
    }
}