export interface PeerServerConfig {
  host: string
  port: number
  path: string
  key: string
  secure: boolean
}

const STORAGE_KEY = 'qc-peer-settings'

/** Built-in default signaling server (wss). */
export const DEFAULT_PEER_CONFIG: PeerServerConfig = {
  host: 'dilesoft.ru',
  port: 9002,
  path: '/peerjs',
  key: 'peerjs',
  secure: true,
}

/**
 * Resolve which PeerJS signaling server to use.
 * Priority: manual Lobby setting (localStorage) > build-time env >
 * built-in default (dilesoft.ru) > undefined
 * (undefined = PeerJS public cloud broker, used as fallback).
 */
export function getPeerConfig(): PeerServerConfig | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<PeerServerConfig>
      if (p.host) {
        return {
          host: p.host,
          port: Number(p.port) || (p.secure === false ? 80 : 443),
          path: p.path || '/peerjs',
          key: p.key || 'peerjs',
          secure: p.secure !== false,
        }
      }
    }
  } catch {
    // Corrupt storage — fall through to env/defaults.
  }
  const host = import.meta.env.VITE_PEER_HOST as string | undefined
  if (!host) return { ...DEFAULT_PEER_CONFIG }
  return {
    host,
    port: Number(import.meta.env.VITE_PEER_PORT) || 443,
    path: (import.meta.env.VITE_PEER_PATH as string) || '/peerjs',
    key: (import.meta.env.VITE_PEER_KEY as string) || 'peerjs',
    secure: (import.meta.env.VITE_PEER_SECURE as string) !== 'false',
  }
}

export function savePeerConfig(cfg: PeerServerConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

export function clearPeerConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
}
