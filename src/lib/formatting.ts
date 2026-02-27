import { Color } from "@raycast/api";

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  if (usd === 0) return "$0.00";
  return `$${usd.toFixed(4)}`;
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);
  const isFuture = diffMs > 0;

  const minutes = Math.floor(absDiffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let relative: string;
  if (minutes < 1) relative = "just now";
  else if (minutes < 60) relative = `${minutes}m`;
  else if (hours < 24) relative = `${hours}h ${minutes % 60}m`;
  else relative = `${days}d ${hours % 24}h`;

  if (relative === "just now") return relative;
  return isFuture ? `in ${relative}` : `${relative} ago`;
}

export function getUtilizationColor(pct: number): Color {
  if (pct >= 80) return Color.Red;
  if (pct >= 50) return Color.Yellow;
  return Color.Green;
}

export function getUtilizationEmoji(pct: number): string {
  if (pct >= 80) return "🔴";
  if (pct >= 50) return "🟡";
  return "🟢";
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
