import {
  createReadStream,
  readdirSync,
  readFileSync,
  existsSync,
  statSync,
} from "fs";
import { createInterface } from "readline";
import { join, basename } from "path";
import type {
  TokenUsage,
  SessionSummary,
  ProjectSummary,
  SessionsIndex,
  TimeRange,
} from "./types";
import { PROJECTS_DIR, getModelTier } from "./constants";
import { calculateCost } from "./cost-calculator";

function emptyTokenUsage(): TokenUsage {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
}

function addTokens(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_creation_input_tokens:
      a.cache_creation_input_tokens + b.cache_creation_input_tokens,
    cache_read_input_tokens:
      a.cache_read_input_tokens + b.cache_read_input_tokens,
  };
}

function getTimeRangeStart(range: TimeRange): Date | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  // week
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return weekAgo;
}

interface ProjectDir {
  dirName: string;
  dirPath: string;
  originalPath: string;
}

export function listProjects(): ProjectDir[] {
  if (!existsSync(PROJECTS_DIR)) return [];

  const dirs = readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  );

  return dirs.map((d) => {
    const dirPath = join(PROJECTS_DIR, d.name);
    let originalPath = d.name;

    const indexPath = join(dirPath, "sessions-index.json");
    if (existsSync(indexPath)) {
      try {
        const idx = JSON.parse(
          readFileSync(indexPath, "utf-8"),
        ) as SessionsIndex;
        if (idx.originalPath) originalPath = idx.originalPath;
      } catch {
        // ignore malformed index
      }
    } else {
      // Decode dir name: -Users-felipe-projects-foo -> /Users/felipe/projects/foo
      originalPath = d.name.replace(/^-/, "/").replace(/-/g, "/");
    }

    return { dirName: d.name, dirPath, originalPath };
  });
}

export async function parseSessionFile(
  filePath: string,
  rangeStart: Date | null,
): Promise<SessionSummary | null> {
  if (!existsSync(filePath)) return null;

  const sessionId = basename(filePath, ".jsonl");
  const tokens = emptyTokenUsage();
  let messageCount = 0;
  let model = "";
  let firstTimestamp = "";
  let lastTimestamp = "";

  return new Promise((resolve) => {
    const rl = createInterface({
      input: createReadStream(filePath, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      try {
        const entry = JSON.parse(line);
        if (entry.type !== "assistant" || !entry.message?.usage) return;

        const ts = entry.timestamp;
        if (rangeStart && ts) {
          const msgDate = new Date(ts);
          if (msgDate < rangeStart) return;
        }

        const usage = entry.message.usage;
        tokens.input_tokens += usage.input_tokens || 0;
        tokens.output_tokens += usage.output_tokens || 0;
        tokens.cache_creation_input_tokens +=
          usage.cache_creation_input_tokens || 0;
        tokens.cache_read_input_tokens += usage.cache_read_input_tokens || 0;
        messageCount++;

        if (!model && entry.message.model) model = entry.message.model;
        if (!firstTimestamp && ts) firstTimestamp = ts;
        if (ts) lastTimestamp = ts;
      } catch {
        // skip malformed lines
      }
    });

    rl.on("close", () => {
      if (messageCount === 0) {
        resolve(null);
        return;
      }

      const tier = getModelTier(model);
      const cost = calculateCost(tokens, tier);

      resolve({
        sessionId,
        projectDir: "",
        projectPath: "",
        totalTokens: tokens,
        messageCount,
        model: model || "unknown",
        firstTimestamp,
        lastTimestamp,
        costUSD: cost.totalCost,
      });
    });

    rl.on("error", () => resolve(null));
  });
}

export async function getProjectSummaries(
  range: TimeRange,
): Promise<ProjectSummary[]> {
  const projects = listProjects();
  const rangeStart = getTimeRangeStart(range);
  const summaries: ProjectSummary[] = [];

  for (const project of projects) {
    const files = readdirSync(project.dirPath).filter((f) =>
      f.endsWith(".jsonl"),
    );
    if (files.length === 0) continue;

    // For "today" filter, skip files not modified today to speed things up
    const filteredFiles =
      rangeStart && range === "today"
        ? files.filter((f) => {
            try {
              const stat = statSync(join(project.dirPath, f));
              return stat.mtime >= rangeStart;
            } catch {
              return false;
            }
          })
        : files;

    const sessionPromises = filteredFiles.map((f) =>
      parseSessionFile(join(project.dirPath, f), rangeStart),
    );

    const sessions = (await Promise.all(sessionPromises)).filter(
      (s): s is SessionSummary => s !== null,
    );

    if (sessions.length === 0) continue;

    let totalTokens = emptyTokenUsage();
    let totalCost = 0;

    for (const session of sessions) {
      session.projectDir = project.dirName;
      session.projectPath = project.originalPath;
      totalTokens = addTokens(totalTokens, session.totalTokens);
      totalCost += session.costUSD;
    }

    // Sort sessions by last timestamp, most recent first
    sessions.sort((a, b) => (b.lastTimestamp > a.lastTimestamp ? 1 : -1));

    summaries.push({
      projectDir: project.dirName,
      projectPath: project.originalPath,
      sessions,
      totalTokens,
      totalCost,
      sessionCount: sessions.length,
    });
  }

  // Sort projects by total cost descending
  summaries.sort((a, b) => b.totalCost - a.totalCost);
  return summaries;
}
