import { type Address, getAddress } from "viem";

export const SUPPORTED_CHAIN_IDS = [97, 56] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export interface ChainConfig {
  chainId: SupportedChainId;
  name: string;
  shortName: string;
  nativeSymbol: string;
  nativeDecimals: number;
  explorerUrl: string;
  defaultRpcUrl: string;
  wbnbAddress: Address;
  universalRouter?: Address;
}

export const NETWORKS: Record<SupportedChainId, ChainConfig> = {
  97: {
    chainId: 97,
    name: "BNB Smart Chain Testnet",
    shortName: "BNB Testnet",
    nativeSymbol: "tBNB",
    nativeDecimals: 18,
    explorerUrl: "https://testnet.bscscan.com",
    defaultRpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    wbnbAddress: getAddress("0xae13d989dac2f0debff460ac112a837c89baa7cd"),
    universalRouter: getAddress("0x87FD5305E6a40F378da124864B2D479c2028BD86"),
  },
  56: {
    chainId: 56,
    name: "BNB Smart Chain Mainnet",
    shortName: "BNB Mainnet",
    nativeSymbol: "BNB",
    nativeDecimals: 18,
    explorerUrl: "https://bscscan.com",
    defaultRpcUrl: "https://bsc-dataseed.binance.org",
    wbnbAddress: getAddress("0xbb4CdB9CBD36B01bD1cBaEBF2De08d9173bc095c"),
    universalRouter: getAddress("0x13f4EA83D0bd40E75C8222255bc855a974568Dd4"),
  },
};

export function isSupportedChainId(chainId: number): chainId is SupportedChainId {
  return SUPPORTED_CHAIN_IDS.includes(chainId as SupportedChainId);
}

export function getChainConfig(chainId: number): ChainConfig | undefined {
  if (isSupportedChainId(chainId)) {
    return NETWORKS[chainId];
  }
  return undefined;
}

export function getNativeSymbol(chainId: number): string {
  const config = getChainConfig(chainId);
  return config?.nativeSymbol ?? (chainId === 56 ? "BNB" : "tBNB");
}

export function getWbnbAddress(chainId: number): Address | undefined {
  const config = getChainConfig(chainId);
  return config?.wbnbAddress;
}

export function getAddressExplorerUrl(chainId: number, address: string): string {
  const config = getChainConfig(chainId);
  const base = config?.explorerUrl ?? (chainId === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com");
  return `${base}/address/${address}`;
}

export function getTxExplorerUrl(chainId: number, txHash: string): string {
  const config = getChainConfig(chainId);
  const base = config?.explorerUrl ?? (chainId === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com");
  return `${base}/tx/${txHash}`;
}
