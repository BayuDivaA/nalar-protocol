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

  // Supported blockchain networks for MVP
  SUPPORTED_CHAINS: {
    97: {
      id: 97,
      hex: "0x61",
      name: "BNB Smart Chain Testnet",
      symbol: "tBNB",
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
