import type { NextRequest } from "next/server";

import { AppError } from "./errors";

/**
 * Cheap abuse protection for the two routes that cost money to run.
 *
 * Both controls are opt-in through environment variables so local development
 * stays frictionless, and both are deliberately dependency-free — no Redis,
 * no Upstash, no account to create.
 */

/* ------------------------------------------------------------------ *
 * Shared password
 * ------------------------------------------------------------------ */

export const PASSWORD_HEADER = "x-studysync-password";

/** Whether a password is required at all. */
export function passwordRequired(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

/**
 * Rejects the request unless it carries the shared password. A no-op when
 * APP_PASSWORD is unset, which is the normal local-development case.
 */
export function requirePassword(request: NextRequest): void {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return;

  const supplied = request.headers.get(PASSWORD_HEADER);
  if (supplied !== expected) {
    throw new AppError("This demo is password protected.", 401);
  }
}

/* ------------------------------------------------------------------ *
 * Per-IP rate limiting
 * ------------------------------------------------------------------ */

/** Requests allowed per IP per hour. 0 disables the limiter entirely. */
function limitPerHour(): number {
  const raw = Number(process.env.RATE_LIMIT_PER_HOUR);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return 20;
}

const WINDOW_MS = 60 * 60 * 1000;

/**
 * Timestamps of recent requests, keyed by IP.
 *
 * This lives in process memory, which on a serverless host means it is scoped
 * to one warm instance and is lost when that instance recycles. It therefore
 * stops casual repeated spam from a single client, but it is NOT a hard
 * guarantee across a distributed deployment — for that you need shared state
 * (Vercel KV, Upstash) or the platform's own firewall. The hard backstop is
 * the provider-side quota, which is why the README tells you to keep billing
 * off or capped.
 */
const hits = new Map<string, number[]>();

/** Best-effort client IP. Vercel sets x-forwarded-for at the edge. */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function enforceRateLimit(request: NextRequest): void {
  const limit = limitPerHour();
  if (limit === 0) return;

  const ip = clientIp(request);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= limit) {
    const oldest = recent[0]!;
    const minutes = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 60_000));
    throw new AppError(
      `Rate limit reached — ${limit} generations per hour. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      429,
    );
  }

  recent.push(now);
  hits.set(ip, recent);

  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
}

/** Applies both controls. Call at the top of any route that costs money. */
export function guard(request: NextRequest): void {
  requirePassword(request);
  enforceRateLimit(request);
}
