import asyncio

from pymongo import AsyncMongoClient
import logging
from contextlib import asynccontextmanager
from pymongo.errors import (
    ConnectionFailure, 
    ServerSelectionTimeoutError, 
    ConfigurationError,
)
from fastapi import FastAPI, Depends, HTTPException, status
from typing import AsyncGenerator
from dotenv import load_dotenv
import os
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

_client: AsyncMongoClient | None = None
db_client = None 

async def get_database_client(uri: str, name: str, timeout_ms: int = 10000):
    try:
        client_instance = AsyncMongoClient(
            uri,
            serverSelectionTimeoutMS=timeout_ms,
            socketTimeoutMS=5000,
            connectTimeoutMS=5000,
        )

        # `serverSelectionTimeoutMS` covers server selection, but some network/DNS/TLS
        # failures can still take a long time. Put a hard cap around the ping.
        await asyncio.wait_for(
            client_instance.admin.command("ping"),
            timeout=max(0.001, timeout_ms / 1000),
        )
        logger.info("Successfully connected and pinged MongoDB!")

        specific_db = client_instance[name] 
        return client_instance, specific_db
        
    except ServerSelectionTimeoutError as e:
        logger.error(f"Connection timed out. The server at '{uri}' might be down or blocked by a firewall. Details: {e}")
        raise
    except ConnectionFailure as e:
        logger.error(f"Database connection failed network-level handshake. Details: {e}")
        raise
    except ConfigurationError as e:
        logger.error(f"MongoDB URI configuration string is malformed or invalid. Details: {e}")
        raise
    except Exception as e:
        logger.critical(f"An unexpected error occurred during database initialization: {e}")
        raise

@asynccontextmanager
async def db_lifespan(app: FastAPI):
    global _client, db_client
    
    
    DATABASE_URI = os.getenv("DATABASE_URI")
    DATABASE_NAME = os.getenv("DATABASE_NAME")
    
    
    # If Mongo is down, we still want the app to start so basic endpoints (like health)
    # work. Database-dependent endpoints can fail later.
    ping_timeout_ms = int(os.getenv("MONGODB_PING_TIMEOUT_MS", "3000"))

    try:
        if not DATABASE_NAME or not DATABASE_URI:
            raise(RuntimeError("DATABASE env is not set"))
        
        _client, db_client = await get_database_client(
            uri=DATABASE_URI, name=DATABASE_NAME, timeout_ms=ping_timeout_ms
        )
    except Exception as e:
        logger.error(
            "MongoDB is unreachable during startup. Continuing without DB. Error: %s",
            e,
        )
        _client = None
        db_client = None
        
    yield # -------------------------------------------------------------------
    # FastAPI Shutdown Process triggered here:
    
    if _client:
        await _client.close()
        logger.info("MongoDB cluster connection pools terminated successfully.")




async def get_db() -> AsyncGenerator:
    if db_client is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database system is uninitialized."
        )
    yield db_client