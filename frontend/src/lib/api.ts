export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface SecurityCheckTransaction {
  chainId: number;
  from: string;
  to: string;
  value: string;
  data: `0x${string}`;
}

export interface SecurityCheckRequest {
  intent: string;
  transaction: SecurityCheckTransaction;
}

export interface SecurityCheckResponse {
  ok: boolean;
  decision: "ALLOW" | "REVIEW" | "BLOCK";

  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  intentMatch: boolean;

  intent: {
    action: string;
    quantity: number | null;
    maxValueNative: string | null;
    nativeCurrency: string | null;
    maxValueWei: string | null;
    allowApproval: boolean;
    targetAddress: string | null;
    description: string;
  };

  actual: {
    action: string;
    functionName: string | null;
    selector: string | null;
    value: string;
    description: string;
  };

  simulation: {
    success: boolean;
    gasEstimate: string | null;
    error: string | null;
  };

  policy: {
    maxSpendBNB: string;
    allowedActions: string[];
    forbiddenActions: string[];
    requireReviewAboveBNB: string;
    evaluation: {
      allowed: boolean;
      requiresReview: boolean;
      reasons: string[];
    };
  };

  effects: {
    approvals: Array<{
      type: string;
      token: string;
      owner: string;
      operator: string;
      approved: boolean;
      sourceFunction: string;
    }>;
  } | null;

  stateDiff: Array<{
    type: string;
    token: string;
    owner: string;
    operator: string;
    before: boolean | null;
    after: boolean;
    sourceFunction: string;
  }> | null;

  comparison: {
    matches: boolean;
    mismatches: string[];
  };

  contract?: {
    address: string;
    abiSource: "local" | "sourcify" | "unknown";
    verified: boolean;
  };

  transaction?: {
    selector: string | null;
    functionName: string | null;
    action: string;
  };

  reasons: string[];

  explanation: {
    title: string;
    summary: string;
    details: string[];
    recommendedAction: "CANCEL" | "REVIEW" | "PROCEED";
  };
}

export async function securityCheck(request: SecurityCheckRequest): Promise<SecurityCheckResponse> {
  const response = await fetch(`${API_URL}/api/transactions/security-check`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error ?? data?.message ?? `Security check failed with status ${response.status}.`);
  }

  return data as SecurityCheckResponse;
}
