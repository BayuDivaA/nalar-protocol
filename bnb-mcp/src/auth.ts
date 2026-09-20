import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function verifyToken(providedToken: string, expectedSecret?: string): boolean {
  const secret = expectedSecret ?? process.env.MCP_SHARED_SECRET ?? process.env.BNB_MCP_AUTH_TOKEN ?? process.env.MCP_AUTH_TOKEN;

  if (!secret || !providedToken) {
    return false;
  }

  // Hash both inputs with SHA-256 to ensure identical fixed-length buffers (32 bytes),
  // preventing length-based timing side channels.
  const providedHash = crypto.createHash("sha256").update(providedToken).digest();
  const secretHash = crypto.createHash("sha256").update(secret).digest();

  return crypto.timingSafeEqual(providedHash, secretHash);
}

export function authenticateMcpRequest(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or malformed Authorization header. Expected 'Bearer <token>'.",
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token || !verifyToken(token)) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid authentication token.",
    });
  }

  return next();
}
