import { FileIcon, XIcon } from "lucide-react"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import type { ChatAttachment } from "@/types/schemas"

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

type ChatAttachmentListProps = {
  attachments: ChatAttachment[]
  onRemove?: (id: string) => void
  size?: "default" | "sm" | "xs"
}

export function ChatAttachmentList({
  attachments,
  onRemove,
  size = "sm",
}: ChatAttachmentListProps) {
  if (attachments.length === 0) return null

  return (
    <AttachmentGroup className="max-w-full">
      {attachments.map((attachment) => (
        <Attachment key={attachment.id} state="done" size={size}>
          {attachment.kind === "image" && attachment.previewUrl ? (
            <AttachmentMedia variant="image">
              <img src={attachment.previewUrl} alt={attachment.name} />
            </AttachmentMedia>
          ) : (
            <AttachmentMedia variant="icon">
              <FileIcon />
            </AttachmentMedia>
          )}
          <AttachmentContent>
            <AttachmentTitle>{attachment.name}</AttachmentTitle>
            <AttachmentDescription>
              {formatBytes(attachment.size)}
            </AttachmentDescription>
          </AttachmentContent>
          {onRemove && (
            <AttachmentActions>
              <AttachmentAction
                aria-label={`Remove ${attachment.name}`}
                onClick={() => onRemove(attachment.id)}
              >
                <XIcon />
              </AttachmentAction>
            </AttachmentActions>
          )}
        </Attachment>
      ))}
    </AttachmentGroup>
  )
}
