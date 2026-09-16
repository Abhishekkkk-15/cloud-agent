/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_PREVIEW_DOMAIN?: string
  readonly VITE_PREVIEW_PORT?: string
  readonly VITE_PREVIEW_SCHEME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
