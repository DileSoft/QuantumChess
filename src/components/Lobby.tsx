import { useState } from 'react'
import type { Color } from 'chess.js'
import type { PeerSession } from '../net/usePeerSession'
import { clearPeerConfig, savePeerConfig } from '../net/peerConfig'

export default function Lobby({ session }: { session: PeerSession }) {
  const { status, code, isHost, error } = session
  const [joinCode, setJoinCode] = useState('')
  const [hostColor, setHostColor] = useState<Color>('w')
  const [showSrv, setShowSrv] = useState(false)
  const [srvHost, setSrvHost] = useState('')
  const [srvPort, setSrvPort] = useState('443')
  const [srvPath, setSrvPath] = useState('/peerjs')
  const [srvKey, setSrvKey] = useState('peerjs')
  const [srvSecure, setSrvSecure] = useState(true)

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

          <div className="lobby-section">
            <h3 onClick={() => setShowSrv((v) => !v)} style={{ cursor: 'pointer' }}>
              Сервер соединения {showSrv ? '▾' : '▸'}
            </h3>
            {showSrv && (
              <>
                <p className="hint">
                  Пустой хост — публичный брокер PeerJS. Свой сервер: хост, порт,
                  путь и ключ (должны совпадать с server/.env).
                </p>
                <div className="lobby-row">
                  <input
                    placeholder="Хост (example.com)"
                    value={srvHost}
                    onChange={(e) => setSrvHost(e.target.value)}
                  />
                </div>
                <div className="lobby-row">
                  <input
                    placeholder="Порт"
                    value={srvPort}
                    onChange={(e) => setSrvPort(e.target.value)}
                  />
                  <input
                    placeholder="Путь"
                    value={srvPath}
                    onChange={(e) => setSrvPath(e.target.value)}
                  />
                </div>
                <div className="lobby-row">
                  <input
                    placeholder="Ключ"
                    value={srvKey}
                    onChange={(e) => setSrvKey(e.target.value)}
                  />
                  <button
                    className={srvSecure ? 'active' : ''}
                    onClick={() => setSrvSecure((v) => !v)}
                  >
                    {srvSecure ? '🔒 SSL' : '🔓 без SSL'}
                  </button>
                </div>
                <div className="lobby-row">
                  <button
                    onClick={() =>
                      savePeerConfig({
                        host: srvHost.trim(),
                        port: Number(srvPort) || 443,
                        path: srvPath || '/peerjs',
                        key: srvKey || 'peerjs',
                        secure: srvSecure,
                      })
                    }
                  >
                    Сохранить
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      clearPeerConfig()
                      setSrvHost('')
                    }}
                  >
                    Сбросить
                  </button>
                </div>
              </>
            )}
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