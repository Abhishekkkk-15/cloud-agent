"""Container-native file tools (read, write, edit, grep) for Cloud Agent.

All operations execute directly inside the workspace Docker container via Docker
Archive and Exec APIs, guaranteeing that untrusted project files, scripts, and
edits are completely isolated from the host filesystem.
"""

from __future__ import annotations

import asyncio
import io
import os
import posixpath
import tarfile
import time
from typing import Any, Dict, List, Optional

from docker import DockerClient
from docker.errors import APIError, NotFound
from pi_sdk import ToolSpec

from src.ai_core.sandbox.client import get_sandbox_client

DEFAULT_MAX_BYTES = 30720  # 30 KB truncation limit matching pi_sdk
DEFAULT_MAX_LINES = 200
DEFAULT_READ_LIMIT = 100

LOCKFILE_NAMES = ("package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb")


def _resolve_container_path(path: str, workdir: str = "/app") -> str:
    """Normalize path inside container and prevent directory traversal."""
    cleaned = path.replace("\\", "/").strip()
    if posixpath.isabs(cleaned):
        norm = posixpath.normpath(cleaned)
    else:
        norm = posixpath.normpath(posixpath.join(workdir, cleaned))

    norm_workdir = posixpath.normpath(workdir).rstrip("/")
    if not (norm == norm_workdir or norm.startswith(norm_workdir + "/")):
        raise ValueError(
            f"Path traversal detected: '{path}' escapes container workdir '{workdir}'"
        )
    return norm


def _read_file_from_container(container: Any, container_path: str) -> str:
    """Read full file contents from container via Docker Archive API."""
    try:
        stream, stat_info = container.get_archive(container_path)
    except NotFound:
        raise FileNotFoundError(f"File '{container_path}' does not exist.")
    except Exception as e:
        raise RuntimeError(f"Error accessing '{container_path}': {e}")

    tar_bytes = b"".join(stream)
    with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:*") as tar:
        members = [m for m in tar.getmembers() if not m.name.endswith("/")]
        if not members:
            raise FileNotFoundError(f"File '{container_path}' not found in container archive.")
        member = members[0]
        if member.isdir():
            raise IsADirectoryError(f"'{container_path}' is a directory, not a file.")
        extracted = tar.extractfile(member)
        if extracted is None:
            raise FileNotFoundError(f"Could not extract file '{container_path}'.")
        raw = extracted.read()

    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        raise ValueError(
            f"File '{container_path}' appears to be binary and not decodable as UTF-8 text."
        )


def _write_file_to_container(
    container: Any,
    container_path: str,
    content: str,
    workdir: str = "/app",
) -> tuple[bool, int, int]:
    """Write file to container via Docker Archive API, creating parent directories in tar."""
    existed = False
    try:
        container.get_archive(container_path)
        existed = True
    except Exception:
        existed = False

    rel_path = posixpath.relpath(container_path, workdir)
    parts = rel_path.split("/")
    dirs_to_create = []
    for i in range(1, len(parts)):
        dirs_to_create.append("/".join(parts[:i]))

    tar_stream = io.BytesIO()
    encoded = (content or "").encode("utf-8")
    now = int(time.time())

    with tarfile.open(fileobj=tar_stream, mode="w") as tar:
        for d in dirs_to_create:
            d_info = tarfile.TarInfo(name=d)
            d_info.type = tarfile.DIRTYPE
            d_info.mode = 0o755
            d_info.mtime = now
            tar.addfile(d_info)

        f_info = tarfile.TarInfo(name=rel_path)
        f_info.type = tarfile.REGTYPE
        f_info.mode = 0o644
        f_info.size = len(encoded)
        f_info.mtime = now
        tar.addfile(f_info, io.BytesIO(encoded))

    tar_stream.seek(0)
    container.put_archive(workdir, tar_stream)

    lines = len((content or "").splitlines()) if content else 0
    return existed, lines, len(encoded)


GREP_CONTAINER_SCRIPT = r"""
import sys, os, re, fnmatch

if len(sys.argv) < 6:
    sys.exit(1)

pattern = sys.argv[1]
target_path = sys.argv[2]
glob_filter = sys.argv[3]
case_insensitive = sys.argv[4].lower() in ("true", "1", "yes")
try:
    max_results = max(1, min(int(sys.argv[5]), 200))
except Exception:
    max_results = 50

flags = re.IGNORECASE if case_insensitive else 0
try:
    regex = re.compile(pattern, flags)
except re.error as e:
    sys.stderr.write(f"Error: invalid regex pattern: {e}\n")
    sys.exit(1)

workdir = "/app"
full_path = os.path.normpath(os.path.join(workdir, target_path)) if not os.path.isabs(target_path) else os.path.normpath(target_path)
if not (full_path == workdir or full_path.startswith(workdir.rstrip("/") + "/")):
    sys.stderr.write(f"Error: path '{target_path}' escapes workspace directory.\n")
    sys.exit(1)

if not os.path.exists(full_path):
    sys.stderr.write(f"Error: path '{target_path}' does not exist.\n")
    sys.exit(1)

SKIP_DIRS = {'.git', 'node_modules', 'dist', 'build', '.next', '__pycache__', '.venv', 'venv', '.turbo'}
SKIP_SUFFIXES = {'.pyc', '.pyo', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.woff', '.woff2', '.ttf', '.eot', '.so', '.dylib', '.exe'}

matches = []
files_searched = 0
truncated = False

def iter_files(root):
    if os.path.isfile(root):
        yield root
        return
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.')]
        for f in filenames:
            yield os.path.join(dirpath, f)

for fpath in iter_files(full_path):
    if truncated:
        break
    ext = os.path.splitext(fpath)[1].lower()
    if ext in SKIP_SUFFIXES:
        continue
    rel_from_workdir = os.path.relpath(fpath, workdir)
    if glob_filter:
        fname = os.path.basename(fpath)
        if not fnmatch.fnmatch(fname, glob_filter) and not fnmatch.fnmatch(rel_from_workdir, glob_filter):
            continue

    files_searched += 1
    try:
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            for line_no, line in enumerate(f, 1):
                if regex.search(line):
                    clean_rel = rel_from_workdir.replace("\\", "/")
                    matches.append(f"{clean_rel}:{line_no}:{line.rstrip()}")
                    if len(matches) >= max_results:
                        truncated = True
                        break
    except Exception:
        continue

if not matches:
    scope = f" in '{target_path}'" if target_path and target_path != "." else ""
    g = f" (glob={glob_filter})" if glob_filter else ""
    print(f"No matches for /{pattern}/{scope}{g}. Searched {files_searched} file(s).")
    sys.exit(0)

header = f"Found {len(matches)} match(es) in {files_searched} file(s)"
if truncated:
    header += f" (truncated at {max_results})"
print(header + ":\n" + "\n".join(matches))
"""


def build_docker_file_tools(
    container_id: str,
    workdir: str = "/app",
) -> list[ToolSpec]:
    """Build isolated container-native read, write, edit, and grep tools."""

    def _get_client_and_container() -> Any:
        client = get_sandbox_client()
        if client is None:
            raise RuntimeError("Docker client is not available")
        return client.containers.get(container_id)

    # 1. read tool
    async def read_handler(
        path: str,
        offset: Optional[int] = None,
        limit: Optional[int] = None,
        **_: object,
    ) -> str:
        def _do_read() -> str:
            try:
                c_path = _resolve_container_path(path, workdir=workdir)
            except ValueError as e:
                return f"Error: {e}"

            filename = posixpath.basename(c_path).lower()
            if (
                filename in LOCKFILE_NAMES
                and (offset is None or offset <= 1)
                and (limit is None or limit > 30)
            ):
                return (
                    f"Notice: '{filename}' is an automated package lockfile. "
                    "To prevent context overflow and preserve token efficiency, "
                    "inspect 'package.json' for dependency declarations instead."
                )

            try:
                container = _get_client_and_container()
                content = _read_file_from_container(container, c_path)
            except FileNotFoundError:
                return f"Error: File '{path}' does not exist."
            except IsADirectoryError:
                return f"Error: '{path}' is a directory, not a file."
            except ValueError as e:
                return f"Error: {e}"
            except Exception as e:
                return f"Error reading file '{path}': {e}"

            all_lines = content.splitlines()
            total_lines = len(all_lines)
            start_line = max(0, (offset - 1) if offset else 0)
            if start_line >= total_lines and total_lines > 0:
                return f"Error: Offset {offset} is beyond end of file ({total_lines} lines total)"

            effective_limit = (
                min(limit, DEFAULT_MAX_LINES)
                if limit is not None
                else DEFAULT_READ_LIMIT
            )
            end_line = min(start_line + effective_limit, total_lines)
            selected_lines = all_lines[start_line:end_line]

            truncated_lines = []
            bytes_accumulated = 0
            truncated = False

            for idx, line in enumerate(selected_lines):
                formatted_line = f"{start_line + idx + 1}: {line}"
                line_bytes = len(formatted_line.encode("utf-8")) + 1

                if bytes_accumulated + line_bytes > DEFAULT_MAX_BYTES:
                    truncated = True
                    break

                truncated_lines.append(formatted_line)
                bytes_accumulated += line_bytes

            output_text = "\n".join(truncated_lines)
            output_lines_count = len(truncated_lines)
            end_line_display = start_line + output_lines_count

            if truncated:
                next_offset = end_line_display + 1
                output_text += (
                    f"\n\n[Truncated: showing {output_lines_count} lines "
                    f"({start_line + 1}-{end_line_display}) of {total_lines} "
                    f"({DEFAULT_MAX_BYTES // 1024}KB limit). Use offset={next_offset} to continue.]"
                )
            elif end_line_display < total_lines:
                next_offset = end_line_display + 1
                output_text += (
                    f"\n\n[Showing {output_lines_count} lines "
                    f"({start_line + 1}-{end_line_display}) of {total_lines}. "
                    f"Use offset={next_offset} to continue, or grep to locate specific code.]"
                )

            return output_text

        return await asyncio.to_thread(_do_read)

    read_tool = ToolSpec(
        name="read",
        description=(
            "Read file contents at the given path inside the container workspace. "
            "Supports offset and limit (default: 100 lines, max: 200). "
            "Always use targeted line ranges or grep to locate code efficiently."
        ),
        parameters={
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Relative or absolute file path to read.",
                },
                "offset": {
                    "type": "integer",
                    "description": "Line number to start reading from (1-indexed, optional, default: 1).",
                },
                "limit": {
                    "type": "integer",
                    "description": (
                        "Maximum number of lines to read (optional, default: 100, max: 200). "
                        "Prefer small ranges (20-60 lines) for surgical inspection."
                    ),
                },
            },
            "required": ["path"],
        },
        handler=read_handler,
        require_permission=False,
    )

    # 2. write tool
    async def write_handler(
        path: str,
        content: str,
        **_: object,
    ) -> str:
        def _do_write() -> str:
            try:
                c_path = _resolve_container_path(path, workdir=workdir)
                container = _get_client_and_container()
                existed, lines, nbytes = _write_file_to_container(
                    container, c_path, content, workdir=workdir
                )
                action = "Overwrote" if existed else "Created"
                return f"{action} '{path}' - {lines} lines, {nbytes} bytes."
            except ValueError as e:
                return f"Error: {e}"
            except Exception as e:
                return f"Error writing file '{path}': {e}"

        return await asyncio.to_thread(_do_write)

    write_tool = ToolSpec(
        name="write",
        description="Create a new file or completely overwrite an existing file inside the sandbox container.",
        parameters={
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to write to.",
                },
                "content": {
                    "type": "string",
                    "description": "Complete text content to write into the file.",
                },
            },
            "required": ["path", "content"],
        },
        handler=write_handler,
        require_permission=True,
        permission_arg="path",
    )

    # 3. edit tool
    async def edit_handler(
        path: str,
        edits: List[Dict[str, str]],
        **_: object,
    ) -> str:
        def _do_edit() -> str:
            try:
                c_path = _resolve_container_path(path, workdir=workdir)
                container = _get_client_and_container()
                content = _read_file_from_container(container, c_path)
            except FileNotFoundError:
                return f"Error: File '{path}' does not exist."
            except Exception as e:
                return f"Error editing file '{path}': {e}"

            normalized_content = content.replace("\r\n", "\n")
            matches = []

            for i, edit in enumerate(edits):
                old_text = (edit.get("oldText", "") or "").replace("\r\n", "\n")
                new_text = (edit.get("newText", "") or "").replace("\r\n", "\n")

                if not old_text:
                    return f"Error in edit {i + 1}: 'oldText' cannot be empty."

                occurrences = normalized_content.count(old_text)
                if occurrences == 0:
                    return (
                        f"Error in edit entry {i + 1}: Could not find exact match for 'oldText'.\n"
                        f"Target text was:\n{old_text}"
                    )
                if occurrences > 1:
                    return (
                        f"Error in edit entry {i + 1}: 'oldText' matched {occurrences} locations. "
                        "Provide more surrounding context to make it unique."
                    )

                start_idx = normalized_content.index(old_text)
                end_idx = start_idx + len(old_text)
                matches.append({
                    "index": i,
                    "start": start_idx,
                    "end": end_idx,
                    "new_text": new_text,
                    "old_text": old_text,
                })

            # Check for overlapping edit regions
            matches.sort(key=lambda m: m["start"])
            for i in range(1, len(matches)):
                prev = matches[i - 1]
                curr = matches[i]
                if prev["end"] > curr["start"]:
                    return (
                        f"Error: Edits {prev['index'] + 1} and {curr['index'] + 1} overlap in '{path}'. "
                        "Merge them into a single replacement block."
                    )

            # Apply edits in reverse order
            new_content = normalized_content
            for m in reversed(matches):
                new_content = (
                    new_content[: m["start"]] + m["new_text"] + new_content[m["end"] :]
                )

            # Restore CRLF if original file had CRLF
            if "\r\n" in content:
                new_content = new_content.replace("\n", "\r\n")

            try:
                _write_file_to_container(
                    container, c_path, new_content, workdir=workdir
                )
                return f"Applied {len(edits)} edit(s) to '{path}' successfully."
            except Exception as e:
                return f"Error writing edits to '{path}': {e}"

        return await asyncio.to_thread(_do_edit)

    edit_tool = ToolSpec(
        name="edit",
        description="Make precise, surgical changes to a file inside the sandbox container by providing exact original text blocks to replace.",
        parameters={
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to edit.",
                },
                "edits": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "oldText": {
                                "type": "string",
                                "description": "Exact text block from the file to be replaced.",
                            },
                            "newText": {
                                "type": "string",
                                "description": "New text to replace oldText with.",
                            },
                        },
                        "required": ["oldText", "newText"],
                    },
                    "description": "List of precise edits to perform.",
                },
            },
            "required": ["path", "edits"],
        },
        handler=edit_handler,
        require_permission=True,
        permission_arg="path",
    )

    # 4. grep tool
    async def grep_handler(
        pattern: str,
        path: str = ".",
        glob: str = "",
        case_insensitive: bool = False,
        max_results: int = 50,
        **_: object,
    ) -> str:
        def _do_grep() -> str:
            if not pattern:
                return "Error: pattern is required."

            try:
                container = _get_client_and_container()
                cmd = [
                    "python3",
                    "-c",
                    GREP_CONTAINER_SCRIPT,
                    pattern,
                    path or ".",
                    glob or "",
                    str(case_insensitive),
                    str(max_results or 50),
                ]
                res = container.exec_run(cmd, workdir=workdir)
                out = (
                    res.output.decode("utf-8", errors="replace").strip()
                    if res.output
                    else ""
                )
                if res.exit_code != 0 and not out:
                    return f"Error executing grep in container (exit code {res.exit_code})"
                return out or f"No matches for /{pattern}/ in '{path}'."
            except Exception as e:
                return f"Error executing grep: {e}"

        return await asyncio.to_thread(_do_grep)

    grep_tool = ToolSpec(
        name="grep",
        description="Search the container workspace for a text/regex pattern across files. Fast, token-efficient code discovery.",
        parameters={
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Regex or plain text pattern to search for.",
                },
                "path": {
                    "type": "string",
                    "description": "File or directory to search (default: current workspace).",
                },
                "glob": {
                    "type": "string",
                    "description": "Optional filename glob filter, e.g. '*.py' or '*.ts'.",
                },
                "case_insensitive": {
                    "type": "boolean",
                    "description": "Case-insensitive search (default: false).",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum matches to return (default: 50, max: 200).",
                },
            },
            "required": ["pattern"],
        },
        handler=grep_handler,
        require_permission=False,
    )

    return [read_tool, write_tool, edit_tool, grep_tool]
