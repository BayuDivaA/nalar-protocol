import { describe, expect, test } from "bun:test";
import { verifyToken, authenticateMcpRequest } from "../auth.js";
import type { Request, Response, NextFunction } from "express";

describe("MCP Gateway Authentication", () => {
  const SECRET = "test-super-secret-mcp-token-123456789";

  test("verifyToken returns true for identical token", () => {
    expect(verifyToken(SECRET, SECRET)).toBe(true);
  });

  test("verifyToken returns false for different token", () => {
    expect(verifyToken("wrong-token", SECRET)).toBe(false);
  });

  test("verifyToken returns false for empty input", () => {
    expect(verifyToken("", SECRET)).toBe(false);
    expect(verifyToken(SECRET, "")).toBe(false);
  });

  test("verifyToken returns false for different length token", () => {
    expect(verifyToken("short", SECRET)).toBe(false);
  });

  test("authenticateMcpRequest returns 401 when Authorization header is missing", () => {
    process.env.MCP_SHARED_SECRET = SECRET;

    let statusCode = 0;
    let responseBody: unknown = null;
    let nextCalled = false;

    const req = {
      headers: {},
    } as unknown as Request;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        responseBody = body;
        return this;
      },
    } as unknown as Response;

    const next: NextFunction = () => {
      nextCalled = true;
    };

    authenticateMcpRequest(req, res, next);

    expect(statusCode).toBe(401);
    expect((responseBody as { error: string }).error).toBe("Unauthorized");
    expect(nextCalled).toBe(false);
  });

  test("authenticateMcpRequest returns 401 when token is invalid", () => {
    process.env.MCP_SHARED_SECRET = SECRET;

    let statusCode = 0;
    let nextCalled = false;

    const req = {
      headers: {
        authorization: "Bearer wrong-token-value",
      },
    } as unknown as Request;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    } as unknown as Response;

    const next: NextFunction = () => {
      nextCalled = true;
    };

    authenticateMcpRequest(req, res, next);

    expect(statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  test("authenticateMcpRequest returns 401 when Authorization header is malformed", () => {
    process.env.MCP_SHARED_SECRET = SECRET;

    let statusCode = 0;
    let nextCalled = false;

    const req = {
      headers: {
        authorization: "Basic 12345",
      },
    } as unknown as Request;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    } as unknown as Response;

    const next: NextFunction = () => {
      nextCalled = true;
    };

    authenticateMcpRequest(req, res, next);

    expect(statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  test("authenticateMcpRequest returns 401 when Bearer token is empty string", () => {
    process.env.MCP_SHARED_SECRET = SECRET;

    let statusCode = 0;
    let nextCalled = false;

    const req = {
      headers: {
        authorization: "Bearer   ",
      },
    } as unknown as Request;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    } as unknown as Response;

    const next: NextFunction = () => {
      nextCalled = true;
    };

    authenticateMcpRequest(req, res, next);

    expect(statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  test("authenticateMcpRequest calls next() when token is valid", () => {
    process.env.MCP_SHARED_SECRET = SECRET;

    let nextCalled = false;

    const req = {
      headers: {
        authorization: `Bearer ${SECRET}`,
      },
    } as unknown as Request;

    const res = {
      status(_code: number) {
        return this;
      },
      json() {
        return this;
      },
    } as unknown as Response;

    const next: NextFunction = () => {
      nextCalled = true;
    };

    authenticateMcpRequest(req, res, next);

    expect(nextCalled).toBe(true);
  });

  test("verifyToken recognizes BNB_MCP_AUTH_TOKEN and MCP_AUTH_TOKEN environment variables", () => {
    delete process.env.MCP_SHARED_SECRET;

    process.env.BNB_MCP_AUTH_TOKEN = "token-via-bnb-env";
    expect(verifyToken("token-via-bnb-env")).toBe(true);
    expect(verifyToken("wrong-token")).toBe(false);
    delete process.env.BNB_MCP_AUTH_TOKEN;

    process.env.MCP_AUTH_TOKEN = "token-via-mcp-env";
    expect(verifyToken("token-via-mcp-env")).toBe(true);
    expect(verifyToken("wrong-token")).toBe(false);
    delete process.env.MCP_AUTH_TOKEN;
  });
});
