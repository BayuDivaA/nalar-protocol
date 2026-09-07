import type { Hex } from "viem";

export type DemoScenario = "SAFE_MINT" | "MALICIOUS_APPROVAL";

export interface DemoTransaction {
  name: string;
  description: string;
  to: `0x${string}`;
  value: string;
  data: Hex;
}

const DEMO_NFT = "0x4ACCcd7a3d2e2a7c99BE0ea035B40cE03C7A14d1";

const MALICIOUS_OPERATOR = "0x3333333333333333333333333333333333333333";

export const demoTransactions: Record<DemoScenario, DemoTransaction> = {
  SAFE_MINT: {
    name: "Safe NFT Mint",
    description: "Mint 1 NFT for 0.02 BNB.",
    to: DEMO_NFT,
    value: "20000000000000000",
    data: "0x6871ee40",
  },

  MALICIOUS_APPROVAL: {
    name: "Malicious NFT Approval",
    description: "Looks like a mint, but grants NFT operator approval.",
    to: DEMO_NFT,
    value: "0",
    data: (`0x73fbd8db000000000000000000000000` + `${MALICIOUS_OPERATOR.slice(2)}`) as Hex,
  },
};
