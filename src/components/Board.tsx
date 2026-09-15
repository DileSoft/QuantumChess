import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import type { QuantumChessApi } from '../game/useQuantumChess'

const ARROW_COLORS = ['#4caf50', '#2196f3'] // 1st option green, 2nd option blue

export default function Board({ game }: { game: QuantumChessApi }) {
  const { state } = game
  const [clickFrom, setClickFrom] = useState<string | null>(null)

  const canSelect = state.phase === 'selecting'

  const arrows = state.selectedMoves.map((m, i) => ({
    startSquare: m.from,
    endSquare: m.to,
    color: ARROW_COLORS[i % ARROW_COLORS.length],
  }))

  const squareStyles: Record<string, React.CSSProperties> = {}
  state.selectedMoves.forEach((m, i) => {
    const color = ARROW_COLORS[i % ARROW_COLORS.length]
    squareStyles[m.from] = { backgroundColor: `${color}66` }
    squareStyles[m.to] = { backgroundColor: `${color}66` }
  })
  if (clickFrom) {
    squareStyles[clickFrom] = { backgroundColor: 'rgba(255, 235, 59, 0.45)' }
  }

  function onSquareClick({
    square,
    piece,
  }: {
    square: string
    piece: { pieceType: string } | null
  }) {
    if (!canSelect) return
    if (!clickFrom) {
      if (piece && piece.pieceType[0] === state.turn) {
        setClickFrom(square)
      }
      return
    }
    if (square === clickFrom) {
      setClickFrom(null)
      return
    }
    game.handleMoveSelect({ from: clickFrom, to: square })
    setClickFrom(null)
  }

  function onPieceDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string
    targetSquare: string | null
  }) {
    if (!canSelect || !targetSquare) return false
    game.handleMoveSelect({ from: sourceSquare, to: targetSquare })
    return false
  }

  return (
    <Chessboard
      options={{
        id: 'quantum-board',
        position: state.fen,
        boardOrientation: 'white',
        arrows,
        squareStyles,
        allowDrawingArrows: false,
        onSquareClick,
        onPieceDrop,
        canDragPiece: ({ piece }) =>
          canSelect && piece.pieceType[0] === state.turn,
      }}
    />
  )
}