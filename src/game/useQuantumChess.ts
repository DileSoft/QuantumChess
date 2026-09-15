import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import type { GameResult, HistoryEntry, PendingPromotion, Phase } from '../types'
import {
  getGameResult,
  getLegalMoves,
  makeMove,
  pickRandom,
  sameMove,
} from './quantumChess'

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

export function useQuantumChess(): QuantumChessApi {
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

  const commit = useCallback((next: GameState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const startNewGame = useCallback(() => {
    chessRef.current = new Chess()
    lastAutoFenRef.current = null
    commit(buildState(chessRef.current, [], [], null))
  }, [commit])

  const addMoveToSelection = useCallback(
    (move: Move) => {
      const prev = stateRef.current
      if (prev.phase !== 'selecting' || prev.selectedMoves.length >= 2) return
      if (prev.selectedMoves.some((m) => sameMove(m, move))) return
      const selectedMoves = [...prev.selectedMoves, move]
      commit({
        ...prev,
        selectedMoves,
        phase: selectedMoves.length >= 2 ? 'resolving' : 'selecting',
      })
    },
    [commit],
  )

  const handleMoveSelect = useCallback(
    (input: { from: string; to: string }) => {
      const legal = getLegalMoves(chessRef.current).find(
        (m) => m.from === input.from && m.to === input.to,
      )
      if (!legal) return
      if (legal.promotion) {
        commit({
          ...stateRef.current,
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
    },
    [commit],
  )

  const cancelPromotion = useCallback(() => {
    commit({ ...stateRef.current, pendingPromotion: null })
  }, [commit])

  const playSingle = useCallback(
    (move: Move) => {
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
    },
    [commit],
  )

  const resolve = useCallback(() => {
    const prev = stateRef.current
    if (prev.phase !== 'resolving' || prev.selectedMoves.length < 2) return
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
  }, [commit])

  const undo = useCallback(() => {
    const prev = stateRef.current
    const chess = chessRef.current
    if (prev.selectedMoves.length > 0 || prev.pendingPromotion) {
      commit({ ...prev, selectedMoves: [], pendingPromotion: null, phase: 'selecting' })
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
  }, [commit])

  // Auto-play when only a single legal move exists (no choice to make).
  useEffect(() => {
    if (state.phase !== 'selecting') return
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
  }
}