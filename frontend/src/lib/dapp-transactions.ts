import type { Hex, Address } from "viem";

export type DAppScenario = "SAFE_MINT" | "MALICIOUS_APPROVAL";

export interface DAppTransaction {
  name: string;
  description: string;
  intent: string;
  transaction: {
    chainId: number;
    to: Address;
    value: bigint;
    data: Hex;
  };
}

const DEMO_NFT = "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1" as Address;

export const dAppTransactions: Record<DAppScenario, DAppTransaction> = {
  SAFE_MINT: {
    name: "Safe NFT Mint",

    description: "Example dApp requests a normal NFT mint.",

    intent: "I want to mint 1 NFT for 0.02 BNB",

    transaction: {
      chainId: 97,

      to: DEMO_NFT,

      value: BigInt("20000000000000000"),

      data: "0x6871ee40" as Hex,
    },
  },

  MALICIOUS_APPROVAL: {
    name: "Malicious NFT Approval",

    description: "The dApp claims to mint an NFT but the transaction actually grants NFT operator approval.",

    intent: "I want to mint 1 NFT for 0.02 BNB",

    transaction: {
      chainId: 97,

      to: DEMO_NFT,

      value: 0n,

      data: "0x73fbd8db0000000000000000000000003333333333333333333333333333333333333333" as Hex,
    },
  },
};
