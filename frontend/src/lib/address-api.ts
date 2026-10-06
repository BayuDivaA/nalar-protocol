import { API_URL } from "./api";

export type AddressFact = {
  id: string;
  label: string;
  value: string;
  source: "RPC" | "ABI" | "SOURCIFY" | "PROTOCOL" | "BNB_MCP";
  checkedAt: string;
  note?: string;
  addressUrl?: string;
};

export type AddressExplanation = { english: string; indonesian: string; factIds: string[] };

type ReportBase = {
  chainId: 56 | 97;
  network: string;
  explorerUrl: string;
  checkedAt: string;
  facts: AddressFact[];
  unknowns: string[];
  sources: { rpc: "available"; abi: "available" | "unavailable"; mcp: "available" | "unavailable" | "not_checked" };
  answer: AddressExplanation | null;
  aiStatus: "available" | "unavailable";
};

export type ContractFunction = { signature: string; inputs: Array<{ name: string; type: string }>; outputs: Array<{ name: string; type: string }>; mode: "read" | "write" | "payable" };
export type AddressReport = ReportBase & { kind: "address"; address: string; functions: ContractFunction[]; functionCount: number };
export type TransactionReport = ReportBase & { kind: "transaction"; hash: string };
export type ExplainerReport = AddressReport | TransactionReport;

export class AddressApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function getExplainerReport(
  input: { chainId: number; query: string; question?: string; history?: Array<{ question: string; answer: string }> },
  signal?: AbortSignal,
): Promise<ExplainerReport> {
  const query = input.query.trim();
  const subject = /^0x[0-9a-fA-F]{64}$/.test(query) ? { txHash: query } : /^0x[0-9a-fA-F]{40}$/.test(query) ? { address: query } : null;
  if (!subject) throw new AddressApiError("INVALID_INPUT", "Enter a BNB Chain address (40 hex characters) or transaction hash (64 hex characters).");
  const response = await fetch(`${API_URL}/api/address/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chainId: input.chainId, ...subject, question: input.question, history: input.history }),
    cache: "no-store",
    signal,
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data && typeof data === "object" ? (data as { error?: string; message?: string }) : null;
    throw new AddressApiError(error?.error ?? "UNAVAILABLE", error?.message ?? "The on-chain data could not be checked. Please retry.");
  }
  if (!data || typeof data !== "object" || !Array.isArray((data as Partial<ExplainerReport>).facts) || !["address", "transaction"].includes((data as { kind?: string }).kind ?? "")) {
    throw new AddressApiError("INVALID_RESPONSE", "Nalar received an incomplete report. Please retry.");
  }
  return data as ExplainerReport;
}
