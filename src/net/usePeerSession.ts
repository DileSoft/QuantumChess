import { useCallback, useRef, useState } from 'react'
import { Peer, type DataConnection } from 'peerjs'
import type { Color } from 'chess.js'
import {
  PROTOCOL_VERSION,
  isNetMessage,
  makeRoomCode,
  roomPeerId,
  type NetMessage,
} from './protocol'

export type SessionStatus =
  | 'idle'
  | 'creating'
  | 'waiting'
  | 'joining'
  | 'connected'
  | 'error'

export interface PeerSession {
  status: SessionStatus
  /** Room code (defined once created/joined). */
  code: string | null
  /** True for the room creator. */
  isHost: boolean
  /** My color (host chose at creation; guest learns it from hello). */
  myColor: Color | null
  error: string | null
  /** Handshake trace for diagnostics (newest last). */
  debugLog: string[]
  createRoom: (hostColor: Color) => void
  joinRoom: (code: string) => void
  leave: () => void
  send: (msg: NetMessage) => void
  onMessage: (handler: (msg: NetMessage) => void) => void
}

function peerErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'type' in err) {
    const t = String((err as { type: unknown }).type)
    if (t === 'peer-unavailable') return 'Комната не найдена. Проверьте код.'
    if (t === 'network' || t === 'server-error' || t === 'socket-error')
      return 'Нет соединения с сервером сигналинга. Проверьте интернет.'
    if (t === 'browser-incompatible') return 'Браузер не поддерживает WebRTC.'
    return `Ошибка соединения: ${t}`
  }
  return 'Неизвестная ошибка соединения.'
}

export function usePeerSession(): PeerSession {
  const [status, setStatus] = useState<SessionStatus>('idle')
  const [code, setCode] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [myColor, setMyColor] = useState<Color | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugLog, setDebugLog] = useState<string[]>([])

  const trace = useCallback((line: string) => {
    setDebugLog((prev) => [...prev.slice(-19), line])
  }, [])

  const peerRef = useRef<Peer | null>(null)
  const connRef = useRef<DataConnection | null>(null)
  const handlerRef = useRef<(msg: NetMessage) => void>(() => {})
  const statusRef = useRef<SessionStatus>('idle')
  statusRef.current = status
  // Epoch guards against stale connections: StrictMode remounts (or rapid
  // re-joins) can leave an old DataConnection opening *after* it was replaced.
  // Events from a superseded epoch are ignored.
  const epochRef = useRef(0)

  const setFailed = useCallback((message: string) => {
    setError(message)
    setStatus('error')
  }, [])

  const cleanup = useCallback(() => {
    // Invalidate any in-flight connections before tearing down.
    epochRef.current += 1
    connRef.current?.close()
    connRef.current = null
    peerRef.current?.destroy()
    peerRef.current = null
  }, [])

  const attachConnection = useCallback(
    (conn: DataConnection, host: boolean) => {
      const epoch = epochRef.current
      connRef.current = conn
      trace(`conn attached (peer=${conn.peer}, open=${conn.open})`)
      const isCurrent = () => epoch === epochRef.current && connRef.current === conn
      const markConnected = () => {
        if (!isCurrent()) {
          trace('ignoring open from stale connection')
          return
        }
        trace('conn open event')
        if (statusRef.current === 'joining' || statusRef.current === 'waiting') {
          setStatus('connected')
        }
      }
      conn.on('data', (data: unknown) => {
        if (!isCurrent() || !isNetMessage(data)) return
        // Guest learns their color from the host's hello.
        if (!host && data.type === 'hello') {
          setMyColor(data.hostColor === 'w' ? 'b' : 'w')
        }
        handlerRef.current(data)
      })
      conn.on('open', markConnected)
      // The connection may already be open (event fired before we subscribed).
      if (conn.open) markConnected()
      conn.on('close', () => {
        if (!isCurrent()) return
        trace('conn close event')
        connRef.current = null
        if (statusRef.current === 'connected') {
          setError(host ? 'Соперник отключился.' : 'Соединение с хостом потеряно.')
          setStatus('error')
        }
      })
      conn.on('error', (err: unknown) => {
        if (!isCurrent()) return
        trace(`conn error: ${peerErrorMessage(err)}`)
        setFailed(peerErrorMessage(err))
      })
    },
    [setFailed, trace],
  )

  const createRoom = useCallback(
    (hostColor: Color) => {
      cleanup()
      const roomCode = makeRoomCode()
      setCode(roomCode)
      setIsHost(true)
      setMyColor(hostColor)
      setError(null)
      setStatus('creating')
      const peer = new Peer(roomPeerId(roomCode))
      peerRef.current = peer
      trace(`peer created id=${roomPeerId(roomCode)}`)
      peer.on('open', (id) => {
        trace(`peer open id=${id}`)
        setStatus('waiting')
      })
      peer.on('connection', (conn) => {
        trace(`incoming connection from ${conn.peer}`)
        attachConnection(conn, true)
      })
      peer.on('disconnected', () => trace('peer disconnected from broker'))
      peer.on('error', (err: unknown) => {
        // "unavailable-id" means code collision — retry with a fresh code.
        if (
          typeof err === 'object' &&
          err !== null &&
          (err as { type?: unknown }).type === 'unavailable-id'
        ) {
          peer.destroy()
          peerRef.current = null
          createRoom(hostColor)
          return
        }
        setFailed(peerErrorMessage(err))
      })
    },
    [attachConnection, cleanup, setFailed],
  )

  const joinRoom = useCallback(
    (roomCode: string) => {
      cleanup()
      const normalized = roomCode.trim().toLowerCase()
      if (!normalized) {
        setFailed('Введите код комнаты.')
        return
      }
      setCode(normalized)
      setIsHost(false)
      setMyColor(null)
      setError(null)
      setStatus('joining')
      const peer = new Peer()
      peerRef.current = peer
      trace('guest peer created')
      peer.on('open', (id) => {
        trace(`guest peer open id=${id}, connecting to ${roomPeerId(normalized)}`)
        const conn = peer.connect(roomPeerId(normalized), { reliable: true })
        attachConnection(conn, false)
      })
      peer.on('disconnected', () => trace('guest peer disconnected from broker'))
      peer.on('error', (err: unknown) => {
        trace(`peer error: ${peerErrorMessage(err)}`)
        setFailed(peerErrorMessage(err))
      })
    },
    [attachConnection, cleanup, setFailed],
  )

  const leave = useCallback(() => {
    cleanup()
    setCode(null)
    setIsHost(false)
    setMyColor(null)
    setError(null)
    setStatus('idle')
  }, [cleanup])

  const send = useCallback((msg: NetMessage) => {
    const conn = connRef.current
    if (conn?.open) {
      void conn.send({ ...msg, protocol: PROTOCOL_VERSION } as NetMessage)
    }
  }, [])

  const onMessage = useCallback((handler: (msg: NetMessage) => void) => {
    handlerRef.current = handler
  }, [])

  // NOTE: no unmount cleanup here on purpose. React StrictMode's
  // mount → unmount → remount cycle would destroy a Peer created by an
  // auto-join effect, while the re-run effect would no-op (room already
  // consumed from the URL). Teardown happens explicitly via leave(),
  // createRoom() and joinRoom(), which all call cleanup() first.

  return {
    status,
    code,
    isHost,
    myColor,
    error,
    debugLog,
    createRoom,
    joinRoom,
    leave,
    send,
    onMessage,
  }
}
