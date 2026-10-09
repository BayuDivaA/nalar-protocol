import { ContractFunctionExecutionError, ContractFunctionRevertedError, ContractFunctionZeroDataError, createPublicClient, custom, decodeEventLog, decodeFunctionData, encodeFunctionData, isAddress, isAddressEqual, parseAbi, zeroAddress, type Address, type Hex, type ReplacementReason, type TransactionReceipt } from "viem";
import { bscTestnet } from "viem/chains";

export const collectionAbi = parseAbi([
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
  "function name() view returns (string)",
  "function getMintPrice() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function previewImage() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function safeMint() payable",
  "function setApprovalForAll(address operator, bool approved)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);
const trapAbi = parseAbi([
  "function collection() view returns (address)",
  "function operator() view returns (address)",
  "function mintRequest() view returns (address target, uint256 value, bytes data)",
]);

export type MintMode = "normal" | "trap";
export type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
};
type TrapRequest = { address: Address; operator: Address; target: Address; value: bigint; data: Hex };
export type DemoCollection = { address: Address; name: string; price: bigint; minted: bigint; maximum: bigint; image: string; trap: TrapRequest | null };
const isArtwork = (value: unknown): value is string => typeof value === "string" && value.startsWith("data:image/svg+xml;base64,") && value.length <= 64_000;

export function getDemoWallet(): WalletProvider {
  const provider = (window as Window & { ethereum?: WalletProvider }).ethereum;
  if (!provider?.request) throw new Error("No browser wallet found. Install or unlock your wallet, then retry.");
  return provider;
}

export function demoClient(provider: WalletProvider) {
  return createPublicClient({ chain: bscTestnet, transport: custom(provider) });
}

export async function assertDemoChain(provider: WalletProvider) {
  if (Number(await provider.request({ method: "eth_chainId" })) !== bscTestnet.id) {
    throw new Error("Switch your wallet to BNB Testnet. These demo contracts are not available on Mainnet.");
  }
}

export async function readDemoCollection(provider: WalletProvider, address: string | undefined, trapAddress?: string): Promise<DemoCollection> {
  if (!address || !isAddress(address) || address === zeroAddress) throw new Error("The NFT collection is not configured for this deployment.");
  await assertDemoChain(provider);
  const client = demoClient(provider);
  const code = await client.getBytecode({ address });
  if (!code || code === "0x") throw new Error("No collection contract found at this address on BNB Testnet.");
  const compatible = await client.readContract({ address, abi: collectionAbi, functionName: "supportsInterface", args: ["0x80ac58cd"] }).catch((cause: unknown) => {
    if (cause instanceof ContractFunctionExecutionError && (cause.cause instanceof ContractFunctionRevertedError || cause.cause instanceof ContractFunctionZeroDataError)) return false;
    throw cause;
  });
  if (!compatible) throw new Error("The configured demo address is not a compatible NFT collection. The site needs the deployed Nalar Editions address before you can mint.");
  const [name, price, minted, maximum, image] = await Promise.all([
    client.readContract({ address, abi: collectionAbi, functionName: "name" }),
    client.readContract({ address, abi: collectionAbi, functionName: "getMintPrice" }),
    client.readContract({ address, abi: collectionAbi, functionName: "totalSupply" }),
    client.readContract({ address, abi: collectionAbi, functionName: "MAX_SUPPLY" }),
    client.readContract({ address, abi: collectionAbi, functionName: "previewImage" }),
  ]);
  if (maximum <= 0n || minted > maximum || !isArtwork(image)) {
    throw new Error("The collection returned an unsupported supply or artwork format.");
  }
  let trap: TrapRequest | null = null;
  if (trapAddress) {
    if (!isAddress(trapAddress) || trapAddress === zeroAddress) throw new Error("The approval-trap contract address is invalid.");
    const trapCode = await client.getBytecode({ address: trapAddress });
    if (!trapCode || trapCode === "0x") throw new Error("No approval-trap contract found on BNB Testnet.");
    const [targetCollection, operator, request] = await Promise.all([
      client.readContract({ address: trapAddress, abi: trapAbi, functionName: "collection" }),
      client.readContract({ address: trapAddress, abi: trapAbi, functionName: "operator" }),
      client.readContract({ address: trapAddress, abi: trapAbi, functionName: "mintRequest" }),
    ]);
    if (!isAddressEqual(targetCollection, address)) throw new Error("The trap is configured for a different collection.");
    trap = { address: trapAddress, operator, target: request[0], value: request[1], data: request[2] };
  }
  await assertDemoChain(provider);
  const collection = { address, name, price, minted, maximum, image, trap };
  if (trap) buildDemoTransaction(collection, "trap");
  return collection;
}

export function buildDemoTransaction(collection: DemoCollection, mode: MintMode): { to: Address; value: bigint; data: Hex } {
  if (mode === "normal") {
    if (collection.minted >= collection.maximum) throw new Error("This collection is sold out.");
    return { to: collection.address, value: collection.price, data: encodeFunctionData({ abi: collectionAbi, functionName: "safeMint" }) };
  }
  const trap = collection.trap;
  if (!trap || trap.target.toLowerCase() !== collection.address.toLowerCase() || trap.value !== 0n || trap.operator.toLowerCase() !== trap.address.toLowerCase()) {
    throw new Error("The approval request does not match the current demo contracts.");
  }
  const decoded = decodeFunctionData({ abi: collectionAbi, data: trap.data });
  if (decoded.functionName !== "setApprovalForAll" || decoded.args[0].toLowerCase() !== trap.operator.toLowerCase() || decoded.args[1] !== true) {
    throw new Error("The trap returned an unexpected transaction. No request was sent.");
  }
  return { to: trap.target, value: trap.value, data: trap.data };
}

export function demoReceiptStatus(receipt: Pick<TransactionReceipt, "status">, replacement?: ReplacementReason) {
  if (replacement === "cancelled" || replacement === "replaced") return replacement;
  return receipt.status === "success" ? "confirmed" : "reverted";
}

export async function readMintedToken(provider: WalletProvider, address: Address, receipt: TransactionReceipt, owner: Address) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== address.toLowerCase()) continue;
    let transfer;
    try { transfer = decodeEventLog({ abi: collectionAbi, eventName: "Transfer", data: log.data, topics: log.topics }); } catch { continue; }
    if (transfer.args.from !== zeroAddress || transfer.args.to.toLowerCase() !== owner.toLowerCase()) continue;
    const uri = await demoClient(provider).readContract({ address, abi: collectionAbi, functionName: "tokenURI", args: [transfer.args.tokenId] });
    const prefix = "data:application/json;base64,";
    if (!uri.startsWith(prefix) || uri.length > 128_000) throw new Error("The NFT metadata format could not be read.");
    const metadata = JSON.parse(atob(uri.slice(prefix.length))) as { name?: unknown; image?: unknown };
    if (typeof metadata.name !== "string" || !isArtwork(metadata.image)) {
      throw new Error("The minted NFT returned unsupported artwork.");
    }
    return { id: transfer.args.tokenId, name: metadata.name, image: metadata.image };
  }
  return null;
}
