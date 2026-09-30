import asyncio
import io
import json
import subprocess
import tarfile
import unittest
from unittest.mock import MagicMock, patch

from src.models.user_model import User
from src.models.workspace_model import Workspace
from src.services.workspace_files_service import (
    WorkspaceFilesService,
    WorkspaceFilesError,
)
from src.services.workspace_git import (
    WorkspaceGitService,
    WorkspaceGitError,
)
from src.utils.workspace_utils import prepare_workspace


class TestContainerNativeSandbox(unittest.TestCase):
    def test_workspace_files_service_container_get_tree(self):
        container = MagicMock()
        mock_tree = [
            {
                "id": "src/index.ts",
                "name": "index.ts",
                "path": "src/index.ts",
                "type": "file",
                "language": "typescript",
                "size": 100,
                "updatedAt": "2026-09-30T00:00:00Z",
            }
        ]
        exec_res = MagicMock()
        exec_res.exit_code = 0
        exec_res.output = json.dumps(mock_tree).encode("utf-8")
        container.exec_run.return_value = exec_res

        with patch("src.services.workspace_files_service.get_sandbox_client") as mock_client_getter:
            mock_client = MagicMock()
            mock_client.containers.get.return_value = container
            mock_client_getter.return_value = mock_client

            service = WorkspaceFilesService(
                workspace_id="test_ws",
                container_id="test_container",
                workdir="/app",
            )

            tree = service.get_tree()
            self.assertEqual(len(tree), 1)
            self.assertEqual(tree[0]["name"], "index.ts")
            self.assertEqual(tree[0]["language"], "typescript")

    def test_workspace_files_service_container_read_and_save(self):
        container = MagicMock()
        file_content = "export const PI = 3.14159;\n"

        # Mock get_archive returning tar
        stream_tar = io.BytesIO()
        with tarfile.open(fileobj=stream_tar, mode="w") as tar:
            raw = file_content.encode("utf-8")
            info = tarfile.TarInfo(name="constants.ts")
            info.size = len(raw)
            info.type = tarfile.REGTYPE
            tar.addfile(info, io.BytesIO(raw))
        stream_tar.seek(0)
        container.get_archive.return_value = ([stream_tar.read()], {})

        saved_bytes = bytearray()
        def mock_put_archive(path, fileobj):
            nonlocal saved_bytes
            saved_bytes = bytearray(fileobj.read())
        container.put_archive = mock_put_archive

        with patch("src.services.workspace_files_service.get_sandbox_client") as mock_client_getter:
            mock_client = MagicMock()
            mock_client.containers.get.return_value = container
            mock_client_getter.return_value = mock_client

            service = WorkspaceFilesService(
                workspace_id="test_ws",
                container_id="test_container",
                workdir="/app",
            )

            # 1. Read
            res = service.get_content("src/constants.ts")
            self.assertEqual(res["content"], file_content)
            self.assertEqual(res["language"], "typescript")

            # 2. Save
            new_content = "export const PI = 3.14;\n"
            save_res = service.save_content("src/constants.ts", new_content)
            self.assertEqual(save_res["path"], "src/constants.ts")
            self.assertEqual(save_res["size"], len(new_content.encode("utf-8")))

            # Verify saved tar
            with tarfile.open(fileobj=io.BytesIO(saved_bytes), mode="r:*") as tar:
                f = tar.extractfile(tar.getmember("src/constants.ts"))
                self.assertEqual(f.read().decode("utf-8"), new_content)

    def test_workspace_files_path_traversal_blocked(self):
        service = WorkspaceFilesService(
            workspace_id="test_ws",
            container_id="test_container",
            workdir="/app",
        )
        with self.assertRaises(WorkspaceFilesError):
            service._resolve_safe_container_path("../etc/passwd")

        with self.assertRaises(WorkspaceFilesError):
            service._resolve_safe_container_path("/etc/shadow")

    def test_workspace_git_service_container_execution(self):
        container = MagicMock()
        exec_res = MagicMock()
        exec_res.exit_code = 0
        exec_res.output = (b"## main\nM src/App.tsx\n", b"")
        container.exec_run.return_value = exec_res

        with patch("src.services.workspace_git.get_sandbox_client") as mock_client_getter:
            mock_client = MagicMock()
            mock_client.containers.get.return_value = container
            mock_client_getter.return_value = mock_client

            git = WorkspaceGitService(
                container_id="test_container",
                workdir="/app",
            )

            res = git._run(["status", "--short", "--branch"])
            self.assertEqual(res.returncode, 0)
            self.assertIn("M src/App.tsx", res.stdout)

            # Verify command ran inside container with /app
            container.exec_run.assert_called_once()
            call_args = container.exec_run.call_args
            cmd = call_args[0][0]
            self.assertIn("git", cmd)
            self.assertIn("-C", cmd)
            self.assertIn("/app", cmd)
            self.assertEqual(call_args[1]["workdir"], "/app")

    def test_prepare_workspace_container_mode(self):
        user = User(
            id="user_123",
            email="user@example.com",
            name="Test User",
            username="testuser",
        )
        workspace = Workspace(
            id="ws_123",
            user_id="user_123",
            title="My Workspace",
            target_path="/app",
            source_path="/app",
            workspace_origin="template",
        )

        with patch("src.services.workspace_git.WorkspaceGitService.init") as mock_init, \
             patch("src.services.workspace_git.WorkspaceGitService.ensure_gitignore") as mock_ignore:
            res = asyncio.run(prepare_workspace(user, workspace, container_id="test_container"))
            self.assertEqual(res, "/app")
            mock_init.assert_called_once()
            mock_ignore.assert_called_once()


if __name__ == "__main__":
    unittest.main()
