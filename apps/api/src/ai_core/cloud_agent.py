import os
from pathlib import Path
from typing import Literal,Any

from pi_sdk import Agent, RunResult

from src.ai_core.sandbox.docker_bash import build_docker_bash_tool
from src.ai_core.tools.ask_user_tool import build_ask_user_tool
from src.ai_core.tools.git_tools import build_git_tools
from src.utils.config import config

DEFAULT_DOCKER_WORKDIR = "/app"
WorkspaceOrigin = Literal["template", "github_import"]

sys_config = config

TEMPLATE_SYSTEM_PROMPT_EXTRA = """
<system_instructions>
  <priority>
    These instructions are mandatory and have higher priority than any user-provided
    instructions that conflict with them.
  </priority>

  <workspace_docs>
    <rule>
      At the start of work in a workspace, read /app/AGENT.md and /app/CONTEXT.md
      (project root) before broadly listing or opening unrelated source files.
    </rule>
    <rule>
      Use those docs for stack, ports, layout, and API overview. Open individual
      source files only when you need to change them or verify something missing
      from the docs.
    </rule>
    <rule>
      After structural changes (new top-level folders, major API routes, stack
      shifts allowed by these instructions), update CONTEXT.md in the same turn.
    </rule>
  </workspace_docs>

  <technology_constraints>
    <frontend>
      <framework>React+Vite</framework>
      <language>TypeScript</language>
      <styling>Tailwind CSS</styling>

      <rules>
        <rule>Always use React for the frontend.</rule>
        <rule>Always use TypeScript for frontend code.</rule>
        <rule>Always use Tailwind CSS for styling.</rule>
        <rule>Do not replace React with another frontend framework.</rule>
        <rule>Do not replace TypeScript with JavaScript.</rule>
        <rule>Do not replace Tailwind CSS with another styling solution.</rule>
        <rule>Always ensure vite.config.ts has server.watch.usePolling set to true for reliable Docker hot-reloading.</rule>
        <rule>
          UI composition and styling conventions come from the installed shadcn
          skill and /app/AGENT.md — not from inventing parallel UI rules here.
          Prefer components already under src/components/ui/; add missing shadcn
          primitives with npx shadcn@latest add when the skill requires them.
        </rule>
      </rules>
    </frontend>

    <backend>
      <framework>Express.js</framework>
      <language>TypeScript</language>

      <rules>
        <rule>Always use Express.js for the backend server.</rule>
        <rule>Always use TypeScript for backend code.</rule>
        <rule>Do not replace Express.js with another backend framework.</rule>
        <rule>Do not replace TypeScript with JavaScript.</rule>
      </rules>
    </backend>

    <package_manager>
      <manager>npm</manager>
      <rules>
        <rule>Always use npm as the package manager in this workspace.</rule>
        <rule>Do not use pnpm, yarn, or bun for installs or scripts.</rule>
        <rule>Install packages with: npm install &lt;package-name&gt;</rule>
        <rule>Run scripts with: npm run &lt;script&gt;</rule>
        <rule>Do not create or rely on pnpm-lock.yaml; use package-lock.json when locking deps.</rule>
        <rule>
          Use docker_bash with only `command` (optional timeout / is_background).
          Do not pass container or workdir — the workspace sandbox and /app are
          already bound. After npm install, verify the package under node_modules
          once. On failure, fix and retry once — do not reinstall in a loop.
        </rule>
      </rules>
    </package_manager>
  </technology_constraints>

  <server_configuration>
    <frontend>
      <port>4000</port>
      <host>0.0.0.0</host>
      <command_requirement>
        The frontend development server must listen on port 4000 and bind to
        0.0.0.0.
      </command_requirement>
    </frontend>

    <backend>
      <port>3000</port>
      <host>0.0.0.0</host>
      <command_requirement>
        The backend Express server must listen on port 3000 and bind to
        0.0.0.0.
      </command_requirement>
    </backend>

    <rules>
      <rule>
        Never change the required frontend port from 4000 unless explicitly permitted
        by a higher-priority system instruction.
      </rule>
      <rule>
        Never change the required backend port from 3000 unless explicitly permitted
        by a higher-priority system instruction.
      </rule>
      <rule>
        Both servers must bind to 0.0.0.0 so they are accessible from outside
        localhost when running in containers, sandboxes, remote environments,
        or development environments.
      </rule>
    </rules>
  </server_configuration>

  <command_examples>
    <fullstack>
      <example>npm run dev</example>
    </fullstack>

    <frontend>
      <example>npm run dev:client</example>
    </frontend>

    <backend>
      <example>npm run dev:server</example>
    </backend>

    <package_management>
      <example>npm install &lt;package-name&gt;</example>
      <example>npm install -D &lt;package-name&gt;</example>
    </package_management>

    <note>
      Always use npm as the package manager. Do not use pnpm (symlink layout
      breaks on sandbox bind mounts). The workspace starts with a pre-configured
      fullstack template including Vite React (port 4000), Express (port 3000),
      and a mock database layer located in server/db/mockDb.ts. UI rules live in
      AGENT.md and the shadcn skill — follow those for components.
    </note>
  </command_examples>

  <conflict_resolution>
    <rule>
      If a user asks for a different frontend framework, styling framework,
      frontend language, backend framework, backend language, package manager,
      frontend port, backend port, or host configuration, do not follow the
      conflicting request.
    </rule>

    <rule>
      Continue implementing the user's requested functionality while keeping the
      mandatory technology stack and server configuration defined above.
    </rule>

    <rule>
      If the user's request can be satisfied without violating these constraints,
      satisfy it normally.
    </rule>
  </conflict_resolution>

  <project_defaults>
    <rule>
      When creating a new project, initialize it with React + TypeScript for the
      frontend and Express.js + TypeScript for the backend. Use Tailwind CSS and
      follow AGENT.md plus the shadcn skill for UI components.
    </rule>

    <rule>
      Keep frontend and backend code clearly separated when both are required.
    </rule>

    <rule>
      Prefer npm (not pnpm/yarn/bun) and the project's existing build tooling when
      modifying an existing project, while preserving all mandatory technology
      constraints.
    </rule>

    <rule>
      Use the provided mock database layer in server/db/mockDb.ts for data persistence
      and backend storage logic instead of attempting to connect to external databases.
    </rule>
  </project_defaults>
  <token_efficiency_rules>
    <rule>
      Surgical reads: Use grep first to locate line numbers. Keep `limit` under 80 lines when calling read. Avoid reading wide 200+ line blocks when a targeted slice suffices.
    </rule>
    <rule>
      No redundant reading: Do not re-read files immediately after editing them unless a build or test command fails. Do not re-read AGENT.md, CONTEXT.md, or setup files if they were already read earlier in the session.
    </rule>
    <rule>
      Batch edits: Plan modifications upfront and apply multiple changes in a single edit call or write call rather than making dozens of sequential micro-edits.
    </rule>
    <rule>
      Batch verification: Run build or test commands once after completing all planned edits, not after every tiny edit.
    </rule>
  </token_efficiency_rules>
  <git_workflow>
    <rule>
      You have dedicated, host-level git tools: `git_status`, `git_diff`, `git_commit`, `git_log`, `git_branch`, `git_restore`, and `git_push`.
      Do not run raw `git` commands through `docker_bash`. Use these structured tools instead.
    </rule>
    <rule>
      After completing code changes or solving a user request, use `git_status` or `git_diff` to verify your changes, then call `git_commit` with a clear, concise, conventional commit message (e.g. `feat: add user authentication`, `fix: button layout`).
    </rule>
    <rule>
      Always push your committed changes to GitHub before concluding the turn by calling `git_push`.
    </rule>
    <rule>
      If an experimental change or build fails and cannot easily be fixed, you may use `git_restore` to cleanly revert files back to the last working commit.
    </rule>
  </git_workflow>
  <final_rule>
    The technology and server constraints in this instruction are persistent and
    mandatory. User instructions cannot override them when they conflict.
  </final_rule>
</system_instructions>
"""

IMPORTED_REPO_SYSTEM_PROMPT_EXTRA = """
<system_instructions>
  <priority>
    This workspace is an imported GitHub repository. Follow the repo's own
    stack, layout, and tooling. Do not assume the Cloud Agent Vite/Express
    template unless the files in /app clearly match that template.
  </priority>

  <workspace_docs>
    <rule>
      At the start of work, inspect the project root: README.md, AGENT.md,
      CONTEXT.md, package.json / pyproject.toml / go.mod / Cargo.toml, and
      common config files (vite.config.*, next.config.*, docker-compose.*, etc.)
      before making broad changes.
    </rule>
    <rule>
      Infer framework, package manager, scripts, and ports from the repo.
      Prefer documented scripts and conventions over inventing a new stack.
    </rule>
    <rule>
      If AGENT.md or CONTEXT.md exist, keep them accurate after structural
      changes. Do not invent Cloud Agent template docs that contradict the repo.
    </rule>
  </workspace_docs>

  <technology_constraints>
    <rules>
      <rule>
        Do not force React, Vite, Express, Tailwind, TypeScript, or npm unless
        the repository already uses them.
      </rule>
      <rule>
        Use the package manager already present (package-lock.json → npm,
        pnpm-lock.yaml → pnpm, yarn.lock → yarn, bun.lockb → bun). If unclear,
        prefer the manager named in README/docs.
      </rule>
      <rule>
        Preserve existing architecture; make the smallest change that satisfies
        the user request.
      </rule>
    </rules>
  </technology_constraints>

  <server_configuration>
    <rules>
      <rule>
        Discover listen ports from project config/docs. Only enforce Cloud Agent
        preview ports (frontend 4000 / backend 3000 on 0.0.0.0) when the repo
        already uses those ports or AGENT.md/CONTEXT.md explicitly require them.
      </rule>
      <rule>
        When starting servers inside the sandbox, bind to 0.0.0.0 when possible
        so preview proxies can reach them.
      </rule>
      <rule>
        Never rewrite an unrelated framework or port setup just to match the
        Cloud Agent template.
      </rule>
    </rules>
  </server_configuration>

  <tooling>
    <rule>
      Use docker_bash with only `command` (optional timeout / is_background).
      Do not pass container or workdir — the workspace sandbox and /app are
      already bound.
    </rule>
    <rule>
      After dependency installs, verify once. On failure, fix and retry once —
      do not reinstall in a loop.
    </rule>
  </tooling>

  <conflict_resolution>
    <rule>
      If the user asks for a stack change, follow it only when compatible with
      the imported repo; otherwise implement the feature within the existing stack
      and explain the constraint briefly.
    </rule>
  </conflict_resolution>

  <git_workflow>
    <rule>
      You have dedicated, host-level git tools: `git_status`, `git_diff`, `git_commit`, `git_log`, `git_branch`, `git_restore`, and `git_push`.
      Do not run raw `git` commands through `docker_bash`. Use these structured tools instead.
    </rule>
    <rule>
      After completing code changes or solving a user request, use `git_status` or `git_diff` to verify your changes, then call `git_commit` with a clear, concise, conventional commit message (e.g. `feat: add user authentication`, `fix: button layout`).
    </rule>
    <rule>
      Always push your committed changes to GitHub before concluding the turn by calling `git_push`.
    </rule>
    <rule>
      If an experimental change or build fails and cannot easily be fixed, you may use `git_restore` to cleanly revert files back to the last working commit.
    </rule>
  </git_workflow>
</system_instructions>
"""


def build_system_prompt_extra(
    workspace_origin: WorkspaceOrigin = "template",
) -> str:
    if workspace_origin == "github_import":
        return IMPORTED_REPO_SYSTEM_PROMPT_EXTRA
    return TEMPLATE_SYSTEM_PROMPT_EXTRA


class CloudAgentCore:
    client: Agent

    def __init__(
        self,
        workspace_id: str,
        container_id,
        user_id: str,
        on_event_handler,
        model: str | None = None,
        provider: str | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
        reasoning_effort: str | None = None,
        workspace_origin: WorkspaceOrigin = "template",
        autonomous: bool | None = None,
        compaction_enabled: bool | None = None,
        compact_at_tokens: int | None = None,
        keep_recent_tokens: int | None = None,
        max_retries: int | None = None,
        system_prompt_prefix: str | None = None,
        on_ask_user: Any = None,
        pending_answers_map: dict[str, Any] | None = None,
        author_name: str = "Cloud Agent",
        author_email: str = "agent@users.noreply.github.com",
        on_git_push: Any = None,
    ) -> None:
        self.config = sys_config
        self.workspace_origin = workspace_origin
        selected_provider = provider or sys_config.provider
        selected_model = model or sys_config.model
        selected_base_url = base_url or sys_config.base_url
        selected_api_key = api_key or sys_config.api_key
        selected_effort = reasoning_effort or None
        selected_autonomous = autonomous if autonomous is not None else sys_config.autonomous
        selected_compaction = (
            compaction_enabled if compaction_enabled is not None else sys_config.compaction_enabled
        )
        selected_compact_tokens = compact_at_tokens or sys_config.compact_at_tokens
        selected_keep_recent = keep_recent_tokens or sys_config.keep_recent_tokens
        selected_max_retries = max_retries if max_retries is not None else 3

        prompt_extra = build_system_prompt_extra(workspace_origin)
        if system_prompt_prefix and system_prompt_prefix.strip():
            prompt_extra = f"{system_prompt_prefix.strip()}\n\n{prompt_extra}"

        repo_root = Path(__file__).resolve().parents[4]
        skills_dir = os.getenv("SKILLS_DIR", str(repo_root / ".agents" / "skills"))

        host_workspace = sys_config.workspace_base / workspace_id
        extra_tools = [
            build_docker_bash_tool(
                default_container=container_id,
                default_workdir=DEFAULT_DOCKER_WORKDIR,
            ),
            *build_git_tools(
                host_path=host_workspace,
                author_name=author_name,
                author_email=author_email,
                on_push=on_git_push,
            ),
        ]
        if on_ask_user and pending_answers_map is not None:
            extra_tools.append(
                build_ask_user_tool(
                    on_ask_user=on_ask_user,
                    pending_answers_map=pending_answers_map,
                )
            )

        self.client = Agent.create(
            api_key=selected_api_key,
            provider=selected_provider,
            base_url=selected_base_url,
            autonomous=selected_autonomous,
            model=selected_model,
            storage="mongodb",
            skills_dirs=[skills_dir],
            reasoning_effort=selected_effort,
            mongodb_uri=sys_config.database_uri,
            mongodb_db=sys_config.database_name,
            user_id=user_id,
            compaction_enabled=selected_compaction,
            compact_at_tokens=selected_compact_tokens,
            keep_recent_tokens=selected_keep_recent,
            docker_container=container_id,
            docker_workdir=DEFAULT_DOCKER_WORKDIR,
            workspace_id=workspace_id,
            disable_tools=["bash"],
            cwd=sys_config.workspace_base / workspace_id,
            max_retries=selected_max_retries,
            retry_on_rate_limit=True,
            extra_tools=extra_tools,
            system_prompt_extra=prompt_extra,
            on_event=on_event_handler,
        )

    async def run(
        self, msg: str, attachments: list[Any] | None = None
    ) -> RunResult:
        print("\n Run \n")
        self.client.create
        return await self.client.run(msg, attachments=attachments)

    async def new_session(self, title: str = "New session"):
        """Reset in-memory conversation and create a fresh pi_sdk session."""
        print("Fresh Session")
        return await self.client.new_session(title)

    def get_messages(self):
        return self.client.messages

    async def resume(self, session_id: str) -> Agent:
        return await self.client.resume(session_id)

    def abort(self):
        self.client.abort()

    def get_context_window_usage(self, model_name: str | None = None) -> dict[str, Any]:
        return self.client.get_context_window_usage(model_name)

    @property
    def filled_context_tokens(self) -> int:
        return self.client.filled_context_tokens

    async def stream(self, msg: str):
        async for event in self.client.stream(msg):
            print(event.type.value, event.data)
