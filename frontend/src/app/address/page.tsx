import type { Metadata } from "next";

import AddressExplainer from "./AddressExplainer";

export const metadata: Metadata = {
  title: "On-chain Explainer · Nalar Protocol",
  description: "Understand BNB Chain addresses, contracts, and transactions in plain language.",
};

export default async function AddressPage({ searchParams }: { searchParams: Promise<{ chainId?: string; query?: string; address?: string }> }) {
  const params = await searchParams;
  return <AddressExplainer initialQuery={params.query ?? params.address ?? ""} initialChainId={params.chainId === "97" ? 97 : 56} autoInspect={params.chainId === "56" || params.chainId === "97"} />;
}
