import type { GameResult } from '../types'

export default function GameOverOverlay({
  result,
  onRestart,
}: {
  result: GameResult
  onRestart: () => void
}) {
  const title =
    result.reason === 'checkmate'
      ? `${result.winner === 'w' ? 'Белые' : 'Чёрные'} победили матом!`
      : result.reason === 'stalemate'
        ? 'Пат — ничья'
        : 'Ничья'

  return (
    <div className="gameover-overlay">
      <div className="gameover-card">
        <h2>{title}</h2>
        <button onClick={onRestart}>🔄 Новая игра</button>
      </div>
    </div>
  )
}