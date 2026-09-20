# Nalar Protocol — Production Deployment Guide

This document describes the production deployment architecture, configuration, security practices, and operational procedures for Nalar Protocol.

---

## 1. Architecture Overview

Nalar Protocol is an AI-assisted Web3 transaction firewall that analyzes transactions before user signature. In production, Nalar utilizes a split cloud architecture:

- **Client Tier**: Chrome / Web Browser Extension (TxSentry).
- **Application Tier**: Nalar Security API deployed on Vercel Serverless (Hono framework).
- **Investigation Tier**: Persistent remote BNB Chain MCP Gateway deployed on Railway/Container runtime.
- **Blockchain Tier**: BNB Smart Chain Testnet (Chain ID 97) RPC node.

```
┌────────────────────────────────────────┐
│     Browser Extension (TxSentry)       │
└───────────────────┬────────────────────┘
                    │ HTTPS
                    ▼
┌────────────────────────────────────────┐
│    Nalar Backend (Hono on Vercel)      │
│  - Intent Engine & Translator          │
│  - Transaction Simulation              │
│  - Deterministic Risk Engine           │
│  - BNB Agent Investigator              │
└───────────────────┬────────────────────┘
                    │ HTTPS / SSE (Bearer Auth)
                    ▼
┌────────────────────────────────────────┐
│    Remote BNB MCP Gateway (Railway)    │
│  - Express Reverse Proxy               │
│  - Constant-Time Token Auth            │
│  - Official @bnb-chain/mcp --sse       │
└───────────────────┬────────────────────┘
                    │ JSON-RPC
                    ▼
┌────────────────────────────────────────┐
│    BNB Smart Chain Testnet (RPC)       │
│  - isContract, ERC20 Token Metadata    │
│  - Contract State Probes (sellTax...)  │
└────────────────────────────────────────┘
```

---

## 2. Local Development Workflow

In local development, the backend does not require cloud hosting or remote services. It communicates with the official `@bnb-chain/mcp` package via standard input/output (`stdio`):

```bash
# Terminal (Backend)
cd backend
cp .env.example .env
# Set BNB_MCP_TRANSPORT=stdio
bun run dev
```

In `stdio` mode:

- `BnbChainMcpClient` launches `npx -y @bnb-chain/mcp@latest` as an isolated local child process.
- Strictly read-only (`PRIVATE_KEY: ""`).
- No open network ports required for MCP.

---

## 3. Remote MCP Deployment (`bnb-mcp/`)

The official `@bnb-chain/mcp` server operates as a stateful Server-Sent Events (SSE) server (`GET /sse` streams events and `POST /messages` receives JSON-RPC commands). Because serverless environments (like Vercel functions) have ephemeral lifecycles and execution limits, the MCP gateway must run on a persistent container or VM environment (such as Railway, Render, Fly.io, or AWS ECS/Fargate).

### 3.1. Deploying to Railway

1. **Create Project**:
   - In Railway dashboard, select **New Project** → **Deploy from GitHub repo**.
   - Choose `BayuDivaA/nalar-protocol` (branch `feat/scam-intelligence`).

2. **Configure Service Root**:
   - In service settings, set **Root Directory** to `/bnb-mcp`.

3. **Set Environment Variables**:
   Configure the following in the Railway dashboard:
   - `PORT`: (Injected dynamically by Railway)
   - `INTERNAL_MCP_PORT`: `3101`
   - `MCP_SHARED_SECRET`: `<GENERATE_A_SECURE_RANDOM_SECRET_MIN_32_CHARS>`
   - `BNB_RPC_URL`: `https://data-seed-prebsc-1-s1.binance.org:8545`
   - `NODE_ENV`: `production`

4. **Deploy**:
   - Railway will build the container using `bnb-mcp/Dockerfile`.
   - Once deployed, generate a public domain (e.g. `https://bnb-mcp-production.up.railway.app`).

### 3.2. Deploying via Docker (Self-Hosted / VPS)

```bash
cd bnb-mcp
docker build -t nalar-bnb-mcp:latest .

docker run -d \
  --name nalar-bnb-mcp \
  --restart unless-stopped \
  -p 3001:3001 \
  -e PORT=3001 \
  -e INTERNAL_MCP_PORT=3101 \
  -e MCP_SHARED_SECRET="<YOUR_SECRET_TOKEN>" \
  -e BNB_RPC_URL="https://data-seed-prebsc-1-s1.binance.org:8545" \
  nalar-bnb-mcp:latest
```

---

## 4. Environment Variables Reference

### 4.1. Remote MCP Server (`bnb-mcp/`)

| Variable                | Required     | Default      | Description                                                                                     |
| ----------------------- | ------------ | ------------ | ----------------------------------------------------------------------------------------------- |
| `PORT` / `BNB_MCP_PORT` | Optional     | `3001`       | Public HTTP port (dynamic in Railway/Fly)                                                       |
| `INTERNAL_MCP_PORT`     | Optional     | `3101`       | Local port for internal `@bnb-chain/mcp --sse` process                                          |
| `MCP_SHARED_SECRET`     | **Required** | -            | Shared secret for Bearer token authentication (aliases: `BNB_MCP_AUTH_TOKEN`, `MCP_AUTH_TOKEN`) |
| `BNB_RPC_URL`           | **Required** | -            | BSC RPC URL (e.g. Testnet or Mainnet node)                                                      |
| `NODE_ENV`              | Optional     | `production` | Node runtime environment                                                                        |
| `LOG_LEVEL`             | Optional     | `info`       | Logging verbosity                                                                               |

### 4.2. Nalar Backend (`backend/`)

| Variable                   | Required     | Production Value                   | Description                                          |
| -------------------------- | ------------ | ---------------------------------- | ---------------------------------------------------- |
| `BNB_MCP_TRANSPORT`        | **Required** | `sse`                              | Transport mode: `stdio` (local) or `sse` (remote)    |
| `BNB_MCP_URL`              | **Required** | `https://<REMOTE_HOST>/sse`        | Remote MCP SSE endpoint                              |
| `MCP_AUTH_TOKEN`           | **Required** | `<SAME_MCP_SHARED_SECRET>`         | Shared Bearer token (must match `MCP_SHARED_SECRET`) |
| `BNB_INVESTIGATOR_ENABLED` | Optional     | `true`                             | Enables BNB Agent on-chain investigator              |
| `BNB_RPC_URL`              | **Required** | `https://data-seed-prebsc-1-s1...` | BSC RPC for viem transaction simulation              |
| `FRONTEND_ORIGIN`          | Optional     | `https://nalar-protocol.xyz`       | Comma-separated allowed CORS origins                 |
| `AI_PROVIDER`              | Optional     | `heuristics` / `gemini`            | Intent comparison provider                           |
| `AI_API_KEY`               | Optional     | -                                  | API key for AI provider (if not heuristics)          |
| `TXSENTRY_DEMO_NFT`        | Optional     | `0x...`                            | Demo NFT address                                     |

> [!CAUTION]
> Never commit `.env`, `.env.local`, or `.env.production` to version control. All secrets must only be provided via deployment platform environment configuration.

---

## 5. Authentication & Security Model

1. **Bearer Token Authentication**:
   - All access to `/sse` and `/messages` endpoints requires HTTP header:
     ```
     Authorization: Bearer <MCP_AUTH_TOKEN>
     ```
   - Requests with missing, malformed, or invalid tokens are rejected immediately with `401 Unauthorized`.

2. **Constant-Time Verification**:
   - Authentication middleware utilizes fixed-length SHA-256 digests evaluated through `crypto.timingSafeEqual`:
     ```ts
     const providedHash = crypto.createHash("sha256").update(providedToken).digest();
     const secretHash = crypto.createHash("sha256").update(secret).digest();
     return crypto.timingSafeEqual(providedHash, secretHash);
     ```
   - This eliminates timing side-channel vulnerabilities across tokens of different lengths.

3. **Read-Only Enforcement**:
   - The MCP child process is executed with `PRIVATE_KEY: ""`.
   - The MCP service has no access to private keys and cannot sign transactions or transfer assets.

4. **Credential-Safe Logging**:
   - URLs logged during SSE connection only record the origin (`new URL(url).origin`), avoiding leaks of query parameters, session IDs, or tokens in server logs.

---

## 6. Backend Vercel Configuration

1. Connect the GitHub repository `BayuDivaA/nalar-protocol` to Vercel.
2. In Project Settings:
   - **Root Directory**: `backend`
   - **Framework Preset**: Other (Hono on Vercel is configured via `vercel.json`)
   - **Build Command**: `tsc --noEmit`
3. In **Settings → Environment Variables**, add the variables specified in Section 4.2.
4. Deploy the project:
   ```bash
   cd backend
   vercel --prod
   ```

---

## 7. Health & Readiness Verification

The remote MCP server exposes two public health endpoints:

### Liveness Probe (`GET /health`)

Checks whether the Express server process is alive:

```bash
curl -i https://<your-remote-mcp-host>/health
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "ok": true,
  "service": "bnb-mcp"
}
```

### Readiness Probe (`GET /ready`)

Checks whether the MCP core is running AND the BSC RPC node is reachable:

```bash
curl -i https://<your-remote-mcp-host>/ready
```

**Response (200 OK):**

```json
{
  "status": "ready",
  "service": "bnb-mcp",
  "network": "bsc-testnet",
  "rpc": true,
  "mcp": true
}
```

---

## 8. Local Verification of Remote-Style MCP

To verify the remote SSE workflow locally before deploying to cloud providers:

### Terminal 1: Launch MCP Gateway

```bash
cd bnb-mcp
MCP_SHARED_SECRET="local-test-secret-12345" \
PORT=3991 \
INTERNAL_MCP_PORT=3992 \
BNB_RPC_URL="https://data-seed-prebsc-1-s1.binance.org:8545" \
bun run src/server.ts
```

### Terminal 2: Test End-to-End from Backend

```bash
cd backend
BNB_MCP_TRANSPORT=sse \
BNB_MCP_URL=http://127.0.0.1:3991/sse \
MCP_AUTH_TOKEN="local-test-secret-12345" \
bun test src/services/scam/__tests__/remote-mcp-e2e.test.ts
```

---

## 9. Troubleshooting & FAQ

### Problem: MCP connection times out (`BNB MCP connection timed out after 10000ms`)

- **Cause**: The remote URL is unreachable, or the remote server is sleeping/spinning up.
- **Resolution**:
  1. Verify the service is active: `curl https://<remote-mcp-host>/health`
  2. Verify readiness: `curl https://<remote-mcp-host>/ready`
  3. Increase connection timeout in backend: `MCP_CONNECT_TIMEOUT_MS=20000`.

### Problem: `401 Unauthorized` on `/sse`

- **Cause**: Mismatch between `MCP_AUTH_TOKEN` in the backend and `MCP_SHARED_SECRET` on the MCP Gateway.
- **Resolution**: Confirm identical token strings in both Vercel and Railway environment settings.

### Problem: MCP core child process fails to start

- **Cause**: `@bnb-chain/mcp` dist not found or node binary path issue.
- **Resolution**: In Docker container, verify `node_modules/@bnb-chain/mcp/dist/index.js` exists. Ensure `NODE_ENV=production` and `npm install --production` ran during build.
