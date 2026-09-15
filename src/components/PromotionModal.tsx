import type { Color } from 'chess.js'

const PIECES = ['q', 'r', 'b', 'n'] as const
const NAMES: Record<string, string> = {
  q: 'Ферзь',
  r: 'Ладья',
  b: 'Слон',
  n: 'Конь',
}
const GLYPHS: Record<string, Record<Color, string>> = {
  q: { w: '♕', b: '♛' },
  r: { w: '♖', b: '♜' },
  b: { w: '♗', b: '♝' },
  n: { w: '♘', b: '♞' },
}

export default function PromotionModal({
  color,
  onSelect,
  onCancel,
}: {
  color: Color
  onSelect: (piece: string) => void
  onCancel: () => void
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Превращение пешки</h3>
        <div className="promotion-pieces">
          {PIECES.map((p) => (
            <button key={p} className="promo-piece" onClick={() => onSelect(p)}>
              <span className="promo-glyph">{GLYPHS[p][color]}</span>
              <span className="promo-name">{NAMES[p]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}