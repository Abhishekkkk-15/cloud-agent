from dotenv import load_dotenv
import os
load_dotenv()

                

class Config:
    def __init__(self) -> None:
        API_KEY = os.getenv("API_KEY")
        PROVIDER = os.getenv("PROVIDER")
        MODEL = os.getenv("MODEL")
        DATABASE_URI = os.getenv("DATABASE_URI")
        DATABASE_NAME = os.getenv("DATABASE_NAME")
        SANDBOX_TARGET = os.getenv("SANDBOX_TARGET") or "/app"
        SANDBOX_MOUNT = os.getenv("SANDBOX_MOUNT")
        AUTONOMOUS =  True if os.getenv("AUTONOMOUS") else False
        if not API_KEY:
            raise(RuntimeError(f"API_KEY is not set"))
        if not PROVIDER:
            raise(RuntimeError(f"PROVIDER is not set"))
        if not MODEL:
            raise(RuntimeError(f"MODEL is not set"))
        if not AUTONOMOUS:
            raise(RuntimeError(f"AUTONOMOUS is not set"))
        if not DATABASE_NAME:
            raise(RuntimeError(f"DATABASE_NAME is not set"))
        if not DATABASE_URI:
            raise(RuntimeError(f"DATABASE_URI is not set"))
        if not SANDBOX_MOUNT:
            raise(RuntimeError(f"SANDBOX_MOUNT is not set"))
        self.base_url = os.getenv("BASE_URL")
        self.api_key:str = API_KEY
        self.provider:str = PROVIDER
        self.model:str = MODEL
        self.autonomous:bool = AUTONOMOUS
        self.database_uri = DATABASE_URI
        self.database_name = DATABASE_NAME
        self.sandbox_target = SANDBOX_TARGET
        self.sandbox_mount = SANDBOX_MOUNT
        self.google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        self.google_client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
        self.jwt_secret = os.getenv("JWT_SECRET") or "dev-insecure-change-me"