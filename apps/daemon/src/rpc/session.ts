import { registry } from "../registry.js";
import type {
  CliSessionSummary,
  CliSessionDetail,
  CliMessage,
  CliPaginatedResult,
  CliSessionListOptions,
  CliGetSessionOptions,
  CliPaginationOptions,
} from "@cloud-agent/cli-interface";

export async function handleSessionsList(params: {
  cli?: string;
  workspaceFilter?: string;
  limit?: number;
  offset?: number;
}): Promise<CliPaginatedResult<CliSessionSummary>> {
  const adapter = registry.get(params.cli);
  const opts: CliSessionListOptions = {
    workspaceFilter: params.workspaceFilter,
    limit: params.limit,
    offset: params.offset,
  };
  return adapter.listSessions(opts);
}

export async function handleSessionsGet(params: {
  cli?: string;
  sessionId: string;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
  includeArtifacts?: boolean;
}): Promise<CliSessionDetail | null> {
  const adapter = registry.get(params.cli);
  const opts: CliGetSessionOptions = {
    limit: params.limit,
    offset: params.offset,
    order: params.order,
    includeArtifacts: params.includeArtifacts,
  };
  return adapter.getSession(params.sessionId, opts);
}

export async function handleMessagesGet(params: {
  cli?: string;
  sessionId: string;
  limit?: number;
  offset?: number;
  order?: "asc" | "desc";
}): Promise<CliPaginatedResult<CliMessage>> {
  const adapter = registry.get(params.cli);
  const opts: CliPaginationOptions = {
    limit: params.limit,
    offset: params.offset,
    order: params.order,
  };
  return adapter.getMessages(params.sessionId, opts);
}

export async function handleSessionRename(params: {
  cli?: string;
  sessionId: string;
  title: string;
}): Promise<{ ok: boolean }> {
  const adapter = registry.get(params.cli);
  if (adapter.renameSession) {
    await adapter.renameSession(params.sessionId, params.title);
    return { ok: true };
  }
  throw new Error(`CLI adapter ${adapter.id} does not support session renaming`);
}

export async function handleSessionDelete(params: {
  cli?: string;
  sessionId: string;
}): Promise<{ ok: boolean }> {
  const adapter = registry.get(params.cli);
  if (adapter.deleteSession) {
    await adapter.deleteSession(params.sessionId);
    return { ok: true };
  }
  throw new Error(`CLI adapter ${adapter.id} does not support session deletion`);
}

export async function handleSessionPin(params: {
  cli?: string;
  sessionId: string;
  pinned: boolean;
}): Promise<{ ok: boolean }> {
  const adapter = registry.get(params.cli);
  if (adapter.pinSession) {
    await adapter.pinSession(params.sessionId, params.pinned);
    return { ok: true };
  }
  throw new Error(`CLI adapter ${adapter.id} does not support session pinning`);
}
