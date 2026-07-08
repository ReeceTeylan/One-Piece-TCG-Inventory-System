import { peso } from '@/lib/utils';
import { resolveImageUrl } from '@/components/common/CardImage';
import type { FbCard, OverlayConfig } from './types';

// A single 5:7 card tile with an overlay. `scale` lets the export clone render larger.
export function FbCardTile({ card, config, scale = 1, aspect = '5 / 7' }: { card: FbCard; config: OverlayConfig; scale?: number; aspect?: string }) {
  const dark = config.theme === 'dark';
  const gradient = dark
    ? `linear-gradient(to top, rgba(0,0,0,${config.opacity}) 0%, rgba(0,0,0,${config.opacity * 0.6}) 40%, rgba(0,0,0,0) 100%)`
    : `linear-gradient(to top, rgba(255,255,255,${config.opacity}) 0%, rgba(255,255,255,${config.opacity * 0.6}) 40%, rgba(255,255,255,0) 100%)`;
  const topGradient = dark
    ? `linear-gradient(to bottom, rgba(0,0,0,${config.opacity}) 0%, rgba(0,0,0,0) 100%)`
    : `linear-gradient(to bottom, rgba(255,255,255,${config.opacity}) 0%, rgba(255,255,255,0) 100%)`;
  const textColor = dark ? '#ffffff' : '#111111';
  const subColor = dark ? 'rgba(255,255,255,.82)' : 'rgba(17,17,17,.72)';
  const fs = config.fontSize * scale;

  const info = (
    <>
      {config.showPrice && <div style={{ fontSize: fs * 1.15, fontWeight: 800, color: textColor, lineHeight: 1.1 }}>{peso(card.price)}</div>}
      <div style={{ display: 'flex', gap: fs * 0.5, flexWrap: 'wrap', marginTop: fs * 0.15 }}>
        {config.showQuantity && <span style={{ fontSize: fs * 0.72, fontWeight: 600, color: subColor }}>Qty {card.quantity}</span>}
        {config.showCardNumber && <span style={{ fontSize: fs * 0.72, fontWeight: 600, color: subColor }}>{card.cardNumber}</span>}
        {card.grade && <span style={{ fontSize: fs * 0.72, fontWeight: 700, color: subColor }}>{card.grade}</span>}
      </div>
    </>
  );

  return (
    <div
      style={{ aspectRatio: aspect, borderRadius: config.borderRadius * scale, boxShadow: config.shadow ? `0 ${6 * scale}px ${20 * scale}px rgba(0,0,0,.25)` : 'none' }}
      className="relative overflow-hidden bg-muted"
    >
      {resolveImageUrl(card.imageUrl) ? (
        <img src={resolveImageUrl(card.imageUrl)} alt={card.name} crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full object-contain" style={{ background: dark ? '#0b0b0d' : '#f2f2f2' }} />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-center" style={{ background: dark ? '#0b0b0d' : '#f2f2f2' }}>
          <span style={{ fontSize: fs * 0.8, color: subColor }} className="px-2">{card.name}</span>
        </div>
      )}

      {config.showLogo && (
        <div className="absolute" style={{ top: 8 * scale, left: 8 * scale, display: 'flex', alignItems: 'center', gap: 5 * scale,
          padding: `${3 * scale}px ${6 * scale}px`, borderRadius: 6 * scale, background: dark ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.6)' }}>
          <span style={{ width: fs, height: fs, borderRadius: 4 * scale, background: 'linear-gradient(135deg,#475569,#0f172a)', display: 'grid', placeItems: 'center', fontSize: fs * 0.6, fontWeight: 800, color: '#fff' }}>OP</span>
        </div>
      )}

      {card.badge !== 'none' && (
        <div className="absolute" style={{ top: 8 * scale, right: 8 * scale, padding: `${3 * scale}px ${8 * scale}px`, borderRadius: 6 * scale,
          fontSize: fs * 0.7, fontWeight: 800, color: '#fff', background: card.badge === 'sold' ? '#DC2626' : '#D97706' }}>
          {card.badge === 'sold' ? 'SOLD' : 'RESERVED'}
        </div>
      )}

      {config.textPosition === 'pill' ? (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center"
          style={{ paddingBottom: fs * 0.55, gap: fs * 0.28 }}>
          {config.showPrice && (
            <div style={{
              background: `rgba(255,255,255,${0.55 + config.opacity * 0.4})`,
              color: '#0b0b0d', fontWeight: 800, fontSize: fs * 1.1, lineHeight: 1,
              borderRadius: 999, padding: `${fs * 0.24}px ${fs * 0.8}px`,
              boxShadow: '0 1px 4px rgba(0,0,0,.28)',
            }}>
              {peso(card.price)}
            </div>
          )}
          {(config.showQuantity || config.showCardNumber || card.note) && (
            <div style={{
              background: `rgba(255,255,255,${0.4 + config.opacity * 0.4})`,
              color: '#111', fontWeight: 700, fontSize: fs * 0.66, lineHeight: 1,
              borderRadius: 999, padding: `${fs * 0.16}px ${fs * 0.6}px`,
              display: 'flex', gap: fs * 0.4, alignItems: 'center',
            }}>
              {config.showQuantity && <span>Qty {card.quantity}</span>}
              {config.showCardNumber && <span>{card.cardNumber}</span>}
              {card.note && <span>{card.note}</span>}
            </div>
          )}
        </div>
      ) : config.textPosition === 'top' ? (
        <div className="absolute inset-x-0 top-0" style={{ padding: fs * 0.7, background: topGradient }}>{info}</div>
      ) : config.textPosition === 'bottom-split' ? (
        <>
          {config.showPrice && (
            <div className="absolute" style={{ bottom: fs * 0.6, right: fs * 0.6, padding: `${fs * 0.25}px ${fs * 0.5}px`, borderRadius: 6 * scale,
              background: dark ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.7)', fontSize: fs * 1.05, fontWeight: 800, color: textColor }}>
              {peso(card.price)}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0" style={{ padding: fs * 0.7, background: gradient }}>
            <div style={{ display: 'flex', gap: fs * 0.5 }}>
              {config.showQuantity && <span style={{ fontSize: fs * 0.72, fontWeight: 600, color: subColor }}>Qty {card.quantity}</span>}
              {config.showCardNumber && <span style={{ fontSize: fs * 0.72, fontWeight: 600, color: subColor }}>{card.cardNumber}</span>}
            </div>
          </div>
        </>
      ) : (
        <div className="absolute inset-x-0 bottom-0" style={{ padding: fs * 0.7, background: gradient }}>{info}</div>
      )}
    </div>
  );
}
