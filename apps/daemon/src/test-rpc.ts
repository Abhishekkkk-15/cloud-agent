import { rpcDispatcher } from "./rpc/index.js";

async function runLocalTests() {
  console.log("=== 1. Testing daemon.status ===");
  const statusRes = await rpcDispatcher.handle({ id: "test-1", method: "daemon.status" });
  console.log("Status result:", JSON.stringify(statusRes.result, null, 2));

  console.log("\n=== 2. Testing sessions.list (Paginated) ===");
  const listRes = await rpcDispatcher.handle({
    id: "test-2",
    method: "sessions.list",
    params: { limit: 5, offset: 0 },
  });
  const pagedSessions = listRes.result as any;
  console.log(`Total sessions on disk: ${pagedSessions.total}`);
  console.log(`Page items returned   : ${pagedSessions.items.length}`);
  console.log(`Has more sessions     : ${pagedSessions.hasMore}`);

  if (pagedSessions.items.length > 0) {
    const latest = pagedSessions.items[0];
    console.log(`\n=== 3. Testing sessions.get with Paginated Messages ===`);
    console.log(`Requesting first 10 messages for session [${latest.id}]...`);
    const detailRes = await rpcDispatcher.handle({
      id: "test-3",
      method: "sessions.get",
      params: { sessionId: latest.id, limit: 10, offset: 0 },
    });
    const detail = detailRes.result as any;
    console.log(`Session Title        : "${detail.title}"`);
    console.log(`Messages in this page: ${detail.messages.length}`);
    console.log(`Total messages       : ${detail.totalMessages}`);
    console.log(`Has more messages    : ${detail.hasMoreMessages}`);
    console.log(`Artifacts discovered : ${detail.artifacts?.length ?? 0}`);

    console.log(`\n=== 4. Testing sessions.messages (Infinite Scroll Page 2) ===`);
    console.log(`Requesting next 10 messages (offset: 10)...`);
    const page2Res = await rpcDispatcher.handle({
      id: "test-4",
      method: "sessions.messages",
      params: { sessionId: latest.id, limit: 10, offset: 10 },
    });
    const page2 = page2Res.result as any;
    console.log(`Page 2 items returned: ${page2.items.length}`);
    console.log(`Page 2 first message : [${page2.items[0]?.role}] ${page2.items[0]?.content?.slice(0, 60)}...`);
    console.log(`Page 2 has more      : ${page2.hasMore}`);
  }

  console.log("\n=== 5. Testing fs.tree ===");
  const fsRes = await rpcDispatcher.handle({
    id: "test-5",
    method: "fs.tree",
    params: { maxDepth: 1 },
  });
  const nodes = (fsRes.result as any[]) || [];
  console.log(`Workspace root files/directories found: ${nodes.length}`);
}

runLocalTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
