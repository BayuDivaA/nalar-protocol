import type { Address } from 'viem'

export interface ApprovalChange {
  type: 'ERC20_ALLOWANCE' | 'ERC721_OPERATOR'

  token: Address

  owner: Address

  spender: Address

  before: bigint

  after: bigint

  unlimited?: boolean

  stateKnown: boolean
}

export interface TransactionImpact {
    nativeValueSpent: bigint

    tokenTransfers: TokenTransfer[]

    approvals: ApprovalChange[]

    nftTransfers: NFTTransfer[]
}

export interface TokenTransfer {
    token: Address
    from: Address
    to: Address
    amount: bigint
}

export interface NFTTransfer {
    collection: Address
    from: Address
    to: Address
    tokenId: bigint
}