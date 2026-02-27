import { List, Icon, Color, ActionPanel, Action } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState, useCallback } from "react";
import { fetchRateLimits } from "./lib/anthropic-api";
import { getSubscriptionInfo } from "./lib/credentials";
import { getProjectSummaries, getUsageTotals } from "./lib/session-parser";
import type {
  TimeRange,
  ProjectSummary,
  SessionSummary,
  UsageApiResponse,
  RateLimitWindow,
} from "./lib/types";
import type { SubscriptionInfo } from "./lib/credentials";
import type { UsageTotals } from "./lib/session-parser";
import {
  formatPercentage,
  formatResetCountdown,
  formatTokenCount,
  formatCost,
  formatTimestamp,
  getUtilizationColor,
  centsToDollars,
} from "./lib/formatting";

interface ServiceData {
  rateLimits: UsageApiResponse;
  subscription: SubscriptionInfo;
  today: UsageTotals;
  month: UsageTotals;
}

async function loadServiceData(): Promise<ServiceData> {
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

export default function TokenWatcher() {
  const [timeRange, setTimeRange] = useState<TimeRange>("today");

  const {
    data: service,
    isLoading: serviceLoading,
    revalidate: revalidateService,
  } = useCachedPromise(loadServiceData, [], { keepPreviousData: true });

  const {
    data: projects,
    isLoading: projLoading,
    revalidate: revalidateProjects,
  } = useCachedPromise(
    (range: TimeRange) => getProjectSummaries(range),
    [timeRange],
    { keepPreviousData: true },
  );

  const isLoading = serviceLoading || projLoading;

  const refresh = useCallback(() => {
    revalidateService();
    revalidateProjects();
  }, [revalidateService, revalidateProjects]);

  const totalCost = projects?.reduce((s, p) => s + p.totalCost, 0) ?? 0;
  const totalTokens =
    projects?.reduce(
      (s, p) =>
        s +
        p.totalTokens.input_tokens +
        p.totalTokens.output_tokens +
        p.totalTokens.cache_creation_input_tokens +
        p.totalTokens.cache_read_input_tokens,
      0,
    ) ?? 0;

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarAccessory={
        <List.Dropdown
          tooltip="Time Range"
          value={timeRange}
          onChange={(v) => setTimeRange(v as TimeRange)}
        >
          <List.Dropdown.Item title="Today" value="today" />
          <List.Dropdown.Item title="Past 7 Days" value="week" />
          <List.Dropdown.Item title="Past 30 Days" value="month" />
          <List.Dropdown.Item title="All Time" value="all" />
        </List.Dropdown>
      }
    >
      {/* === Claude service === */}
      {service && <ClaudeSection service={service} refresh={refresh} />}

      {/* === Projects === */}
      <List.Section
        title="Projects"
        subtitle={`${formatTokenCount(totalTokens)} tokens · ${formatCost(totalCost)}`}
      >
        {projects?.map((project) => (
          <ProjectItem key={project.projectDir} project={project} />
        ))}
      </List.Section>
    </List>
  );
}

// ─── Claude Service Section ───────────────────────────────────────────────

function ClaudeSection({
  service,
  refresh,
}: {
  service: ServiceData;
  refresh: () => void;
}) {
  const { rateLimits, subscription, today, month } = service;

  return (
    <List.Section title={`Claude · ${subscription.tierLabel}`}>
      <RateLimitItem
        label="Session"
        window={rateLimits.five_hour}
        refresh={refresh}
      />
      <RateLimitItem
        label="Weekly"
        window={rateLimits.seven_day}
        refresh={refresh}
      />
      {rateLimits.seven_day_sonnet && (
        <RateLimitItem
          label="Sonnet"
          window={rateLimits.seven_day_sonnet}
          refresh={refresh}
        />
      )}
      {rateLimits.seven_day_opus && (
        <RateLimitItem
          label="Opus"
          window={rateLimits.seven_day_opus}
          refresh={refresh}
        />
      )}
      {rateLimits.extra_usage?.is_enabled && (
        <List.Item
          icon={{
            source: Icon.CircleFilled,
            tintColor: Color.SecondaryText,
          }}
          title="Extra Usage"
          accessories={[
            {
              text: `${formatCost(centsToDollars(rateLimits.extra_usage.used_credits))} / ${formatCost(centsToDollars(rateLimits.extra_usage.monthly_limit))}`,
            },
          ]}
          actions={
            <ActionPanel>
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                onAction={refresh}
              />
            </ActionPanel>
          }
          detail={
            <List.Item.Detail
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label
                    title="Used"
                    text={formatCost(
                      centsToDollars(rateLimits.extra_usage.used_credits),
                    )}
                  />
                  <List.Item.Detail.Metadata.Label
                    title="Monthly Limit"
                    text={formatCost(
                      centsToDollars(rateLimits.extra_usage.monthly_limit),
                    )}
                  />
                  <List.Item.Detail.Metadata.Label
                    title="Utilization"
                    text={`${rateLimits.extra_usage.monthly_limit > 0 ? ((rateLimits.extra_usage.used_credits / rateLimits.extra_usage.monthly_limit) * 100).toFixed(0) : 0}%`}
                  />
                </List.Item.Detail.Metadata>
              }
            />
          }
        />
      )}
      <List.Item
        icon={Icon.Coins}
        title="Cost"
        accessories={[
          {
            text: `Today ${formatCost(today.totalCost)} · 30d ${formatCost(month.totalCost)}`,
          },
        ]}
        actions={
          <ActionPanel>
            <Action
              title="Refresh"
              icon={Icon.ArrowClockwise}
              onAction={refresh}
            />
          </ActionPanel>
        }
        detail={
          <List.Item.Detail
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label
                  title="Today"
                  text={`${formatCost(today.totalCost)} · ${formatTokenCount(today.totalTokens)} tokens`}
                />
                <List.Item.Detail.Metadata.Label
                  title="Last 30 Days"
                  text={`${formatCost(month.totalCost)} · ${formatTokenCount(month.totalTokens)} tokens`}
                />
              </List.Item.Detail.Metadata>
            }
          />
        }
      />
    </List.Section>
  );
}

function RateLimitItem({
  label,
  window: w,
  refresh,
}: {
  label: string;
  window: RateLimitWindow;
  refresh: () => void;
}) {
  const left = Math.max(0, 100 - w.utilization);
  return (
    <List.Item
      icon={{
        source: Icon.CircleFilled,
        tintColor: getUtilizationColor(w.utilization),
      }}
      title={label}
      accessories={[
        { text: `${left.toFixed(0)}% left` },
        { text: `Resets in ${formatResetCountdown(w.resets_at)}` },
      ]}
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={refresh}
          />
        </ActionPanel>
      }
      detail={
        <List.Item.Detail
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Utilization"
                text={formatPercentage(w.utilization)}
              />
              <List.Item.Detail.Metadata.Label
                title="Remaining"
                text={`${left.toFixed(1)}%`}
              />
              <List.Item.Detail.Metadata.TagList title="Status">
                <List.Item.Detail.Metadata.TagList.Item
                  text={
                    left <= 10
                      ? "Critical"
                      : left <= 20
                        ? "High"
                        : left <= 50
                          ? "Medium"
                          : "Low"
                  }
                  color={getUtilizationColor(w.utilization)}
                />
              </List.Item.Detail.Metadata.TagList>
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="Resets"
                text={`in ${formatResetCountdown(w.resets_at)}`}
              />
              <List.Item.Detail.Metadata.Label
                title="Reset Time"
                text={formatTimestamp(w.resets_at)}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
    />
  );
}

// ─── Projects ─────────────────────────────────────────────────────────────

function ProjectItem({ project }: { project: ProjectSummary }) {
  const name = project.projectPath.split("/").pop() || project.projectDir;
  const allTokens =
    project.totalTokens.input_tokens +
    project.totalTokens.output_tokens +
    project.totalTokens.cache_creation_input_tokens +
    project.totalTokens.cache_read_input_tokens;

  if (project.sessions.length === 1) {
    // Single session — show it directly as the project item
    return (
      <SessionItem
        session={project.sessions[0]}
        projectPath={project.projectPath}
        title={name}
      />
    );
  }

  return (
    <List.Item
      icon={Icon.Folder}
      title={name}
      accessories={[
        { text: `${formatTokenCount(allTokens)}` },
        { text: formatCost(project.totalCost) },
        { tag: `${project.sessionCount} sessions` },
      ]}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Project Path"
            content={project.projectPath}
          />
        </ActionPanel>
      }
      detail={
        <List.Item.Detail
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Project"
                text={project.projectPath}
              />
              <List.Item.Detail.Metadata.Label
                title="Sessions"
                text={String(project.sessionCount)}
              />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="Input Tokens"
                text={formatTokenCount(project.totalTokens.input_tokens)}
              />
              <List.Item.Detail.Metadata.Label
                title="Output Tokens"
                text={formatTokenCount(project.totalTokens.output_tokens)}
              />
              <List.Item.Detail.Metadata.Label
                title="Cache Write"
                text={formatTokenCount(
                  project.totalTokens.cache_creation_input_tokens,
                )}
              />
              <List.Item.Detail.Metadata.Label
                title="Cache Read"
                text={formatTokenCount(
                  project.totalTokens.cache_read_input_tokens,
                )}
              />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="Total Tokens"
                text={formatTokenCount(allTokens)}
              />
              <List.Item.Detail.Metadata.Label
                title="Total Cost"
                text={formatCost(project.totalCost)}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
    />
  );
}

function SessionItem({
  session,
  projectPath,
  title,
}: {
  session: SessionSummary;
  projectPath: string;
  title?: string;
}) {
  const sessionTokens =
    session.totalTokens.input_tokens +
    session.totalTokens.output_tokens +
    session.totalTokens.cache_creation_input_tokens +
    session.totalTokens.cache_read_input_tokens;

  const modelShort = session.model
    .replace("claude-", "")
    .replace(/-\d{8}$/, "");

  return (
    <List.Item
      icon={Icon.Document}
      title={title ?? session.sessionId.slice(0, 8)}
      subtitle={modelShort}
      accessories={[
        { text: formatTokenCount(sessionTokens) },
        { text: formatCost(session.costUSD) },
        { date: new Date(session.lastTimestamp) },
      ]}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Session Id"
            content={session.sessionId}
          />
          <Action.CopyToClipboard
            title="Copy Cost Summary"
            content={`Session ${session.sessionId}\nProject: ${projectPath}\nModel: ${session.model}\nTokens: ${sessionTokens.toLocaleString()}\nCost: ${formatCost(session.costUSD)}`}
          />
        </ActionPanel>
      }
      detail={
        <List.Item.Detail
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Session ID"
                text={session.sessionId}
              />
              <List.Item.Detail.Metadata.Label
                title="Model"
                text={session.model}
              />
              <List.Item.Detail.Metadata.Label
                title="Messages"
                text={String(session.messageCount)}
              />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="Input Tokens"
                text={formatTokenCount(session.totalTokens.input_tokens)}
              />
              <List.Item.Detail.Metadata.Label
                title="Output Tokens"
                text={formatTokenCount(session.totalTokens.output_tokens)}
              />
              <List.Item.Detail.Metadata.Label
                title="Cache Write"
                text={formatTokenCount(
                  session.totalTokens.cache_creation_input_tokens,
                )}
              />
              <List.Item.Detail.Metadata.Label
                title="Cache Read"
                text={formatTokenCount(
                  session.totalTokens.cache_read_input_tokens,
                )}
              />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="Cost"
                text={formatCost(session.costUSD)}
              />
              <List.Item.Detail.Metadata.Label
                title="Started"
                text={formatTimestamp(session.firstTimestamp)}
              />
              <List.Item.Detail.Metadata.Label
                title="Last Activity"
                text={formatTimestamp(session.lastTimestamp)}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
    />
  );
}
