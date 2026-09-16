import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess, type Color, type Move } from 'chess.js'
import type { GameResult, HistoryEntry, PendingPromotion, Phase } from '../types'
import type { NetMessage } from '../net/protocol'
import {
  getGameResult,
  getLegalMoves,
  makeMove,
  pickRandom,
  sameMove,
} from './quantumChess'

/**
 * Optional network adapter for online play. When present:
 * - local selection/resolve is allowed only when it's my turn;
 * - every local selection/resolve is broadcast to the peer;
 * - remote moves arrive via `applyRemote` and are verified before applying.
 */
export interface NetAdapter {
  /** My color, or null until the session assigns it. */
  myColor: Color | null
  send: (msg: NetMessage) => void
}

export interface GameState {
  fen: string
  turn: 'w' | 'b'
  phase: Phase
  selectedMoves: Move[]
  history: HistoryEntry[]
  result: GameResult | null
  pendingPromotion: PendingPromotion | null
}

export interface QuantumChessApi {
  state: GameState
  handleMoveSelect: (input: { from: string; to: string }) => void
  resolve: () => void
  undo: () => void
  startNewGame: () => void
  choosePromotion: (piece: string) => void
  cancelPromotion: () => void
  /** Apply a message received from the remote peer. No-op without net. */
  applyRemote: (msg: NetMessage) => void
  /** True when it's my turn in a net game (always true offline). */
  isMyTurn: boolean
}

function buildState(
  chess: Chess,
  selectedMoves: Move[],
  history: HistoryEntry[],
  pendingPromotion: PendingPromotion | null,
): GameState {
  const result = getGameResult(chess)
  const phase: Phase = result
    ? 'gameover'
    : selectedMoves.length >= 2
      ? 'resolving'
      : 'selecting'
  return {
    fen: chess.fen(),
    turn: chess.turn(),
    phase,
    selectedMoves,
    history,
    result,
    pendingPromotion,
  }
}

export function useQuantumChess(net?: NetAdapter): QuantumChessApi {
  const chessRef = useRef<Chess>(new Chess())
  const lastAutoFenRef = useRef<string | null>(null)
  const [state, setState] = useState<GameState>(() =>
    buildState(chessRef.current, [], [], null),
  )
  // Mirror of the latest state so event handlers can read it synchronously.
  // IMPORTANT: chess mutations must NOT happen inside setState updaters,
  // because React StrictMode double-invokes updaters, which would apply each
  // move twice. All mutations happen here, outside the updater.
  const stateRef = useRef(state)
  const netRef = useRef<NetAdapter | undefined>(net)
  netRef.current = net

  const myColor = net?.myColor ?? null
  // Offline: always my turn. Online without an assigned color yet: not my turn.
  const isMyTurn = !net ? true : myColor != null && state.turn === myColor

  const commit = useCallback((next: GameState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const startNewGame = useCallback(() => {
    chessRef.current = new Chess()
    lastAutoFenRef.current = null
    commit(buildState(chessRef.current, [], [], null))
    netRef.current?.send({ type: 'restart' })
  }, [commit])

  const addMoveToSelection = useCallback(
    (move: Move, broadcast = true) => {
      const prev = stateRef.current
      if (prev.phase !== 'selecting' || prev.selectedMoves.length >= 2) return
      if (prev.selectedMoves.some((m) => sameMove(m, move))) return
      const selectedMoves = [...prev.selectedMoves, move]
      commit({
        ...prev,
        selectedMoves,
        phase: selectedMoves.length >= 2 ? 'resolving' : 'selecting',
      })
      if (broadcast) netRef.current?.send({ type: 'select', san: move.san })
    },
    [commit],
  )

  const handleMoveSelect = useCallback(
    (input: { from: string; to: string }) => {
      const prev = stateRef.current
      if (netRef.current && prev.turn !== netRef.current.myColor) return
      const legal = getLegalMoves(chessRef.current).find(
        (m) => m.from === input.from && m.to === input.to,
      )
      if (!legal) return
      if (legal.promotion) {
        commit({
          ...prev,
          pendingPromotion: { from: input.from, to: input.to },
        })
        return
      }
      addMoveToSelection(legal)
    },
    [addMoveToSelection, commit],
  )

  const choosePromotion = useCallback(
    (piece: string) => {
      const prev = stateRef.current
      if (!prev.pendingPromotion) return
      const move = makeMove(chessRef.current, {
        from: prev.pendingPromotion.from,
        to: prev.pendingPromotion.to,
        promotion: piece,
      })
      if (prev.phase !== 'selecting' || prev.selectedMoves.length >= 2) {
        commit({ ...prev, pendingPromotion: null })
        return
      }
      if (prev.selectedMoves.some((m) => sameMove(m, move))) {
        commit({ ...prev, pendingPromotion: null })
        return
      }
      const selectedMoves = [...prev.selectedMoves, move]
      commit({
        ...prev,
        pendingPromotion: null,
        selectedMoves,
        phase: selectedMoves.length >= 2 ? 'resolving' : 'selecting',
      })
      netRef.current?.send({ type: 'select', san: move.san })
    },
    [commit],
  )

  const cancelPromotion = useCallback(() => {
    commit({ ...stateRef.current, pendingPromotion: null })
  }, [commit])

  const playSingle = useCallback(
    (move: Move, broadcast = true) => {
      const prev = stateRef.current
      const chess = chessRef.current
      chess.move(move.san)
      const entry: HistoryEntry = {
        moveNumber: chess.moveNumber(),
        player: prev.turn,
        options: [move.san],
        played: move.san,
      }
      commit(buildState(chess, [], [...prev.history, entry], null))
      if (broadcast) {
        netRef.current?.send({ type: 'resolve', options: [move.san], played: move.san })
      }
    },
    [commit],
  )

  const resolve = useCallback(() => {
    const prev = stateRef.current
    if (prev.phase !== 'resolving' || prev.selectedMoves.length < 2) return
    if (netRef.current && prev.turn !== netRef.current.myColor) return
    const chess = chessRef.current
    const played = pickRandom(prev.selectedMoves)
    chess.move(played.san)
    const entry: HistoryEntry = {
      moveNumber: chess.moveNumber(),
      player: prev.turn,
      options: prev.selectedMoves.map((m) => m.san),
      played: played.san,
    }
    commit(buildState(chess, [], [...prev.history, entry], null))
    netRef.current?.send({
      type: 'resolve',
      options: prev.selectedMoves.map((m) => m.san),
      played: played.san,
    })
  }, [commit])

  const undo = useCallback(() => {
    const prev = stateRef.current
    const chess = chessRef.current
    if (prev.selectedMoves.length > 0 || prev.pendingPromotion) {
      commit({ ...prev, selectedMoves: [], pendingPromotion: null, phase: 'selecting' })
      netRef.current?.send({ type: 'clearSelection' })
      return
    }
    if (prev.history.length === 0) return
    chess.undo()
    let history = prev.history.slice(0, -1)
    const last = prev.history[prev.history.length - 1]
    // If the last entry was a forced (single-option) move, also undo the
    // random move that led to it so "undo" reverts a full turn.
    if (last.options.length === 1 && history.length > 0) {
      chess.undo()
      history = history.slice(0, -1)
    }
    lastAutoFenRef.current = null
    commit(buildState(chess, [], history, null))
    netRef.current?.send({ type: 'undo' })
  }, [commit])

  /**
   * Apply a message from the remote peer. All mutations happen here,
   * outside setState updaters (StrictMode-safe).
   */
  const applyRemote = useCallback(
    (msg: NetMessage) => {
      const prev = stateRef.current
      const chess = chessRef.current
      switch (msg.type) {
        case 'hello': {
          // Guest syncs to the host's position on connect.
          chess.load(msg.fen)
          lastAutoFenRef.current = null
          commit(buildState(chess, [], msg.history, null))
          break
        }
        case 'select': {
          // Display-only: opponent's chosen option.
          try {
            const move = makeMove(chess, msg.san)
            addMoveToSelection(move, false)
          } catch {
            netRef.current?.send({ type: 'resyncRequest' })
          }
          break
        }
        case 'clearSelection': {
          if (prev.selectedMoves.length > 0) {
            commit({ ...prev, selectedMoves: [], phase: 'selecting' })
          }
          break
        }
        case 'resolve': {
          // Verify: every declared option must be legal, and played must be
          // one of the declared options.
          try {
            const legal = getLegalMoves(chess)
            const sans = new Set(legal.map((m) => m.san))
            const optionsOk =
              msg.options.length >= 1 &&
              msg.options.length <= 2 &&
              msg.options.every((s) => sans.has(s))
            if (!optionsOk || !msg.options.includes(msg.played)) {
              throw new Error('resolve verification failed')
            }
            chess.move(msg.played)
            const entry: HistoryEntry = {
              moveNumber: chess.moveNumber(),
              player: prev.turn,
              options: msg.options,
              played: msg.played,
            }
            commit(buildState(chess, [], [...prev.history, entry], null))
          } catch {
            netRef.current?.send({ type: 'resyncRequest' })
          }
          break
        }
        case 'undo': {
          if (prev.selectedMoves.length > 0 || prev.pendingPromotion) {
            commit({ ...prev, selectedMoves: [], pendingPromotion: null, phase: 'selecting' })
            break
          }
          if (prev.history.length === 0) break
          chess.undo()
          let history = prev.history.slice(0, -1)
          const last = prev.history[prev.history.length - 1]
          if (last.options.length === 1 && history.length > 0) {
            chess.undo()
            history = history.slice(0, -1)
          }
          lastAutoFenRef.current = null
          commit(buildState(chess, [], history, null))
          break
        }
        case 'restart': {
          chessRef.current = new Chess()
          lastAutoFenRef.current = null
          commit(buildState(chessRef.current, [], [], null))
          break
        }
        case 'resyncRequest': {
          netRef.current?.send({
            type: 'resyncState',
            fen: chess.fen(),
            history: prev.history,
          })
          break
        }
        case 'resyncState': {
          chess.load(msg.fen)
          lastAutoFenRef.current = null
          commit(buildState(chess, [], msg.history, null))
          break
        }
        case 'error':
          break
      }
    },
    [addMoveToSelection, commit],
  )

  // Auto-play when only a single legal move exists (no choice to make).
  // In net games only the side to move executes it (and broadcasts).
  useEffect(() => {
    if (state.phase !== 'selecting') return
    if (netRef.current && state.turn !== netRef.current.myColor) return
    const legal = getLegalMoves(chessRef.current)
    if (legal.length === 1 && lastAutoFenRef.current !== state.fen) {
      lastAutoFenRef.current = state.fen
      playSingle(legal[0])
    }
  }, [state.phase, state.fen, playSingle])

  return {
    state,
    handleMoveSelect,
    resolve,
    undo,
    startNewGame,
    choosePromotion,
    cancelPromotion,
    applyRemote,
    isMyTurn,
  }
}