import {
  type Address,
  type Hex,
} from 'viem'

import { publicClient } from '../lib/viem'
import { securityAbi } from '../lib/abis'

import type {
  ApprovalChange,
} from '../types/impact'

import {
  getApprovalState,
} from './nft-state'

const MAX_UINT256 =
  2n ** 256n - 1n

interface StateDiffResult {
  approvals: ApprovalChange[]
}

export async function analyzeStateDiff(input: {
  from: Address
  to: Address
  data: Hex
}): Promise<StateDiffResult> {
  const result: StateDiffResult = {
    approvals: [],
  }

  if (input.data === '0x') {
    return result
  }

  const selector = input.data.slice(0, 10)

  /**
   * ERC20 approve(address,uint256)
   *
   * selector:
   * 0x095ea7b3
   */
  if (selector === '0x095ea7b3') {
    try {
      const spender = extractAddress(
        input.data,
        0,
      )

      const amount = extractUint256(
        input.data,
        1,
      )

      const before =
        await publicClient.readContract({
          address: input.to,
          abi: securityAbi,
          functionName: 'allowance',
          args: [
            input.from,
            spender,
          ],
        })

      result.approvals.push({
        type: 'ERC20_ALLOWANCE',

        token: input.to,

        owner: input.from,

        spender,

        before,

        after: amount,

        unlimited:
          amount === MAX_UINT256,

        stateKnown: true,
      })

      return result
    } catch (error) {
      console.error(
        'ERC20 state diff failed:',
        error,
      )

      return result
    }
  }

  /**
   * ERC721 setApprovalForAll(address,bool)
   *
   * selector:
   * 0xa22cb465
   */
  if (selector === '0xa22cb465') {
  const operator = extractAddress(
    input.data,
    0,
  )

  const approved = extractBool(
    input.data,
    1,
  )

  const before =
    await getApprovalState(
      input.to,
      input.from,
      operator,
    )

  if (before === null) {
    result.approvals.push({
      type: 'ERC721_OPERATOR',

      token: input.to,

      owner: input.from,

      spender: operator,

      before: 0n,

      after: approved ? 1n : 0n,

      unlimited: approved,

      stateKnown: false,
    })

    return result
  }

  result.approvals.push({
    type: 'ERC721_OPERATOR',

    token: input.to,

    owner: input.from,

    spender: operator,

    before: before ? 1n : 0n,

    after: approved ? 1n : 0n,

    unlimited: approved,

    stateKnown: true,
  })

  return result
}

  return result
}

function extractAddress(
  data: Hex,
  index: number,
): Address {
  const start =
    10 + index * 64

  const word = data.slice(
    start,
    start + 64,
  )

  return `0x${word.slice(24)}` as Address
}

function extractUint256(
  data: Hex,
  index: number,
): bigint {
  const start =
    10 + index * 64

  const word = data.slice(
    start,
    start + 64,
  )

  return BigInt(`0x${word}`)
}

function extractBool(
  data: Hex,
  index: number,
): boolean {
  return (
    extractUint256(data, index) !== 0n
  )
}