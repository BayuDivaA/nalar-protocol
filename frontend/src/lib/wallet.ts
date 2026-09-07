import { createWalletClient, custom, type Address, type Hex } from "viem";

import { bscTestnet } from "viem/chains";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): EthereumProvider {
  if (typeof window === "undefined") {
    throw new Error("Wallet is only available in the browser.");
  }

  const ethereum = (
    window as Window & {
      ethereum?: EthereumProvider;
    }
  ).ethereum;

  if (!ethereum) {
    throw new Error("No injected wallet found. Please install MetaMask.");
  }

  return ethereum;
}

export async function connectWallet(): Promise<{
  address: Address;
  chainId: number;
}> {
  const ethereum = getEthereum();

  const walletClient = createWalletClient({
    chain: bscTestnet,
    transport: custom(ethereum),
  });

  const addresses = await walletClient.requestAddresses();

  if (addresses.length === 0) {
    throw new Error("No wallet account selected.");
  }

  const chainId = await walletClient.getChainId();

  return {
    address: addresses[0],
    chainId,
  };
}

export async function switchToBscTestnet() {
  const ethereum = getEthereum();

  await ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [
      {
        chainId: "0x61",
      },
    ],
  });
}

export async function sendTransaction(input: { account: Address; to: Address; value: bigint; data: Hex }): Promise<Hex> {
  const ethereum = getEthereum();

  const walletClient = createWalletClient({
    chain: bscTestnet,
    transport: custom(ethereum),
  });

  const chainId = await walletClient.getChainId();

  if (chainId !== 97) {
    throw new Error("Wallet must be connected to BNB Testnet.");
  }

  const hash = await walletClient.sendTransaction({
    account: input.account,
    to: input.to,
    value: input.value,
    data: input.data,
    chain: bscTestnet,
  });

  return hash;
}
