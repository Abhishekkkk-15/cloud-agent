from datetime import datetime, timezone
import os
from pathlib import Path
from typing import Any

from src.utils.config import config

# Ignored directories and special files in file tree
IGNORED_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    ".next",
    "__pycache__",
    ".turbo",
    ".venv",
    ".idea",
    ".vscode",
    ".pytest_cache",
    ".parcel-cache",
}

IGNORED_FILES = {
    ".DS_Store",
    "Thumbs.db",
}

EXTENSION_TO_LANGUAGE: dict[str, str] = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".json": "json",
    ".css": "css",
    ".scss": "scss",
    ".less": "less",
    ".html": "html",
    ".htm": "html",
    ".md": "markdown",
    ".markdown": "markdown",
    ".py": "python",
    ".pyw": "python",
    ".sh": "shell",
    ".bash": "shell",
    ".zsh": "shell",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".xml": "xml",
    ".svg": "xml",
    ".sql": "sql",
    ".env": "shell",
    ".gitignore": "shell",
    ".dockerignore": "shell",
    "dockerfile": "dockerfile",
}


def detect_language(path: Path) -> str:
    name_lower = path.name.lower()
    if name_lower in EXTENSION_TO_LANGUAGE:
        return EXTENSION_TO_LANGUAGE[name_lower]
    ext = path.suffix.lower()
    return EXTENSION_TO_LANGUAGE.get(ext, "plaintext")


class WorkspaceFilesError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class WorkspaceFilesService:
    def __init__(self, workspace_id: str):
        self.workspace_id = workspace_id
        self.base_dir = (config.workspace_base / workspace_id).resolve()

    def _resolve_safe_path(self, relative_path: str) -> Path:
        """Resolve a path and guarantee it does not escape base_dir."""
        cleaned = relative_path.strip().lstrip("/\\")
        target = (self.base_dir / cleaned).resolve()
        try:
            target.relative_to(self.base_dir)
        except ValueError:
            raise WorkspaceFilesError("Invalid path traversal", status_code=403)
        return target

    def get_tree(self) -> list[dict[str, Any]]:
        """Return the complete hierarchical file tree of the workspace."""
        if not self.base_dir.exists():
            return []

        def build_nodes(current_dir: Path) -> list[dict[str, Any]]:
            items: list[dict[str, Any]] = []
            try:
                entries = sorted(
                    list(current_dir.iterdir()),
                    key=lambda e: (not e.is_dir(), e.name.lower()),
                )
            except (PermissionError, FileNotFoundError):
                return []

            for entry in entries:
                if entry.name in IGNORED_FILES:
                    continue

                rel_path = entry.relative_to(self.base_dir).as_posix()

                if entry.is_dir():
                    if entry.name in IGNORED_DIRS:
                        continue
                    children = build_nodes(entry)
                    items.append({
                        "id": rel_path,
                        "name": entry.name,
                        "path": rel_path,
                        "type": "folder",
                        "children": children,
                    })
                else:
                    try:
                        stat_res = entry.stat()
                        size = stat_res.st_size
                        updated_at = datetime.fromtimestamp(
                            stat_res.st_mtime, timezone.utc
                        ).isoformat()
                    except Exception:
                        size = 0
                        updated_at = None

                    items.append({
                        "id": rel_path,
                        "name": entry.name,
                        "path": rel_path,
                        "type": "file",
                        "language": detect_language(entry),
                        "size": size,
                        "updatedAt": updated_at,
                    })

            return items

        return build_nodes(self.base_dir)

    def get_content(self, relative_path: str) -> dict[str, Any]:
        """Fetch file content, language, and size."""
        target = self._resolve_safe_path(relative_path)
        if not target.exists() or not target.is_file():
            raise WorkspaceFilesError(f"File '{relative_path}' not found", status_code=404)

        try:
            stat_res = target.stat()
            # Try reading as UTF-8
            content = target.read_text(encoding="utf-8", errors="replace")
            updated_at = datetime.fromtimestamp(
                stat_res.st_mtime, timezone.utc
            ).isoformat()

            return {
                "path": target.relative_to(self.base_dir).as_posix(),
                "content": content,
                "language": detect_language(target),
                "size": stat_res.st_size,
                "updatedAt": updated_at,
            }
        except Exception as e:
            raise WorkspaceFilesError(f"Failed to read file: {e}", status_code=500)

    def save_content(self, relative_path: str, content: str) -> dict[str, Any]:
        """Directly overwrite file content."""
        target = self._resolve_safe_path(relative_path)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            stat_res = target.stat()
            return {
                "path": target.relative_to(self.base_dir).as_posix(),
                "size": stat_res.st_size,
                "updatedAt": datetime.fromtimestamp(
                    stat_res.st_mtime, timezone.utc
                ).isoformat(),
            }
        except Exception as e:
            raise WorkspaceFilesError(f"Failed to save file: {e}", status_code=500)

    def create_item(self, relative_path: str, item_type: str = "file", content: str = "") -> dict[str, Any]:
        """Create a new file or directory."""
        target = self._resolve_safe_path(relative_path)
        if target.exists():
            raise WorkspaceFilesError(f"Path '{relative_path}' already exists", status_code=409)

        try:
            if item_type == "folder":
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")

            return {
                "path": target.relative_to(self.base_dir).as_posix(),
                "type": item_type,
                "success": True,
            }
        except Exception as e:
            raise WorkspaceFilesError(f"Failed to create {item_type}: {e}", status_code=500)

    def delete_item(self, relative_path: str) -> dict[str, Any]:
        """Delete a file or directory safely."""
        target = self._resolve_safe_path(relative_path)
        if not target.exists():
            raise WorkspaceFilesError(f"Path '{relative_path}' not found", status_code=404)

        try:
            if target.is_dir():
                import shutil
                shutil.rmtree(target)
            else:
                target.unlink()

            return {
                "path": relative_path,
                "deleted": True,
            }
        except Exception as e:
            raise WorkspaceFilesError(f"Failed to delete '{relative_path}': {e}", status_code=500)

    def rename_item(self, old_path: str, new_path: str) -> dict[str, Any]:
        """Rename or move a file or directory."""
        src = self._resolve_safe_path(old_path)
        dst = self._resolve_safe_path(new_path)

        if not src.exists():
            raise WorkspaceFilesError(f"Source path '{old_path}' not found", status_code=404)
        if dst.exists():
            raise WorkspaceFilesError(f"Destination path '{new_path}' already exists", status_code=409)

        try:
            dst.parent.mkdir(parents=True, exist_ok=True)
            src.rename(dst)
            return {
                "old_path": old_path,
                "new_path": dst.relative_to(self.base_dir).as_posix(),
                "success": True,
            }
        except Exception as e:
            raise WorkspaceFilesError(f"Failed to rename '{old_path}': {e}", status_code=500)
