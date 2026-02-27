import { existsSync } from "fs";
import { getPreferenceValues } from "@raycast/api";
import { CREDENTIALS_PATH, CODEX_AUTH_PATH } from "./constants";

export type Service = "claude" | "codex";

export interface ServiceAvailability {
  claude: boolean;
  codex: boolean;
  configured: Service[];
  anyConfigured: boolean;
}

export function resolveCodexCredentialsPath(): string {
  const prefs = getPreferenceValues<{ codexCredentialsPath?: string }>();
  const p = prefs.codexCredentialsPath?.trim();
  if (p) {
    return p.replace(/^~/, process.env.HOME || "");
  }
  return CODEX_AUTH_PATH;
}

export function checkServiceAvailability(): ServiceAvailability {
  const prefs = getPreferenceValues<{ credentialsPath?: string }>();
  const claudePath = prefs.credentialsPath?.trim()
    ? prefs.credentialsPath.trim().replace(/^~/, process.env.HOME || "")
    : CREDENTIALS_PATH;

  const codexPath = resolveCodexCredentialsPath();

  const claude = existsSync(claudePath);
  const codex = existsSync(codexPath);

  const configured: Service[] = [];
  if (claude) configured.push("claude");
  if (codex) configured.push("codex");

  return { claude, codex, configured, anyConfigured: configured.length > 0 };
}
