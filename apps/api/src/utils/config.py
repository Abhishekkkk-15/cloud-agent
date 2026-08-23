from dotenv import load_dotenv
import os
load_dotenv()

                

class Config:
    def __init__(self) -> None:
        API_KEY = os.getenv("API_KEY")
        PROVIDER = os.getenv("PROVIDER")
        MODEL = os.getenv("MODEL")
        AUTONOMOUS =  True if os.getenv("AUTONOMOUS") else False
        if not API_KEY:
            raise(RuntimeError(f"API_KEY is not set"))
        if not PROVIDER:
            raise(RuntimeError(f"PROVIDER is not set"))
        if not MODEL:
            raise(RuntimeError(f"MODEL is not set"))
        if not AUTONOMOUS:
            raise(RuntimeError(f"AUTONOMOUS is not set"))
        self.base_url = os.getenv("BASE_URL")
        self.api_key:str = API_KEY
        self.provider:str = PROVIDER
        self.model:str = MODEL
        self.autonomous:bool = AUTONOMOUS