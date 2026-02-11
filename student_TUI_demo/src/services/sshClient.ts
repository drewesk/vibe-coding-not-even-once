// WebSocket SSH Client
// Connects browser terminal to backend SSH proxy

export type SSHClientStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type SSHClientCallbacks = {
  onData: (data: string | Uint8Array) => void
  onStatus: (status: SSHClientStatus, message?: string) => void
}

export class SSHClient {
  private ws: WebSocket | null = null
  private callbacks: SSHClientCallbacks
  private vmId: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  constructor(vmId: string, callbacks: SSHClientCallbacks) {
    this.vmId = vmId
    this.callbacks = callbacks
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.warn('[SSHClient] Already connected')
      return
    }

    this.callbacks.onStatus('connecting', `Connecting to ${this.vmId}...`)

    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws/terminal?vm=${this.vmId}`

    console.log('[SSHClient] Connecting to:', wsUrl)

    try {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('[SSHClient] WebSocket connected')
        this.reconnectAttempts = 0
        this.callbacks.onStatus('connected', 'Connection established')
      }

      this.ws.onmessage = (event) => {
        // Handle both text and binary data from SSH stream
        if (event.data instanceof Blob) {
          event.data.arrayBuffer().then((buffer) => {
            this.callbacks.onData(new Uint8Array(buffer))
          })
        } else if (typeof event.data === 'string') {
          // Check if it's a JSON status message
          try {
            const message = JSON.parse(event.data)
            if (message.type === 'error') {
              console.error('[SSHClient] Error:', message.message)
              this.callbacks.onStatus('error', message.message)
            } else if (message.type === 'connected') {
              console.log('[SSHClient] SSH session established')
            }
          } catch {
            // Not JSON, treat as regular terminal output
            this.callbacks.onData(event.data)
          }
        }
      }

      this.ws.onerror = (error) => {
        console.error('[SSHClient] WebSocket error:', error)
        this.callbacks.onStatus('error', 'Connection error')
      }

      this.ws.onclose = (event) => {
        console.log('[SSHClient] WebSocket closed:', event.code, event.reason)
        this.callbacks.onStatus('disconnected', 'Connection closed')
        
        // Auto-reconnect on unexpected close
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`[SSHClient] Reconnecting... (attempt ${this.reconnectAttempts})`)
          setTimeout(() => this.connect(), 2000)
        }
      }
    } catch (error) {
      console.error('[SSHClient] Failed to create WebSocket:', error)
      this.callbacks.onStatus('error', 'Failed to connect')
    }
  }

  send(data: string | Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[SSHClient] Cannot send - not connected')
      return false
    }

    try {
      if (typeof data === 'string') {
        // Send terminal input as JSON message
        this.ws.send(JSON.stringify({ type: 'input', data }))
      } else {
        // Send binary data directly
        this.ws.send(data)
      }
      return true
    } catch (error) {
      console.error('[SSHClient] Send error:', error)
      return false
    }
  }

  resize(rows: number, cols: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      this.ws.send(JSON.stringify({ type: 'resize', rows, cols }))
    } catch (error) {
      console.error('[SSHClient] Resize error:', error)
    }
  }

  disconnect() {
    if (this.ws) {
      console.log('[SSHClient] Disconnecting...')
      this.reconnectAttempts = this.maxReconnectAttempts // Prevent auto-reconnect
      this.ws.close(1000, 'User disconnected')
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
