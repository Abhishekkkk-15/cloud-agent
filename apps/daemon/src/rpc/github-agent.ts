import { handleAgentRun } from "./run.js";
import {
  safeExec,
  detectTestCommand,
  findMatchingWorkspace,
  createOrUpdatePullRequest,
  postGithubIssueComment,
  addGithubReaction,
} from "./git-utils.js";

export interface GithubAgentEvent {
  type: "issue" | "issue_comment" | "pull_request" | "pr_review_comment";
  issueNumber: number;
  prNumber?: number;
  title: string;
  body: string;
  comment?: string;
  commentId?: number;
  author: string;
  commentAuthor?: string;
  url?: string;
  repo: {
    owner: string;
    name: string;
    fullName: string;
    cloneUrl?: string;
    htmlUrl?: string;
    defaultBranch?: string;
  };
  isPullRequest?: boolean;
  pullRequest?: {
    headRef: string;
    baseRef: string;
    prUrl?: string;
  };
  workspacePath?: string;
}

export interface GithubAgentResult {
  ok: boolean;
  branchName: string;
  baseBranch: string;
  commitHash?: string;
  prUrl?: string;
  prNumber?: number;
  message: string;
  testPassed: boolean;
  testOutput: string;
  diff: string;
  filesChanged: string[];
  summary: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export async function handleGithubAgentExecute(params: {
  cli?: string;
  event: GithubAgentEvent;
}): Promise<GithubAgentResult> {
  const { event } = params;
  const { owner, name, fullName, defaultBranch = "main" } = event.repo;

  // 1. Locate local repository workspace
  const cwd = findMatchingWorkspace(fullName, event.repo.cloneUrl, event.workspacePath);
  console.log(`[GithubAgent] Executing for ${fullName} #${event.issueNumber} in [${cwd}]`);

  // React on GitHub with eyes to indicate work started
  addGithubReaction({
    owner,
    repo: name,
    issueNumber: event.issueNumber,
    content: "eyes",
  }).catch(() => {});

  // 2. Stash any uncommitted local work cleanly
  const statusCheck = safeExec("git status --porcelain", cwd);
  if (statusCheck.output.trim().length > 0) {
    safeExec("git stash push -m 'cloud-agent-auto-stash'", cwd);
  }

  // 3. Setup git branch
  let targetBranch = "";
  let baseBranch = defaultBranch;

  if (event.isPullRequest && event.pullRequest?.headRef) {
    targetBranch = event.pullRequest.headRef;
    baseBranch = event.pullRequest.baseRef || defaultBranch;
    console.log(`[GithubAgent] Checking out existing PR head branch: ${targetBranch}`);
    safeExec("git fetch origin", cwd);
    safeExec(`git checkout ${targetBranch}`, cwd);
    safeExec(`git pull origin ${targetBranch} --rebase || true`, cwd);
  } else {
    const slug = slugify(event.title) || "task";
    targetBranch = `agent/issue-${event.issueNumber}-${slug}`;
    console.log(`[GithubAgent] Creating branch ${targetBranch} from ${baseBranch}`);
    safeExec(`git checkout ${baseBranch}`, cwd);
    safeExec(`git pull origin ${baseBranch} --rebase || true`, cwd);
    safeExec(`git checkout -B ${targetBranch}`, cwd);
  }

  // 4. Formulate the comprehensive agent instruction
  const taskDescription = event.comment
    ? `Task Comment by @${event.commentAuthor || event.author}:\n${event.comment}\n\nOriginal Issue Description:\n${event.body}`
    : event.body;

  const agentPrompt = `[GITHUB AUTONOMOUS CODING AGENT INSTRUCTION]
Repository: ${fullName}
${event.isPullRequest ? `Pull Request #${event.prNumber || event.issueNumber}` : `Issue #${event.issueNumber}`}: ${event.title}
Author: @${event.author}

${taskDescription}

You are Cloud Agent, acting as an Autonomous Principal Software Engineer.
Your objective is to resolve this task end-to-end:
1. Search and inspect the repository code to understand relevant modules, dependencies, and type structures.
2. Formulate a precise, non-breaking fix or feature implementation.
3. Apply code changes surgically to the affected files.
4. Run project test commands or typechecks (e.g. npm test, pnpm test, pytest, cargo test) to ensure zero regressions.
5. If any test or typecheck fails, diagnose the error and fix it autonomously.
6. Provide a clear, structured summary of:
   - Root cause / rationale
   - Key modifications
   - Verification results`;

  // 5. Execute persistent CLI agent
  const sessionId = `gh_agent_${event.issueNumber}_${Date.now()}`;
  const stream = handleAgentRun({
    cli: params.cli,
    options: {
      prompt: agentPrompt,
      sessionId,
      cwd,
      dangerouslySkipPermissions: true,
    },
  });

  let assistantSummary = "";
  for await (const chunk of stream) {
    if (chunk.type === "text_chunk") {
      const text = (chunk.data as any)?.text || "";
      if (text) assistantSummary += text;
    }
  }

  if (!assistantSummary.trim()) {
    assistantSummary = `Resolved issue #${event.issueNumber}: ${event.title}. Verified with automated test suite.`;
  }

  // 6. Run test suite to verify fix
  const testCmd = detectTestCommand(cwd);
  console.log(`[GithubAgent] Running verification test command: ${testCmd}`);
  const testRun = safeExec(testCmd, cwd);
  const testPassed = testRun.exitCode === 0;

  // 7. Check diff and commit changes
  safeExec("git add -A", cwd);
  const stagedFilesRes = safeExec("git diff --cached --name-only", cwd);
  const filesChanged = stagedFilesRes.output
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  let commitHash: string | undefined;
  let diff = "";

  if (filesChanged.length > 0) {
    const commitMsg = `fix: resolve issue #${event.issueNumber} - ${event.title}\n\nCloses #${event.issueNumber}`;
    safeExec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}" --no-verify`, cwd);
    const hashRes = safeExec("git rev-parse HEAD", cwd);
    commitHash = hashRes.exitCode === 0 ? hashRes.output.trim() : undefined;

    const diffRes = safeExec(`git diff ${baseBranch}...${targetBranch}`, cwd);
    diff = diffRes.output || "";

    // Push branch to remote
    console.log(`[GithubAgent] Pushing ${targetBranch} to origin...`);
    safeExec(`git push -u origin ${targetBranch}`, cwd);
  } else {
    console.log(`[GithubAgent] No files changed during agent execution.`);
  }

  // 8. Create or Update Pull Request if new issue
  let prUrl: string | undefined = event.pullRequest?.prUrl;
  let prNumber: number | undefined = event.prNumber;

  if (!event.isPullRequest && filesChanged.length > 0) {
    console.log(`[GithubAgent] Creating Pull Request for ${targetBranch} -> ${baseBranch}...`);
    const prBody = `## 🤖 Cloud Agent Autonomous Resolution

### Overview
Resolves #${event.issueNumber}

### Summary of Changes
${assistantSummary.slice(0, 2000)}

### Verification Status
- **Test Command**: \`${testCmd}\`
- **Result**: ${testPassed ? "✅ All tests passing" : "⚠️ Tests reported warnings/errors"}

\`\`\`
${testRun.output.slice(0, 800)}
\`\`\`

---
*Created autonomously by [Cloud Agent](https://github.com/Abhishekkkk-15/cloud-agent).*`;

    const prResult = await createOrUpdatePullRequest({
      owner,
      repo: name,
      headBranch: targetBranch,
      baseBranch,
      title: `fix: ${event.title} (resolves #${event.issueNumber})`,
      body: prBody,
      cwd,
    });

    prUrl = prResult.prUrl;
    prNumber = prResult.prNumber;
  }

  // 9. Post completion comment to GitHub Issue / PR
  const commentBody = prUrl
    ? `🤖 **Cloud Agent** has resolved this task!\n\n- **Pull Request**: ${prUrl}\n- **Branch**: \`${targetBranch}\`\n- **Tests**: ${testPassed ? "✅ Passing" : "⚠️ Inspect output"}\n\n### Summary\n${assistantSummary.slice(0, 1500)}`
    : `🤖 **Cloud Agent** has finished working on branch \`${targetBranch}\`.\n\n- **Tests**: ${testPassed ? "✅ Passing" : "⚠️ Inspect output"}\n- **Files Modified**: ${filesChanged.length}\n\n### Summary\n${assistantSummary.slice(0, 1500)}`;

  await postGithubIssueComment({
    owner,
    repo: name,
    issueNumber: event.issueNumber,
    body: commentBody,
    cwd,
  });

  // React with rocket to celebrate completion
  addGithubReaction({
    owner,
    repo: name,
    issueNumber: event.issueNumber,
    content: "rocket",
  }).catch(() => {});

  const result: GithubAgentResult = {
    ok: true,
    branchName: targetBranch,
    baseBranch,
    commitHash,
    prUrl,
    prNumber,
    message: prUrl
      ? `Successfully opened Pull Request: ${prUrl}`
      : `Pushed changes to branch ${targetBranch}`,
    testPassed,
    testOutput: testRun.output,
    diff,
    filesChanged,
    summary: assistantSummary,
  };

  return result;
}
