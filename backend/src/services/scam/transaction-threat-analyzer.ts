import type { Address } from "viem";

import type { TransactionAction } from "../../lib/classifier";
import type { TransactionEffects } from "../effect-analyzer";

import type { ScamFinding } from "./findings";

export interface TransactionThreatAnalysisInput {
  from: Address;
  to: Address;

  value: bigint;

  action: TransactionAction;

  functionName: string | null;

  protocol?: string;

  contractVerified: boolean | null;

  effects: TransactionEffects;

  intentAllowsApproval: boolean;

  targetIsContract?: boolean | null;

  counterpartyContracts?: ReadonlySet<string>;
}

/**
 * Transaction-level threat detection.
 *
 * IMPORTANT:
 * This module is deterministic.
 * It does not use an LLM.
 * It does not make a final ALLOW/BLOCK decision.
 *
 * It produces evidence/findings for the existing
 * risk engine and security decision engine.
 */
export function analyzeTransactionThreats(input: TransactionThreatAnalysisInput): ScamFinding[] {
  const findings: ScamFinding[] = [];

  const functionName = input.functionName?.toLowerCase() ?? "";

  /*
   * ------------------------------------------------------------
   * 1. Approval threats
   * ------------------------------------------------------------
   */

  for (const approval of input.effects.approvals) {
    if (approval.type === "ERC20_ALLOWANCE") {
      if (approval.unlimited) {
        findings.push({
          code: "UNLIMITED_ALLOWANCE",

          severity: "HIGH",

          title: "Unlimited token spending permission",

          description: "The transaction grants another address permission to spend an unrestricted amount of this token.",

          evidence: `Spender: ${approval.spender}.`,

          source: "CONTRACT",
        });
      }

      if (!input.intentAllowsApproval) {
        findings.push({
          code: "UNEXPECTED_SPENDER",

          severity: approval.unlimited ? "CRITICAL" : "HIGH",

          title: "Unexpected token spending permission",

          description: "The transaction grants token-spending permission even though the user's intent did not include an approval.",

          evidence: `Spender: ${approval.spender}. Amount: ${approval.amount.toString()}.`,

          source: "CONTRACT",
        });
      }

      if (input.counterpartyContracts?.has(approval.spender.toLowerCase())) {
        findings.push({
          code: "APPROVAL_TO_CONTRACT",

          severity: approval.unlimited ? "HIGH" : "MEDIUM",

          title: "Token permission targets a contract",

          description: "The token spending permission is granted to another smart contract.",

          evidence: `Spender: ${approval.spender}.`,

          source: "ONCHAIN",
        });
      }
    }

    if (approval.type === "ERC721_OPERATOR" && approval.approved) {
      findings.push({
        code: input.intentAllowsApproval ? "APPROVAL_TO_CONTRACT" : "UNEXPECTED_NFT_OPERATOR",

        severity: input.intentAllowsApproval ? "HIGH" : "CRITICAL",

        title: input.intentAllowsApproval ? "NFT operator permission granted" : "Unexpected NFT operator permission",

        description: input.intentAllowsApproval
          ? "The transaction gives another address permission to manage NFTs from this collection."
          : "The transaction gives another address permission to manage NFTs even though the user's intent did not include an NFT approval.",

        evidence: `Operator: ${approval.operator}. Token contract: ${approval.token}.`,

        source: "CONTRACT",
      });
    }
  }

  /*
   * ------------------------------------------------------------
   * 2. Third-party asset movement
   * ------------------------------------------------------------
   */

  if (input.action === "TOKEN_TRANSFER_FROM") {
    findings.push({
      code: "THIRD_PARTY_TOKEN_TRANSFER",

      severity: "HIGH",

      title: "Third-party token transfer",

      description: "The transaction attempts to move tokens from an address through a transferFrom-style operation.",

      evidence: "transferFrom semantics were detected from the decoded transaction.",

      source: "CONTRACT",
    });
  }

  /*
   * ------------------------------------------------------------
   * 3. Unknown / unidentified contract
   * ------------------------------------------------------------
   */

  if (input.targetIsContract === false && input.functionName) {
    findings.push({
      code: "CONTRACT_TARGET_IS_EOA",

      severity: "HIGH",

      title: "Transaction target is not a smart contract",

      description: "The wallet request contains contract calldata, but the target address does not currently contain contract code.",

      evidence: `Target: ${input.to}.`,

      source: "ONCHAIN",
    });
  }

  if (input.action === "UNKNOWN" && input.functionName === null) {
    findings.push({
      code: "UNIDENTIFIED_CONTRACT_CALL",

      severity: input.contractVerified === false ? "HIGH" : "MEDIUM",

      title: "Transaction behavior could not be identified",

      description: "Nalar could not decode the contract call from the available ABI evidence.",

      evidence: input.contractVerified === false ? "The target contract is not verified in the available ABI source." : "The transaction selector could not be matched to an available ABI.",

      source: "CONTRACT",
    });
  }

  /*
   * ------------------------------------------------------------
   * 4. Multicall
   * ------------------------------------------------------------
   */

  if (functionName === "multicall" || functionName === "aggregate" || functionName === "aggregate3" || functionName === "tryaggregate") {
    findings.push({
      code: "SUSPICIOUS_MULTICALL",

      severity: "MEDIUM",

      title: "Batch contract execution detected",

      description: "The transaction can execute multiple contract calls through a single wallet request.",

      evidence: `Function: ${input.functionName}.`,

      source: "CONTRACT",
    });
  }

  /*
   * ------------------------------------------------------------
   * 5. Delegatecall
   * ------------------------------------------------------------
   */

  if (functionName === "delegatecall" || functionName === "executedelegatecall") {
    findings.push({
      code: "DELEGATECALL_TARGET",

      severity: input.contractVerified === false ? "CRITICAL" : "HIGH",

      title: "Delegatecall execution detected",

      description: "The transaction can execute code in the context of the target contract, which requires careful inspection of the delegated target.",

      evidence: `Function: ${input.functionName}. Target: ${input.to}.`,

      source: "CONTRACT",
    });
  }

  /*
   * ------------------------------------------------------------
   * 6. Generic external execution
   * ------------------------------------------------------------
   */

  const arbitraryCallFunctions = new Set(["functioncall", "functioncallwithvalue", "execute", "executebatch", "call", "callwithvalue"]);

  if (arbitraryCallFunctions.has(functionName) && input.protocol !== "PancakeSwap") {
    findings.push({
      code: "ARBITRARY_EXTERNAL_CALL",

      severity: input.contractVerified === false ? "HIGH" : "MEDIUM",

      title: "External contract execution detected",

      description: "The transaction invokes a generic execution function that may dispatch additional contract calls.",

      evidence: `Function: ${input.functionName}. Target: ${input.to}.`,

      source: "CONTRACT",
    });
  }

  /*
   * ------------------------------------------------------------
   * 7. Native value + unverified contract
   * ------------------------------------------------------------
   */

  if (input.value > 0n && input.contractVerified === false && input.targetIsContract !== false) {
    findings.push({
      code: "NATIVE_VALUE_TO_UNVERIFIED_CONTRACT",

      severity: "MEDIUM",

      title: "Native BNB is sent to an unverified contract",

      description: "The transaction sends native BNB to a contract whose available source verification could not be established.",

      evidence: `Value: ${input.value.toString()} wei. Target: ${input.to}.`,

      source: "ONCHAIN",
    });
  }

  /*
   * ------------------------------------------------------------
   * 8. Unknown execution path
   * ------------------------------------------------------------
   */

  if (input.action === "UNKNOWN" && input.value > 0n) {
    findings.push({
      code: "UNKNOWN_EXECUTION_PATH",

      severity: "HIGH",

      title: "Execution path is not understood",

      description: "The transaction carries value but Nalar could not establish the semantic action performed by the target contract.",

      evidence: `Target: ${input.to}. Value: ${input.value.toString()} wei.`,

      source: "CONTRACT",
    });
  }

  return dedupeFindings(findings);
}

function dedupeFindings(findings: ScamFinding[]): ScamFinding[] {
  return [...new Map(findings.map((finding) => [`${finding.code}:${finding.evidence ?? finding.title}`, finding])).values()];
}
