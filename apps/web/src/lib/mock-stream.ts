export type StreamTextOptions = {
  signal?: AbortSignal
  onChunk: (chunk: string, fullText: string) => void
  delayMs?: number
  chunkSize?: number
}

export async function streamText(
  fullText: string,
  { signal, onChunk, delayMs = 18, chunkSize = 3 }: StreamTextOptions
) {
  let assembled = ""
  for (let i = 0; i < fullText.length; i += chunkSize) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError")
    }
    const chunk = fullText.slice(i, i + chunkSize)
    assembled += chunk
    onChunk(chunk, assembled)
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => resolve(), delayMs)
      const onAbort = () => {
        window.clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      }
      if (signal) {
        if (signal.aborted) {
          onAbort()
          return
        }
        signal.addEventListener("abort", onAbort, { once: true })
      }
    })
  }
  return assembled
}
