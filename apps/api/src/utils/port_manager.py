"""Allocate host ports for sandbox preview (frontend + backend).

Docker publishes ports only at container create time, so allocate here
before `containers.run` and pass `to_docker_ports()`.

Convention:
  - frontend listens on container 4000 → random free host port
  - backend  listens on container 4001 → random free host port
Agent should bind services to those fixed container ports.
"""

from __future__ import annotations

import random
import socket
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PortRole(str, Enum):
    FRONTEND = "frontend"
    BACKEND = "backend"


class Port(BaseModel):
    """One published mapping for a workspace."""

    host_port: int
    container_port: int
    workspace_id: str
    role: PortRole

    @property
    def port(self) -> int:
        """Alias for host_port (preview / legacy callers)."""
        return self.host_port

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.host_port}"


# Fixed inside the sandbox so the agent always knows where to bind.
CONTAINER_PORTS: dict[PortRole, int] = {
    PortRole.FRONTEND: 5173,
    PortRole.BACKEND: 3000,
}

DEFAULT_ROLES: tuple[PortRole, ...] = (PortRole.FRONTEND, PortRole.BACKEND)


class PortManager(BaseModel):
    """In-memory port allocator (process-scoped singleton via DI)."""

    ports: list[Port] = Field(default_factory=list)
    min_port: int = 30000
    max_port: int = 39999

    model_config = {"arbitrary_types_allowed": True}

    def model_post_init(self, __context: object) -> None:
        # Rebuild set from list so reloads stay consistent
        object.__setattr__(
            self,
            "_allocated_ports",
            {p.host_port for p in self.ports},
        )

    @property
    def _allocated(self) -> set[int]:
        allocated = getattr(self, "_allocated_ports", None)
        if allocated is None:
            allocated = {p.host_port for p in self.ports}
            object.__setattr__(self, "_allocated_ports", allocated)
        return allocated

    def is_port_available(self, port: int) -> bool:
        if port in self._allocated:
            return False
        return self._is_os_port_free(port)

    def allocate_port(
        self,
        workspace_id: str,
        role: PortRole = PortRole.FRONTEND,
        requested_port: Optional[int] = None,
        container_port: Optional[int] = None,
    ) -> Port:
        """Allocate a single host port for a workspace role."""
        if requested_port is not None:
            if not (self.min_port <= requested_port <= self.max_port):
                raise ValueError(
                    f"Port {requested_port} is out of valid range "
                    f"({self.min_port}-{self.max_port})"
                )
            if not self.is_port_available(requested_port):
                raise RuntimeError(f"Port {requested_port} is already in use.")
            host_port = requested_port
        else:
            host_port = self._generate_random_port()

        new_port = Port(
            host_port=host_port,
            container_port=container_port
            if container_port is not None
            else CONTAINER_PORTS.get(role, host_port),
            workspace_id=workspace_id,
            role=role,
        )
        self.ports.append(new_port)
        self._allocated.add(host_port)
        return new_port

    def allocate_workspace_ports(
        self,
        workspace_id: str,
        roles: Optional[list[PortRole]] = None,
    ) -> list[Port]:
        """
        Allocate frontend + backend (default) for a workspace.

        Idempotent: if ports already exist for this workspace, return them.
        """
        existing = self.get_workspace_ports(workspace_id)
        if existing:
            return existing

        role_list = list(roles) if roles is not None else list(DEFAULT_ROLES)
        created: list[Port] = []
        try:
            for role in role_list:
                created.append(
                    self.allocate_port(
                        workspace_id=workspace_id,
                        role=role,
                        container_port=CONTAINER_PORTS[role],
                    )
                )
            return created
        except Exception:
            for p in created:
                self.release_port(p.host_port)
            raise

    def get_ports(self, workspace_id: str) -> dict[str, int]:
        """Docker `ports=` mapping: {'4000/tcp': host_port, ...}."""
        allocated = self.allocate_workspace_ports(workspace_id)
        return {f"{p.container_port}/tcp": p.host_port for p in allocated}

    def to_docker_ports(self, workspace_id: str) -> dict[str, int]:
        """Alias for get_ports (explicit name at call sites)."""
        return self.get_ports(workspace_id)

    def release_port(self, port_number: int) -> bool:
        if port_number in self._allocated:
            self._allocated.remove(port_number)
            self.ports = [p for p in self.ports if p.host_port != port_number]
            return True
        return False

    def release_workspace_ports(self, workspace_id: str) -> int:
        to_release = [p.host_port for p in self.get_workspace_ports(workspace_id)]
        for port in to_release:
            self.release_port(port)
        return len(to_release)

    def get_workspace_ports(self, workspace_id: str) -> list[Port]:
        return [p for p in self.ports if p.workspace_id == workspace_id]

    def get_workspace_port(
        self, workspace_id: str, role: PortRole
    ) -> Port | None:
        for p in self.get_workspace_ports(workspace_id):
            if p.role == role:
                return p
        return None

    def _generate_random_port(self) -> int:
        total_range = self.max_port - self.min_port + 1
        if len(self._allocated) >= total_range:
            raise RuntimeError("No available ports left in the specified range.")

        max_attempts = 200
        for _ in range(max_attempts):
            candidate = random.randint(self.min_port, self.max_port)
            if self.is_port_available(candidate):
                return candidate

        for candidate in range(self.min_port, self.max_port + 1):
            if self.is_port_available(candidate):
                return candidate

        raise RuntimeError("No available ports left in the specified range.")

    @staticmethod
    def _is_os_port_free(port: int) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
                return True
            except OSError:
                return False
