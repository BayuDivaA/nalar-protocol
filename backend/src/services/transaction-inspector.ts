import { decodeEventLog, decodeFunctionData, encodeFunctionData, formatEther, getAddress, isAddress, parseAbi, toEventSelector, toFunctionSelector, zeroAddress, type Address, type PublicClient } from "viem";

import { getChainConfig } from "../config/networks";
import { env } from "../config/env";
import { getPublicClient } from "../lib/viem";
import { securityAbi } from "../lib/abis";
import { resolveContractAbi } from "./contract-resolver";
import { BnbChainMcpClient, type BnbMcpClient } from "./scam/bnb-mcp-client";
import type { AddressFact } from "./address-inspector";

export type TransactionInspection = {
  kind: "transaction";
  chainId: 56 | 97;
  network: string;
  hash: `0x${string}`;
  explorerUrl: string;
  checkedAt: string;
  facts: AddressFact[];
  unknowns: string[];
  sources: { rpc: "available"; abi: "available" | "unavailable"; mcp: "available" | "unavailable" | "not_checked" };
};

export class TransactionInspectionError extends Error {
  constructor(public code: "INVALID_INPUT" | "UNSUPPORTED_NETWORK" | "RPC_UNAVAILABLE" | "TRANSACTION_UNAVAILABLE", message: string) {
    super(message);
  }
}

type Options = {
  clientFactory?: (chainId: number) => PublicClient;
  resolveAbi?: typeof resolveContractAbi;
  mcpClientFactory?: () => BnbMcpClient;
  mcpEnabled?: boolean;
};

const eventInterfaces = [
  { standard: "ERC-721", abi: parseAbi(["event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)", "event Approval(address indexed owner,address indexed approved,uint256 indexed tokenId)"]) },
  { standard: "ERC-20", abi: parseAbi(["event Transfer(address indexed from,address indexed to,uint256 value)", "event Approval(address indexed owner,address indexed spender,uint256 value)"]) },
  { standard: "operator approval", abi: parseAbi(["event ApprovalForAll(address indexed owner,address indexed operator,bool approved)"]) },
  { standard: "ERC-1155", abi: parseAbi(["event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)"]) },
].map((item) => ({ ...item, topics: item.abi.map(toEventSelector) }));
const localFunctions = securityAbi.map((item) => ({ item, selector: toFunctionSelector(item) }));

async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Read timed out")), 9_000); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function readableArg(value: unknown): string {
  if (typeof value === "bigint" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value.length > 180 ? `${value.slice(0, 178)}…` : value;
  if (Array.isArray(value)) return value.length <= 5 ? value.map(readableArg).join(", ") : `${value.length} values`;
  return "Not displayable";
}

function mcpRecord(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 5) return null;
  if (typeof value === "string") {
    if (value.length > 20_000) return null;
    try { return mcpRecord(JSON.parse(value), depth + 1); } catch { return null; }
  }
  if (Array.isArray(value)) return value.length === 1 ? mcpRecord(value[0], depth + 1) : null;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.isError === true) return null;
  if (typeof record.hash === "string" || typeof record.transactionHash === "string") return record;
  for (const key of ["structuredContent", "result", "data", "transaction", "receipt", "content", "text", "value", "output"]) {
    if (!(key in record)) continue;
    const nested = mcpRecord(record[key], depth + 1);
    if (nested) return nested;
  }
  return null;
}

function mcpMatches(record: Record<string, unknown> | null, input: { hash: string; chainId: number; from: string; to: string | null }): boolean {
  if (!record) return false;
  const receivedHash = record.hash ?? record.transactionHash;
  if (typeof receivedHash !== "string" || receivedHash.toLowerCase() !== input.hash.toLowerCase()) return false;
  if (record.chainId !== undefined && Number(record.chainId) !== input.chainId) return false;
  if (typeof record.from === "string" && record.from.toLowerCase() !== input.from.toLowerCase()) return false;
  if (typeof record.to === "string" && record.to.toLowerCase() !== input.to?.toLowerCase()) return false;
  return true;
}

export async function inspectTransaction(input: { chainId: number; txHash: string }, options: Options = {}): Promise<TransactionInspection> {
  const network = getChainConfig(input.chainId);
  if (!network) throw new TransactionInspectionError("UNSUPPORTED_NETWORK", "Choose BNB Mainnet or BNB Testnet.");
  if (!/^0x[0-9a-fA-F]{64}$/.test(input.txHash)) throw new TransactionInspectionError("INVALID_INPUT", "Enter a transaction hash with 64 hexadecimal characters.");

  const hash = input.txHash as `0x${string}`;
  const client = (options.clientFactory ?? getPublicClient)(network.chainId);
  let actualChainId: number;
  try { actualChainId = await bounded(client.getChainId()); }
  catch { throw new TransactionInspectionError("RPC_UNAVAILABLE", `Could not read ${network.shortName}. Please try again.`); }
  if (actualChainId !== network.chainId) throw new TransactionInspectionError("RPC_UNAVAILABLE", `${network.shortName} RPC returned another network.`);

  let tx: Awaited<ReturnType<PublicClient["getTransaction"]>>;
  try { tx = await bounded(client.getTransaction({ hash })); }
  catch { throw new TransactionInspectionError("TRANSACTION_UNAVAILABLE", `This transaction could not be found on ${network.shortName}. Check the network and hash, then try again.`); }
  if (tx.hash.toLowerCase() !== hash.toLowerCase()) throw new TransactionInspectionError("TRANSACTION_UNAVAILABLE", "The network returned a different transaction hash.");

  const checkedAt = new Date().toISOString();
  const facts: AddressFact[] = [];
  const unknowns: string[] = [];
  const add = (id: string, label: string, value: string, source: AddressFact["source"] = "RPC", note?: string, linkedAddress?: Address) => {
    facts.push({ id, label, value, source, checkedAt, ...(note ? { note } : {}), ...(linkedAddress ? { addressUrl: `${network.explorerUrl}/address/${linkedAddress}` } : {}) });
  };

  add("from", "Sent from", tx.from, "RPC", undefined, tx.from);
  if (tx.to) add("to", "Sent to", tx.to, "RPC", undefined, tx.to);
  else add("deployment", "Recipient", "New contract deployment", "RPC", "The transaction creates a contract; it has no existing recipient address.");
  add("value", `${network.nativeSymbol} sent directly`, `${formatEther(tx.value)} ${network.nativeSymbol}`, "RPC", "Token movements can also occur inside a contract call.");
  add("nonce", "Sender transaction number", String(tx.nonce), "RPC", "The sender's nonce for this transaction.");
  if (tx.blockNumber !== null) add("block", "Included in block", tx.blockNumber.toString());
  else add("execution", "Execution status", "Not yet included in a block", "RPC", "A transaction without a block has no confirmed execution result.");

  if (tx.blockNumber !== null) {
    try {
      const receipt = await bounded(client.getTransactionReceipt({ hash }));
      if (receipt.transactionHash.toLowerCase() !== hash.toLowerCase()) throw new Error("Receipt hash mismatch");
      add("execution", "Execution status", receipt.status === "success" ? "Executed" : "Reverted", "RPC", "Execution status does not say whether the action was desirable.");
      add("fee", "Network fee paid", `${formatEther(receipt.gasUsed * receipt.effectiveGasPrice)} ${network.nativeSymbol}`);
      add("logs", "Event records", String(receipt.logs.length), "RPC", "Events are records emitted by contracts, not a complete explanation of effects.");
      if (receipt.status === "success") {
        let shown = 0;
        // ponytail: inspect at most 200 logs and show 12 records; paginate if larger receipts need a full explorer view.
        for (const [index, log] of receipt.logs.slice(0, 200).entries()) {
          if (shown === 12) break;
          if (log.removed || (log.transactionHash && log.transactionHash.toLowerCase() !== hash.toLowerCase()) || !isAddress(log.address)) continue;
          for (const { abi, standard, topics } of eventInterfaces) {
            if (!log.topics[0] || !topics.includes(log.topics[0])) continue;
            try {
              const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true });
              const args = decoded.args as Record<string, Address | bigint | boolean>;
              const action = decoded.eventName.startsWith("Transfer") ? args.from === zeroAddress ? "Mint" : args.to === zeroAddress ? "Burn" : "Transfer" : "Approval";
              const note = "Decoded from a matching receipt using a standard event layout. The contract emitted this record; balances, ownership and its implementation were not independently verified.";
              const prefix = `event_${index}`;
              add(`${prefix}_action`, "Recorded action", `${action} record (${standard} layout)`, "RPC", note);
              add(`${prefix}_contract`, "Contract that emitted the record", log.address, "RPC", undefined, log.address);
              for (const [name, value] of Object.entries(args)) {
                const key = name === "tokenId" || name === "id" ? "token_id" : name === "value" ? "amount" : name;
                const label = key === "token_id" ? "Token ID" : key === "amount" ? "Amount (raw units)" : name === "approved" && typeof value === "boolean" ? "Operator permission enabled" : name;
                add(`${prefix}_${key}`, label, String(value), "RPC", key === "amount" ? "Amount in raw units. Token decimals and resulting balance changes are not established here." : undefined, typeof value === "string" && isAddress(value) ? getAddress(value) : undefined);
              }
              shown += 1;
              break;
            } catch {
              // An unmatched layout provides no decoded evidence.
            }
          }
        }
        if (shown === 12 || receipt.logs.length > 200) unknowns.push("Only up to 12 recognized transfer or approval records are shown; this is not a complete trace of transaction effects.");
        if (receipt.logs.length > 0 && shown === 0) unknowns.push("The receipt contains events, but no supported transfer or approval layout could be decoded.");
      }
    } catch {
      unknowns.push("The transaction receipt could not be read; its execution result is not established.");
    }
    try {
      const block = await bounded(client.getBlock({ blockNumber: tx.blockNumber }));
      const timestamp = Number(block.timestamp) * 1_000;
      if (Number.isSafeInteger(timestamp)) add("block_time", "Block time", new Date(timestamp).toISOString());
    } catch {
      unknowns.push("Block time could not be read.");
    }
  }

  let abiStatus: TransactionInspection["sources"]["abi"] = "unavailable";
  if (tx.input && tx.input !== "0x") {
    add("selector", "Function selector", tx.input.slice(0, 10), "RPC", "The first four bytes of the requested contract call.");
    if (tx.to) {
      try {
        const resolution = await bounded((options.resolveAbi ?? resolveContractAbi)({ chainId: network.chainId, address: tx.to }));
        if (resolution.found && resolution.contract && resolution.contract.chainId === network.chainId && resolution.contract.address.toLowerCase() === tx.to.toLowerCase()) {
          const decoded = decodeFunctionData({ abi: resolution.contract.abi, data: tx.input });
          const abiFunction = resolution.contract.abi.find((item) => item.type === "function" && toFunctionSelector(item) === tx.input.slice(0, 10));
          abiStatus = "available";
          add("function", "Called function", decoded.functionName, resolution.contract.source === "sourcify" ? "SOURCIFY" : "PROTOCOL", "A decoded request, not proof of every resulting token movement.");
          if (abiFunction?.type === "function") {
            add("function_signature", "Function and parameter types", `${abiFunction.name}(${abiFunction.inputs.map((item) => item.type).join(", ")})`, "ABI");
            add("function_mode", "Interface-declared call type", abiFunction.stateMutability === "view" || abiFunction.stateMutability === "pure" ? "Reads data" : abiFunction.stateMutability === "payable" ? "Can receive native currency and change state" : "May change state", "ABI", "Declared by the interface, not a source-code review or proof of what happened.");
          }
          const args = Array.isArray(decoded.args) ? decoded.args : [];
          args.slice(0, 8).forEach((value, index) => {
            const name = abiFunction?.type === "function" ? abiFunction.inputs[index]?.name || `item_${index + 1}` : `item_${index + 1}`;
            const rendered = readableArg(value);
            add(`argument_${name}`, `Input: ${name}`, rendered, "RPC", "Decoded from transaction data using the contract interface.", isAddress(rendered) ? getAddress(rendered) : undefined);
          });
          if (args.length > 8) unknowns.push("Only the first eight decoded inputs are shown here.");
        } else {
          unknowns.push("The target's full contract interface was not available; a local signature match cannot establish its implementation.");
          if (!resolution.found) {
            const candidates = localFunctions.filter((item) => item.selector === tx.input.slice(0, 10));
            if (candidates.length === 1) {
              const candidate = candidates[0]!.item;
              try {
                const localAbi = [candidate] as const;
                const decoded = decodeFunctionData({ abi: localAbi, data: tx.input });
                if (encodeFunctionData({ abi: localAbi, functionName: decoded.functionName, args: decoded.args }).toLowerCase() === tx.input.toLowerCase()) {
                  const note = "Calldata matches a locally known interface. A four-byte selector can collide; this does not verify the target's ABI, implementation or behavior.";
                  add("function_candidate", "Call signature match (not verified)", `${candidate.name}(${candidate.inputs.map((item) => item.type).join(", ")})`, "ABI", note);
                  (decoded.args ?? []).slice(0, 8).forEach((value, index) => {
                    const name = candidate.inputs[index]?.name || `item_${index + 1}`;
                    const rendered = readableArg(value);
                    add(`candidate_argument_${name}`, `Matched input: ${name}`, rendered, "ABI", note, isAddress(rendered) ? getAddress(rendered) : undefined);
                  });
                  unknowns.push("The call signature was matched locally, but the target's full interface and implementation remain unverified.");
                }
              } catch {
                // Do not label malformed calldata as a recognized call.
              }
            }
          }
        }
      } catch {
        unknowns.push("The function inputs could not be decoded from the available contract interface.");
      }
    } else {
      unknowns.push("This deployment input is contract bytecode, not a normal function call.");
    }
  } else {
    add("call_data", "Contract call data", "None", "RPC", "No function call data was supplied with this transaction.");
  }

  let mcpStatus: TransactionInspection["sources"]["mcp"] = "not_checked";
  if (options.mcpEnabled ?? env.BNB_INVESTIGATOR_ENABLED) {
    const mcp = (options.mcpClientFactory ?? (() => new BnbChainMcpClient()))();
    const mcpNetwork = network.chainId === 56 ? "bsc" : "bsc-testnet";
    try {
      const lookup = await bounded(mcp.getTransaction({ txHash: hash, network: mcpNetwork }));
      const matched = mcpMatches(mcpRecord(lookup), { hash, chainId: network.chainId, from: tx.from, to: tx.to });
      if (matched) {
        mcpStatus = "available";
        add("mcp_lookup", "BNB MCP lookup", "Matched this transaction", "BNB_MCP", "BNB MCP returned the same hash and did not contradict the transaction parties.");
        try {
          const receipt = await bounded(mcp.getTransactionReceipt({ txHash: hash, network: mcpNetwork }));
          if (!mcpMatches(mcpRecord(receipt), { hash, chainId: network.chainId, from: tx.from, to: tx.to })) unknowns.push("BNB MCP receipt could not be matched to this transaction.");
        } catch {
          unknowns.push("BNB MCP receipt was not available.");
        }
      } else {
        mcpStatus = "unavailable";
        unknowns.push("BNB MCP lookup could not be matched to this transaction.");
      }
    } catch {
      mcpStatus = "unavailable";
      unknowns.push("BNB MCP transaction details were not available.");
    } finally {
      await mcp.close().catch(() => undefined);
    }
  }

  return { kind: "transaction", chainId: network.chainId, network: network.shortName, hash, explorerUrl: `${network.explorerUrl}/tx/${hash}`, checkedAt, facts, unknowns, sources: { rpc: "available", abi: abiStatus, mcp: mcpStatus } };
}
