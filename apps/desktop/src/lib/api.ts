import { AVAILABLE_MODELS } from "@/types/models"

export async function listModels() {
  return AVAILABLE_MODELS.map((m) => ({
    id: m.id,
    name: m.name,
    model_id: m.id,
    provider: m.provider,
    description: m.description,
    supports_effort: m.supportsEffort ?? true,
    url: m.url || "",
    base_url: m.base_url || "",
    badge: m.badge || null,
    use_case: m.use_case || "",
    is_active: m.isActive ?? true,
    is_default: m.isDefault ?? false,
    default_effort: "high",
  }))
}

export async function downloadWorkspaceZip(workspaceId: string, title?: string) {
  const blob = new Blob([`Mock project archive for workspace: ${title || workspaceId}`], {
    type: "application/zip",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${(title || workspaceId).toLowerCase().replace(/\s+/g, "-")}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
