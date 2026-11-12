import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { rpcDispatcher } from "../src/rpc/index.js";

describe("@cloud-agent/daemon - File System & Workspace Operations", () => {
  const tmpBase = path.join(os.tmpdir(), `ca-daemon-fs-test-${Date.now()}`);

  before(() => {
    fs.mkdirSync(tmpBase, { recursive: true });
    // Create nested mock structure
    fs.mkdirSync(path.join(tmpBase, "src"), { recursive: true });
    fs.mkdirSync(path.join(tmpBase, "node_modules"), { recursive: true });
    fs.mkdirSync(path.join(tmpBase, ".git"), { recursive: true });
    fs.writeFileSync(path.join(tmpBase, "package.json"), '{"name":"mock"}', "utf8");
    fs.writeFileSync(path.join(tmpBase, "src", "index.ts"), 'console.log("hello");', "utf8");
    fs.writeFileSync(path.join(tmpBase, "node_modules", "dummy.js"), "module.exports = {};", "utf8");
  });

  after(() => {
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors on temp dir
    }
  });

  it("fs.tree should construct file hierarchy and respect ignore rules and maxDepth", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-fs-tree-1",
      method: "fs.tree",
      params: { path: tmpBase, maxDepth: 2 },
    });

    assert.equal(res.id, "test-fs-tree-1");
    assert.ok(Array.isArray(res.result), "Expected array of tree nodes");
    const nodes = res.result as any[];

    // Invariant: node_modules and .git must be ignored
    const names = nodes.map((n) => n.name);
    assert.ok(names.includes("src"), "Should include src directory");
    assert.ok(names.includes("package.json"), "Should include package.json");
    assert.ok(!names.includes("node_modules"), "Must ignore node_modules");
    assert.ok(!names.includes(".git"), "Must ignore .git");

    // Invariant: Directories sorted before files
    const srcIndex = names.indexOf("src");
    const pkgIndex = names.indexOf("package.json");
    assert.ok(srcIndex < pkgIndex, "Directories should appear before files");

    // Invariant: Nested children populated
    const srcNode = nodes.find((n) => n.name === "src");
    assert.ok(srcNode?.children, "src node should have children");
    assert.equal(srcNode.children.length, 1);
    assert.equal(srcNode.children[0].name, "index.ts");
  });

  it("fs.read should return content of existing file", async () => {
    const filePath = path.join(tmpBase, "package.json");
    const res = await rpcDispatcher.handle({
      id: "test-fs-read-1",
      method: "fs.read",
      params: { path: filePath },
    });

    assert.equal(res.id, "test-fs-read-1");
    assert.ok(res.result, "Expected result");
    const data = res.result as { content: string };
    assert.equal(data.content, '{"name":"mock"}');
  });

  it("fs.read should return error for non-existent file or missing path", async () => {
    const missingRes = await rpcDispatcher.handle({
      id: "test-fs-read-missing",
      method: "fs.read",
      params: { path: path.join(tmpBase, "does-not-exist.txt") },
    });
    assert.ok(missingRes.error, "Expected error on missing file");
    assert.match(missingRes.error!, /File not found/);

    const noParamRes = await rpcDispatcher.handle({
      id: "test-fs-read-no-param",
      method: "fs.read",
      params: {},
    });
    assert.ok(noParamRes.error, "Expected error when path param is missing");
  });

  it("fs.write should write content and create parent directory recursively", async () => {
    const newFilePath = path.join(tmpBase, "new_folder", "sub", "test.txt");
    const testContent = "Hello from automated test!";

    const writeRes = await rpcDispatcher.handle({
      id: "test-fs-write-1",
      method: "fs.write",
      params: { path: newFilePath, content: testContent },
    });

    assert.equal(writeRes.id, "test-fs-write-1");
    assert.ok(!writeRes.error, "Write should not return an error");
    assert.deepEqual(writeRes.result, { ok: true });

    // Verify written content by reading it back
    const readRes = await rpcDispatcher.handle({
      id: "test-fs-write-verify",
      method: "fs.read",
      params: { path: newFilePath },
    });
    assert.equal((readRes.result as any)?.content, testContent);
  });

  it("fs.listDirs should list directories and return available drives", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-fs-listdirs-1",
      method: "fs.listDirs",
      params: { path: tmpBase },
    });

    assert.equal(res.id, "test-fs-listdirs-1");
    assert.ok(res.result, "Expected listDirs result");
    const data = res.result as any;

    assert.ok(data.currentPath);
    assert.ok(Array.isArray(data.dirs));
    assert.ok(Array.isArray(data.drives));
    assert.ok(data.drives.length > 0, "Should detect at least one drive");

    const dirNames = data.dirs.map((d: any) => d.name);
    assert.ok(dirNames.includes("src"));
    assert.ok(!dirNames.includes("node_modules"), "Should filter node_modules");
  });

  it("fs.createDir should create a new folder and reject invalid names or traversal", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-fs-mkdir-1",
      method: "fs.createDir",
      params: { parentPath: tmpBase, name: "my_created_dir" },
    });

    assert.equal(res.id, "test-fs-mkdir-1");
    assert.ok(res.result, "Expected createDir result");
    const result = res.result as any;
    assert.equal(result.ok, true);
    assert.equal(result.name, "my_created_dir");
    assert.ok(fs.existsSync(result.fullPath));

    // Duplicate creation should fail
    const dupRes = await rpcDispatcher.handle({
      id: "test-fs-mkdir-dup",
      method: "fs.createDir",
      params: { parentPath: tmpBase, name: "my_created_dir" },
    });
    assert.ok(dupRes.error, "Duplicate folder creation must fail");
    assert.match(dupRes.error!, /already exists/);

    // Path traversal attempt should fail
    const traversalRes = await rpcDispatcher.handle({
      id: "test-fs-mkdir-traversal",
      method: "fs.createDir",
      params: { parentPath: tmpBase, name: "../escaped" },
    });
    assert.ok(traversalRes.error, "Path traversal in folder name must fail");
  });

  it("workspaces.list should discover workspaces and always include current working directory", async () => {
    const res = await rpcDispatcher.handle({
      id: "test-ws-list-1",
      method: "workspaces.list",
    });

    assert.equal(res.id, "test-ws-list-1");
    assert.ok(res.result, "Expected workspaces result");
    const data = res.result as { workspaces: Array<{ path: string; name: string; lastUsed: string }> };

    assert.ok(Array.isArray(data.workspaces), "Expected workspaces array");
    assert.ok(data.workspaces.length > 0, "Workspaces list should not be empty");

    // Current working directory invariant
    const cwd = process.cwd();
    const hasCwd = data.workspaces.some(
      (w) => path.normalize(w.path).toLowerCase() === path.normalize(cwd).toLowerCase()
    );
    assert.ok(hasCwd, "Workspaces list must contain process.cwd()");

    for (const ws of data.workspaces) {
      assert.ok(ws.path, "Workspace must have path");
      assert.ok(ws.name, "Workspace must have name");
      assert.ok(ws.lastUsed, "Workspace must have lastUsed timestamp");
    }
  });
});
