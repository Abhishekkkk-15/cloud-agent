type MessageHandler = (data: any) => void

type Event = "agent:send" | "agent:start"

class WebSocketManager {
  private socket: WebSocket | null = null
  private url: string = ""
  private handlers = new Map<Event, Set<MessageHandler>>()
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(url: string) {
    this.url = url
  }

  connect() {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    this.socket = new WebSocket(this.url)
    this.socket.onopen = () => {
      console.log("websocket connected")
      this.reconnectAttempts = 0
    }

    this.socket.onmessage = (event) => {
      try {
        console.log(event)
        const message = JSON.parse(event.data)
        const handlers = this.handlers.get(message.type)

        handlers?.forEach((handle) => handle(message.type))
      } catch (error) {
        console.error("Invalid websocket message : ", error)
      }
    }

    this.socket.onclose = () => {
      this.socket = null
      this.reconnect()
    }

    this.socket.onerror = (error) => {
      console.error("WebSocket error:", error)
    }
  }

  private reconnect() {
    if (this.reconnectTimer) return
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000)
    ;(this, this.reconnectAttempts++)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  subscribe(type: Event, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }

    this.handlers.get(type)!.add(handler)
    return () => {
      this.handlers.get(type)?.delete(handler)
    }
  }

  send(type: Event, data: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected")
    }
    this.socket.send(JSON.stringify({ type, data }))
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.socket?.close()
    this.socket = null
  }
}

export const ws = new WebSocketManager("ws://localhost:8000/ws")
