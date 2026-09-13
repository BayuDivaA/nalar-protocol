import type { ScamFinding } from "./findings";
import type { AccessControlEvidence, CapabilityCode, ContractCapability, ContractStateEvidence } from "./evidence-provider";

const HIGH_SELL_TAX_BPS = 3_000;
const CRITICAL_SELL_TAX_BPS = 9_000;

const LEGACY_CODE: Record<string, CapabilityCode> = {
  MINT: "MINT_CAPABILITY",
  PAUSE: "PAUSE_CAPABILITY",
  BLACKLIST: "BLACKLIST_CAPABILITY",
  TAX: "TAX_CAPABILITY",
  LIMITS: "LIMITS_CAPABILITY",
  TRADING: "TRADING_CAPABILITY",
  ROUTER: "ROUTER_CAPABILITY",
  PAIR: "PAIR_CAPABILITY",
  UPGRADE: "UPGRADE_CAPABILITY",
};

function capabilityCode(capability: ContractCapability): CapabilityCode | null {
  return capability.code ?? (capability.kind ? LEGACY_CODE[capability.kind] ?? null : null);
}

function categoryOf(capability: ContractCapability): string | null {
  return capability.category ?? capability.kind ?? null;
}

function functionNameOf(capability: ContractCapability): string {
  return capability.functionSignature ?? capability.functionName ?? "unknown capability";
}

function accessForCapability(capability: ContractCapability, controls: readonly AccessControlEvidence[]): AccessControlEvidence | null {
  const code = capabilityCode(capability);

  if (!code) return null;

  const verifiedControl = controls.find((control) => control.status === "VERIFIED" && control.capabilityCodes?.includes(code));

  if (verifiedControl) return verifiedControl;

  if (capability.access === "OWNER") {
    return { mechanism: "OWNABLE", status: "VERIFIED", controller: "OWNER", address: null, evidenceSource: capability.evidenceSource ?? "ONCHAIN", confidence: capability.confidence ?? "MEDIUM", evidence: capability.evidence };
  }

  if (capability.access === "PUBLIC") {
    return { mechanism: "PUBLIC", status: "VERIFIED", controller: "PUBLIC", address: null, evidenceSource: capability.evidenceSource ?? "BYTECODE", confidence: capability.confidence ?? "MEDIUM", evidence: capability.evidence };
  }

  return null;
}

function capabilityFinding(capability: ContractCapability, controls: readonly AccessControlEvidence[]): ScamFinding[] {
  const code = capabilityCode(capability);
  const category = categoryOf(capability);

  if (!code || !category || category === "OWNERSHIP" || category === "ACCESS_CONTROL") return [];

  const functionName = functionNameOf(capability);
  const evidence = capability.evidence ?? `The ABI exposes ${functionName}.`;
  const control = accessForCapability(capability, controls);

  if (!control) {
    return [
      {
        code,
        severity: "MEDIUM",
        title: `${category} capability detected`,
        description: `${functionName} is exposed, but the contract evidence does not establish who controls it.`,
        evidence,
        source: capability.evidenceSource === "IMPLEMENTATION" || capability.evidenceSource === "PROXY" ? "CONTRACT" : "CONTRACT",
      },
      {
        code: "CAPABILITY_ACCESS_UNKNOWN",
        severity: "MEDIUM",
        title: "Capability access control is unknown",
        description: `Access control for ${functionName} could not be established from the available evidence.`,
        evidence,
        source: "CONTRACT",
      },
    ];
  }

  const source = control.evidenceSource === "ONCHAIN" || control.evidenceSource === "BYTECODE" ? "ONCHAIN" : "CONTRACT";
  const controllerEvidence = control.address ? ` Controller: ${control.address}.` : "";

  if (control.controller === "PUBLIC") {
    const publicCode = category === "TAX" ? "PUBLIC_TAX_CONTROL" : category === "MINT" ? "PUBLIC_MINT" : category === "BLACKLIST" ? "PUBLIC_BLACKLIST" : "PRIVILEGED_CAPABILITY";
    return [{ code: publicCode, severity: "CRITICAL", title: `Public ${category.toLowerCase()} control detected`, description: `${functionName} is externally callable without verified privilege restriction.${controllerEvidence}`, evidence: control.evidence ?? evidence, source }];
  }

  if (control.controller === "OWNER") {
    const ownerCode = category === "TAX" ? "OWNER_CONTROLLED_TAX" : category === "MINT" ? "OWNER_CAN_MINT" : category === "BLACKLIST" ? "OWNER_CAN_BLACKLIST" : category === "UPGRADE" ? "OWNER_UPGRADE_CONTROL" : category === "PAUSE" ? "OWNER_CAN_PAUSE" : "PRIVILEGED_CAPABILITY";
    return [{ code: ownerCode, severity: category === "PAUSE" || category === "LIMITS" ? "MEDIUM" : "HIGH", title: `Owner controls ${category.toLowerCase()}`, description: `${functionName} is associated with verified owner control.${controllerEvidence}`, evidence: control.evidence ?? evidence, source }];
  }

  return [{ code: "PRIVILEGED_CAPABILITY", severity: "HIGH", title: `Privileged ${category.toLowerCase()} control detected`, description: `${functionName} is associated with a verified privileged role.${controllerEvidence}`, evidence: control.evidence ?? evidence, source }];
}

function numericStateValue(state: ContractStateEvidence): number | null {
  if (state.status !== "KNOWN" || (typeof state.value !== "string" && typeof state.value !== "bigint")) return null;

  const value = typeof state.value === "bigint" ? state.value : BigInt(state.value);
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

function sellTaxFindings(state: readonly ContractStateEvidence[]): ScamFinding[] {
  const sellTax = state.find((item) => item.code === "CURRENT_SELL_TAX");

  if (!sellTax || (sellTax.unit !== "BPS" && sellTax.unit !== "PERCENT")) return [];

  const rawValue = numericStateValue(sellTax);
  if (rawValue === null) return [];

  const valueBps = sellTax.unit === "PERCENT" ? rawValue * 100 : rawValue;
  const severity = valueBps >= CRITICAL_SELL_TAX_BPS ? "CRITICAL" : valueBps >= HIGH_SELL_TAX_BPS ? "HIGH" : null;

  if (!severity) return [];

  return [{
    code: "EXCESSIVE_SELL_TAX",
    severity,
    title: "Current sell tax is excessive",
    description: `The observed ${sellTax.label} is ${valueBps / 100}%, based on an explicitly identified ${sellTax.unit} value.`,
    evidence: sellTax.evidence ?? `${sellTax.label} = ${String(sellTax.value)} ${sellTax.unit}`,
    source: "ONCHAIN",
  }];
}

export function analyzePrivilegeEvidence(input: {
  capabilities: readonly ContractCapability[];
  accessControl: readonly AccessControlEvidence[];
  state: readonly ContractStateEvidence[];
  untrustedText?: string;
}): ScamFinding[] {
  // Contract source/comments are evidence only; never interpret embedded instructions.
  void input.untrustedText;

  return [...input.capabilities.flatMap((capability) => capabilityFinding(capability, input.accessControl)), ...sellTaxFindings(input.state)];
}
