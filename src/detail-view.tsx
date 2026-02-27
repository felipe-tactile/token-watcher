import { List, Icon, ActionPanel, Action } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { fetchRateLimits } from "./lib/anthropic-api";
import { getProjectSummaries } from "./lib/session-parser";
import type {
  TimeRange,
  ProjectSummary,
  SessionSummary,
  UsageApiResponse,
} from "./lib/types";
import {
  formatPercentage,
  formatRelativeTime,
  formatTokenCount,
  formatCost,
  formatTimestamp,
  getUtilizationColor,
} from "./lib/formatting";

export default function DetailView() {
  const [timeRange, setTimeRange] = useState<TimeRange>("today");

  const { data: rateLimits, isLoading: rlLoading } = useCachedPromise(
    fetchRateLimits,
    [],
    {
      keepPreviousData: true,
    },
  );

  const { data: projects, isLoading: projLoading } = useCachedPromise(
    (range: TimeRange) => getProjectSummaries(range),
    [timeRange],
    { keepPreviousData: true },
  );

  const isLoading = rlLoading || projLoading;

  const totalCost = projects?.reduce((sum, p) => sum + p.totalCost, 0) ?? 0;
  const totalAllTokens =
    projects?.reduce(
      (sum, p) =>
        sum +
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
          <List.Dropdown.Item title="All Time" value="all" />
        </List.Dropdown>
      }
    >
      {rateLimits && <RateLimitsSection rateLimits={rateLimits} />}

      <List.Section
        title={`Summary — ${formatTokenCount(totalAllTokens)} tokens · ${formatCost(totalCost)}`}
      >
        <List.Item
          title="Total Usage"
          icon={Icon.BarChart}
          detail={
            <List.Item.Detail
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label
                    title="Time Range"
                    text={timeRange}
                  />
                  <List.Item.Detail.Metadata.Label
                    title="Total Tokens"
                    text={formatTokenCount(totalAllTokens)}
                  />
                  <List.Item.Detail.Metadata.Label
                    title="Total Cost"
                    text={formatCost(totalCost)}
                  />
                  <List.Item.Detail.Metadata.Label
                    title="Projects"
                    text={String(projects?.length ?? 0)}
                  />
                  <List.Item.Detail.Metadata.Label
                    title="Sessions"
                    text={String(
                      projects?.reduce((s, p) => s + p.sessionCount, 0) ?? 0,
                    )}
                  />
                </List.Item.Detail.Metadata>
              }
            />
          }
        />
      </List.Section>

      {projects?.map((project) => (
        <ProjectSection key={project.projectDir} project={project} />
      ))}
    </List>
  );
}

function RateLimitsSection({ rateLimits }: { rateLimits: UsageApiResponse }) {
  return (
    <List.Section title="Rate Limits">
      <List.Item
        title="5-Hour Window"
        icon={{
          source: Icon.Clock,
          tintColor: getUtilizationColor(rateLimits.five_hour.utilization),
        }}
        accessories={[
          { text: formatPercentage(rateLimits.five_hour.utilization) },
        ]}
        detail={
          <List.Item.Detail
            metadata={
              <List.Item.Detail.Metadata>
                <List.Item.Detail.Metadata.Label
                  title="Utilization"
                  text={formatPercentage(rateLimits.five_hour.utilization)}
                />
                <List.Item.Detail.Metadata.TagList title="Status">
                  <List.Item.Detail.Metadata.TagList.Item
                    text={
                      rateLimits.five_hour.utilization >= 80
                        ? "High"
                        : rateLimits.five_hour.utilization >= 50
                          ? "Medium"
                          : "Low"
                    }
                    color={getUtilizationColor(
                      rateLimits.five_hour.utilization,
                    )}
                  />
                </List.Item.Detail.Metadata.TagList>
                <List.Item.Detail.Metadata.Label
                  title="Resets"
                  text={formatRelativeTime(rateLimits.five_hour.resets_at)}
                />
                <List.Item.Detail.Metadata.Separator />
                <List.Item.Detail.Metadata.Label
                  title="7-Day Utilization"
                  text={formatPercentage(rateLimits.seven_day.utilization)}
                />
                <List.Item.Detail.Metadata.Label
                  title="7-Day Resets"
                  text={formatRelativeTime(rateLimits.seven_day.resets_at)}
                />
                {rateLimits.seven_day_sonnet && (
                  <List.Item.Detail.Metadata.Label
                    title="7-Day Sonnet"
                    text={formatPercentage(
                      rateLimits.seven_day_sonnet.utilization,
                    )}
                  />
                )}
                {rateLimits.seven_day_opus && (
                  <List.Item.Detail.Metadata.Label
                    title="7-Day Opus"
                    text={formatPercentage(
                      rateLimits.seven_day_opus.utilization,
                    )}
                  />
                )}
                {rateLimits.extra_usage?.is_enabled && (
                  <>
                    <List.Item.Detail.Metadata.Separator />
                    <List.Item.Detail.Metadata.Label
                      title="Extra Usage"
                      text={`${formatCost(rateLimits.extra_usage.used_credits)} / ${formatCost(rateLimits.extra_usage.monthly_limit)}`}
                    />
                  </>
                )}
              </List.Item.Detail.Metadata>
            }
          />
        }
      />
    </List.Section>
  );
}

function ProjectSection({ project }: { project: ProjectSummary }) {
  const name = project.projectPath.split("/").pop() || project.projectDir;
  const allTokens =
    project.totalTokens.input_tokens +
    project.totalTokens.output_tokens +
    project.totalTokens.cache_creation_input_tokens +
    project.totalTokens.cache_read_input_tokens;

  return (
    <List.Section
      title={name}
      subtitle={`${formatTokenCount(allTokens)} · ${formatCost(project.totalCost)} · ${project.sessionCount} sessions`}
    >
      {project.sessions.map((session) => (
        <SessionItem
          key={session.sessionId}
          session={session}
          projectPath={project.projectPath}
        />
      ))}
    </List.Section>
  );
}

function SessionItem({
  session,
  projectPath,
}: {
  session: SessionSummary;
  projectPath: string;
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
      title={session.sessionId.slice(0, 8)}
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
