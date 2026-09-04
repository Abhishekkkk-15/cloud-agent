from src.utils.port_manager import PortManager
from typing import Annotated, Any
from fastapi import Depends

_gloabl_port_manage = PortManager()

def get_portmanager():
    return _gloabl_port_manage

PortRepo = Annotated[PortManager,Depends(get_portmanager)]