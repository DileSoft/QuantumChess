import { useQuantumChess } from './game/useQuantumChess'
import Board from './components/Board'
import MoveHistory from './components/MoveHistory'
import PromotionModal from './components/PromotionModal'
import GameOverOverlay from './components/GameOverOverlay'
import './styles.css'

export default function App() {
  const game = useQuantumChess()
  const { state } = game
  const turnName = state.turn === 'w' ? 'Белые' : 'Чёрные'

  return (
    <div className="app">
      <header className="app-header">
        <h1>Квантовые шахматы</h1>
        <p className="subtitle">Выберите два хода — один выполнится случайно</p>
      </header>

      <div className="layout">
        <div className="board-wrap">
          <Board game={game} />

          {state.phase === 'resolving' && (
            <button className="resolve-btn" onClick={game.resolve}>
              🎲 Разрешить ход
            </button>
          )}

          {state.phase === 'gameover' && state.result && (
            <GameOverOverlay result={state.result} onRestart={game.startNewGame} />
          )}
        </div>

        <aside className="sidebar">
          <div className="status">
            {state.phase === 'gameover' ? (
              'Игра окончена'
            ) : (
              <>
                Ход: <strong>{turnName}</strong>
              </>
            )}
            {state.phase === 'selecting' && (
              <span className="hint">
                Выберите 2 хода ({state.selectedMoves.length}/2)
              </span>
            )}
            {state.phase === 'resolving' && (
              <span className="hint">Нажмите «Разрешить ход»</span>
            )}
          </div>

          <div className="controls">
            <button
              onClick={game.undo}
              disabled={
                state.history.length === 0 && state.selectedMoves.length === 0
              }
            >
              ↩ Отменить
            </button>
            <button onClick={game.startNewGame}>🔄 Новая игра</button>
          </div>

          <MoveHistory history={state.history} />
        </aside>
      </div>

      {state.pendingPromotion && (
        <PromotionModal
          color={state.turn}
          onSelect={game.choosePromotion}
          onCancel={game.cancelPromotion}
        />
      )}
    </div>
  )
}