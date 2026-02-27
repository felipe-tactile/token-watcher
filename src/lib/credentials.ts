import { readFileSync } from "fs";
import { getPreferenceValues } from "@raycast/api";
import type { ClaudeOAuthCredentials } from "./types";
import { CREDENTIALS_PATH } from "./constants";

function resolveCredentialsPath(): string {
  const prefs = getPreferenceValues<{ credentialsPath?: string }>();
  const p = prefs.credentialsPath?.trim();
  if (p) {
    return p.replace(/^~/, process.env.HOME || "");
  }
  return CREDENTIALS_PATH;
}

export function readCredentials(): ClaudeOAuthCredentials {
  const path = resolveCredentialsPath();
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as ClaudeOAuthCredentials;
}

export function isTokenExpired(credentials: ClaudeOAuthCredentials): boolean {
  return Date.now() >= credentials.claudeAiOauth.expiresAt;
}

export function getValidAccessToken(): string {
  const creds = readCredentials();
  // Always re-read the file since the CLI may have refreshed the token
  // If expired, we still return it and let the API call handle 401
  return creds.claudeAiOauth.accessToken;
}
