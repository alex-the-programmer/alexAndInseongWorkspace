/* Hubble — Marketing Landing Page */

function MarketingLanding() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', color: 'var(--paper)' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 48px', position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <HubbleWordmark height={22} />
        <div style={{ display: 'flex', gap: 28, fontSize: 13 }}>
          <a style={{ color: 'var(--fg-dim)', textDecoration: 'none' }}>How it works</a>
          <a style={{ color: 'var(--fg-dim)', textDecoration: 'none' }}>For brands</a>
          <a style={{ color: 'var(--fg-dim)', textDecoration: 'none' }}>Reviews</a>
          <a style={{ color: 'var(--fg-dim)', textDecoration: 'none' }}>About</a>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: 13 }}>Brand login</button>
          <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>Open chat →</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: '80px 48px 64px', position: 'relative' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <span className="dot dot-pulse" />
            <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-dim)' }}>
              YOUR SKINCARE CONCIERGE · NOW IN PUBLIC BETA
            </span>
          </div>
          <h1 className="font-display" style={{
            fontSize: 'clamp(56px, 9vw, 132px)', lineHeight: 0.95, margin: 0,
            letterSpacing: '-0.04em', maxWidth: 1100,
          }}>
            Skincare advice<br />
            that <em style={{ color: 'var(--coral)' }}>actually</em> knows<br />
            <span style={{ color: 'var(--fg-dim)' }}>your face.</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 48, gap: 48, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 20, lineHeight: 1.5, maxWidth: 520, color: 'var(--fg-dim)', margin: 0 }}>
              Hubble is the AI you'd call before your dermatologist. We learn your skin, your routine, and your budget — then recommend products you'll actually finish the bottle of.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ padding: '14px 24px', fontSize: 15 }}>
                Start the skin quiz <Icon name="arrow" size={14} />
              </button>
              <button className="btn btn-ghost" style={{ padding: '14px 24px', fontSize: 15 }}>
                Watch a chat
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SHOWCASE: Chat preview */}
      <section style={{ padding: '32px 48px 80px' }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', borderRadius: 24,
          border: '1px solid var(--border-2)',
          background: 'var(--ink-2)', overflow: 'hidden',
          display: 'grid', gridTemplateColumns: '1.1fr 1fr',
        }}>
          {/* LEFT — preview chat */}
          <div style={{ padding: 32, borderRight: '1px solid var(--border)', background: 'var(--ink)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <HubbleAvatar size={28} />
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                LIVE PREVIEW
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 16, lineHeight: 1.5, maxWidth: 380 }}>
                <span style={{ color: 'var(--fg-dim)' }}>Tell me about your skin lately —</span> what's been working and what isn't?
              </div>
              <div style={{
                alignSelf: 'flex-end', maxWidth: 340,
                padding: '10px 14px', borderRadius: 16, borderTopRightRadius: 4,
                background: 'var(--coral)', color: 'var(--ink)', fontSize: 14, fontWeight: 500,
              }}>
                Combination, kinda dehydrated. My CeraVe cleanser is fine but my serum (BoJ) is almost out.
              </div>
              <div style={{ fontSize: 16, lineHeight: 1.5 }}>
                <span style={{ color: 'var(--fg-dim)' }}>Got it. The BoJ serum's hero is propolis +</span> niacinamide. <span style={{ color: 'var(--fg-dim)' }}>Want me to find a similar formula or branch into something new?</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Chip>Stay close</Chip>
                <Chip>Branch out</Chip>
                <Chip>Surprise me</Chip>
              </div>
            </div>
          </div>
          {/* RIGHT — copy + product card */}
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className="font-mono" style={{ fontSize: 11, color: 'var(--coral)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                01 — Conversation, not commerce
              </div>
              <div className="font-display" style={{ fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                We don't push products.<br />
                <span style={{ color: 'var(--fg-dim)' }}>We pull on context.</span>
              </div>
              <p style={{ fontSize: 15, color: 'var(--fg-dim)', lineHeight: 1.6, marginTop: 16, maxWidth: 420 }}>
                Hubble remembers your routine, your reactions, and what you've already loved. So every recommendation feels like one your friend who works at Sephora would make.
              </p>
            </div>
            <div style={{ marginTop: 32 }}>
              <RecCard product={PRODUCTS.cosrxSnail} primary />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '80px 48px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--coral)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            How it works
          </div>
          <h2 className="font-display" style={{ fontSize: 64, letterSpacing: '-0.03em', lineHeight: 1, margin: 0, maxWidth: 800 }}>
            Three messages in, you'll know more about your skin than five years of <em>just trying things</em>.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 64 }}>
            {[
              { num: '01', title: 'Take the chat-quiz', body: 'Five minutes of casual back-and-forth. We ask about your skin type, sensitivities, current routine, and what your wallet thinks about all of this.', accent: 'var(--coral)' },
              { num: '02', title: 'Get matched, with reasoning', body: 'Three picks per category, ranked. Each comes with a one-line "why this" so you understand the recommendation, not just the rating.', accent: 'var(--lime)' },
              { num: '03', title: 'Build the routine, slowly', body: 'Hubble checks in every couple weeks, adjusts for season changes, and unlocks brand-funded discounts when something fits you.', accent: 'var(--lilac)' },
            ].map(s => (
              <div key={s.num} style={{
                padding: 28, borderRadius: 20,
                background: 'var(--ink-2)', border: '1px solid var(--border)',
              }}>
                <div className="font-mono" style={{ fontSize: 14, color: s.accent, marginBottom: 32, letterSpacing: '0.04em' }}>{s.num}</div>
                <div className="font-display" style={{ fontSize: 28, lineHeight: 1.15, marginBottom: 12 }}>{s.title}</div>
                <p style={{ fontSize: 14, color: 'var(--fg-dim)', lineHeight: 1.55, margin: 0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRAND CTA */}
      <section style={{ padding: '80px 48px', borderTop: '1px solid var(--border)', background: 'var(--paper)', color: 'var(--ink)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, color: 'var(--coral)' }}>
              For beauty brands
            </div>
            <h2 className="font-display" style={{ fontSize: 72, lineHeight: 0.95, letterSpacing: '-0.03em', margin: 0 }}>
              Be the answer<br />
              when it matters.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: '#444', marginTop: 24, maxWidth: 480 }}>
              Build your AI sales agent. Tell Hubble when you'd like to surface, what you'd like to offer, and how aggressive you want to be. Run conversational surveys to learn what your prospective customers actually want.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button className="btn" style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '14px 24px', fontSize: 15 }}>
                Open brand dashboard <Icon name="arrow" size={14} />
              </button>
              <button className="btn" style={{ border: '1px solid rgba(0,0,0,0.2)', padding: '14px 24px', fontSize: 15 }}>Talk to sales</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {['Anua', 'COSRX', 'Biodance', 'Innisfree', 'Glow Recipe', 'Peach & Lily'].map((b, i) => (
              <div key={b} style={{
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i % 2 === 0 ? 'var(--ink)' : '#fff',
                color: i % 2 === 0 ? 'var(--paper)' : 'var(--ink)',
                border: '1px solid rgba(0,0,0,0.1)', borderRadius: 16,
                fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.02em',
              }}>{b}</div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '64px 48px 48px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48 }}>
          <div>
            <HubbleWordmark height={28} />
            <p style={{ fontSize: 13, color: 'var(--fg-dim)', lineHeight: 1.6, marginTop: 16, maxWidth: 320 }}>
              Hubble is your skincare concierge — built by skincare nerds, powered by AI, paid for by the brands you'd want to discover anyway.
            </p>
          </div>
          {[
            { h: 'Product', items: ['How it works', 'Skin quiz', 'Reviews', 'Routines'] },
            { h: 'For brands', items: ['Dashboard', 'Sales agents', 'Surveys', 'Pricing'] },
            { h: 'Company', items: ['About', 'Careers', 'Press', 'Contact'] },
          ].map(col => (
            <div key={col.h}>
              <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 16 }}>{col.h}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.items.map(it => (
                  <a key={it} style={{ fontSize: 13, color: 'var(--fg-dim)', textDecoration: 'none' }}>{it}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 64, paddingTop: 24, borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 11, color: 'var(--fg-mute)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
        }}>
          <div>© 2026 Hubble Beauty, Inc.</div>
          <div>Built with care · Brooklyn / Seoul</div>
        </div>
      </footer>
    </div>
  );
}

Object.assign(window, { MarketingLanding });
