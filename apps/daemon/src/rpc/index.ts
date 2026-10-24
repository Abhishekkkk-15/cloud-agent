import os from "node:os";
import { registry } from "../registry.js";
import { handleSessionsList, handleSessionsGet, handleMessagesGet } from "./session.js";
import { handleAgentRun, handleAgentCancel, handleRespondPermission } from "./run.js";
import { buildFileTree, readFileContent, writeFileContent } from "./fs.js";
import type { CliEvent } from "@cloud-agent/cli-interface";

export interface RpcRequest {
  id: string;
  method: string;
  params?: Record<string, any>;
}

export interface RpcResponse {
  id: string;
  result?: unknown;
  error?: string;
  stream?: boolean;
  done?: boolean;
}

export type StreamCallback = (chunk: {
  id: string;
  stream: true;
  event: CliEvent;
  done?: boolean;
}) => void;

export class RpcDispatcher {
  async handle(req: RpcRequest, onStream?: StreamCallback): Promise<RpcResponse> {
    const params = req.params || {};

    try {
      switch (req.method) {
        case "ping":
          return { id: req.id, result: { pong: true, timestamp: new Date().toISOString() } };

        case "daemon.status": {
          const avail = await registry.checkAll();
          return {
            id: req.id,
            result: {
              hostname: os.hostname(),
              platform: process.platform,
              arch: process.arch,
              uptime: os.uptime(),
              adapters: registry.list(),
              availability: avail,
            },
          };
        }

        case "sessions.list": {
          const result = await handleSessionsList({
            cli: params.cli,
            workspaceFilter: params.workspaceFilter,
          });
          return { id: req.id, result };
        }

        case "sessions.get": {
          if (!params.sessionId) {
            throw new Error("Missing sessionId param");
          }
          const result = await handleSessionsGet({
            cli: params.cli,
            sessionId: params.sessionId,
            limit: params.limit,
            offset: params.offset,
            order: params.order,
            includeArtifacts: params.includeArtifacts,
          });
          return { id: req.id, result };
        }

        case "sessions.messages":
        case "messages.list": {
          if (!params.sessionId) {
            throw new Error("Missing sessionId param");
          }
          const result = await handleMessagesGet({
            cli: params.cli,
            sessionId: params.sessionId,
            limit: params.limit,
            offset: params.offset,
            order: params.order,
          });
          return { id: req.id, result };
        }

        case "agent.run": {
          if (!params.options || !params.options.prompt) {
            throw new Error("Missing options.prompt param");
          }
          if (!onStream) {
            throw new Error("Streaming callback is required for agent.run");
          }

          // Stream execution chunks
          const stream = handleAgentRun({
            cli: params.cli,
            options: params.options,
          });

          for await (const event of stream) {
            onStream({
              id: req.id,
              stream: true,
              event,
            });
          }

          return { id: req.id, result: { completed: true }, done: true };
        }

        case "agent.cancel": {
          if (!params.sessionId) {
            throw new Error("Missing sessionId param");
          }
          const result = await handleAgentCancel({
            cli: params.cli,
            sessionId: params.sessionId,
          });
          return { id: req.id, result };
        }

        case "agent.respondPermission": {
          if (!params.sessionId || !params.requestId) {
            throw new Error("Missing sessionId or requestId");
          }
          const result = await handleRespondPermission({
            cli: params.cli,
            sessionId: params.sessionId,
            requestId: params.requestId,
            allow: Boolean(params.allow),
          });
          return { id: req.id, result };
        }

        case "fs.tree": {
          const dir = params.path || process.cwd();
          const tree = buildFileTree(dir, params.maxDepth || 4);
          return { id: req.id, result: tree };
        }

        case "fs.read": {
          if (!params.path) throw new Error("Missing path param");
          const content = readFileContent(params.path);
          return { id: req.id, result: { content } };
        }

        case "fs.write": {
          if (!params.path || typeof params.content !== "string") {
            throw new Error("Missing path or content param");
          }
          writeFileContent(params.path, params.content);
          return { id: req.id, result: { ok: true } };
        }

        default:
          return { id: req.id, error: `Method not found: ${req.method}` };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { id: req.id, error: message };
    }
  }
}

export const rpcDispatcher = new RpcDispatcher();
