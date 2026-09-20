# Nalar Protocol — BNB Chain MCP Gateway

Dedicated remote tool server wrapping the official `@bnb-chain/mcp` with constant-time Bearer token authentication for deployment on Railway and connection to Nalar Protocol's backend on Vercel.

---

## 1. Purpose & Architecture

Nalar Protocol is an AI-assisted Web3 transaction security firewall. In this architecture:

- **Nalar Backend (Vercel)**: Acts as the **MCP Client** during transaction security checks.
- **BNB Agent**: Acts as the **Investigator**, orchestrating evidence probes.
- **BNB Chain MCP (Railway)**: Acts as the **Remote Tool Server**, providing read-only access to on-chain state.
- **Nalar Security Engine**: Acts as the **Final Decision Maker** (evaluating deterministic evidence into `ALLOW`, `REVIEW`, or `BLOCK`).

```
Browser Extension
        ↓
Nalar Backend (Vercel)
        ↓
BNB Agent Investigator
        ↓
BnbMcpClient (SSEClientTransport with Bearer Auth)
        ↓
Remote BNB Chain MCP Gateway (Railway)
        ↓
BSC Testnet RPC (Chain ID 97)
        ↓
On-chain Evidence
        ↓
Nalar Deterministic Security Engine
        ↓
ALLOW / REVIEW / BLOCK
```

---

## 2. Official BNB MCP Source

This gateway uses the official BNB Chain MCP implementation:

- **Repository**: [https://github.com/bnb-chain/bnbchain-mcp](https://github.com/bnb-chain/bnbchain-mcp)
- **Official Package**: `@bnb-chain/mcp` (version `^1.5.1`)

Read-oriented tools leveraged:

- `get_latest_block`: Retrieve current block number and metadata.
- `get_transaction`: Retrieve transaction details by hash.
- `get_transaction_receipt`: Retrieve transaction receipt.
- `is_contract`: Verify whether an address is a contract or EOA.
- `read_contract`: Execute read-only contract calls (e.g. `owner()`, `sellTax()`, `buyTax()`).
- `get_erc20_token_info`: Retrieve token name, symbol, decimals, and total supply.

---

## 3. Local Development Setup

In local development, the gateway can be run directly using Bun or Node.js:

```bash
cd bnb-mcp
bun install
cp .env.example .env
# Edit .env with your BSC Testnet RPC and secret
bun run dev
```

---

## 4. Local Stdio Mode vs Remote SSE

- **Local Development**: By default, Nalar Backend connects via `stdio` using `npx @bnb-chain/mcp@latest`. No remote server is required.
  ```env
  BNB_INVESTIGATOR_ENABLED=true
  BNB_MCP_TRANSPORT=stdio
  ```
- **Production (Vercel + Railway)**: Nalar Backend connects via Server-Sent Events (`sse`):
  ```env
  BNB_INVESTIGATOR_ENABLED=true
  BNB_MCP_TRANSPORT=sse
  BNB_MCP_URL=https://<your-railway-app>.up.railway.app/sse
  MCP_AUTH_TOKEN=your-random-shared-secret-here
  ```

---

## 5. Railway Deployment

1. Create a new service on [Railway](https://railway.app/).
2. Connect your Git repository (`BayuDivaA/nalar-protocol`).
3. Set **Root Directory** to `bnb-mcp`.
4. Railway will automatically detect the `Dockerfile`.
5. Configure Environment Variables in the Railway dashboard (see Section 6).
6. Generate a domain (e.g. `https://nalar-bnb-mcp.up.railway.app`).

---

## 6. Environment Variables

| Variable            | Required       | Description                            | Example                                    |
| ------------------- | -------------- | -------------------------------------- | ------------------------------------------ |
| `PORT`              | Auto (Railway) | Port to bind (default 3001)            | `3001`                                     |
| `BNB_RPC_URL`       | Yes            | BSC Testnet RPC endpoint               | `https://bnb-testnet.g.alchemy.com/v2/...` |
| `MCP_SHARED_SECRET` | Yes            | Shared token for Bearer authentication | `<long-random-string>`                     |
| `NODE_ENV`          | Optional       | Runtime environment                    | `production`                               |
| `LOG_LEVEL`         | Optional       | Log verbosity level                    | `info`                                     |

---

## 7. Authentication

Official BNB MCP SSE endpoints have no built-in authentication. This gateway enforces Bearer authentication on all operational routes using constant-time comparison (`crypto.timingSafeEqual`):

- **Header**: `Authorization: Bearer <MCP_SHARED_SECRET>`
- **Health Check**: `GET /health` is public (`200 OK`).
- **MCP Endpoints**: `GET /sse` and `POST /messages` require valid Bearer token (`401 Unauthorized` on missing or invalid token).

---

## 8. SSE Endpoint Format

The remote server exposes:

- `GET /sse`: Establishes the Server-Sent Events stream and delivers the message endpoint.
- `POST /messages?sessionId=<session>`: Receives JSON-RPC requests from the client.

---

## 9. Nalar Backend Configuration

In `backend/.env` (or Vercel Environment Settings):

```env
BNB_INVESTIGATOR_ENABLED=true
BNB_MCP_TRANSPORT=sse
BNB_MCP_URL=https://<your-railway-app>.up.railway.app/sse
MCP_AUTH_TOKEN=your-random-shared-secret-here
```

---

## 10. Testing

Run unit tests:

```bash
cd bnb-mcp
bun test
```

Test public health check:

```bash
curl -i http://localhost:3001/health
```

Test unauthorized access:

```bash
curl -i http://localhost:3001/sse
# Expected: HTTP/1.1 401 Unauthorized
```

Test authorized access:

```bash
curl -i -H "Authorization: Bearer <MCP_SHARED_SECRET>" http://localhost:3001/sse
# Expected: text/event-stream connection
```

---

## 11. Troubleshooting

- **502 Bad Gateway**: Internal `@bnb-chain/mcp` process is still initializing or crashed due to invalid RPC. Verify `BNB_RPC_URL`.
- **401 Unauthorized**: Ensure `MCP_AUTH_TOKEN` in the backend matches `MCP_SHARED_SECRET` in Railway byte-for-byte.
- **Connection Timeout**: Ensure `PORT` binding is `0.0.0.0` (not `127.0.0.1`) on Railway.

---

## 12. Security Notes

- **No Private Key**: The gateway is strictly read-only. `PRIVATE_KEY` is explicitly set to empty (`""`). No wallet signing, transfer, or approval operations can occur.
- **Credential Hygiene**: Tokens and secrets are never logged or exposed in HTTP error responses.
- **Internal Protection**: The frontend and Chrome extension never communicate with this service directly; only the Nalar backend connects using the shared secret.
