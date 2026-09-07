import type { Address } from "viem";

import { getApprovalState } from "./nft-state";

import type { TransactionEffects } from "./effect-analyzer";

export interface ApprovalStateDiff {
  type: "ERC721_OPERATOR";

  token: Address;

  owner: Address;

  operator: Address;

  before: boolean | null;

  after: boolean;

  sourceFunction: string;
}

export async function resolveEffectState(effects: TransactionEffects): Promise<ApprovalStateDiff[]> {
  const diffs: ApprovalStateDiff[] = [];

  for (const approval of effects.approvals) {
    const before = await getApprovalState(approval.token, approval.owner, approval.operator);

    diffs.push({
      type: approval.type,

      token: approval.token,

      owner: approval.owner,

      operator: approval.operator,

      before,

      after: approval.approved,

      sourceFunction: approval.sourceFunction,
    });
  }

  return diffs;
}
