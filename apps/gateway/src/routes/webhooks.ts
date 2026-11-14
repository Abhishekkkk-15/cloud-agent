import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { sendJson } from "./machines.js";
import { daemonHub } from "../hub/daemon-hub.js";
import { clientHub } from "../hub/client-hub.js";
import { notifyMachineSubscribers } from "./push.js";

export interface AutoHealerProposal {
  incidentId: string;
  title: string;
  description: string;
  source: "github" | "sentry" | "simulator";
  branchName: string;
  diff: string;
  testCommand: string;
  testOutput: string;
  testsPassed: boolean;
  createdAt: string;
  status: "pending_review" | "approved" | "discarded";
  url?: string;
}

export interface AutoPrReviewReport {
  prNumber: number;
  prTitle: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  verdict: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  summary: string;
  securityRisks: string[];
  lineComments: Array<{ file: string; line: number; comment: string; suggestion?: string }>;
  fullMarkdown: string;
  createdAt: string;
  status: "pending_review" | "posted" | "discarded";
}

export interface GithubAgentReport {
  issueNumber: number;
  prNumber?: number;
  title: string;
  author: string;
  branchName: string;
  prUrl?: string;
  commitHash?: string;
  testPassed: boolean;
  testOutput: string;
  diff: string;
  filesChanged: string[];
  summary: string;
  createdAt: string;
  type?: "github_agent.completed";
}

type IncidentItem = AutoHealerProposal | AutoPrReviewReport | GithubAgentReport;

// In-memory history strictly adhering to Zero-DB Daemon & Gateway invariant
const incidentHistory = new Map<string, Array<IncidentItem>>();

function recordHistory(machineId: string, item: IncidentItem) {
  if (!incidentHistory.has(machineId)) {
    incidentHistory.set(machineId, []);
  }
  const list = incidentHistory.get(machineId)!;
  list.unshift(item);
  if (list.length > 50) list.pop();
}

async function parseRawBody(req: IncomingMessage): Promise<{ raw: string; parsed: any }> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1e7) {
        req.destroy();
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        resolve({ raw, parsed });
      } catch (err) {
        reject(err);
      }
    });
  });
}

function verifyGithubSignature(secret: string, rawBody: string, header?: string | string[]): boolean {
  if (!header) return false;
  const sig = Array.isArray(header) ? header[0] : header;
  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig));
  } catch {
    return false;
  }
}

const AGENT_MENTION_REGEX = /@cloud-agent|@agent|\/agent/i;

export async function handleWebhookRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const path = url.pathname;

  // Options CORS preflight
  if (req.method === "OPTIONS" && path.startsWith("/webhooks/")) {
    sendJson(res, 204, {});
    return true;
  }

  // 1. GET /webhooks/history/:machineId
  if (req.method === "GET" && path.startsWith("/webhooks/history/")) {
    const machineId = path.replace("/webhooks/history/", "").trim();
    const history = incidentHistory.get(machineId) || [];
    sendJson(res, 200, { history });
    return true;
  }

  // 2. POST /webhooks/simulate/:machineId (Dev simulation of bug incident)
  if (req.method === "POST" && path.startsWith("/webhooks/simulate/")) {
    const machineId = path.replace("/webhooks/simulate/", "").trim();
    if (!daemonHub.isOnline(machineId)) {
      sendJson(res, 404, { error: `Target VPS machine [${machineId}] is offline or not found.` });
      return true;
    }

    try {
      const { parsed: body } = await parseRawBody(req).catch(() => ({ raw: "", parsed: {} }));
      const incidentId = body.incidentId || `sim_${Date.now()}`;
      const title = body.title || "Fix missing export in index module causing runtime TypeError";
      const description =
        body.description ||
        "Simulated Incident: A runtime exception was detected in a workspace module. Auto-Healer will inspect the codebase, create a reproduction test, apply a surgical fix, and verify zero regressions.";

      // Dispatch RPC to Daemon
      console.log(`[Webhooks] Dispatching auto_healer.trigger to machine [${machineId}]...`);
      const daemonRes = await daemonHub.sendRpc(
        machineId,
        "auto_healer.trigger",
        {
          incident: {
            incidentId,
            title,
            description,
            source: "simulator",
            createdAt: new Date().toISOString(),
          },
        },
        undefined,
        180000
      );

      const proposal: AutoHealerProposal = daemonRes.result?.proposal || daemonRes.result;
      if (proposal) {
        recordHistory(machineId, proposal);

        // Push notification to mobile devices
        notifyMachineSubscribers(machineId, {
          title: "🚨 Auto-Healer Fix Verified",
          body: `${title.slice(0, 70)} (Tests Passing). Tap to review.`,
          data: { type: "auto_healer.proposal", proposal, machineId },
          channelId: "agent-alerts",
        }).catch(() => {});

        // Broadcast real-time WebSocket event
        clientHub.broadcastAll({
          type: "auto_healer.proposal",
          machineId,
          proposal,
        });
      }

      sendJson(res, 200, { success: true, proposal });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Webhooks] Error handling simulate:`, msg);
      sendJson(res, 500, { error: msg });
      return true;
    }
  }

  // 3. POST /webhooks/simulate-pr/:machineId (Dev simulation of pull request review)
  if (req.method === "POST" && path.startsWith("/webhooks/simulate-pr/")) {
    const machineId = path.replace("/webhooks/simulate-pr/", "").trim();
    if (!daemonHub.isOnline(machineId)) {
      sendJson(res, 404, { error: `Target VPS machine [${machineId}] is offline or not found.` });
      return true;
    }

    try {
      const { parsed: body } = await parseRawBody(req).catch(() => ({ raw: "", parsed: {} }));
      const prNumber = body.prNumber || 42;
      const prTitle = body.prTitle || "feat(auth): add OAuth2 token refresh & session rotation";
      const author = body.author || "developer";
      const baseBranch = body.baseBranch || "main";
      const headBranch = body.headBranch || "feat/oauth2-refresh";

      console.log(`[Webhooks] Dispatching auto_healer.pr_review to machine [${machineId}]...`);
      const daemonRes = await daemonHub.sendRpc(
        machineId,
        "auto_healer.pr_review",
        {
          pr: {
            prNumber,
            prTitle,
            author,
            baseBranch,
            headBranch,
            source: "simulator",
            diffSnippet: body.diffSnippet,
          },
        },
        undefined,
        180000
      );

      const review: AutoPrReviewReport = daemonRes.result?.review || daemonRes.result;
      if (review) {
        recordHistory(machineId, review);

        // Push notification
        notifyMachineSubscribers(machineId, {
          title: `👀 PR Review Ready: PR #${prNumber}`,
          body: `Verdict: ${review.verdict} • ${prTitle.slice(0, 60)}`,
          data: { type: "auto_healer.pr_review", review, machineId },
          channelId: "agent-alerts",
        }).catch(() => {});

        // Broadcast real-time WebSocket event
        clientHub.broadcastAll({
          type: "auto_healer.pr_review",
          machineId,
          review,
        });
      }

      sendJson(res, 200, { success: true, review });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Webhooks] Error handling simulate-pr:`, msg);
      sendJson(res, 500, { error: msg });
      return true;
    }
  }

  // 4. POST /webhooks/github or POST /webhooks/github/:machineId
  if (
    req.method === "POST" &&
    (path === "/webhooks/github" ||
      path === "/webhooks/github/" ||
      path.startsWith("/webhooks/github/"))
  ) {
    let machineId = path.startsWith("/webhooks/github/")
      ? path.replace("/webhooks/github/", "").trim()
      : (url.searchParams.get("machineId") ||
          (req.headers["x-machine-id"] as string) ||
          "").trim();

    // If no machineId specified in URL, pick the first online connected machine daemon
    if (!machineId) {
      machineId = daemonHub.getFirstOnlineMachineId() || "";
    }

    if (!machineId || !daemonHub.isOnline(machineId)) {
      sendJson(res, 503, {
        error: `No online Cloud Agent daemon available to handle GitHub webhook. Machine ID: '${machineId}'`,
      });
      return true;
    }

    try {
      const { raw, parsed: body } = await parseRawBody(req);

      // Verify HMAC signature if GITHUB_WEBHOOK_SECRET is set
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
      if (webhookSecret) {
        const sig = req.headers["x-hub-signature-256"];
        if (!verifyGithubSignature(webhookSecret, raw, sig)) {
          sendJson(res, 401, { error: "Invalid X-Hub-Signature-256 header" });
          return true;
        }
      }

      const eventType = (req.headers["x-github-event"] || body.event || "unknown") as string;
      const repo = body.repository || {};
      const repoInfo = {
        owner: repo.owner?.login || repo.owner?.name || "unknown",
        name: repo.name || "unknown",
        fullName: repo.full_name || `${repo.owner?.login}/${repo.name}`,
        cloneUrl: repo.clone_url,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch || "main",
      };

      // Case A: Issue Comments (e.g. "@cloud-agent fix the auth timeout")
      if (eventType === "issue_comment") {
        const comment = body.comment;
        const issue = body.issue;
        const action = body.action;

        if (action === "created" && comment && issue) {
          const commentBody = comment.body || "";
          const isMentioned = AGENT_MENTION_REGEX.test(commentBody);

          if (!isMentioned) {
            sendJson(res, 200, { status: "ignored_unmentioned", issue: issue.number });
            return true;
          }

          console.log(
            `[Webhooks] GitHub @cloud-agent comment on #${issue.number} -> machine [${machineId}]`
          );

          // Alert mobile client that agent has picked up the task
          notifyMachineSubscribers(machineId, {
            title: `🤖 Task Picked Up: #${issue.number}`,
            body: `${comment.user?.login || "User"}: "${commentBody.slice(0, 70)}"`,
            data: { type: "github_agent.started", issueNumber: issue.number, machineId },
            channelId: "agent-alerts",
          }).catch(() => {});

          // Dispatch autonomous execution to Daemon
          const daemonRes = await daemonHub.sendRpc(
            machineId,
            "github_agent.execute",
            {
              event: {
                type: "issue_comment",
                issueNumber: issue.number,
                title: issue.title,
                body: issue.body || "",
                comment: commentBody,
                commentId: comment.id,
                author: issue.user?.login || "unknown",
                commentAuthor: comment.user?.login || "unknown",
                url: comment.html_url || issue.html_url,
                repo: repoInfo,
                isPullRequest: Boolean(issue.pull_request),
                pullRequest: issue.pull_request
                  ? {
                      headRef: body.pull_request?.head?.ref || "",
                      baseRef: body.pull_request?.base?.ref || repoInfo.defaultBranch,
                      prUrl: issue.pull_request.html_url || issue.html_url,
                    }
                  : undefined,
              },
            },
            undefined,
            300000 // 5 min timeout
          );

          const result = daemonRes.result;
          if (result) {
            const report: GithubAgentReport = {
              issueNumber: issue.number,
              prNumber: result.prNumber,
              title: issue.title,
              author: comment.user?.login || issue.user?.login || "unknown",
              branchName: result.branchName,
              prUrl: result.prUrl,
              commitHash: result.commitHash,
              testPassed: result.testPassed,
              testOutput: result.testOutput,
              diff: result.diff,
              filesChanged: result.filesChanged || [],
              summary: result.summary,
              createdAt: new Date().toISOString(),
              type: "github_agent.completed",
            };
            recordHistory(machineId, report);

            notifyMachineSubscribers(machineId, {
              title: `✅ Agent Completed: #${issue.number}`,
              body: result.prUrl
                ? `PR Opened: ${result.prUrl}`
                : `Changes pushed to ${result.branchName}`,
              data: { type: "github_agent.completed", report, machineId },
              channelId: "agent-alerts",
            }).catch(() => {});

            clientHub.broadcastAll({
              type: "github_agent.completed",
              machineId,
              report,
            });
          }

          sendJson(res, 200, { status: "executed", result });
          return true;
        }

        sendJson(res, 200, { status: `ignored action ${action}` });
        return true;
      }

      // Case B: GitHub Issues Event (opened, labeled with cloud-agent or @cloud-agent in body)
      if (eventType === "issues") {
        const issue = body.issue;
        const action = body.action;

        if (action === "opened" || action === "labeled" || action === "assigned") {
          const hasLabel = issue.labels?.some(
            (l: any) =>
              l.name?.toLowerCase() === "cloud-agent" ||
              l.name?.toLowerCase() === "agent"
          );
          const hasMention =
            AGENT_MENTION_REGEX.test(issue.title || "") ||
            AGENT_MENTION_REGEX.test(issue.body || "");
          const isAssigned =
            action === "assigned" ||
            issue.assignees?.some((a: any) => a.login?.toLowerCase().includes("agent"));

          // If labeled cloud-agent or mentioned, execute full autonomous coding agent!
          if (hasLabel || hasMention || isAssigned) {
            console.log(
              `[Webhooks] GitHub Autonomous Agent for Issue #${issue.number} -> machine [${machineId}]`
            );

            notifyMachineSubscribers(machineId, {
              title: `🤖 Agent Task: #${issue.number}`,
              body: `${issue.title.slice(0, 70)} (Assigned to Cloud Agent)`,
              data: { type: "github_agent.started", issueNumber: issue.number, machineId },
              channelId: "agent-alerts",
            }).catch(() => {});

            const daemonRes = await daemonHub.sendRpc(
              machineId,
              "github_agent.execute",
              {
                event: {
                  type: "issue",
                  issueNumber: issue.number,
                  title: issue.title,
                  body: issue.body || "",
                  author: issue.user?.login || "unknown",
                  url: issue.html_url,
                  repo: repoInfo,
                  isPullRequest: false,
                },
              },
              undefined,
              300000
            );

            const result = daemonRes.result;
            if (result) {
              const report: GithubAgentReport = {
                issueNumber: issue.number,
                prNumber: result.prNumber,
                title: issue.title,
                author: issue.user?.login || "unknown",
                branchName: result.branchName,
                prUrl: result.prUrl,
                commitHash: result.commitHash,
                testPassed: result.testPassed,
                testOutput: result.testOutput,
                diff: result.diff,
                filesChanged: result.filesChanged || [],
                summary: result.summary,
                createdAt: new Date().toISOString(),
                type: "github_agent.completed",
              };
              recordHistory(machineId, report);

              notifyMachineSubscribers(machineId, {
                title: `✅ Agent Opened PR: #${issue.number}`,
                body: result.prUrl || `Pushed to ${result.branchName}`,
                data: { type: "github_agent.completed", report, machineId },
                channelId: "agent-alerts",
              }).catch(() => {});

              clientHub.broadcastAll({
                type: "github_agent.completed",
                machineId,
                report,
              });
            }

            sendJson(res, 200, { status: "executed", result });
            return true;
          }

          // Fallback to auto-healer bug investigation
          console.log(`[Webhooks] GitHub Issue event #${issue.number} (${action}) -> Auto-Healer`);
          const daemonRes = await daemonHub.sendRpc(
            machineId,
            "auto_healer.trigger",
            {
              incident: {
                incidentId: `gh_${issue.number}`,
                title: issue.title,
                description: issue.body || "",
                source: "github",
                url: issue.html_url,
                createdAt: new Date().toISOString(),
              },
            },
            undefined,
            180000
          );

          const proposal: AutoHealerProposal = daemonRes.result?.proposal || daemonRes.result;
          if (proposal) {
            recordHistory(machineId, proposal);
            notifyMachineSubscribers(machineId, {
              title: "🚨 Auto-Healer Fix Verified",
              body: `Issue #${issue.number}: ${issue.title.slice(0, 60)} (Tests Passed)`,
              data: { type: "auto_healer.proposal", proposal, machineId },
            }).catch(() => {});

            clientHub.broadcastAll({
              type: "auto_healer.proposal",
              machineId,
              proposal,
            });
          }

          sendJson(res, 200, { status: "investigated", proposal });
          return true;
        }

        sendJson(res, 200, { status: `ignored action ${action}` });
        return true;
      }

      // Case C: GitHub Pull Request Event
      if (eventType === "pull_request") {
        const pr = body.pull_request;
        const action = body.action;

        if (action === "opened" || action === "synchronize" || action === "reopened") {
          console.log(`[Webhooks] GitHub PR event #${pr.number} (${action}) -> machine [${machineId}]`);
          const daemonRes = await daemonHub.sendRpc(
            machineId,
            "auto_healer.pr_review",
            {
              pr: {
                prNumber: pr.number,
                prTitle: pr.title,
                author: pr.user?.login || "unknown",
                baseBranch: pr.base?.ref || "main",
                headBranch: pr.head?.ref || "head",
                diffUrl: pr.diff_url,
                source: "github",
              },
            },
            undefined,
            180000
          );

          const review: AutoPrReviewReport = daemonRes.result?.review || daemonRes.result;
          if (review) {
            recordHistory(machineId, review);
            notifyMachineSubscribers(machineId, {
              title: `👀 PR Review Ready: PR #${pr.number}`,
              body: `Verdict: ${review.verdict} • ${pr.title.slice(0, 60)}`,
              data: { type: "auto_healer.pr_review", review, machineId },
            }).catch(() => {});

            clientHub.broadcastAll({
              type: "auto_healer.pr_review",
              machineId,
              review,
            });
          }

          sendJson(res, 200, { status: "reviewed", review });
          return true;
        }

        sendJson(res, 200, { status: `ignored action ${action}` });
        return true;
      }

      // Case D: GitHub CI Failure Event
      if (eventType === "workflow_run") {
        const run = body.workflow_run;
        if (run && run.conclusion === "failure") {
          console.log(`[Webhooks] GitHub Workflow failure in ${run.name} -> machine [${machineId}]`);
          const daemonRes = await daemonHub.sendRpc(
            machineId,
            "auto_healer.trigger",
            {
              incident: {
                incidentId: `ci_${run.id}`,
                title: `CI Failure in ${run.name} on branch ${run.head_branch}`,
                description: `GitHub Actions workflow run #${run.run_number} failed on commit ${run.head_sha?.slice(
                  0,
                  7
                )}. Investigate failure and repair broken tests.`,
                source: "github",
                url: run.html_url,
                createdAt: new Date().toISOString(),
              },
            },
            undefined,
            180000
          );

          const proposal: AutoHealerProposal = daemonRes.result?.proposal || daemonRes.result;
          if (proposal) {
            recordHistory(machineId, proposal);
            notifyMachineSubscribers(machineId, {
              title: "🚨 Auto-Healer Repaired CI Failure",
              body: `Workflow: ${run.name} (Tests Passing). Tap to review.`,
              data: { type: "auto_healer.proposal", proposal, machineId },
            }).catch(() => {});

            clientHub.broadcastAll({
              type: "auto_healer.proposal",
              machineId,
              proposal,
            });
          }

          sendJson(res, 200, { status: "ci_repaired", proposal });
          return true;
        }
      }

      sendJson(res, 200, { status: `unhandled event ${eventType}` });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Webhooks] Error handling GitHub webhook:`, msg);
      sendJson(res, 500, { error: msg });
      return true;
    }
  }

  // 5. POST /webhooks/sentry/:machineId
  if (req.method === "POST" && path.startsWith("/webhooks/sentry/")) {
    const machineId = path.replace("/webhooks/sentry/", "").trim();
    if (!daemonHub.isOnline(machineId)) {
      sendJson(res, 404, { error: `Target VPS machine [${machineId}] is offline or not found.` });
      return true;
    }

    try {
      const { parsed: body } = await parseRawBody(req);
      const title = body.event?.title || body.message || "Sentry Uncaught Exception";
      const culprit = body.event?.culprit || body.culprit || "";
      const stack = body.event?.entries?.map((e: any) => JSON.stringify(e)).join("\n") || "";

      console.log(`[Webhooks] Sentry alert received -> machine [${machineId}]`);
      const daemonRes = await daemonHub.sendRpc(
        machineId,
        "auto_healer.trigger",
        {
          incident: {
            incidentId: `sentry_${Date.now()}`,
            title: `[Sentry] ${title} (${culprit})`,
            description: `Sentry Error Report:\nCulprit: ${culprit}\nStack Trace:\n${stack.slice(
              0,
              2000
            )}`,
            source: "sentry",
            createdAt: new Date().toISOString(),
          },
        },
        undefined,
        180000
      );

      const proposal: AutoHealerProposal = daemonRes.result?.proposal || daemonRes.result;
      if (proposal) {
        recordHistory(machineId, proposal);
        notifyMachineSubscribers(machineId, {
          title: "🚨 Sentry Incident Fix Verified",
          body: `${title.slice(0, 60)} (Tests Passing). Tap to review.`,
          data: { type: "auto_healer.proposal", proposal, machineId },
        }).catch(() => {});

        clientHub.broadcastAll({
          type: "auto_healer.proposal",
          machineId,
          proposal,
        });
      }

      sendJson(res, 200, { status: "investigated", proposal });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Webhooks] Error handling Sentry webhook:`, msg);
      sendJson(res, 500, { error: msg });
      return true;
    }
  }

  return false;
}
