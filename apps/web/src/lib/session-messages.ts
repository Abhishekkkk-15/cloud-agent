import type { Message } from "@cloud-agent/shared"
import type { ThreadMessage } from "@/types/chat-ui"

export function messageToThread(message: Message): ThreadMessage {
  return {
    id: `${message.session_id}:${message.seq}`,
    session_id: message.session_id,
    seq: message.seq,
    role: message.role,
    content: message.content,
    user_id: message.user_id,
    name: message.name,
    tool_calls: message.tool_calls,
    tool_call_id: message.tool_call_id,
    reasoning_content: message.reasoning_content,
  }
}

export function messagesToThread(messages: Message[]): ThreadMessage[] {
  return messages.map(messageToThread)
}
