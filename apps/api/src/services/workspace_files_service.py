from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import posixpath
import tarfile
import time
from typing import Any, Optional
import zipfile

from src.ai_core.sandbox.client import get_sandbox_client
from src.ai_core.tools.docker_file_tools import (
    _read_file_from_container,
    _write_file_to_container,
)
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


def detect_language(path: Path | str) -> str:
    name_str = path.name if isinstance(path, Path) else posixpath.basename(path)
    name_lower = name_str.lower()
    if name_lower in EXTENSION_TO_LANGUAGE:
        return EXTENSION_TO_LANGUAGE[name_lower]
    ext = path.suffix.lower() if isinstance(path, Path) else posixpath.splitext(name_str)[1].lower()
    return EXTENSION_TO_LANGUAGE.get(ext, "plaintext")


class WorkspaceFilesError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


CONTAINER_TREE_SCRIPT = r"""
import os, sys, json
from datetime import datetime, timezone
from pathlib import Path

EXTENSION_TO_LANGUAGE = {
    ".ts": "typescript", ".tsx": "typescript", ".js": "javascript",
    ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".json": "json", ".css": "css", ".scss": "scss", ".less": "less",
    ".html": "html", ".htm": "html", ".md": "markdown", ".markdown": "markdown",
    ".py": "python", ".pyw": "python", ".sh": "shell", ".bash": "shell",
    ".zsh": "shell", ".yml": "yaml", ".yaml": "yaml", ".xml": "xml",
    ".svg": "xml", ".sql": "sql", ".env": "shell", ".gitignore": "shell",
    ".dockerignore": "shell", "dockerfile": "dockerfile",
}

IGNORED_DIRS = {
    ".git", "node_modules", "dist", "build", ".next",
    "__pycache__", ".turbo", ".venv", ".idea", ".vscode",
    ".pytest_cache", ".parcel-cache",
}

IGNORED_FILES = {".DS_Store", "Thumbs.db"}

def detect_lang(name, ext):
    if name.lower() in EXTENSION_TO_LANGUAGE:
        return EXTENSION_TO_LANGUAGE[name.lower()]
    return EXTENSION_TO_LANGUAGE.get(ext.lower(), "plaintext")

base_dir = Path("/app")

def build_nodes(current_dir):
    items = []
    try:
        entries = sorted(
            list(current_dir.iterdir()),
            key=lambda e: (not e.is_dir(), e.name.lower()),
        )
    except Exception:
        return []

    for entry in entries:
        if entry.name in IGNORED_FILES:
            continue
        rel_path = entry.relative_to(base_dir).as_posix()
        if entry.is_dir():
            if entry.name in IGNORED_DIRS:
                continue
            items.append({
                "id": rel_path,
                "name": entry.name,
                "path": rel_path,
                "type": "folder",
                "children": build_nodes(entry),
            })
        else:
            try:
                st = entry.stat()
                size = st.st_size
                updated_at = datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat()
            except Exception:
                size = 0
                updated_at = None
            items.append({
                "id": rel_path,
                "name": entry.name,
                "path": rel_path,
                "type": "file",
                "language": detect_lang(entry.name, entry.suffix),
                "size": size,
                "updatedAt": updated_at,
            })
    return items

print(json.dumps(build_nodes(base_dir)))
"""

CONTAINER_ZIP_SCRIPT = r"""
import os, zipfile, sys
from pathlib import Path

IGNORED_DIRS = {
    ".git", "node_modules", "dist", "build", ".next",
    "__pycache__", ".turbo", ".venv", ".idea", ".vscode",
    ".pytest_cache", ".parcel-cache", ".cache", "coverage", ".output", "out"
}
IGNORED_FILES = {".DS_Store", "Thumbs.db"}

base_dir = Path("/app")
out_path = "/tmp/workspace.zip"
with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS and not d.startswith(".")]
        root_p = Path(root)
        for f in sorted(files):
            if f in IGNORED_FILES:
                continue
            fp = root_p / f
            if fp.is_file():
                zf.write(fp, arcname=fp.relative_to(base_dir).as_posix())
print("OK")
"""


def _read_binary_from_container(container: Any, container_path: str) -> bytes:
    stream, _ = container.get_archive(container_path)
    tar_bytes = b"".join(stream)
    with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:*") as tar:
        members = [m for m in tar.getmembers() if not m.name.endswith("/")]
        if not members:
            raise FileNotFoundError(f"File '{container_path}' not found in container archive.")
        extracted = tar.extractfile(members[0])
        if extracted is None:
            raise FileNotFoundError(f"Could not extract file '{container_path}'.")
        return extracted.read()


class WorkspaceFilesService:
    def __init__(
        self,
        workspace_id: str,
        container_id: Optional[str] = None,
        workdir: str = "/app",
    ):
        self.workspace_id = workspace_id
        self.container_id = container_id
        self.workdir = workdir
        self.base_dir = (config.workspace_base / workspace_id).resolve()

    def _get_container(self) -> Any:
        if not self.container_id:
            return None
        client = get_sandbox_client()
        if not client:
            return None
        try:
            return client.containers.get(self.container_id)
        except Exception:
            return None

    def _resolve_safe_container_path(self, relative_path: str) -> str:
        """Resolve a path inside container and guarantee it does not escape workdir."""
        cleaned = relative_path.replace("\\", "/").strip()
        if posixpath.isabs(cleaned):
            norm = posixpath.normpath(cleaned)
        else:
            norm = posixpath.normpath(posixpath.join(self.workdir, cleaned))

        norm_workdir = posixpath.normpath(self.workdir).rstrip("/")
        if not (norm == norm_workdir or norm.startswith(norm_workdir + "/")):
            raise WorkspaceFilesError("Invalid path traversal", status_code=403)
        return norm

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
        container = self._get_container()
        if container is not None:
            res = container.exec_run(["python3", "-c", CONTAINER_TREE_SCRIPT], workdir=self.workdir)
            if res.exit_code == 0 and res.output:
                try:
                    return json.loads(res.output.decode("utf-8", errors="replace"))
                except Exception as e:
                    print(f"[WorkspaceFilesService] Failed to parse container tree: {e}")

        # Fallback to host base_dir if container is not available
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
        container = self._get_container()
        if container is not None:
            c_path = self._resolve_safe_container_path(relative_path)
            try:
                content = _read_file_from_container(container, c_path)
                rel_posix = posixpath.relpath(c_path, self.workdir)
                return {
                    "path": rel_posix,
                    "content": content,
                    "language": detect_language(c_path),
                    "size": len(content.encode("utf-8")),
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                }
            except FileNotFoundError:
                raise WorkspaceFilesError(f"File '{relative_path}' not found", status_code=404)
            except Exception as e:
                raise WorkspaceFilesError(f"Failed to read file: {e}", status_code=500)

        target = self._resolve_safe_path(relative_path)
        if not target.exists() or not target.is_file():
            raise WorkspaceFilesError(f"File '{relative_path}' not found", status_code=404)

        try:
            stat_res = target.stat()
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
        container = self._get_container()
        if container is not None:
            c_path = self._resolve_safe_container_path(relative_path)
            try:
                _write_file_to_container(container, c_path, content, workdir=self.workdir)
                rel_posix = posixpath.relpath(c_path, self.workdir)
                return {
                    "path": rel_posix,
                    "size": len(content.encode("utf-8")),
                    "updatedAt": datetime.now(timezone.utc).isoformat(),
                }
            except Exception as e:
                raise WorkspaceFilesError(f"Failed to save file: {e}", status_code=500)

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

    def create_item(
        self, relative_path: str, item_type: str = "file", content: str = ""
    ) -> dict[str, Any]:
        """Create a new file or directory."""
        container = self._get_container()
        if container is not None:
            c_path = self._resolve_safe_container_path(relative_path)
            rel_posix = posixpath.relpath(c_path, self.workdir)
            try:
                if item_type == "folder":
                    res = container.exec_run(["mkdir", "-p", c_path])
                    if res.exit_code != 0:
                        raise RuntimeError(f"mkdir failed: {res.output}")
                else:
                    _write_file_to_container(container, c_path, content, workdir=self.workdir)
                return {
                    "path": rel_posix,
                    "type": item_type,
                    "success": True,
                }
            except Exception as e:
                raise WorkspaceFilesError(f"Failed to create {item_type}: {e}", status_code=500)

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
        container = self._get_container()
        if container is not None:
            c_path = self._resolve_safe_container_path(relative_path)
            rel_posix = posixpath.relpath(c_path, self.workdir)
            try:
                res = container.exec_run(["rm", "-rf", c_path])
                if res.exit_code != 0:
                    raise RuntimeError(f"rm failed: {res.output}")
                return {
                    "path": rel_posix,
                    "deleted": True,
                }
            except Exception as e:
                raise WorkspaceFilesError(f"Failed to delete '{relative_path}': {e}", status_code=500)

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
        container = self._get_container()
        if container is not None:
            c_old = self._resolve_safe_container_path(old_path)
            c_new = self._resolve_safe_container_path(new_path)
            try:
                parent = posixpath.dirname(c_new)
                container.exec_run(["mkdir", "-p", parent])
                res = container.exec_run(["mv", c_old, c_new])
                if res.exit_code != 0:
                    raise RuntimeError(f"mv failed: {res.output}")
                return {
                    "old_path": old_path,
                    "new_path": posixpath.relpath(c_new, self.workdir),
                    "success": True,
                }
            except Exception as e:
                raise WorkspaceFilesError(f"Failed to rename '{old_path}': {e}", status_code=500)

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

    def create_zip_buffer(self) -> io.BytesIO:
        """Create an in-memory zip archive of the workspace excluding ignored directories and files."""
        container = self._get_container()
        if container is not None:
            try:
                res = container.exec_run(["python3", "-c", CONTAINER_ZIP_SCRIPT], workdir=self.workdir)
                if res.exit_code == 0:
                    raw_zip = _read_binary_from_container(container, "/tmp/workspace.zip")
                    container.exec_run(["rm", "-f", "/tmp/workspace.zip"])
                    return io.BytesIO(raw_zip)
            except Exception as e:
                print(f"[WorkspaceFilesService] In-container zip generation failed, falling back: {e}")

        if not self.base_dir.exists():
            raise WorkspaceFilesError("Workspace directory does not exist", status_code=404)

        ignored_zip_dirs = IGNORED_DIRS | {
            ".cache",
            "coverage",
            ".output",
            "out",
            ".svn",
            ".hg",
        }

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for root, dirs, files in os.walk(self.base_dir):
                dirs[:] = [d for d in dirs if d not in ignored_zip_dirs]

                root_path = Path(root)
                for file_name in sorted(files):
                    if file_name in IGNORED_FILES:
                        continue
                    file_path = root_path / file_name
                    if not file_path.is_file():
                        continue
                    arcname = file_path.relative_to(self.base_dir).as_posix()
                    try:
                        zip_file.write(file_path, arcname=arcname)
                    except Exception as e:
                        print(f"[WorkspaceFilesService] Skipping {file_path} in zip: {e}")
                        continue

        buffer.seek(0)
        return buffer
