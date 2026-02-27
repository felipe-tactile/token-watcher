import {
  Color,
  Icon,
  MenuBarExtra,
  launchCommand,
  LaunchType,
  openCommandPreferences,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { fetchRateLimits } from "./lib/anthropic-api";
import { getSubscriptionInfo } from "./lib/credentials";
import { getUsageTotals } from "./lib/session-parser";
import type { UsageApiResponse, RateLimitWindow } from "./lib/types";
import type { SubscriptionInfo } from "./lib/credentials";
import type { UsageTotals } from "./lib/session-parser";
import {
  formatTokenCount,
  formatCost,
  formatResetCountdown,
  centsToDollars,
} from "./lib/formatting";

interface MenuBarData {
  rateLimits: UsageApiResponse;
  subscription: SubscriptionInfo;
  today: UsageTotals;
  month: UsageTotals;
}

async function loadMenuBarData(): Promise<MenuBarData> {
  let subscription: SubscriptionInfo = {
    tierLabel: "Claude",
    subscriptionType: "",
    rateLimitTier: "",
  };
  try {
    subscription = getSubscriptionInfo();
  } catch {
    // not authenticated yet
  }

  const [rateLimits, today, month] = await Promise.all([
    fetchRateLimits(),
    getUsageTotals("today"),
    getUsageTotals("month"),
  ]);

  return { rateLimits, subscription, today, month };
}

function statusColor(utilization: number): Color {
  const left = 100 - utilization;
  if (left <= 10) return Color.Red;
  if (left <= 20) return Color.Orange;
  if (left <= 50) return Color.Yellow;
  return Color.Green;
}

export default function MenuBar() {
  const { data, isLoading, error } = useCachedPromise(loadMenuBarData, [], {
    keepPreviousData: true,
  });

  const openDashboard = () =>
    launchCommand({ name: "token-watcher", type: LaunchType.UserInitiated });

  // Title: show remaining % in menu bar
  let title = "⏳";
  let icon: MenuBarExtra.Props["icon"] = Icon.BarChart;
  if (error) {
    title = "⚠️";
  } else if (data) {
    const left = Math.max(0, 100 - data.rateLimits.five_hour.utilization);
    title = `${left.toFixed(0)}%`;
    icon = {
      source: Icon.CircleFilled,
      tintColor: statusColor(data.rateLimits.five_hour.utilization),
    };
  }

  return (
    <MenuBarExtra
      icon={icon}
      title={title}
      isLoading={isLoading}
      tooltip="Claude Token Watcher"
    >
      {error ? (
        <MenuBarExtra.Section title="Error">
          <MenuBarExtra.Item
            title={
              error.message.includes("ENOENT")
                ? "Run `claude` to authenticate"
                : "Token expired or API error"
            }
            icon={Icon.ExclamationMark}
            onAction={() => openCommandPreferences()}
          />
        </MenuBarExtra.Section>
      ) : data ? (
        <>
          <MenuBarExtra.Section
            title={`Claude · ${data.subscription.tierLabel}`}
          >
            <RateLimitRow
              label="Session"
              window={data.rateLimits.five_hour}
              onAction={openDashboard}
            />
            <RateLimitRow
              label="Weekly"
              window={data.rateLimits.seven_day}
              onAction={openDashboard}
            />
            {data.rateLimits.seven_day_sonnet && (
              <RateLimitRow
                label="Sonnet"
                window={data.rateLimits.seven_day_sonnet}
                onAction={openDashboard}
              />
            )}
            {data.rateLimits.seven_day_opus && (
              <RateLimitRow
                label="Opus"
                window={data.rateLimits.seven_day_opus}
                onAction={openDashboard}
              />
            )}
            {data.rateLimits.extra_usage?.is_enabled && (
              <MenuBarExtra.Item
                icon={{
                  source: Icon.CircleFilled,
                  tintColor: Color.SecondaryText,
                }}
                title={`Extra  ${formatCost(centsToDollars(data.rateLimits.extra_usage.used_credits))} / ${formatCost(centsToDollars(data.rateLimits.extra_usage.monthly_limit))}`}
                onAction={openDashboard}
              />
            )}
          </MenuBarExtra.Section>

          <MenuBarExtra.Section title="Cost">
            <MenuBarExtra.Item
              icon={Icon.Coins}
              title={`Today  ${formatCost(data.today.totalCost)}`}
              subtitle={`${formatTokenCount(data.today.totalTokens)} tokens`}
              onAction={openDashboard}
            />
            <MenuBarExtra.Item
              icon={Icon.Calendar}
              title={`30 Days  ${formatCost(data.month.totalCost)}`}
              subtitle={`${formatTokenCount(data.month.totalTokens)} tokens`}
              onAction={openDashboard}
            />
          </MenuBarExtra.Section>
        </>
      ) : null}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Open Token Watcher"
          icon={Icon.List}
          shortcut={{ modifiers: ["cmd"], key: "o" }}
          onAction={openDashboard}
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

function RateLimitRow({
  label,
  window: w,
  onAction,
}: {
  label: string;
  window: RateLimitWindow;
  onAction: () => void;
}) {
  const left = Math.max(0, 100 - w.utilization);
  return (
    <MenuBarExtra.Item
      icon={{
        source: Icon.CircleFilled,
        tintColor: statusColor(w.utilization),
      }}
      title={`${label}  ${left.toFixed(0)}% left`}
      subtitle={`Resets in ${formatResetCountdown(w.resets_at)}`}
      onAction={onAction}
    />
  );
}
