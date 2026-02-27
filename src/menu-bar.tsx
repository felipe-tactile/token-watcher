import {
  Icon,
  MenuBarExtra,
  launchCommand,
  LaunchType,
  openCommandPreferences,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { fetchRateLimits } from "./lib/anthropic-api";
import { getProjectSummaries } from "./lib/session-parser";
import {
  formatPercentage,
  formatRelativeTime,
  formatTokenCount,
  formatCost,
  getUtilizationEmoji,
} from "./lib/formatting";

export default function MenuBar() {
  const {
    data: rateLimits,
    isLoading: rlLoading,
    error: rlError,
  } = useCachedPromise(fetchRateLimits, [], { keepPreviousData: true });

  const { data: projects, isLoading: projLoading } = useCachedPromise(
    () => getProjectSummaries("today"),
    [],
    { keepPreviousData: true },
  );

  const isLoading = rlLoading || projLoading;

  // Title: show 5h utilization in menu bar
  let title = "⏳";
  let icon = Icon.BarChart;
  if (rlError) {
    title = "⚠️";
  } else if (rateLimits) {
    const pct = rateLimits.five_hour.utilization;
    title = `${formatPercentage(pct)}`;
    if (pct >= 80) icon = Icon.ExclamationMark;
    else if (pct >= 50) icon = Icon.Warning;
    else icon = Icon.CheckCircle;
  }

  // Today totals
  const todayTokens =
    projects?.reduce(
      (sum, p) =>
        sum +
        p.totalTokens.input_tokens +
        p.totalTokens.output_tokens +
        p.totalTokens.cache_creation_input_tokens +
        p.totalTokens.cache_read_input_tokens,
      0,
    ) ?? 0;
  const todayCost = projects?.reduce((sum, p) => sum + p.totalCost, 0) ?? 0;

  return (
    <MenuBarExtra
      icon={icon}
      title={title}
      isLoading={isLoading}
      tooltip="Claude Token Watcher"
    >
      {rlError ? (
        <MenuBarExtra.Section title="Error">
          <MenuBarExtra.Item
            title={
              rlError.message.includes("ENOENT")
                ? "Run `claude` to authenticate"
                : "Token expired or API error"
            }
            icon={Icon.ExclamationMark}
            onAction={() => openCommandPreferences()}
          />
        </MenuBarExtra.Section>
      ) : rateLimits ? (
        <>
          <MenuBarExtra.Section title="Rate Limits">
            <MenuBarExtra.Item
              title={`${getUtilizationEmoji(rateLimits.five_hour.utilization)} 5h: ${formatPercentage(rateLimits.five_hour.utilization)}`}
              subtitle={`resets ${formatRelativeTime(rateLimits.five_hour.resets_at)}`}
            />
            <MenuBarExtra.Item
              title={`${getUtilizationEmoji(rateLimits.seven_day.utilization)} 7d: ${formatPercentage(rateLimits.seven_day.utilization)}`}
              subtitle={`resets ${formatRelativeTime(rateLimits.seven_day.resets_at)}`}
            />
            {rateLimits.seven_day_sonnet && (
              <MenuBarExtra.Item
                title={`${getUtilizationEmoji(rateLimits.seven_day_sonnet.utilization)} 7d Sonnet: ${formatPercentage(rateLimits.seven_day_sonnet.utilization)}`}
                subtitle={`resets ${formatRelativeTime(rateLimits.seven_day_sonnet.resets_at)}`}
              />
            )}
            {rateLimits.seven_day_opus && (
              <MenuBarExtra.Item
                title={`${getUtilizationEmoji(rateLimits.seven_day_opus.utilization)} 7d Opus: ${formatPercentage(rateLimits.seven_day_opus.utilization)}`}
                subtitle={`resets ${formatRelativeTime(rateLimits.seven_day_opus.resets_at)}`}
              />
            )}
            {rateLimits.extra_usage?.is_enabled && (
              <MenuBarExtra.Item
                title={`💰 Extra: ${formatCost(rateLimits.extra_usage.used_credits)} / ${formatCost(rateLimits.extra_usage.monthly_limit)}`}
              />
            )}
          </MenuBarExtra.Section>

          <MenuBarExtra.Section title="Today's Usage">
            <MenuBarExtra.Item
              title={`Tokens: ${formatTokenCount(todayTokens)}`}
              subtitle={formatCost(todayCost)}
            />
            {projects?.slice(0, 5).map((p) => (
              <MenuBarExtra.Item
                key={p.projectDir}
                title={`  ${projectName(p.projectPath)}`}
                subtitle={`${formatTokenCount(totalTokens(p))} · ${formatCost(p.totalCost)}`}
              />
            ))}
          </MenuBarExtra.Section>
        </>
      ) : null}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Open Token Details"
          icon={Icon.List}
          shortcut={{ modifiers: ["cmd"], key: "o" }}
          onAction={() =>
            launchCommand({
              name: "detail-view",
              type: LaunchType.UserInitiated,
            })
          }
        />
        <MenuBarExtra.Item
          title="Preferences..."
          icon={Icon.Gear}
          shortcut={{ modifiers: ["cmd"], key: "," }}
          onAction={() => openCommandPreferences()}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}

function projectName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function totalTokens(p: {
  totalTokens: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
}): number {
  return (
    p.totalTokens.input_tokens +
    p.totalTokens.output_tokens +
    p.totalTokens.cache_creation_input_tokens +
    p.totalTokens.cache_read_input_tokens
  );
}
