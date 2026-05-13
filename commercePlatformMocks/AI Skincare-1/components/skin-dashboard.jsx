/* Hubble — Skin Dashboard
   The post-quiz home base. Shows the user's skin profile + lets them compare
   their current routine against Hubble's recommended routine, individually
   purchase products, and "Save Routine" to lock it in.
*/

const { useState: dState, useEffect: dEffect, useMemo: dMemo, useRef: dRef } = React;

// ─────────────────────────────────────────────────────────────
// Extra products to flesh out current + recommended routines.
// (PRODUCTS from consumer-chat.jsx is the canonical store; we add a few more here.)
const DASH_PRODUCTS = {
  // CURRENT routine — what Maya is using today
  cetaphilCleanser: {
    id: 'cetaphil-1', brand: 'Cetaphil', name: 'Gentle Skin Cleanser',
    price: 14, tone: 'sand', tags: ['Cleanser', 'Daily'], rating: 4, reviewCount: 24800,
    why: "Fine, but it's a workhorse — not optimized for your reactive weeks.",
  },
  drunkVitC: {
    id: 'drunk-1', brand: 'Drunk Elephant', name: 'C-Firma Fresh Day Serum',
    price: 78, tone: 'rose', tags: ['Vitamin C', 'AM'], rating: 4, reviewCount: 5210,
    why: "Strong vitamin C — likely contributing to the redness you're seeing this week.",
  },
  laRocheMoist: {
    id: 'larp-1', brand: 'La Roche-Posay', name: 'Toleriane Double Repair Moisturizer',
    price: 22, tone: 'sage', tags: ['Moisturizer', 'AM/PM'], rating: 5, reviewCount: 18400,
    why: "Genuine keep — barrier-friendly and you tolerate it well.",
  },
  euceridSPF: {
    id: 'euc-1', brand: 'EltaMD', name: 'UV Clear Broad-Spectrum SPF 46',
    price: 41, tone: 'lime', tags: ['SPF', 'AM'], rating: 5, reviewCount: 32100,
    why: "Holy-grail SPF for sensitive skin. Definitely keeping this.",
  },
  oldNightCream: {
    id: 'nivea-1', brand: 'Nivea', name: 'Soft Moisturizing Cream',
    price: 8, tone: 'sand', tags: ['Moisturizer', 'PM'], rating: 3, reviewCount: 12400,
    why: "Heavy and occlusive — fine in winter but contributing to congestion now.",
  },
  // RECOMMENDED — Hubble's picks (some pulled from existing PRODUCTS)
};

// Recommended routine assembled from the product catalog
function makeRoutines() {
  const P = window.PRODUCTS || {};
  return {
    current: {
      am: [
        { step: 'Cleanser', product: DASH_PRODUCTS.cetaphilCleanser, status: 'swap' },
        { step: 'Serum',    product: DASH_PRODUCTS.drunkVitC,        status: 'remove' },
        { step: 'Moisturizer', product: DASH_PRODUCTS.laRocheMoist,  status: 'keep' },
        { step: 'SPF',      product: DASH_PRODUCTS.euceridSPF,       status: 'keep' },
      ],
      pm: [
        { step: 'Cleanser', product: DASH_PRODUCTS.cetaphilCleanser, status: 'swap' },
        { step: 'Moisturizer', product: DASH_PRODUCTS.oldNightCream, status: 'swap' },
      ],
    },
    recommended: {
      am: [
        { step: 'Cleanser',     product: P.peachPHCleanser, status: 'swap',  swapsFor: 'Cetaphil cleanser', why: 'Calmer surfactants — won\'t feed the redness on your nose.' },
        { step: 'Toner',        product: P.anuaCleanser,    status: 'new',   why: 'Adds the calming step missing from your AM. Heartleaf targets reactive flushes.' },
        { step: 'Serum',        product: P.cosrxSnail,      status: 'new',   why: 'Replaces the C-Firma during reactive weeks. Same glow, none of the sting.' },
        { step: 'Moisturizer',  product: DASH_PRODUCTS.laRocheMoist, status: 'keep', why: 'You already love this. We\'re keeping it as your AM lock-in.' },
        { step: 'SPF',          product: DASH_PRODUCTS.euceridSPF,   status: 'keep', why: 'Holy-grail for sensitive skin. Keep forever.' },
      ],
      pm: [
        { step: 'Cleanser',     product: P.peachPHCleanser, status: 'swap',  swapsFor: 'Cetaphil cleanser', why: 'Same swap as AM — one cleanser, both routines.' },
        { step: 'Treatment',    product: P.glowAvocado,     status: 'new',   why: 'Gentle retinol-adjacent for early texture. Start 2x / week.' },
        { step: 'Serum',        product: P.cosrxSnail,      status: 'new',   why: 'Doubles as your PM serum. One bottle, both routines.' },
        { step: 'Moisturizer',  product: DASH_PRODUCTS.laRocheMoist, status: 'swap', swapsFor: 'Nivea Soft', why: 'Same moisturizer AM and PM — simpler is better.' },
        { step: 'Mask · 2x wk', product: P.biodanceMask,    status: 'new',   why: 'Optional. Single-use overnight for a glassy morning.' },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Status pill for routine items
function StatusPill({ status }) {
  const map = {
    new:    { bg: 'var(--coral)',  fg: 'var(--ink)',  label: 'NEW' },
    swap:   { bg: 'var(--lilac)',  fg: 'var(--ink)',  label: 'SWAP' },
    keep:   { bg: 'transparent',   fg: 'var(--lime)', label: 'KEEP', border: '1px solid var(--lime)' },
    remove: { bg: 'transparent',   fg: '#FF8B7A',     label: 'REMOVE', border: '1px solid #FF8B7A' },
  };
  const s = map[status];
  return (
    <span className="font-mono" style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 8px', borderRadius: 999,
      background: s.bg, color: s.fg, border: s.border || 'none',
      fontSize: 9.5, letterSpacing: '0.1em', fontWeight: 600,
    }}>{s.label}</span>
  );
}

// ─────────────────────────────────────────────────────────────
// Small product line — used in routine columns
function RoutineProductRow({ idx, item, side, onBuy }) {
  const { product, step, status, why, swapsFor } = item;
  const dimmed = status === 'remove';
  const discount = side === 'recommended' && (status === 'new' || status === 'swap');
  const offerPct = discount ? (status === 'new' ? 25 : 15) : 0;
  const finalPrice = discount ? (product.price * (1 - offerPct / 100)) : product.price;

  return (
    <div style={{
      display: 'flex', gap: 14,
      padding: 14, borderRadius: 14,
      background: dimmed ? 'transparent' : 'var(--ink-2)',
      border: `1px solid ${dimmed ? 'var(--border)' : 'var(--border-2)'}`,
      opacity: dimmed ? 0.55 : 1,
      position: 'relative',
    }}>
      {/* Step index */}
      <div style={{
        width: 36, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <div className="font-mono" style={{
          width: 28, height: 28, borderRadius: 8,
          background: dimmed ? 'transparent' : 'var(--ink-3)',
          color: dimmed ? 'var(--fg-mute)' : 'var(--coral)',
          border: dimmed ? '1px dashed var(--border-2)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600,
        }}>{String(idx + 1).padStart(2, '0')}</div>
      </div>

      {/* Product image */}
      <ProductImage brand={product.brand} tone={product.tone} size="sm" />

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span className="font-mono" style={{
            fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: 'var(--fg-mute)',
          }}>{step}</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--fg-mute)' }} />
          <StatusPill status={status} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: dimmed ? 'var(--fg-dim)' : 'var(--paper)', lineHeight: 1.25 }}>
          {product.brand}
          {dimmed && <span style={{ color: 'var(--fg-mute)', fontWeight: 400, marginLeft: 6, textDecoration: 'line-through' }}> · {product.name}</span>}
        </div>
        {!dimmed && (
          <div style={{ fontSize: 12.5, color: 'var(--fg-dim)', lineHeight: 1.35, marginTop: 2 }}>
            {product.name}
          </div>
        )}

        {/* Reason / context */}
        {why && (
          <div style={{
            fontSize: 11.5, lineHeight: 1.45, color: 'var(--fg-dim)',
            padding: '8px 10px', marginTop: 10, borderRadius: 8,
            background: 'var(--ink-3)', border: '1px solid var(--border)',
          }}>
            {swapsFor && (
              <span className="font-mono" style={{ color: 'var(--lilac)', fontSize: 10, letterSpacing: '0.06em', marginRight: 6 }}>
                ↳ swaps for {swapsFor}
              </span>
            )}
            {why}
          </div>
        )}

        {/* Buy row */}
        {!dimmed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--paper)' }}>
                ${finalPrice.toFixed(2)}
              </span>
              {discount && (
                <span style={{ fontSize: 11, color: 'var(--fg-mute)', textDecoration: 'line-through' }}>
                  ${product.price}
                </span>
              )}
              {discount && (
                <span style={{
                  fontSize: 9.5, fontWeight: 700, color: 'var(--ink)',
                  background: 'var(--lime)', padding: '2px 6px', borderRadius: 999,
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                }}>−{offerPct}%</span>
              )}
            </div>
            <button onClick={() => onBuy && onBuy(product)} className="btn" style={{
              marginLeft: 'auto',
              padding: '6px 12px', fontSize: 12,
              background: side === 'recommended' ? 'var(--coral)' : 'var(--ink-4)',
              color: side === 'recommended' ? 'var(--ink)' : 'var(--fg)',
            }}>
              <Icon name="bag" size={11} stroke={2} />
              Buy
              <Icon name="arrow" size={10} stroke={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Routine column wrapper (Current OR Recommended)
function RoutineColumn({ title, kicker, items, side, totals, onBuy, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 12, paddingBottom: 14, marginBottom: 4,
        borderBottom: `1px solid ${accent || 'var(--border)'}`,
      }}>
        <div>
          <div className="font-mono" style={{
            fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: accent || 'var(--fg-mute)', marginBottom: 4,
          }}>{kicker}</div>
          <div className="font-display" style={{ fontSize: 24, lineHeight: 1, color: 'var(--paper)' }}>
            {title}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="font-mono" style={{ fontSize: 9.5, color: 'var(--fg-mute)', letterSpacing: '0.08em' }}>
            {items.filter(i => i.status !== 'remove').length} STEPS
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--paper)', marginTop: 2 }}>
            ${totals.toFixed(0)}
          </div>
        </div>
      </div>
      {items.map((it, i) => (
        <RoutineProductRow key={`${it.step}-${it.product.id}-${i}`} idx={i} item={it} side={side} onBuy={onBuy} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat tile in the hero header
function StatTile({ label, value, sub, accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      padding: '14px 16px', borderRadius: 14,
      background: 'var(--ink-2)', border: '1px solid var(--border)',
    }}>
      <div className="font-mono" style={{
        fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--fg-mute)', marginBottom: 6,
      }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: accent || 'var(--paper)', lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN — Skin Dashboard screen
function SkinDashboard({ onChat, onRequiz }) {
  const routines = dMemo(() => makeRoutines(), []);
  const [slot, setSlot] = dState('am'); // 'am' | 'pm'
  const [saved, setSaved] = dState(false);
  const [saving, setSaving] = dState(false);
  const [toast, setToast] = dState(null);

  const current = routines.current[slot];
  const recommended = routines.recommended[slot];

  const currentTotal = current.filter(i => i.status !== 'remove').reduce((s, i) => s + i.product.price, 0);
  const recTotal = recommended.reduce((s, i) => s + i.product.price, 0);
  const recTotalDiscounted = recommended.reduce((s, i) => {
    const off = i.status === 'new' ? 0.25 : i.status === 'swap' ? 0.15 : 0;
    return s + i.product.price * (1 - off);
  }, 0);
  const savings = recTotal - recTotalDiscounted;

  const handleSave = () => {
    if (saved) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setToast('Routine saved · check-in scheduled in 2 weeks');
      setTimeout(() => setToast(null), 3500);
    }, 800);
  };

  const handleBuy = (product) => {
    setToast(`Opening ${product.brand} · ${product.name}`);
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <HubbleWordmark height={20} />
          <span style={{ height: 18, width: 1, background: 'var(--border-2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HubbleAvatar size={22} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.1 }}>Maya's Dashboard</div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg-mute)', letterSpacing: '0.06em' }}>
                Skin profile · v1 · updated 2 days ago
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onRequiz} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }}>
            <Icon name="sliders" size={13} /> Re-take quiz
          </button>
          <button onClick={onChat} className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }}>
            <Icon name="chat" size={13} /> Ask Hubble
          </button>
          <button className="btn btn-ghost" style={{ padding: 8 }}>
            <Icon name="settings" size={14} />
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 32px 140px' }}>

        {/* HERO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32, alignItems: 'flex-end', marginBottom: 36 }}>
          <div>
            <div className="font-mono" style={{
              fontSize: 11, letterSpacing: '0.12em', color: 'var(--coral)',
              textTransform: 'uppercase', marginBottom: 14,
            }}>
              Your skin · this week
            </div>
            <h1 className="font-display" style={{
              fontSize: 'clamp(40px, 5.4vw, 68px)', lineHeight: 1.02, letterSpacing: '-0.025em',
              color: 'var(--paper)', margin: 0,
            }}>
              Hi Maya — here's the<br/>
              routine I built <em style={{ color: 'var(--coral)' }}>for you</em>.
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--fg-dim)', maxWidth: 520, marginTop: 18 }}>
              Based on your quiz: combination + sensitive skin, reactive this week, dehydration and early lines.
              Two products to keep, three to swap, one to retire. Purchase anything individually, or save the whole routine.
            </p>
          </div>

          {/* Stats column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <StatTile label="Skin type" value="Combo · sensitive" sub="Reactive this week" />
              <StatTile label="Top concerns" value="Redness · dehydration" sub="+ early texture" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <StatTile label="Budget" value="$30 – $80 / product" sub="We stayed inside" accent="var(--lime)" />
              <StatTile label="Avoiding" value="Fragrance · drying alcohol" sub="Filtered out 2,140 SKUs" />
            </div>
          </div>
        </div>

        {/* AM/PM tabs */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'inline-flex', padding: 4, borderRadius: 999,
            background: 'var(--ink-2)', border: '1px solid var(--border-2)',
          }}>
            {[
              { id: 'am', label: 'Morning', glyph: '☀' },
              { id: 'pm', label: 'Evening', glyph: '☾' },
            ].map(t => (
              <button key={t.id} onClick={() => setSlot(t.id)} style={{
                padding: '8px 18px', borderRadius: 999, fontSize: 13, fontWeight: 500,
                background: slot === t.id ? 'var(--paper)' : 'transparent',
                color: slot === t.id ? 'var(--ink)' : 'var(--fg-dim)',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                transition: 'all .15s ease',
              }}>
                <span className="font-display" style={{ fontSize: 16, color: slot === t.id ? 'var(--coral)' : 'var(--fg-mute)' }}>
                  {t.glyph}
                </span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Diff legend */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--fg-mute)', letterSpacing: '0.08em' }}>CHANGES THIS SLOT</span>
            <DiffPill color="var(--coral)" label="3 NEW" />
            <DiffPill color="var(--lilac)" label="2 SWAPS" />
            <DiffPill color="var(--lime)"  label="2 KEEPS" hollow />
          </div>
        </div>

        {/* COMPARE columns */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 24,
          alignItems: 'flex-start',
        }}>
          <RoutineColumn
            title="What you use today"
            kicker="Current routine"
            items={current}
            side="current"
            totals={currentTotal}
            onBuy={handleBuy}
          />

          {/* Center divider — arrow with note */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 10, padding: '40px 0', minWidth: 64,
          }}>
            <div style={{ flex: 1, width: 1, background: 'var(--border-2)' }} />
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--coral)', color: 'var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(255,107,71,0.3)',
            }}>
              <Icon name="arrow" size={18} stroke={2.4} />
            </div>
            <div className="font-mono" style={{
              fontSize: 9, letterSpacing: '0.12em', color: 'var(--fg-mute)',
              textTransform: 'uppercase', textAlign: 'center', writingMode: 'horizontal-tb',
            }}>
              Hubble<br/>recommends
            </div>
            <div style={{ flex: 1, width: 1, background: 'var(--border-2)' }} />
          </div>

          <RoutineColumn
            title="What I'd build for you"
            kicker="Recommended · v1"
            items={recommended}
            side="recommended"
            totals={recTotalDiscounted}
            onBuy={handleBuy}
            accent="var(--coral)"
          />
        </div>

        {/* DIFF SUMMARY */}
        <div style={{
          marginTop: 48, padding: 28, borderRadius: 20,
          background: 'var(--ink-2)', border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, alignItems: 'flex-start' }}>
            <div>
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--fg-mute)', textTransform: 'uppercase', marginBottom: 8 }}>
                What this routine targets
              </div>
              <div className="font-display" style={{ fontSize: 22, color: 'var(--paper)', lineHeight: 1.15, marginBottom: 14 }}>
                Calm the reactive week, then build slowly toward texture.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { t: 'Redness', accent: 'var(--coral)' },
                  { t: 'Dehydration', accent: 'var(--lime)' },
                  { t: 'Early texture', accent: 'var(--lilac)' },
                  { t: 'Barrier repair', accent: 'var(--rose)' },
                ].map(c => (
                  <span key={c.t} style={{
                    padding: '5px 11px', borderRadius: 999, fontSize: 12,
                    background: 'transparent', border: `1px solid ${c.accent}`,
                    color: c.accent, fontWeight: 500,
                  }}>{c.t}</span>
                ))}
              </div>
            </div>

            <div>
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--fg-mute)', textTransform: 'uppercase', marginBottom: 8 }}>
                What changed
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <DiffLine glyph="+" color="var(--coral)">
                  <strong>Anua Heartleaf Toner</strong> added to AM
                </DiffLine>
                <DiffLine glyph="↻" color="var(--lilac)">
                  <strong>COSRX Snail Essence</strong> replaces C-Firma during reactive weeks
                </DiffLine>
                <DiffLine glyph="↻" color="var(--lilac)">
                  <strong>Peach &amp; Lily Cleanser</strong> replaces Cetaphil
                </DiffLine>
                <DiffLine glyph="−" color="#FF8B7A">
                  <strong>Nivea Soft Cream</strong> retired from PM
                </DiffLine>
              </div>
            </div>

            <div>
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--fg-mute)', textTransform: 'uppercase', marginBottom: 8 }}>
                The math
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <MathRow label="Recommended at full price" value={`$${recTotal.toFixed(0)}`} />
                <MathRow label="Hubble offers applied" value={`−$${savings.toFixed(0)}`} accent="var(--lime)" />
                <div style={{ height: 1, background: 'var(--border-2)' }} />
                <MathRow label="Your total" value={`$${recTotalDiscounted.toFixed(0)}`} bold />
                <div style={{ fontSize: 11, color: 'var(--fg-mute)', lineHeight: 1.45, marginTop: 2 }}>
                  vs your current spend of <span style={{ color: 'var(--paper)' }}>${(currentTotal).toFixed(0)}</span>{' '}
                  for {current.filter(i => i.status !== 'remove').length} steps. You're adding {recommended.length - current.filter(i => i.status !== 'remove').length} step{(recommended.length - current.filter(i => i.status !== 'remove').length) === 1 ? '' : 's'}.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SKIN JOURNAL placeholder */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginTop: 16 }}>
          <div style={{
            padding: 24, borderRadius: 20, background: 'var(--ink-2)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--fg-mute)', textTransform: 'uppercase' }}>
                Your skin, last 14 days
              </div>
              <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }}>Log today →</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, marginBottom: 12 }}>
              {[3, 4, 3, 5, 4, 3, 2, 3, 4, 5, 4, 4, 5, 5].map((v, i) => (
                <div key={i} style={{
                  flex: 1, height: `${v * 16}%`, borderRadius: 4,
                  background: v >= 4 ? 'var(--lime)' : v >= 3 ? 'var(--coral)' : '#FF8B7A',
                  opacity: 0.85,
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-mute)' }}>
              <span>2 wks ago</span>
              <span style={{ color: 'var(--lime)' }}>↑ Trending up since you added the Anua toner</span>
              <span>Today</span>
            </div>
          </div>

          <div style={{
            padding: 24, borderRadius: 20, background: 'var(--ink-2)',
            border: '1px solid var(--border)',
          }}>
            <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--fg-mute)', textTransform: 'uppercase', marginBottom: 8 }}>
              Next check-in
            </div>
            <div className="font-display" style={{ fontSize: 22, color: 'var(--paper)', lineHeight: 1.2 }}>
              In 14 days, I'll ask how things landed.
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--fg-dim)', marginTop: 10, lineHeight: 1.5 }}>
              I'll nudge you for a quick check-in. If your skin shifts before then, just open the chat — your dashboard updates with you.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={onChat} className="btn" style={{ background: 'var(--lime)', color: 'var(--ink)', padding: '8px 14px', fontSize: 12 }}>
                Open chat <Icon name="arrow" size={11} />
              </button>
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }}>
                Edit reminders
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* STICKY FOOTER — Save Routine */}
      <div style={{
        position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)',
        zIndex: 90, maxWidth: 'calc(100vw - 40px)',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 10px 10px 22px', borderRadius: 999,
        background: 'rgba(20,20,20,0.92)', backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-2)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 12, color: 'var(--fg-dim)',
          }}>
            <Icon name="bag" size={13} />
            {recommended.length} products
          </span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--fg-mute)' }} />
          <span style={{ fontSize: 12, color: 'var(--fg)' }}>
            <strong>${recTotalDiscounted.toFixed(0)}</strong>
            <span style={{ color: 'var(--fg-mute)', textDecoration: 'line-through', marginLeft: 6 }}>${recTotal.toFixed(0)}</span>
          </span>
          <span style={{
            fontSize: 10, color: 'var(--ink)', background: 'var(--lime)',
            padding: '2px 8px', borderRadius: 999, fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em', fontWeight: 600,
          }}>SAVE ${savings.toFixed(0)}</span>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn" style={{
          padding: '10px 18px', fontSize: 13,
          background: saved ? 'var(--lime)' : 'var(--coral)',
          color: 'var(--ink)', fontWeight: 600,
          minWidth: 150, justifyContent: 'center',
          opacity: saving ? 0.7 : 1,
          transition: 'all .25s ease',
        }}>
          {saving ? (
            <><span style={{
              display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
              border: '2px solid var(--ink)', borderTopColor: 'transparent',
              animation: 'qspin 0.7s linear infinite',
            }} /> Saving…</>
          ) : saved ? (
            <><Icon name="check" size={14} stroke={2.6} /> Routine saved</>
          ) : (
            <><Icon name="heart" size={13} /> Save routine</>
          )}
        </button>
        <button className="btn" style={{
          padding: '10px 16px', fontSize: 13, background: 'var(--paper)', color: 'var(--ink)', fontWeight: 600,
        }}>
          Buy all <Icon name="arrow" size={12} />
        </button>
        <style>{`@keyframes qspin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, padding: '10px 16px', borderRadius: 999,
          background: 'var(--ink-2)', border: '1px solid var(--lime)',
          color: 'var(--lime)', fontSize: 12, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          animation: 'toastIn .3s ease',
        }}>
          <Icon name="check" size={13} stroke={2.6} />
          {toast}
          <style>{`@keyframes toastIn { from { transform: translate(-50%, -8px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}</style>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers (DiffPill, DiffLine, MathRow)
function DiffPill({ color, label, hollow }) {
  return (
    <span className="font-mono" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999, fontSize: 10,
      letterSpacing: '0.08em', fontWeight: 600,
      background: hollow ? 'transparent' : color,
      color: hollow ? color : 'var(--ink)',
      border: hollow ? `1px solid ${color}` : 'none',
    }}>{label}</span>
  );
}

function DiffLine({ glyph, color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, lineHeight: 1.45 }}>
      <span style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        background: color, color: 'var(--ink)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
        marginTop: 1,
      }}>{glyph}</span>
      <span style={{ color: 'var(--fg-dim)', fontSize: 13 }}>{children}</span>
    </div>
  );
}

function MathRow({ label, value, accent, bold }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>{label}</span>
      <span style={{
        fontSize: bold ? 22 : 14,
        fontWeight: bold ? 700 : 600,
        color: accent || 'var(--paper)',
        fontFamily: bold ? 'var(--font-display)' : 'inherit',
      }}>{value}</span>
    </div>
  );
}

Object.assign(window, { SkinDashboard });
