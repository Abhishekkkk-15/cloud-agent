import logging
from pathlib import Path
import shutil

from src.utils.config import config

logger = logging.getLogger(__name__)

TEMPLATE_DIR = (
    Path(__file__).resolve().parent.parent
    / "ai_core"
    / "sandbox"
    / "sandbox"
    / "template"
)


def ensure_workspace_template(workspace_id: str) -> Path:
    """Pre-seed workspace directory on host with project template files.

    This ensures that /app on the container has package.json, server, src, etc.
    immediately upon mounting, avoiding slow cross-mount copying during container boot.
    """
    workspace_root = config.workspace_base / workspace_id
    workspace_root.mkdir(parents=True, exist_ok=True)

    package_json = workspace_root / "package.json"
    if not package_json.exists() and TEMPLATE_DIR.exists():
        logger.info(
            "Seeding workspace template for %s from %s",
            workspace_id,
            TEMPLATE_DIR,
        )
        for item in TEMPLATE_DIR.iterdir():
            if item.name == "node_modules":
                continue
            dest = workspace_root / item.name
            if not dest.exists():
                try:
                    if item.is_dir():
                        shutil.copytree(item, dest)
                    else:
                        shutil.copy2(item, dest)
                except Exception as e:
                    logger.warning("Failed copying %s to %s: %s", item.name, dest, e)

    return workspace_root
