import asyncio
import io
import tarfile
import unittest
from unittest.mock import MagicMock

from src.ai_core.tools.docker_file_tools import (
    _resolve_container_path,
    _read_file_from_container,
    _write_file_to_container,
    build_docker_file_tools,
)


class TestDockerFileTools(unittest.TestCase):
    def test_resolve_container_path(self):
        self.assertEqual(_resolve_container_path("src/index.ts"), "/app/src/index.ts")
        self.assertEqual(_resolve_container_path("/app/src/index.ts"), "/app/src/index.ts")
        self.assertEqual(_resolve_container_path("components/Button.tsx"), "/app/components/Button.tsx")

        with self.assertRaises(ValueError):
            _resolve_container_path("../outside.txt")

        with self.assertRaises(ValueError):
            _resolve_container_path("/etc/passwd")


    def test_write_and_read_file_tar(self):
        container = MagicMock()
        stored_tar_bytes = bytearray()

        def mock_put_archive(path, fileobj):
            nonlocal stored_tar_bytes
            stored_tar_bytes = bytearray(fileobj.read())

        container.put_archive = mock_put_archive
        container.get_archive.side_effect = Exception("File not found")

        content = "import React from 'react';\nexport const App = () => <div>Hello</div>;\n"
        existed, lines, nbytes = _write_file_to_container(
            container, "/app/src/App.tsx", content, workdir="/app"
        )

        self.assertFalse(existed)
        self.assertEqual(lines, 2)
        self.assertEqual(nbytes, len(content.encode("utf-8")))

        # Verify tar structure contains parent dir and file
        with tarfile.open(fileobj=io.BytesIO(stored_tar_bytes), mode="r:*") as tar:
            names = [m.name for m in tar.getmembers()]
            self.assertIn("src", names)
            self.assertIn("src/App.tsx", names)

            # Mock reading it back
            f = tar.extractfile(tar.getmember("src/App.tsx"))
            read_bytes = f.read()

        # Now mock container.get_archive returning the stream
        stream_tar = io.BytesIO()
        with tarfile.open(fileobj=stream_tar, mode="w") as tar:
            info = tarfile.TarInfo(name="App.tsx")
            info.size = len(read_bytes)
            info.type = tarfile.REGTYPE
            tar.addfile(info, io.BytesIO(read_bytes))
        stream_tar.seek(0)

        container.get_archive.side_effect = None
        container.get_archive.return_value = ([stream_tar.read()], {})

        read_text = _read_file_from_container(container, "/app/src/App.tsx")
        self.assertEqual(read_text, content)

    def test_tool_specs_and_handlers(self):
        tools = build_docker_file_tools(container_id="test_container")
        self.assertEqual(len(tools), 4)
        tool_names = {t.name for t in tools}
        self.assertEqual(tool_names, {"read", "write", "edit", "grep"})

        read_tool = next(t for t in tools if t.name == "read")
        write_tool = next(t for t in tools if t.name == "write")
        edit_tool = next(t for t in tools if t.name == "edit")
        grep_tool = next(t for t in tools if t.name == "grep")

        self.assertFalse(read_tool.require_permission)
        self.assertTrue(write_tool.require_permission)
        self.assertEqual(write_tool.permission_arg, "path")
        self.assertTrue(edit_tool.require_permission)
        self.assertEqual(edit_tool.permission_arg, "path")
        self.assertFalse(grep_tool.require_permission)

    def test_read_lockfile_notice(self):
        tools = build_docker_file_tools(container_id="test_container")
        read_tool = next(t for t in tools if t.name == "read")

        res = asyncio.run(read_tool.handler(path="package-lock.json"))
        self.assertIn("Notice:", res)
        self.assertIn("automated package lockfile", res)

    def test_edit_logic(self):
        from unittest.mock import patch

        initial_content = "def hello():\n    print('hello world')\n    return True\n"
        container = MagicMock()

        # Build tar for mock reading
        stream_tar = io.BytesIO()
        with tarfile.open(fileobj=stream_tar, mode="w") as tar:
            info = tarfile.TarInfo(name="main.py")
            raw = initial_content.encode("utf-8")
            info.size = len(raw)
            info.type = tarfile.REGTYPE
            tar.addfile(info, io.BytesIO(raw))
        stream_tar.seek(0)
        container.get_archive.return_value = ([stream_tar.read()], {})

        saved_content = None
        def mock_put_archive(path, fileobj):
            nonlocal saved_content
            with tarfile.open(fileobj=fileobj, mode="r:*") as tar:
                f = tar.extractfile(tar.getmember("main.py"))
                saved_content = f.read().decode("utf-8")
        container.put_archive = mock_put_archive

        with patch("src.ai_core.tools.docker_file_tools.get_sandbox_client") as mock_client_getter:
            mock_client = MagicMock()
            mock_client.containers.get.return_value = container
            mock_client_getter.return_value = mock_client

            tools = build_docker_file_tools(container_id="test_container")
            edit_tool = next(t for t in tools if t.name == "edit")

            # 1. Successful edit
            res = asyncio.run(
                edit_tool.handler(
                    path="main.py",
                    edits=[{"oldText": "print('hello world')", "newText": "print('hello cloud agent')"}],
                )
            )
            self.assertIn("Applied 1 edit(s)", res)
            self.assertEqual(
                saved_content,
                "def hello():\n    print('hello cloud agent')\n    return True\n",
            )

            # 2. Match not found
            res_err = asyncio.run(
                edit_tool.handler(
                    path="main.py",
                    edits=[{"oldText": "non_existent_code()", "newText": "foo"}],
                )
            )
            self.assertIn("Could not find exact match", res_err)



if __name__ == "__main__":
    unittest.main()

