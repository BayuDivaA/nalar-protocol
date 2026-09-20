import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authenticateMcpRequest } from "./auth.js";

dotenv.config();

const PUBLIC_PORT = Number(process.env.BNB_MCP_PORT || process.env.PORT || 3001);
const INTERNAL_MCP_PORT = Number(process.env.INTERNAL_MCP_PORT || 3101);

let mcpProcess: ChildProcess | null = null;
let mcpProcessReady = false;

function startInternalMcpServer(): Promise<void> {
  return new Promise((resolve) => {
    console.log(`[MCP] Starting official @bnb-chain/mcp in SSE mode on internal port ${INTERNAL_MCP_PORT}...`);

    const env = {
      ...process.env,
      PORT: String(INTERNAL_MCP_PORT),
      PRIVATE_KEY: "", // Strictly read-only enforcement
      BNB_RPC_URL: process.env.BNB_RPC_URL || "",
    };

    const localMcpPath = path.resolve(process.cwd(), "node_modules/@bnb-chain/mcp/dist/index.js");
    const useLocal = fs.existsSync(localMcpPath);
    const command = useLocal ? process.execPath : "npx";
    const args = useLocal ? [localMcpPath, "--sse"] : ["-y", "@bnb-chain/mcp@latest", "--sse"];

    mcpProcess = spawn(command, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    mcpProcess.stdout?.on("data", (data: Buffer) => {
      const msg = data.toString();
      // Safe logging without leaking sensitive data
      process.stdout.write(`[BNB-MCP-CORE] ${msg}`);
      if (msg.includes("BNBChain MCP SSE Server is running") || msg.includes("http://localhost:")) {
        mcpProcessReady = true;
        resolve();
      }
    });

    mcpProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      process.stderr.write(`[BNB-MCP-CORE] ${msg}`);
      if (msg.includes("BNBChain MCP SSE Server is running") || msg.includes("http://localhost:")) {
        mcpProcessReady = true;
        resolve();
      }
    });

    mcpProcess.on("exit", (code, signal) => {
      console.warn(`[MCP] Internal MCP server exited with code ${code}, signal ${signal}`);
      mcpProcessReady = false;
      mcpProcess = null;
    });

    // Resolve after fallback delay if startup string was missed
    setTimeout(() => {
      mcpProcessReady = true;
      resolve();
    }, 3000);
  });
}

export function createApp() {
  const app = express();
  app.use(cors());

  // Public Health Endpoint (Liveness probe)
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      ok: true,
      service: "bnb-mcp",
    });
  });

  // Public Readiness Endpoint (Readiness probe with RPC & MCP verification)
  app.get("/ready", async (_req, res) => {
    const rpcUrl = process.env.BNB_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";
    let rpcOk = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const rpcRes = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (rpcRes.ok) {
        const body = (await rpcRes.json()) as { error?: unknown; result?: unknown };
        rpcOk = Boolean(body && !body.error && body.result);
      }
    } catch {
      rpcOk = false;
    }

    const isReady = mcpProcessReady && rpcOk;
    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      status: isReady ? "ready" : "not_ready",
      service: "bnb-mcp",
      network: "bsc-testnet",
      rpc: rpcOk,
      mcp: mcpProcessReady,
    });
  });

  // Authenticated SSE Stream Endpoint
  app.get("/sse", authenticateMcpRequest, (req, res) => {
    console.log("[MCP Gateway] New incoming SSE connection request");

    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: INTERNAL_MCP_PORT,
      path: req.url,
      method: "GET",
      headers: {
        ...req.headers,
        host: `127.0.0.1:${INTERNAL_MCP_PORT}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      console.error("[MCP Gateway] Proxy error on /sse:", err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Bad Gateway",
          message: "Internal BNB Chain MCP server is unreachable",
        });
      }
    });

    req.on("close", () => {
      proxyReq.destroy();
    });

    proxyReq.end();
  });

  // Authenticated JSON-RPC Messages Endpoint
  app.post("/messages", authenticateMcpRequest, (req, res) => {
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: INTERNAL_MCP_PORT,
      path: req.url,
      method: "POST",
      headers: {
        ...req.headers,
        host: `127.0.0.1:${INTERNAL_MCP_PORT}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      console.error("[MCP Gateway] Proxy error on /messages:", err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Bad Gateway",
          message: "Failed to forward message to internal MCP server",
        });
      }
    });

    req.pipe(proxyReq);
  });

  return app;
}

async function main() {
  await startInternalMcpServer();

  const app = createApp();
  const server = app.listen(PUBLIC_PORT, "0.0.0.0", () => {
    console.log(`[MCP Gateway] Nalar BNB MCP Gateway running on http://0.0.0.0:${PUBLIC_PORT}`);
  });

  const cleanup = () => {
    console.log("[MCP Gateway] Shutting down...");
    server.close();
    if (mcpProcess) {
      mcpProcess.kill("SIGTERM");
      mcpProcess = null;
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("[MCP Gateway] Fatal startup error:", err);
    process.exit(1);
  });
}
