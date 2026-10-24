import { registry } from "../registry.js";
import type { CliRunOptions, CliEvent } from "@cloud-agent/cli-interface";

export async function* handleAgentRun(params: {
  cli?: string;
  options: CliRunOptions;
}): AsyncIterable<CliEvent> {
  const adapter = registry.get(params.cli);
  yield* adapter.run(params.options);
}

export async function handleAgentCancel(params: {
  cli?: string;
  sessionId: string;
}): Promise<{ ok: boolean }> {
  const adapter = registry.get(params.cli);
  await adapter.cancel(params.sessionId);
  return { ok: true };
}

export async function handleRespondPermission(params: {
  cli?: string;
  sessionId: string;
  requestId: string;
  allow: boolean;
}): Promise<{ ok: boolean }> {
  const adapter = registry.get(params.cli);
  if (adapter.respondPermission) {
    await adapter.respondPermission(params.sessionId, params.requestId, params.allow);
    return { ok: true };
  }
  throw new Error(`CLI adapter ${adapter.id} does not support permission response`);
}
