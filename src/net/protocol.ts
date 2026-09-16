import type { Color } from 'chess.js'
import type { HistoryEntry } from '../types'

/** Protocol version — bump when message shapes change. */
export const PROTOCOL_VERSION = 1

/** Prefix for PeerJS ids so rooms don't collide with other apps. */
export const ROOM_PREFIX = 'qc-room-'

export type NetMessage =
  | {
      type: 'hello'
      protocol: number
      /** Color the HOST plays (chosen at room creation). */
      hostColor: Color
      fen: string
      history: HistoryEntry[]
    }
  | {
      type: 'select'
      /** SAN of the chosen option (includes promotion suffix, e.g. e8=Q). */
      san: string
    }
  | { type: 'clearSelection' }
  | {
      type: 'resolve'
      /** SANs of the two declared options. */
      options: string[]
      /** SAN of the randomly executed move. */
      played: string
    }
  | { type: 'undo' }
  | { type: 'restart' }
  | { type: 'resyncRequest' }
  | {
      type: 'resyncState'
      fen: string
      history: HistoryEntry[]
    }
  | { type: 'error'; message: string }

export function roomPeerId(code: string): string {
  return `${ROOM_PREFIX}${code.toLowerCase()}`
}

/** Short human-friendly room code, e.g. "kq7x2". */
export function makeRoomCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const buf = new Uint32Array(6)
  crypto.getRandomValues(buf)
  return Array.from(buf, (x) => alphabet[x % alphabet.length]).join('')
}

export function isNetMessage(value: unknown): value is NetMessage {
  if (typeof value !== 'object' || value === null) return false
  const t = (value as { type?: unknown }).type
  return (
    t === 'hello' ||
    t === 'select' ||
    t === 'clearSelection' ||
    t === 'resolve' ||
    t === 'undo' ||
    t === 'restart' ||
    t === 'resyncRequest' ||
    t === 'resyncState' ||
    t === 'error'
  )
}
