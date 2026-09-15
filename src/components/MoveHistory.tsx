import type { HistoryEntry } from '../types'

export default function MoveHistory({ history }: { history: HistoryEntry[] }) {
  return (
    <div className="history">
      <h2>История</h2>
      {history.length === 0 && <p className="empty">Пока нет ходов</p>}
      <ol className="history-list">
        {history.map((entry, i) => (
          <li key={i} className="history-entry">
            <span className="move-num">{entry.moveNumber}.</span>
            <span className={`player ${entry.player}`}>
              {entry.player === 'w' ? 'Белые' : 'Чёрные'}
            </span>
            <span className="options">
              {entry.options.map((o, j) => (
                <span
                  key={j}
                  className={`option ${o === entry.played ? 'played' : ''}`}
                >
                  {o}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}