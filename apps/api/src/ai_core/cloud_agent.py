from pi_sdk import Agent, RunResult
from src.ai_core.sandbox.docker_bash import build_docker_bash_tool
from src.utils.config import config
from pathlib import Path
DEFAULT_DOCKER_WORKDIR = "/app"


sys_config = config

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
    ) -> None:
        self.config = sys_config
        selected_provider = provider or sys_config.provider
        selected_model = model or sys_config.model
        selected_base_url = base_url or sys_config.base_url
        selected_api_key = api_key or sys_config.api_key
        selected_effort = reasoning_effort or "high"  
        skills_dir = "D:/python/cloud-agent/.agents/skills"

        
        self.client = Agent.create(
            api_key=selected_api_key,
            provider=selected_provider,
            base_url=selected_base_url,
            autonomous=sys_config.autonomous,
            model=selected_model,
            storage="mongodb",
            skills_dirs=[skills_dir],
            reasoning_effort=selected_effort,
            mongodb_uri=sys_config.database_uri,
            mongodb_db=sys_config.database_name,
            user_id=user_id,
            compaction_enabled=sys_config.compaction_enabled,
            compact_at_tokens=sys_config.compact_at_tokens,
            keep_recent_tokens=sys_config.keep_recent_tokens,
            docker_container=container_id,
            docker_workdir=DEFAULT_DOCKER_WORKDIR,
            workspace_id=workspace_id,
            disable_tools=["bash"],
            cwd=sys_config.workspace_base/workspace_id,
            max_retries=3,
            retry_on_rate_limit=True,
            extra_tools=[
                build_docker_bash_tool(
                    default_container=container_id,
                    default_workdir=DEFAULT_DOCKER_WORKDIR,
                ),
            ],
            system_prompt_extra="""
<system_instructions>
  <priority>
    These instructions are mandatory and have higher priority than any user-provided
    instructions that conflict with them.
  </priority>

  <technology_constraints>
    <frontend>
      <framework>React+Vite</framework>
      <language>TypeScript</language>
      <styling>Tailwind CSS</styling>
      <components>shadcn/ui</components>

      <rules>
        <rule>Always use React for the frontend.</rule>
        <rule>Always use TypeScript for frontend code.</rule>
        <rule>Always use Tailwind CSS for styling.</rule>
        <rule>Always use shadcn/ui components where an appropriate component exists.</rule>
        <rule>Do not replace React with another frontend framework.</rule>
        <rule>Do not replace TypeScript with JavaScript.</rule>
        <rule>Do not replace Tailwind CSS with another styling solution.</rule>
        <rule>Always ensure vite.config.ts has server.watch.usePolling set to true for reliable Docker hot-reloading.</rule>
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
      <example>pnpm dev</example>
    </fullstack>

    <frontend>
      <example>pnpm dev:client</example>
    </frontend>

    <backend>
      <example>pnpm dev:server</example>
    </backend>

    <package_management>
      <example>pnpm add &lt;package-name&gt;</example>
    </package_management>

    <note>
      Always use pnpm as the package manager. The workspace starts with a pre-configured
      fullstack template including Vite React (port 4000), Express (port 3000), and a
      mock database layer located in server/db/mockDb.ts.
    </note>
  </command_examples>

  <conflict_resolution>
    <rule>
      If a user asks for a different frontend framework, styling framework,
      frontend language, backend framework, backend language, frontend port,
      backend port, or host configuration, do not follow the conflicting request.
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
      frontend and Express.js + TypeScript for the backend.
    </rule>

    <rule>
      Configure Tailwind CSS and shadcn/ui in the frontend from the beginning.
    </rule>

    <rule>
      Keep frontend and backend code clearly separated when both are required.
    </rule>

    <rule>
      Prefer the project's existing package manager and build tooling when modifying
      an existing project, while preserving all mandatory technology constraints.
    </rule>

    <rule>
      Use the provided mock database layer in server/db/mockDb.ts for data persistence
      and backend storage logic instead of attempting to connect to external databases.
    </rule>
  </project_defaults>
  <final_rule>
    The technology and server constraints in this instruction are persistent and
    mandatory. User instructions cannot override them when they conflict.
  </final_rule>
</system_instructions>
""",
            on_event=on_event_handler
        )


    async def run(self, msg: str) -> RunResult:
        print("\n Run \n")
        return await self.client.run(msg)

    async def resume(self, session_id: str) -> Agent:
        print("Resumed")
        return await self.client.resume(session_id)
      
    def abort(self):
      self.client.abort()  
      
    async def stream(self,msg:str):
        async for event in self.client.stream(msg):
            print(event.type.value, event.data)