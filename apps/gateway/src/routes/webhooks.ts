import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson, parseBody } from "./machines.js";
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

// In-memory history strictly adhering to Zero-DB Daemon & Gateway invariant
const incidentHistory = new Map<string, Array<AutoHealerProposal | AutoPrReviewReport>>();

function recordHistory(machineId: string, item: AutoHealerProposal | AutoPrReviewReport) {
  if (!incidentHistory.has(machineId)) {
    incidentHistory.set(machineId, []);
  }
  const list = incidentHistory.get(machineId)!;
  list.unshift(item);
  if (list.length > 50) list.pop();
}

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
      const body = await parseBody(req).catch(() => ({}));
      const incidentId = body.incidentId || `sim_${Date.now()}`;
      const title = body.title || "Fix missing export in index module causing runtime TypeError";
      const description = body.description || "Simulated Incident: A runtime exception was detected in a workspace module. Auto-Healer will inspect the codebase, create a reproduction test, apply a surgical fix, and verify zero regressions.";

      // Dispatch RPC to Daemon
      console.log(`[Webhooks] Dispatching auto_healer.trigger to machine [${machineId}]...`);
      const daemonRes = await daemonHub.sendRpc(machineId, "auto_healer.trigger", {
        incident: {
          incidentId,
          title,
          description,
          source: "simulator",
          createdAt: new Date().toISOString(),
        },
      }, undefined, 180000); // 3 min timeout

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
      const body = await parseBody(req).catch(() => ({}));
      const prNumber = body.prNumber || 42;
      const prTitle = body.prTitle || "feat(auth): add OAuth2 token refresh & session rotation";
      const author = body.author || "developer";
      const baseBranch = body.baseBranch || "main";
      const headBranch = body.headBranch || "feat/oauth2-refresh";

      console.log(`[Webhooks] Dispatching auto_healer.pr_review to machine [${machineId}]...`);
      const daemonRes = await daemonHub.sendRpc(machineId, "auto_healer.pr_review", {
        pr: {
          prNumber,
          prTitle,
          author,
          baseBranch,
          headBranch,
          source: "simulator",
          diffSnippet: body.diffSnippet,
        },
      }, undefined, 180000);

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

  // 4. POST /webhooks/github/:machineId
  if (req.method === "POST" && path.startsWith("/webhooks/github/")) {
    const machineId = path.replace("/webhooks/github/", "").trim();
    if (!daemonHub.isOnline(machineId)) {
      sendJson(res, 404, { error: `Target VPS machine [${machineId}] is offline or not found.` });
      return true;
    }

    try {
      const body = await parseBody(req);
      const eventType = req.headers["x-github-event"] || body.event || "unknown";

      // GitHub Pull Request Event
      if (eventType === "pull_request") {
        const pr = body.pull_request;
        const action = body.action;

        if (action === "opened" || action === "synchronize" || action === "reopened") {
          console.log(`[Webhooks] GitHub PR event #${pr.number} (${action}) -> machine [${machineId}]`);
          const daemonRes = await daemonHub.sendRpc(machineId, "auto_healer.pr_review", {
            pr: {
              prNumber: pr.number,
              prTitle: pr.title,
              author: pr.user?.login || "unknown",
              baseBranch: pr.base?.ref || "main",
              headBranch: pr.head?.ref || "head",
              diffUrl: pr.diff_url,
              source: "github",
            },
          }, undefined, 180000);

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

      // GitHub Issues Event
      if (eventType === "issues") {
        const issue = body.issue;
        const action = body.action;

        if (action === "opened" || action === "labeled") {
          console.log(`[Webhooks] GitHub Issue event #${issue.number} (${action}) -> machine [${machineId}]`);
          const daemonRes = await daemonHub.sendRpc(machineId, "auto_healer.trigger", {
            incident: {
              incidentId: `gh_${issue.number}`,
              title: issue.title,
              description: issue.body || "",
              source: "github",
              url: issue.html_url,
              createdAt: new Date().toISOString(),
            },
          }, undefined, 180000);

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

      // GitHub CI Failure Event
      if (eventType === "workflow_run") {
        const run = body.workflow_run;
        if (run && run.conclusion === "failure") {
          console.log(`[Webhooks] GitHub Workflow failure in ${run.name} -> machine [${machineId}]`);
          const daemonRes = await daemonHub.sendRpc(machineId, "auto_healer.trigger", {
            incident: {
              incidentId: `ci_${run.id}`,
              title: `CI Failure in ${run.name} on branch ${run.head_branch}`,
              description: `GitHub Actions workflow run #${run.run_number} failed on commit ${run.head_sha?.slice(0, 7)}. Investigate failure and repair broken tests.`,
              source: "github",
              url: run.html_url,
              createdAt: new Date().toISOString(),
            },
          }, undefined, 180000);

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
      const body = await parseBody(req);
      const title = body.event?.title || body.message || "Sentry Uncaught Exception";
      const culprit = body.event?.culprit || body.culprit || "";
      const stack = body.event?.entries?.map((e: any) => JSON.stringify(e)).join("\n") || "";

      console.log(`[Webhooks] Sentry alert received -> machine [${machineId}]`);
      const daemonRes = await daemonHub.sendRpc(machineId, "auto_healer.trigger", {
        incident: {
          incidentId: `sentry_${Date.now()}`,
          title: `[Sentry] ${title} (${culprit})`,
          description: `Sentry Error Report:\nCulprit: ${culprit}\nStack Trace:\n${stack.slice(0, 2000)}`,
          source: "sentry",
          createdAt: new Date().toISOString(),
        },
      }, undefined, 180000);

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
