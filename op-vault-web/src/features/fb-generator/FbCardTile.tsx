import { peso } from '@/lib/utils';
import { resolveImageUrl } from '@/components/common/CardImage';
import storeLogo from '@/assets/LOGO.png';
import type { FbCard, OverlayConfig } from './types';

// A single card tile with an overlay. `scale` lets an export clone render larger.
// `inSet` cards drop their individual price/qty (the set banner carries the price),
// but their note still shows when notes are enabled.
export function FbCardTile({ card, config, scale = 1, aspect = '5 / 7', inSet = false }: {
  card: FbCard; config: OverlayConfig; scale?: number; aspect?: string; inSet?: boolean;
}) {
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

  // In-set cards hide their own price & quantity (the spanning set banner shows the price).
  const showPrice = config.showPrice && !inSet;
  const showQty = config.showQuantity && !inSet && card.quantity > 1;
  const showNote = config.showNotes && !!card.note;
  const hasSecondary = showQty || config.showCardNumber || showNote;

  const info = (
    <>
      {showPrice && <div style={{ fontSize: fs * 1.15, fontWeight: 800, color: textColor, lineHeight: 1.1 }}>{peso(card.price)}</div>}
      {(showQty || config.showCardNumber || showNote) && (
        <div style={{ display: 'flex', gap: fs * 0.5, flexWrap: 'wrap', marginTop: fs * 0.15 }}>
          {showQty && <span style={{ fontSize: fs * 0.72, fontWeight: 600, color: subColor }}>Qty {card.quantity}</span>}
          {config.showCardNumber && <span style={{ fontSize: fs * 0.72, fontWeight: 600, color: subColor }}>{card.cardNumber}</span>}
          {card.grade && <span style={{ fontSize: fs * 0.72, fontWeight: 700, color: subColor }}>{card.grade}</span>}
          {showNote && <span style={{ fontSize: fs * 0.72, fontWeight: 700, color: subColor }}>{card.note}</span>}
        </div>
      )}
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
        <div className="absolute" style={{ 
          top: 8 * scale, 
          left: 8 * scale, 
          borderRadius: 8 * scale, 
          overflow: 'hidden', 
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)' 
        }}>
          <img 
            src={storeLogo} 
            alt="RB's TCG Logo" 
            style={{ width: fs * 2.8, height: 'auto', display: 'block' }} 
          />
        </div>
      )}

      {card.badge !== 'none' && (
        <div className="absolute" style={{ top: 8 * scale, right: 8 * scale, padding: `${3 * scale}px ${8 * scale}px`, borderRadius: 6 * scale,
          fontSize: fs * 0.7, fontWeight: 800, color: '#fff', background: card.badge === 'sold' ? '#DC2626' : '#D97706' }}>
          {card.badge === 'sold' ? 'SOLD' : 'RESERVED'}
        </div>
      )}

      {config.textPosition === 'pill' ? (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center" style={{ paddingBottom: fs * 0.55, gap: fs * 0.28 }}>
          {showPrice && (
            <div style={{
              background: `rgba(255,255,255,${0.55 + config.opacity * 0.4})`,
              color: '#0b0b0d', fontWeight: 800, fontSize: fs * 1.1, lineHeight: 1,
              borderRadius: 999, padding: `${fs * 0.24}px ${fs * 0.8}px`,
              boxShadow: '0 1px 4px rgba(0,0,0,.28)',
            }}>
              {peso(card.price)}
            </div>
          )}
          {hasSecondary && (
            <div style={{
              background: `rgba(255,255,255,${0.4 + config.opacity * 0.4})`,
              color: '#111', fontWeight: 700, fontSize: fs * 0.66, lineHeight: 1,
              borderRadius: 999, padding: `${fs * 0.16}px ${fs * 0.6}px`,
              display: 'flex', gap: fs * 0.4, alignItems: 'center',
            }}>
              {showQty && <span>Qty {card.quantity}</span>}
              {config.showCardNumber && <span>{card.cardNumber}</span>}
              {showNote && <span>{card.note}</span>}
            </div>
          )}
        </div>
      ) : config.textPosition === 'top' ? (
        hasSecondary || showPrice ? <div className="absolute inset-x-0 top-0" style={{ padding: fs * 0.7, background: topGradient }}>{info}</div> : null
      ) : config.textPosition === 'bottom-split' ? (
        <>
          {showPrice && (
            <div className="absolute" style={{ bottom: fs * 0.6, right: fs * 0.6, padding: `${fs * 0.25}px ${fs * 0.5}px`, borderRadius: 6 * scale,
              background: dark ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.7)', fontSize: fs * 1.05, fontWeight: 800, color: textColor }}>
              {peso(card.price)}
            </div>
          )}
          {(showQty || config.showCardNumber || showNote) && (
            <div className="absolute inset-x-0 bottom-0" style={{ padding: fs * 0.7, background: gradient }}>
              <div style={{ display: 'flex', gap: fs * 0.5, flexWrap: 'wrap' }}>
                {showQty && <span style={{ fontSize: fs * 0.72, fontWeight: 600, color: subColor }}>Qty {card.quantity}</span>}
                {config.showCardNumber && <span style={{ fontSize: fs * 0.72, fontWeight: 600, color: subColor }}>{card.cardNumber}</span>}
                {showNote && <span style={{ fontSize: fs * 0.72, fontWeight: 700, color: subColor }}>{card.note}</span>}
              </div>
            </div>
          )}
        </>
      ) : (
        (hasSecondary || showPrice) ? <div className="absolute inset-x-0 bottom-0" style={{ padding: fs * 0.7, background: gradient }}>{info}</div> : null
      )}
    </div>
  );
}
