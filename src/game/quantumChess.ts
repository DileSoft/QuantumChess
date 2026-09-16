import { Chess, type Move } from 'chess.js'
import type { GameResult } from '../types'

/** All legal moves from the current position (verbose). */
export function getLegalMoves(chess: Chess): Move[] {
  return chess.moves({ verbose: true })
}

/**
 * Fair random pick using the Web Crypto API (rejection sampling),
 * so both options have an exactly equal 50/50 chance.
 */
export function pickRandom<T>(arr: T[]): T {
  return arr[cryptoRandomInt(arr.length)]
}

function cryptoRandomInt(max: number): number {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0xffffffff / max) * max
  let x: number
  do {
    crypto.getRandomValues(buf)
    x = buf[0]
  } while (x >= limit)
  return x % max
}

/** True if two moves are the same (same from/to/promotion). */
export function sameMove(a: Move, b: Move): boolean {
  return (
    a.from === b.from &&
    a.to === b.to &&
    (a.promotion ?? '') === (b.promotion ?? '')
  )
}

/**
 * Make a move on a throwaway basis and return the resulting verbose Move
 * (including SAN), without mutating the real game. Throws if illegal.
 * Accepts SAN (e.g. "Nf3", "e8=Q") or a from/to object.
 */
export function makeMove(
  chess: Chess,
  input: string | { from: string; to: string; promotion?: string },
): Move {
  const move = chess.move(input)
  chess.undo()
  return move
}

/** Game-over result, or null if the game continues. */
export function getGameResult(chess: Chess): GameResult | null {
  if (chess.isCheckmate()) {
    return { winner: chess.turn() === 'w' ? 'b' : 'w', reason: 'checkmate' }
  }
  if (chess.isStalemate()) return { winner: null, reason: 'stalemate' }
  if (chess.isDraw()) return { winner: null, reason: 'draw' }
  return null
}