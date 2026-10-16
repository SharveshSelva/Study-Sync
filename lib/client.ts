"use client";

/** Must match PASSWORD_HEADER in lib/guard.ts (kept separate so client code
 *  does not pull in the server-only module). */
export const PASSWORD_HEADER = "x-studysync-password";

const STORAGE_KEY = "studysync:password";

export function storedPassword(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storePassword(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Private browsing — the password just will not persist across reloads.
  }
}

export function clearPassword(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

/** fetch() that attaches the demo password when one has been entered. */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const password = storedPassword();
  if (password) headers.set(PASSWORD_HEADER, password);
  return fetch(input, { ...init, headers });
}
