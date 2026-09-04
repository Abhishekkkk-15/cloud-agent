import random
from typing import Optional, Set
from pydantic import BaseModel, Field


class Port(BaseModel):
    port: int
    workspace_id: str


class PortManager(BaseModel):
    ports: list[Port] = Field(default_factory=list)
    min_port: int = 1024
    max_port: int = 65535
    
    _allocated_ports: Set[int] = set()

    def model_post_init(self, __context):
        self._allocated_ports = {p.port for p in self.ports}

    def is_port_available(self, port: int) -> bool:
        return port not in self._allocated_ports

    def allocate_port(self, workspace_id: str, requested_port: Optional[int] = None) -> Port:
        if requested_port is not None:
            if not (self.min_port <= requested_port <= self.max_port):
                raise ValueError(f"Port {requested_port} is out of valid range ({self.min_port}-{self.max_port})")
            if not self.is_port_available(requested_port):
                raise RuntimeError(f"Port {requested_port} is already in use.")
            port_number = requested_port
        else:
            port_number = self._generate_random_port()

        new_port = Port(port=port_number, workspace_id=workspace_id)
        self.ports.append(new_port)
        self._allocated_ports.add(port_number)
        return new_port

    def release_port(self, port_number: int) -> bool:
        if port_number in self._allocated_ports:
            self._allocated_ports.remove(port_number)
            self.ports = [p for p in self.ports if p.port != port_number]
            return True
        return False

    def get_workspace_ports(self, workspace_id: str) -> list[Port]:
        return [p for p in self.ports if p.workspace_id == workspace_id]

    def _generate_random_port(self) -> int:
        total_range = self.max_port - self.min_port + 1
        if len(self._allocated_ports) >= total_range:
            raise RuntimeError("No available ports left in the specified range.")

        max_attempts = 100
        for _ in range(max_attempts):
            candidate = random.randint(self.min_port, self.max_port)
            if candidate not in self._allocated_ports:
                return candidate

        available_ports = set(range(self.min_port, self.max_port + 1)) - self._allocated_ports
        return random.choice(list(available_ports))
    
    