// Nalar Protocol Extension Configuration
// Single source of truth for backend endpoints and operational parameters.

const NALAR_CONFIG = {
  // Current active environment: "production" | "development"
  ENV: "production",

  // Base endpoints for supported environments
  ENDPOINTS: {
    production: "https://nalar-protocol.vercel.app",
    development: "http://localhost:3001",
  },

  // Dynamic getter for active backend URL (guarantees no trailing slash)
  get BACKEND_URL() {
    const url = this.ENDPOINTS[this.ENV] || this.ENDPOINTS.production;
    return url.replace(/\/+$/, "");
  },

  // Analysis timeout in milliseconds (30s accommodates on-chain simulation and BNB Agent investigation)
  TIMEOUT_MS: 30000,

  ANALYSIS_STEPS: {
    intent: "Understanding your request",
    decode: "Decoding transaction",
    simulate: "Simulating execution",
    effects: "Checking assets and permissions",
    investigate: "Inspecting addresses with BNB MCP",
    state: "Reading on-chain state",
    scam: "Checking contract risks",
    decide: "Evaluating security rules",
    explain: "Preparing the explanation",
  },

  // Shared network context for popup, background, and page UI.
  SUPPORTED_CHAINS: {
    97: {
      id: "bnb-testnet",
      chainId: 97,
      hex: "0x61",
      name: "BNB TESTNET",
      fullName: "BNB Smart Chain Testnet",
      symbol: "tBNB",
      nativeAsset: "tBNB",
      explorer: "https://testnet.bscscan.com",
      rpcUrl: "https://bnb-testnet.g.alchemy.com/v2/alch_ga4Afo05mc42FzAK86oLB",
    },
    56: {
      id: "bnb-mainnet",
      chainId: 56,
      hex: "0x38",
      name: "BNB MAINNET",
      fullName: "BNB Smart Chain Mainnet",
      symbol: "BNB",
      nativeAsset: "BNB",
      explorer: "https://bscscan.com",
      rpcUrl: "https://bnb-mainnet.g.alchemy.com/v2/alch_ga4Afo05mc42FzAK86oLB",
    },
  },
};

// Expose globally for service worker / script contexts
if (typeof self !== "undefined") {
  self.NALAR_CONFIG = NALAR_CONFIG;
}
if (typeof window !== "undefined") {
  window.NALAR_CONFIG = NALAR_CONFIG;
}
