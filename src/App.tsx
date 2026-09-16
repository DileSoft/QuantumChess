import { useEffect, useMemo, useState } from 'react'
import { useQuantumChess, type NetAdapter } from './game/useQuantumChess'
import { usePeerSession } from './net/usePeerSession'
import Board from './components/Board'
import MoveHistory from './components/MoveHistory'
import PromotionModal from './components/PromotionModal'
import GameOverOverlay from './components/GameOverOverlay'
import Lobby from './components/Lobby'
import './styles.css'

type Mode = 'hotseat' | 'online'

export default function App() {
  const [mode, setMode] = useState<Mode>('hotseat')
  const session = usePeerSession()

  const net: NetAdapter | undefined = useMemo(
    () =>
      mode === 'online' && session.myColor
        ? { myColor: session.myColor, send: session.send }
        : undefined,
    [mode, session.myColor, session.send],
  )

  const game = useQuantumChess(net)
  const { state } = game
  const turnName = state.turn === 'w' ? 'Белые' : 'Чёрные'

  // Route incoming peer messages into the game.
  useEffect(() => {
    session.onMessage((msg) => game.applyRemote(msg))
  }, [session, game])

  // Host sends initial sync when the guest connects.
  useEffect(() => {
    if (
      mode === 'online' &&
      session.status === 'connected' &&
      session.isHost &&
      session.myColor
    ) {
      session.send({
        type: 'hello',
        protocol: 1,
        hostColor: session.myColor,
        fen: state.fen,
        history: state.history,
      })
    }
    // Send once per connection; state is start position for a fresh room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, session.status, session.isHost])

  // Auto-join via ?room=<code> share link.
  // NOTE: no cleanup here — usePeerSession intentionally skips unmount
  // teardown so StrictMode's remount doesn't kill the joining peer.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (!room) return
    setMode('online')
    session.joinRoom(room)
    window.history.replaceState(null, '', window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connected = mode === 'online' && session.status === 'connected'
  // Board shows only when we know our color (guest learns it from hello).
  const ready = mode === 'hotseat' || (connected && session.myColor != null)
  const myColorName =
    session.myColor === 'w' ? 'Белые' : session.myColor === 'b' ? 'Чёрные' : null

  function switchMode(next: Mode) {
    if (next === mode) return
    if (mode === 'online') session.leave()
    setMode(next)
    game.startNewGame()
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Квантовые шахматы</h1>
        <p className="subtitle">Выберите два хода — один выполнится случайно</p>
        <div className="mode-switch">
          <button
            className={mode === 'hotseat' ? 'active' : ''}
            onClick={() => switchMode('hotseat')}
          >
            🪑 Два игрока
          </button>
          <button
            className={mode === 'online' ? 'active' : ''}
            onClick={() => switchMode('online')}
          >
            🌐 По сети
          </button>
        </div>
      </header>

      {mode === 'online' && !ready && <Lobby session={session} />}

      {ready && (
        <div className="layout">
          <div className="board-wrap">
            <Board game={game} interactiveColor={session.myColor} />

            {state.phase === 'resolving' && game.isMyTurn && (
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
              {mode === 'online' && (
                <span className="hint">
                  Вы: <strong>{myColorName}</strong>
                  {session.code && <> · Комната {session.code}</>}
                </span>
              )}
              {state.phase === 'gameover' ? (
                'Игра окончена'
              ) : (
                <>
                  Ход: <strong>{turnName}</strong>
                </>
              )}
              {state.phase === 'selecting' &&
                (game.isMyTurn ? (
                  <span className="hint">
                    Выберите 2 хода ({state.selectedMoves.length}/2)
                  </span>
                ) : (
                  <span className="hint">Ход соперника…</span>
                ))}
              {state.phase === 'resolving' &&
                (game.isMyTurn ? (
                  <span className="hint">Нажмите «Разрешить ход»</span>
                ) : (
                  <span className="hint">Соперник разрешает ход…</span>
                ))}
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

            {mode === 'online' && (
              <button className="secondary leave-btn" onClick={() => switchMode('hotseat')}>
                Покинуть комнату
              </button>
            )}

            <MoveHistory history={state.history} />
          </aside>
        </div>
      )}

      {state.pendingPromotion && game.isMyTurn && (
        <PromotionModal
          color={state.turn}
          onSelect={game.choosePromotion}
          onCancel={game.cancelPromotion}
        />
      )}
    </div>
  )
}