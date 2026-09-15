import type { Color } from 'chess.js'

export type Phase = 'selecting' | 'resolving' | 'gameover'

export interface HistoryEntry {
  moveNumber: number
  player: Color
  /** SAN of the two chosen options (or one, for forced moves). */
  options: string[]
  /** SAN of the randomly executed move. */
  played: string
}

export interface GameResult {
  winner: Color | null
  reason: 'checkmate' | 'stalemate' | 'draw'
}

export interface PendingPromotion {
  from: string
  to: string
}