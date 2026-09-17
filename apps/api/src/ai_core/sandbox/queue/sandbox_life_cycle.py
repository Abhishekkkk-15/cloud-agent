from rq import Queue
from src.dependency.sandbox_dependency import get_sandbox_manager
from src.repository.workspace_repository import create_workspace_repo
from src.utils.db_client import get_db
from pathlib import Path
from src.utils.redis import redis_client
from enum import Enum
import shutil
from datetime import timedelta
sandbox = get_sandbox_manager()

class QUEUE(Enum):
    STOP_QUEUE = "stop_sandbox_queue"
    DELETE_QUEUE = "delete_sandbox_queue"
    
stop_sandbox_queue = Queue(str(QUEUE.STOP_QUEUE),connection=redis_client)
delete_sandbox_queue = Queue(str(QUEUE.DELETE_QUEUE),connection=redis_client)



async def stop_sandbox_worker(workspace_id:str,version:int):
    try:
        ws_repo = create_workspace_repo(get_db)
        ws = await ws_repo.find_by_id(workspace_id)
        if not ws:
            raise Exception(f"workspace for sandbox_id {workspace_id} not found")
        current_version = ws.version
        if not ws.sandbox_id:
            raise Exception("Sandbox id not found")
        if  current_version and current_version != version:
            return
        sandbox.stop_sandbox(ws.sandbox_id)
    except Exception as e:    
        print(e)
        
async def delete_sandbox_worker(workspace_id:str,version:int):
    try:
        ws_repo = create_workspace_repo(get_db)
        ws = await ws_repo.find_by_id(workspace_id)
        if not ws:
            raise Exception(f"workspace {workspace_id} not found")
        current_version = ws.version
        if not ws.sandbox_id:
            raise Exception("Sandbox id not found")
        if  current_version and current_version != version:
            return
        sandbox.delete_sandbox(ws.sandbox_id)
        shutil.rmtree(ws.source_path)
    except FileNotFoundError:
        print("The folder does not exist.")
    except PermissionError:
        print("Error: You do not have permission to delete this folder.")    
    except Exception as e:    
        print(e)
        

async def container_lifecycle_manager(ws_id:str,version:int):
    stop_job = stop_sandbox_queue.enqueue_in(timedelta(minutes=10),stop_sandbox_worker,ws_id,version)
    delete_job = delete_sandbox_queue.enqueue_in(timedelta(minutes=10),delete_sandbox_worker,ws_id,version)
    return stop_job,delete_job
    
            
    