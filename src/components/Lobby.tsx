import { useState } from 'react'
import type { Color } from 'chess.js'
import type { PeerSession } from '../net/usePeerSession'

export default function Lobby({ session }: { session: PeerSession }) {
  const { status, code, isHost, error } = session
  const [joinCode, setJoinCode] = useState('')
  const [hostColor, setHostColor] = useState<Color>('w')

  const shareLink =
    code && typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${code}`
      : ''

  // Connected but color not assigned yet (guest waiting for host hello).
  if (status === 'connected') {
    return (
      <div className="lobby">
        <h2>Сетевая игра</h2>
        <div className="lobby-section">
          <p>Соединено. Получение цвета от хоста…</p>
          <button className="secondary" onClick={session.leave}>
            Отмена
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="lobby">
      <h2>Сетевая игра</h2>

      {status === 'idle' || status === 'error' ? (
        <>
          {error && <p className="lobby-error">{error}</p>}
          <div className="lobby-section">
            <h3>Создать комнату</h3>
            <div className="lobby-row">
              <span>Я играю:</span>
              <button
                className={hostColor === 'w' ? 'active' : ''}
                onClick={() => setHostColor('w')}
              >
                ♔ Белыми
              </button>
              <button
                className={hostColor === 'b' ? 'active' : ''}
                onClick={() => setHostColor('b')}
              >
                ♚ Чёрными
              </button>
            </div>
            <button
              className="primary"
              onClick={() => session.createRoom(hostColor)}
            >
              Создать
            </button>
          </div>

          <div className="lobby-section">
            <h3>Присоединиться</h3>
            <div className="lobby-row">
              <input
                placeholder="Код комнаты"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') session.joinRoom(joinCode)
                }}
              />
              <button className="primary" onClick={() => session.joinRoom(joinCode)}>
                Войти
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="lobby-section">
          {status === 'creating' && <p>Создание комнаты…</p>}
          {status === 'joining' && <p>Подключение к комнате {code}…</p>}
          {status === 'waiting' && isHost && (
            <>
              <p>
                Код комнаты: <strong className="room-code">{code}</strong>
              </p>
              <p className="hint">Отправьте сопернику ссылку:</p>
              <div className="lobby-row">
                <input readOnly value={shareLink} onFocus={(e) => e.target.select()} />
                <button
                  onClick={() => void navigator.clipboard?.writeText(shareLink)}
                >
                  📋
                </button>
              </div>
              <p className="hint">Ожидание соперника…</p>
            </>
          )}
          <button className="secondary" onClick={session.leave}>
            Отмена
          </button>
          {session.debugLog.length > 0 && (
            <details className="debug-log">
              <summary>Диагностика</summary>
              <pre>{session.debugLog.join('\n')}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}