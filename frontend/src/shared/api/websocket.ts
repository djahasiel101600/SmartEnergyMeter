import { useEffect, useRef, useState, useCallback } from 'react'
import type { WSMessage } from '../types'

function resolveWebSocketUrl(): string {
  const configured = (import.meta.env.VITE_WS_URL as string | undefined)?.trim()
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'

  if (configured) {
    if (configured.startsWith('ws://') || configured.startsWith('wss://')) {
      return configured
    }
    if (configured.startsWith('/')) {
      return `${protocol}://${window.location.host}${configured}`
    }
  }

  return `${protocol}://${window.location.host}/ws/energy/`
}

const WS_URL = resolveWebSocketUrl()

interface UseWebSocketOptions {
  onMessage?: (message: WSMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  autoReconnect?: boolean
  reconnectInterval?: number
}

export function useWebSocket(options: UseWebSocketOptions = {}) {

  // Use refs for callbacks to prevent constant re-renders/reconnections
  // when options are passed as inline functions forming new references
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const connect = useCallback(() => {
    try {
      console.log(`[WebSocket] Connecting to ${WS_URL}...`)
      const ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        console.log('[WebSocket] Connected securely.')
        setIsConnected(true)
        optionsRef.current.onConnect?.()

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.debug('[WebSocket] Sending keep-alive ping')
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, 30000) // 30 seconds
      }

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          if (message.type === 'pong') {
            console.debug('[WebSocket] Received pong')
            return
          }
          console.debug('[WebSocket] Message received:', message)
          setLastMessage(message)
          if (optionsRef.current.onMessage) {
            optionsRef.current.onMessage(message)
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', event.data, error)
        }
      }

      ws.onerror = (error) => {
        console.error('[WebSocket] Error encountered:', error)
        if (optionsRef.current.onError) {
          optionsRef.current.onError(error)
        }
      }

      ws.onclose = (event) => {
        console.log(`[WebSocket] Disconnected. Code: ${event.code}, Reason: ${event.reason}`)
        setIsConnected(false)
        if (wsRef.current === ws) {
          wsRef.current = null
        }
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }
        if (optionsRef.current.onDisconnect) {
          optionsRef.current.onDisconnect()
        }

        // Auto-reconnect
        if (optionsRef.current.autoReconnect !== false) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
          }
          const interval = optionsRef.current.reconnectInterval || 5000
          console.log(`[WebSocket] Attempting to reconnect in ${interval}ms...`)
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, interval)
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error)
    }
  }, []) // Empty dependency array since we use optionsRef

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const send = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.debug('[WebSocket] Sending message:', message)
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('[WebSocket] Cannot send message, not connected:', message)
    }
  }, [])

  const subscribe = useCallback((deviceId: string) => {
    send({ type: 'subscribe', device_id: deviceId })
  }, [send])

  const unsubscribe = useCallback((deviceId: string) => {
    send({ type: 'unsubscribe', device_id: deviceId })
  }, [send])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    lastMessage,
    send,
    subscribe,
    unsubscribe,
    reconnect: connect,
    disconnect,
  }
}
