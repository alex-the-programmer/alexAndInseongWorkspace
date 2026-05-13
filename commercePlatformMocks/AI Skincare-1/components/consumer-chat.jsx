/* Hubble Consumer Chat — main AI assistant experience */

const { useState: cState, useEffect: cEffect, useRef: cRef, useMemo: cMemo } = React;

// ─────────────────────────────────────────────────────────────
// Sample product data — fictional skincare brands per user's list
const PRODUCTS = {
  anuaCleanser: {
    id: 'anua-1', brand: 'Anua', name: 'Heartleaf 77% Soothing Toner',
    price: 28, tone: 'sage', tags: ['Soothing', 'Hydrating', 'For sensitive skin'],
    rating: 5, reviewCount: 12480,
    why: 'Heartleaf calms redness — and you mentioned reactive skin.',
  },
  cosrxSnail: {
    id: 'cosrx-1', brand: 'COSRX', name: 'Advanced Snail 96 Mucin Power Essence',
    price: 25, tone: 'lilac', tags: ['Repair', 'Plumping', 'Hero product'],
    rating: 5, reviewCount: 38120,
    why: 'A workhorse for barrier repair. Pairs nicely with your Beauty of Joseon serum.',
  },
  biodanceMask: {
    id: 'biodance-1', brand: 'Biodance', name: 'Bio-Collagen Real Deep Mask',
    price: 4.50, tone: 'rose', tags: ['Overnight', 'Plumping', 'Single use'],
    rating: 5, reviewCount: 21340,
    why: 'TikTok-famous overnight mask. Genuinely worth the hype for a glass-skin morning.',
  },
  innisfreeRetinol: {
    id: 'innisfree-1', brand: 'Innisfree', name: 'Retinol Cica Repair Ampoule',
    price: 38, tone: 'lime', tags: ['Anti-aging', 'Gentle retinol', 'PM'],
    rating: 4, reviewCount: 4280,
    why: 'A gentle retinol with cica buffer — good entry point for sensitive skin.',
  },
  glowAvocado: {
    id: 'glow-1', brand: 'Glow Recipe', name: 'Avocado Melt Retinol Eye Sleeping Mask',
    price: 49, tone: 'sage', tags: ['Eye care', 'Overnight', 'PM'],
    rating: 4, reviewCount: 8910,
    why: 'Targets puffiness without the sting most retinol eye creams have.',
  },
  peachPHCleanser: {
    id: 'peach-1', brand: 'Peach & Lily', name: 'Power Calm Hydrating Gel Cleanser',
    price: 30, tone: 'coral', tags: ['Cleanser', 'AM/PM', 'pH balanced'],
    rating: 5, reviewCount: 6720,
    why: 'A calming cleanser that won\'t strip — gentle enough for daily use.',
  },
};

// ─────────────────────────────────────────────────────────────
// Personality presets
const PERSONALITIES = {
  derm: {
    label: 'Dr. Hubble',
    sub: 'Clinical · Precise',
    accent: 'var(--lilac)',
    intro: "I'm Dr. Hubble. I'll work through your skin profile systematically — concerns, current routine, ingredients you've tolerated. Then I'll recommend products with rationale.",
  },
  bff: {
    label: 'Hubble',
    sub: 'Warm · Casual',
    accent: 'var(--coral)',
    intro: "Hi babe! I'm Hubble — think of me as your skincare-obsessed friend. Tell me what's going on with your skin and what you're hoping for. No judgment, ever.",
  },
  editor: {
    label: 'Hubble',
    sub: 'Editorial · Refined',
    accent: 'var(--lime)',
    intro: "I'm Hubble — your concierge for considered skincare. I'll help you build a routine that feels deliberate, not algorithmic. Let's start with what your skin is telling you lately.",
  },
};

// ─────────────────────────────────────────────────────────────
// Discount Style A — Inline subtle "Sponsored" alternative card
function SponsoredInline({ product, discount, intensity = 'medium' }) {
  return (
    <div style={{
      display: 'flex', gap: 16, padding: 14,
      background: intensity === 'prominent' ? 'linear-gradient(135deg, var(--coral) 0%, #FF8061 100%)' : 'var(--ink-3)',
      border: intensity === 'prominent' ? 'none' : '1px solid var(--border-2)',
      borderRadius: 16, position: 'relative',
      color: intensity === 'prominent' ? 'var(--ink)' : 'var(--fg)',
    }}>
      <ProductImage brand={product.brand} tone={product.tone} size="sm" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span className="font-mono" style={{
            fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: intensity === 'prominent' ? 'rgba(0,0,0,0.6)' : 'var(--fg-mute)',
          }}>Brand offer</span>
          <span style={{
            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: intensity === 'prominent' ? 'var(--ink)' : 'var(--coral)',
            color: intensity === 'prominent' ? 'var(--coral)' : 'var(--ink)',
          }}>{discount}% off</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>{product.brand}</div>
        <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.35, marginBottom: 8 }}>{product.name}</div>
        <button className="btn btn-paper" style={{
          padding: '6px 12px', fontSize: 12,
          background: intensity === 'prominent' ? 'var(--ink)' : 'var(--paper)',
          color: intensity === 'prominent' ? 'var(--paper)' : 'var(--ink)',
        }}>Try it →</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Discount Style B — Carousel of alternatives w/ comparison
function SponsoredCarousel({ products, intensity = 'medium' }) {
  return (
    <div style={{ borderRadius: 16, padding: 16, background: 'var(--ink-3)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>
            Similar · Sponsored
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>Want to try something close with a discount?</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, margin: '0 -16px', padding: '0 16px 4px' }}>
        {products.map((p, i) => (
          <div key={p.id} style={{
            flexShrink: 0, width: 150, padding: 10,
            background: 'var(--ink-2)', border: '1px solid var(--border)',
            borderRadius: 12, position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 6, right: 6,
              background: intensity === 'prominent' ? 'var(--coral)' : 'var(--lime)',
              color: 'var(--ink)', fontSize: 10, fontWeight: 700,
              padding: '3px 7px', borderRadius: 999, zIndex: 2,
            }}>−{20 + i * 5}%</div>
            <ProductImage brand={p.brand} tone={p.tone} size="sm" />
            <div style={{ fontSize: 11, color: 'var(--fg-dim)', marginTop: 8, fontWeight: 500 }}>{p.brand}</div>
            <div style={{ fontSize: 12, lineHeight: 1.3, marginTop: 2, height: 32, overflow: 'hidden' }}>{p.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>${(p.price * (1 - (0.2 + i * 0.05))).toFixed(2)}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-mute)', textDecoration: 'line-through' }}>${p.price}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Discount Style C — AI proactive inline recommendation
function SponsoredProactive({ product, discount, similarTo, intensity = 'medium' }) {
  return (
    <div style={{
      borderRadius: 16, padding: 16,
      border: '1px solid var(--border-2)',
      background: intensity === 'prominent'
        ? 'linear-gradient(135deg, rgba(255,107,71,0.08) 0%, rgba(212,255,79,0.06) 100%)'
        : 'var(--ink-3)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'var(--lime)', color: 'var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon name="sparkle" size={14} stroke={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--fg-dim)' }}>
            Quick aside — since you mentioned <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{similarTo}</span>, you might like this. Same active, gentler price, and the brand's offering <span style={{ color: 'var(--coral)', fontWeight: 600 }}>{discount}% off your first order</span>. Worth a peek?
          </div>
          <div style={{
            display: 'flex', gap: 12, marginTop: 12, padding: 12,
            background: 'var(--ink-2)', borderRadius: 12,
          }}>
            <ProductImage brand={product.brand} tone={product.tone} size="sm" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-mute)', fontFamily: 'var(--font-mono)' }}>{product.brand.toUpperCase()}</div>
              <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, margin: '2px 0 6px' }}>{product.name}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>Shop with code</button>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>Not now</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Recommendation card (the AI's main product suggestion)
function RecCard({ product, primary, density = 'normal' }) {
  const compact = density === 'compact';
  return (
    <div style={{
      display: 'flex', gap: compact ? 12 : 16,
      padding: compact ? 12 : 16,
      background: primary ? 'var(--paper)' : 'var(--ink-3)',
      color: primary ? 'var(--ink)' : 'var(--fg)',
      borderRadius: 16,
      border: primary ? 'none' : '1px solid var(--border)',
    }}>
      <ProductImage brand={product.brand} tone={product.tone} size={compact ? 'sm' : 'md'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.6 }}>
            {product.brand}
          </div>
          <div style={{ fontSize: compact ? 14 : 16, fontWeight: 600 }}>${product.price}</div>
        </div>
        <div className="font-display" style={{ fontSize: compact ? 17 : 20, lineHeight: 1.15, margin: '4px 0 6px' }}>
          {product.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Stars value={product.rating} size={11} />
          <span style={{ fontSize: 11, opacity: 0.6 }}>{product.reviewCount.toLocaleString()} reviews</span>
        </div>
        {!compact && (
          <div style={{
            fontSize: 12, lineHeight: 1.45, padding: '8px 10px',
            background: primary ? 'rgba(0,0,0,0.05)' : 'var(--ink-2)',
            borderRadius: 8, marginBottom: 10,
          }}>
            <span style={{ fontWeight: 600 }}>Why this →</span> {product.why}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {product.tags.slice(0, compact ? 2 : 3).map(t => (
            <span key={t} style={{
              padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 500,
              background: primary ? 'rgba(0,0,0,0.06)' : 'var(--ink-2)',
              color: primary ? 'var(--ink-4)' : 'var(--fg-dim)',
              border: primary ? '1px solid rgba(0,0,0,0.08)' : '1px solid var(--border)',
            }}>{t}</span>
          ))}
        </div>
        {!compact && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" style={{
              background: primary ? 'var(--ink)' : 'var(--coral)',
              color: primary ? 'var(--paper)' : 'var(--ink)',
              padding: '8px 14px', fontSize: 13,
            }}>Add to routine</button>
            <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 13, borderColor: primary ? 'rgba(0,0,0,0.15)' : 'var(--border-2)' }}>
              Tell me more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Quick-reply chips below an AI message
function QuickReplies({ options, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onPick && onPick(opt)} style={{
          padding: '8px 14px', borderRadius: 999,
          background: 'transparent', border: '1px solid var(--border-2)',
          color: 'var(--fg)', fontSize: 13, fontWeight: 400,
          transition: 'all .15s ease', cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--ink-3)'; e.currentTarget.style.borderColor = 'var(--coral)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-2)'; }}
        >{opt}</button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Skin profile summary card (shown after quiz / inline in chat)
function SkinProfileCard({ profile }) {
  return (
    <div style={{
      padding: 16, borderRadius: 16,
      background: 'var(--ink-3)', border: '1px solid var(--border)',
    }}>
      <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 8 }}>
        Your skin profile · v1
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {Object.entries(profile).map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 11, color: 'var(--fg-mute)', marginBottom: 2 }}>{k}</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// One chat message (AI or user) — wraps any rich content
function Message({ from, children, density = 'normal' }) {
  const isUser = from === 'user';
  const compact = density === 'compact';
  return (
    <div style={{
      display: 'flex', gap: 12,
      padding: compact ? '12px 0' : '16px 0',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
    }}>
      {!isUser && <HubbleAvatar size={compact ? 28 : 32} />}
      {isUser && (
        <div style={{
          width: compact ? 28 : 32, height: compact ? 28 : 32, borderRadius: '50%',
          background: 'var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, color: 'var(--fg)', fontSize: 12, fontWeight: 600,
        }}>M</div>
      )}
      <div style={{ flex: 1, maxWidth: isUser ? '75%' : '85%' }}>
        {isUser ? (
          <div style={{
            display: 'inline-block', padding: '10px 14px', borderRadius: 16,
            borderTopRightRadius: 4,
            background: 'var(--coral)', color: 'var(--ink)',
            fontSize: 14, lineHeight: 1.5, fontWeight: 500,
            float: 'right',
          }}>{children}</div>
        ) : (
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--fg)' }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN — Consumer Chat surface
function ConsumerChat({ personality = 'bff', density = 'normal', discountIntensity = 'medium', initialStage = 'mid' }) {
  const persona = PERSONALITIES[personality];
  const [input, setInput] = cState('');
  const [stage, setStage] = cState(initialStage);
  const scrollerRef = cRef(null);

  cEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [stage]);

  const skinProfile = {
    'Skin type': 'Combination, sensitive',
    'Concerns': 'Dehydration · redness · early aging',
    'Budget': '$30 – $80 / product',
    'Routine': '4 steps AM, 5 steps PM',
    'Loves': 'Beauty of Joseon serum',
    'Avoiding': 'Fragrance · harsh exfoliants',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--ink)', position: 'relative',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(16px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <HubbleWordmark height={20} />
          <span style={{ height: 18, width: 1, background: 'var(--border-2)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HubbleAvatar size={24} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.1 }}>{persona.label}</div>
              <div style={{ fontSize: 10, color: 'var(--fg-mute)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>
                {persona.sub}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost" style={{ padding: '8px 12px', fontSize: 12 }}>
            <Icon name="bag" size={14} /> Your routine · 3
          </button>
          <button className="btn btn-ghost" style={{ padding: 8 }}>
            <Icon name="settings" size={14} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollerRef} style={{
        flex: 1, overflowY: 'auto', padding: '24px 0',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>

          {/* Welcome */}
          <Message from="ai" density={density}>
            <div className="font-display" style={{ fontSize: 26, lineHeight: 1.1, marginBottom: 8, color: 'var(--paper)' }}>
              Hi Maya — welcome back.
            </div>
            <div style={{ marginBottom: 12 }}>
              {persona.intro}
            </div>
            <div>
              You finished your skin quiz last week. Want to start where we left off, or update anything?
            </div>
            <QuickReplies options={['Pick up where we left off', 'Update my profile', 'Just browse']} />
          </Message>

          <Message from="user" density={density}>Pick up where we left off</Message>

          <Message from="ai" density={density}>
            <div style={{ marginBottom: 10 }}>
              Here's what I have for you, in case anything's drifted:
            </div>
            <SkinProfileCard profile={skinProfile} />
            <div style={{ marginTop: 10, color: 'var(--fg-dim)' }}>
              Last time you said your <span style={{ color: 'var(--lime)' }}>Beauty of Joseon serum</span> ran out and you wanted a similar feel. I have one in mind — and a couple alternatives.
            </div>
          </Message>

          <Message from="user" density={density}>Yeah, the Beauty of Joseon one was magic for my barrier</Message>

          <Message from="ai" density={density}>
            <div style={{ marginBottom: 12 }}>
              Got it. My top pick — a near-identical formulation at a similar price:
            </div>
            <RecCard product={PRODUCTS.cosrxSnail} primary density={density} />
          </Message>

          {/* DISCOUNT MOMENT 1 — Proactive inline */}
          <Message from="ai" density={density}>
            <SponsoredProactive
              product={PRODUCTS.anuaCleanser}
              discount={25}
              similarTo="redness flares around your nose"
              intensity={discountIntensity}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg-mute)' }}>
              You'll see <span style={{ borderBottom: '1px dotted', cursor: 'help' }}>brand offers</span> when they fit. I'll keep them rare and only when relevant.
            </div>
          </Message>

          <Message from="user" density={density}>Tell me more about that snail one — does it pill under sunscreen?</Message>

          <Message from="ai" density={density}>
            <div style={{ marginBottom: 8 }}>
              Honest answer: it can if you layer it too thick or rush. The trick is a <span style={{ color: 'var(--lime)' }}>3–4 drop layer</span>, wait 60 seconds, then SPF. I'll add that to your routine notes.
            </div>
            <div style={{ marginBottom: 12 }}>
              If you want to compare alternatives at lower price points (some with a launch discount):
            </div>
            <SponsoredCarousel
              products={[PRODUCTS.peachPHCleanser, PRODUCTS.glowAvocado, PRODUCTS.biodanceMask, PRODUCTS.innisfreeRetinol]}
              intensity={discountIntensity}
            />
            <QuickReplies options={['Just go with COSRX', 'Compare top 2', "I'm done for now"]} />
          </Message>

          <Message from="ai" density={density}>
            <TypingDots />
          </Message>
        </div>
      </div>

      {/* Composer */}
      <div style={{
        borderTop: '1px solid var(--border)',
        background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(16px)',
        padding: '16px 24px',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            padding: '10px 12px', background: 'var(--ink-3)',
            border: '1px solid var(--border-2)', borderRadius: 24,
          }}>
            <button style={{ padding: 6, color: 'var(--fg-dim)' }}>
              <Icon name="plus" size={18} />
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask Hubble anything about skin…"
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--fg)', fontSize: 14, lineHeight: 1.5, resize: 'none',
                padding: '6px 0', minHeight: 22, maxHeight: 120,
              }}
            />
            <button style={{
              padding: 8, borderRadius: '50%',
              background: input ? 'var(--coral)' : 'var(--ink-4)',
              color: input ? 'var(--ink)' : 'var(--fg-mute)',
            }}>
              <Icon name="send" size={16} stroke={2} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Chip icon="drop">Build my routine</Chip>
            <Chip icon="spark">Match a product</Chip>
            <Chip icon="tag">Show today's deals</Chip>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ConsumerChat, PRODUCTS, PERSONALITIES, RecCard, SponsoredInline, SponsoredCarousel, SponsoredProactive, SkinProfileCard, Message, QuickReplies });
