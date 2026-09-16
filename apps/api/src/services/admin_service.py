import os
import platform
import time
from typing import Any

from docker.errors import APIError, NotFound

from src.ai_core.sandbox.client import get_sandbox_client
from src.repository.message_repository import MessageRepository
from src.repository.model_repository import ModelRepository
from src.repository.session_repository import SessionRepository
from src.repository.settings_repository import SettingsRepository
from src.repository.usage_repository import (
    UsageRepository,
    current_period_str,
    days_left_in_month,
)
from src.repository.user_repository import UserRepository
from src.repository.workspace_repository import WorkspaceRepository
from src.utils.port_manager import PortManager


def _safe_get_docker():
    """Safely get docker client without crashing if daemon is offline."""
    try:
        client = get_sandbox_client()
        client.ping()
        return client, None
    except Exception as e:
        return None, str(e)


def _extract_workspace_id(container) -> str | None:
    """Attempt to extract associated workspace ID from container mounts or labels."""
    try:
        labels = container.labels or {}
        if "workspace_id" in labels:
            return labels["workspace_id"]

        mounts = container.attrs.get("Mounts", [])
        for m in mounts:
            source = str(m.get("Source", ""))
            # Path typically ends with /<workspace_id>
            parts = [p for p in source.replace("\\", "/").split("/") if p]
            if parts:
                candidate = parts[-1]
                if len(candidate) == 24 or len(candidate) == 32 or len(candidate) == 36:
                    return candidate
    except Exception:
        pass
    return None


def _format_ports(ports_attr: dict | None) -> dict[str, Any]:
    if not ports_attr:
        return {}
    res: dict[str, Any] = {}
    for k, v in ports_attr.items():
        if v and isinstance(v, list) and len(v) > 0:
            host_port = v[0].get("HostPort")
            if host_port:
                res[str(k)] = int(host_port)
            else:
                res[str(k)] = v
        else:
            res[str(k)] = v or ""
    return res


class AdminService:
    @staticmethod
    def get_containers() -> dict[str, Any]:
        client, err = _safe_get_docker()
        if not client:
            return {
                "docker_available": False,
                "docker_error": err or "Docker daemon is offline or unreachable.",
                "containers": [],
            }

        try:
            containers = client.containers.list(all=True)
            results = []
            for c in containers:
                try:
                    attrs = c.attrs or {}
                    state_obj = attrs.get("State", {})
                    state_str = state_obj.get("Status") or c.status
                    created_str = attrs.get("Created")
                    ports_dict = _format_ports(attrs.get("NetworkSettings", {}).get("Ports"))

                    # Fallback to Config.Image if image was deleted/pruned locally
                    image_name = attrs.get("Config", {}).get("Image") or attrs.get("Image") or "unknown"
                    try:
                        if c.image and c.image.tags:
                            image_name = c.image.tags[0]
                        elif c.image:
                            image_name = c.image.short_id
                    except Exception:
                        pass

                    results.append(
                        {
                            "id": c.id,
                            "short_id": c.short_id,
                            "name": c.name,
                            "image": image_name,
                            "status": c.status,
                            "state": state_str,
                            "created": created_str,
                            "ports": ports_dict,
                            "workspace_id": _extract_workspace_id(c),
                        }
                    )
                except Exception:
                    continue
            return {
                "docker_available": True,
                "docker_error": None,
                "containers": results,
            }
        except Exception as e:
            return {
                "docker_available": False,
                "docker_error": str(e),
                "containers": [],
            }

    @staticmethod
    def start_container(container_id: str) -> dict[str, Any]:
        client, err = _safe_get_docker()
        if not client:
            raise RuntimeError(err or "Docker daemon is offline.")
        try:
            c = client.containers.get(container_id)
            c.start()
            c.reload()
            return {"success": True, "status": c.status}
        except NotFound:
            raise ValueError(f"Container '{container_id}' not found.")
        except APIError as e:
            raise RuntimeError(f"Docker API Error: {e.explanation or e}")

    @staticmethod
    def stop_container(container_id: str) -> dict[str, Any]:
        client, err = _safe_get_docker()
        if not client:
            raise RuntimeError(err or "Docker daemon is offline.")
        try:
            c = client.containers.get(container_id)
            c.stop(timeout=5)
            c.reload()
            return {"success": True, "status": c.status}
        except NotFound:
            raise ValueError(f"Container '{container_id}' not found.")
        except APIError as e:
            raise RuntimeError(f"Docker API Error: {e.explanation or e}")

    @staticmethod
    def restart_container(container_id: str) -> dict[str, Any]:
        client, err = _safe_get_docker()
        if not client:
            raise RuntimeError(err or "Docker daemon is offline.")
        try:
            c = client.containers.get(container_id)
            c.restart(timeout=5)
            c.reload()
            return {"success": True, "status": c.status}
        except NotFound:
            raise ValueError(f"Container '{container_id}' not found.")
        except APIError as e:
            raise RuntimeError(f"Docker API Error: {e.explanation or e}")

    @staticmethod
    def remove_container(container_id: str, force: bool = True) -> dict[str, Any]:
        client, err = _safe_get_docker()
        if not client:
            raise RuntimeError(err or "Docker daemon is offline.")
        try:
            c = client.containers.get(container_id)
            c.remove(force=force)
            return {"success": True, "message": f"Container {container_id} removed"}
        except NotFound:
            raise ValueError(f"Container '{container_id}' not found.")
        except APIError as e:
            raise RuntimeError(f"Docker API Error: {e.explanation or e}")

    @staticmethod
    def get_container_logs(container_id: str, tail: int = 150) -> str:
        client, err = _safe_get_docker()
        if not client:
            raise RuntimeError(err or "Docker daemon is offline.")
        try:
            c = client.containers.get(container_id)
            raw = c.logs(tail=tail, timestamps=True)
            return raw.decode("utf-8", errors="replace")
        except NotFound:
            raise ValueError(f"Container '{container_id}' not found.")
        except APIError as e:
            raise RuntimeError(f"Docker API Error: {e.explanation or e}")

    @staticmethod
    def prune_containers() -> dict[str, Any]:
        client, err = _safe_get_docker()
        if not client:
            raise RuntimeError(err or "Docker daemon is offline.")
        try:
            result = client.containers.prune()
            deleted = result.get("ContainersDeleted") or []
            reclaimed = result.get("SpaceReclaimed") or 0
            return {
                "success": True,
                "deleted_count": len(deleted),
                "deleted_containers": deleted,
                "space_reclaimed_bytes": reclaimed,
            }
        except APIError as e:
            raise RuntimeError(f"Docker API Error: {e.explanation or e}")

    @staticmethod
    async def get_system_stats(
        user_repo: UserRepository,
        workspace_repo: WorkspaceRepository,
        session_repo: SessionRepository,
        message_repo: MessageRepository,
        model_repo: ModelRepository,
        db: Any,
    ) -> dict[str, Any]:
        # Mongo health & ping
        mongo_status = "disconnected"
        ping_ms = 0
        mongo_error = None
        try:
            t0 = time.time()
            await db.command("ping")
            ping_ms = round((time.time() - t0) * 1000, 2)
            mongo_status = "connected"
        except Exception as e:
            mongo_error = str(e)

        # Database document counts
        total_users = await user_repo.count_total()
        total_workspaces = await workspace_repo.count_total()
        total_sessions = await session_repo.count_total()
        total_messages = await message_repo.count_total()
        all_models = await model_repo.find_all(active_only=False)
        total_models = len(all_models)
        active_models = sum(1 for m in all_models if m.is_active)

        # Docker health
        client, docker_err = _safe_get_docker()
        docker_health = {
            "status": "online" if client else "offline",
            "version": None,
            "containers_count": 0,
            "running_containers_count": 0,
            "error": docker_err,
        }
        if client:
            try:
                version_info = client.version()
                docker_health["version"] = version_info.get("Version")
                containers = client.containers.list(all=True)
                docker_health["containers_count"] = len(containers)
                docker_health["running_containers_count"] = sum(
                    1 for c in containers if c.status == "running"
                )
            except Exception as e:
                docker_health["status"] = "offline"
                docker_health["error"] = str(e)

        # Environment overview (masked)
        env_summary = {
            "python_version": platform.python_version(),
            "os": f"{platform.system()} {platform.release()}",
            "default_provider": os.getenv("PROVIDER", "openai"),
            "default_model": os.getenv("MODEL", "gpt-5.6-luna"),
            "autonomous_mode": os.getenv("AUTONOMOUS", "True"),
            "docker_wsl_ip": os.getenv("DOCKER_WSL_IP", "Not configured"),
            "sandbox_mount": os.getenv("SANDBOX_MOUNT", "Not configured"),
            "database_name": os.getenv("DATABASE_NAME", "cloud-agent"),
            "preview_base_domain": os.getenv("PREVIEW_BASE_DOMAIN", "lvh.me"),
        }

        # System resource telemetry (CPU, RAM, Disk)
        cpu_usage = 0.0
        logical_cores = 1
        physical_cores = 1
        mem_data = {"total_bytes": 0, "used_bytes": 0, "available_bytes": 0, "percent": 0.0}
        disk_data = {"total_bytes": 0, "used_bytes": 0, "free_bytes": 0, "percent": 0.0, "path": ""}

        try:
            import psutil

            cpu_usage = float(psutil.cpu_percent(interval=None))
            logical_cores = int(psutil.cpu_count(logical=True) or 1)
            physical_cores = int(psutil.cpu_count(logical=False) or logical_cores)

            vm = psutil.virtual_memory()
            mem_data = {
                "total_bytes": int(vm.total),
                "used_bytes": int(vm.used),
                "available_bytes": int(vm.available),
                "percent": float(vm.percent),
            }

            root_path = os.path.splitdrive(os.getcwd())[0] + os.path.sep if os.name == "nt" else "/"
            du = psutil.disk_usage(root_path)
            disk_data = {
                "total_bytes": int(du.total),
                "used_bytes": int(du.used),
                "free_bytes": int(du.free),
                "percent": float(du.percent),
                "path": root_path,
            }
        except Exception as e:
            print(f"[AdminService] error collecting system resources: {e}")

        system_resources = {
            "cpu": {
                "percent": cpu_usage,
                "logical_cores": logical_cores,
                "physical_cores": physical_cores,
            },
            "memory": mem_data,
            "disk": disk_data,
        }

        return {
            "total_users": total_users,
            "total_workspaces": total_workspaces,
            "total_sessions": total_sessions,
            "total_messages": total_messages,
            "total_models": total_models,
            "active_models": active_models,
            "docker": docker_health,
            "mongo": {
                "status": mongo_status,
                "ping_ms": ping_ms,
                "error": mongo_error,
            },
            "system_resources": system_resources,
            "environment": env_summary,
        }

    @staticmethod
    async def get_agent_config(settings_repo: SettingsRepository) -> dict[str, Any]:
        return await settings_repo.get_agent_config()

    @staticmethod
    async def update_agent_config(
        settings_repo: SettingsRepository, data: dict[str, Any]
    ) -> dict[str, Any]:
        return await settings_repo.update_agent_config(data)

    @staticmethod
    async def get_sandbox_config(settings_repo: SettingsRepository) -> dict[str, Any]:
        return await settings_repo.get_sandbox_config()

    @staticmethod
    async def update_sandbox_config(
        settings_repo: SettingsRepository, data: dict[str, Any]
    ) -> dict[str, Any]:
        updated = await settings_repo.update_sandbox_config(data)
        if data.get("apply_to_running"):
            client, _ = _safe_get_docker()
            if client:
                mem_mb = updated.get("memory_limit_mb")
                cpus = updated.get("cpu_limit")
                pids = updated.get("pids_limit")
                update_kwargs: dict[str, Any] = {}
                if mem_mb and mem_mb > 0:
                    update_kwargs["mem_limit"] = f"{int(mem_mb)}m"
                if cpus and cpus > 0:
                    update_kwargs["nano_cpus"] = int(cpus * 1e9)
                if pids and pids > 0:
                    update_kwargs["pids_limit"] = int(pids)

                if update_kwargs:
                    try:
                        containers = client.containers.list()
                        for c in containers:
                            try:
                                c.update(**update_kwargs)
                            except Exception as ce:
                                print(f"[AdminService] failed updating container {c.id}: {ce}")
                    except Exception as e:
                        print(f"[AdminService] error iterating running containers: {e}")
        return updated

    @staticmethod
    async def get_cost_analytics(
        usage_repo: UsageRepository,
        settings_repo: SettingsRepository,
        user_repo: UserRepository,
    ) -> dict[str, Any]:
        period = current_period_str()
        await usage_repo.sync_from_sessions(period)
        days_left = days_left_in_month()
        plan_budgets = await settings_repo.get_plan_budgets()
        platform_usage = await usage_repo.get_platform_total_usage(period)
        model_spend = await usage_repo.get_model_spend(period)
        top_spenders_raw = await usage_repo.get_top_spenders(period, limit=50)

        enriched_top_users = []
        for item in top_spenders_raw:
            uid = item.get("user_id")
            user = await user_repo.find_by_id(uid) if uid else None
            plan = user.plan if user else "free"
            role = user.role if user else "user"
            name = user.name if user else (user.username if user else "Deleted User")
            email = str(user.email) if user and user.email else ""

            budget_usd = float(plan_budgets.get(plan, 5.0)) if role != "admin" else 0.0
            cost_usd = float(item.get("estimated_cost_usd", 0.0))
            percent_used = round((cost_usd / budget_usd * 100), 1) if budget_usd > 0 else 0.0
            is_blocked = bool(percent_used >= 100 and role != "admin" and plan_budgets.get("enabled", True))

            enriched_top_users.append({
                "user_id": uid or "unknown",
                "name": name,
                "email": email,
                "plan": plan,
                "role": role,
                "total_tokens": item.get("total_tokens", 0),
                "prompt_tokens": item.get("prompt_tokens", 0),
                "completion_tokens": item.get("completion_tokens", 0),
                "estimated_cost_usd": cost_usd,
                "budget_usd": budget_usd,
                "percent_used": percent_used,
                "is_blocked": is_blocked,
            })

        return {
            "current_period": period,
            "period_days_left": days_left,
            "total_spend_usd": platform_usage.get("total_spend_usd", 0.0),
            "projected_spend_usd": platform_usage.get("projected_spend_usd", 0.0),
            "total_tokens": platform_usage.get("total_tokens", 0),
            "total_prompt_tokens": platform_usage.get("total_prompt_tokens", 0),
            "total_completion_tokens": platform_usage.get("total_completion_tokens", 0),
            "active_users_count": platform_usage.get("active_users_count", 0),
            "plan_budgets": plan_budgets,
            "spend_by_model": model_spend,
            "top_users": enriched_top_users,
        }

    @staticmethod
    async def update_plan_budgets(
        settings_repo: SettingsRepository, data: dict[str, Any]
    ) -> dict[str, Any]:
        return await settings_repo.update_plan_budgets(data)


