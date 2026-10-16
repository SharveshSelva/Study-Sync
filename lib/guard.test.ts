import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppError } from "./errors";
import { enforceRateLimit, passwordRequired, requirePassword } from "./guard";
import { namedOwner } from "./schemas";

/** guard() only reads headers, so a plain Request is enough. */
function req(headers: Record<string, string> = {}): NextRequest {
  return new Request("https://example.com/api/plan", { headers }) as unknown as NextRequest;
}

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.APP_PASSWORD;
  delete process.env.RATE_LIMIT_PER_HOUR;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("password gate", () => {
  it("is off when APP_PASSWORD is unset", () => {
    expect(passwordRequired()).toBe(false);
    expect(() => requirePassword(req())).not.toThrow();
  });

  it("rejects a request with no password", () => {
    process.env.APP_PASSWORD = "letmein";
    expect(() => requirePassword(req())).toThrow(AppError);
  });

  it("rejects a wrong password", () => {
    process.env.APP_PASSWORD = "letmein";
    expect(() => requirePassword(req({ "x-studysync-password": "nope" }))).toThrow(AppError);
  });

  it("accepts the correct password", () => {
    process.env.APP_PASSWORD = "letmein";
    expect(() => requirePassword(req({ "x-studysync-password": "letmein" }))).not.toThrow();
  });

  it("returns 401 so the UI can prompt rather than show a generic failure", () => {
    process.env.APP_PASSWORD = "letmein";
    try {
      requirePassword(req());
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).status).toBe(401);
    }
  });
});

describe("rate limiting", () => {
  it("allows requests up to the limit then blocks", () => {
    process.env.RATE_LIMIT_PER_HOUR = "3";
    const ip = { "x-forwarded-for": "10.0.0.1" };

    for (let i = 0; i < 3; i += 1) {
      expect(() => enforceRateLimit(req(ip))).not.toThrow();
    }
    expect(() => enforceRateLimit(req(ip))).toThrow(AppError);
  });

  it("counts each IP separately", () => {
    process.env.RATE_LIMIT_PER_HOUR = "1";
    expect(() => enforceRateLimit(req({ "x-forwarded-for": "10.0.0.2" }))).not.toThrow();
    // A different client must not inherit the first one's budget.
    expect(() => enforceRateLimit(req({ "x-forwarded-for": "10.0.0.3" }))).not.toThrow();
  });

  it("reads the first entry of a comma-separated forwarded-for chain", () => {
    process.env.RATE_LIMIT_PER_HOUR = "1";
    expect(() =>
      enforceRateLimit(req({ "x-forwarded-for": "10.0.0.4, 172.16.0.1" })),
    ).not.toThrow();
    expect(() => enforceRateLimit(req({ "x-forwarded-for": "10.0.0.4, 9.9.9.9" }))).toThrow();
  });

  it("is disabled when set to 0", () => {
    process.env.RATE_LIMIT_PER_HOUR = "0";
    const ip = { "x-forwarded-for": "10.0.0.5" };
    for (let i = 0; i < 50; i += 1) {
      expect(() => enforceRateLimit(req(ip))).not.toThrow();
    }
  });

  it("returns 429 rather than a generic error", () => {
    process.env.RATE_LIMIT_PER_HOUR = "1";
    const ip = { "x-forwarded-for": "10.0.0.6" };
    enforceRateLimit(req(ip));
    try {
      enforceRateLimit(req(ip));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as AppError).status).toBe(429);
    }
  });
});

describe("namedOwner", () => {
  it.each([
    [null, null],
    ["", null],
    ["   ", null],
    ["Unassigned", null],
    ["unassigned", null],
    ["  Priya  ", "Priya"],
    ["Arun", "Arun"],
  ])("normalises %o to %o", (input, expected) => {
    expect(namedOwner(input)).toBe(expected);
  });
});
