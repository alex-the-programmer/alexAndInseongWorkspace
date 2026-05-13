/* Hubble — Sales Agent Builder */

function SalesAgentBuilder() {
  const [active, setActive] = React.useState('agent');
  const [mode, setMode] = React.useState('hybrid');
  const [brief, setBrief] = React.useState(
    `Surface the Heartleaf 77% Soothing Toner whenever a shopper mentions redness, sensitive skin, or barrier issues. Lead with the calming/anti-irritation angle — never the price. Offer 25% off for first-time buyers; 35% if they're switching from a competitor (CeraVe, La Roche, Krave). Pause when budget is under $20 — they're not our customer.`
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--ink)' }}>
      <BrandSidebar active={active} onNav={setActive}/>
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden', minWidth: 0 }}>
        {/* LEFT — config */}
        <div style={{ padding: '32px 40px', overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sales Agent · v3</span>
            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: 'var(--lime)', color: 'var(--ink)' }}>LIVE</span>
          </div>
          <h1 className="font-display" style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0, color: 'var(--paper)' }}>
            Tell Hubble when to introduce your products.
          </h1>
          <p style={{ fontSize: 14, color: 'var(--fg-dim)', lineHeight: 1.6, marginTop: 12, maxWidth: 540 }}>
            Describe your strategy in plain language, drop into rule editor for precision, or both. We'll always show you a transcript before going live.
          </p>

          {/* Mode switcher */}
          <div style={{
            display: 'inline-flex', padding: 4, marginTop: 32,
            background: 'var(--ink-3)', borderRadius: 12, border: '1px solid var(--border-2)',
          }}>
            {[
              { id: 'natural', label: 'Natural language' },
              { id: 'rules', label: 'Rule editor' },
              { id: 'hybrid', label: 'Hybrid' },
            ].map(m => (
              <button key={m.id} onClick={() => setMode(m.id)} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: mode === m.id ? 'var(--paper)' : 'transparent',
                color: mode === m.id ? 'var(--ink)' : 'var(--fg-dim)',
              }}>{m.label}</button>
            ))}
          </div>

          {/* Natural language brief */}
          <div style={{ marginTop: 24 }}>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Strategy brief
            </div>
            <div style={{
              padding: 20, borderRadius: 16,
              background: 'var(--ink-2)', border: '1px solid var(--border-2)',
            }}>
              <textarea
                value={brief} onChange={e => setBrief(e.target.value)}
                style={{
                  width: '100%', minHeight: 140,
                  background: 'transparent', border: 'none', outline: 'none', resize: 'vertical',
                  color: 'var(--fg)', fontSize: 14, lineHeight: 1.6, fontFamily: 'var(--font-ui)',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}>
                  <Icon name="sparkle" size={11}/> Polish with AI
                </button>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 11 }}>
                  Convert to rules
                </button>
              </div>
            </div>
          </div>

          {/* Rule editor */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Compiled rules · 5
              </div>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}>
                <Icon name="plus" size={11}/> Add rule
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { trigger: 'shopper mentions', match: 'redness · sensitivity · barrier · stinging', action: 'surface', product: 'Heartleaf 77% Toner', accent: 'var(--coral)', priority: 'High' },
                { trigger: 'shopper currently uses', match: 'CeraVe · La Roche-Posay · Krave', action: 'offer 35% off', product: 'first order', accent: 'var(--lime)', priority: 'High' },
                { trigger: 'first-time visitor', match: '+ matched skin profile', action: 'offer 25% off', product: 'Heartleaf 77% Toner', accent: 'var(--coral)', priority: 'Medium' },
                { trigger: 'budget signal', match: '< $20', action: 'do not surface', product: '—', accent: 'var(--fg-mute)', priority: 'Block' },
                { trigger: 'shopper completed survey', match: 'Routine Audit · 2026 Q2', action: 'unlock $20 credit', product: 'any product', accent: 'var(--lilac)', priority: 'Reward' },
              ].map((r, i) => (
                <div key={i} style={{
                  padding: 14, borderRadius: 12,
                  background: 'var(--ink-2)', border: '1px solid var(--border)',
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)' }}>WHEN</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{r.trigger}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 11,
                        background: 'var(--ink-3)', color: 'var(--lime)', fontFamily: 'var(--font-mono)',
                      }}>{r.match}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)' }}>THEN</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: r.accent }}>{r.action}</span>
                      <span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>· {r.product}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                      background: 'var(--ink-3)', color: 'var(--fg-dim)',
                    }}>{r.priority}</span>
                    <Icon name="settings" size={14} color="var(--fg-mute)"/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tone & guardrails */}
          <div style={{ marginTop: 32 }}>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Tone &amp; guardrails
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { l: 'Frequency cap', v: 'Max 1 offer / conversation' },
                { l: 'Discount ceiling', v: 'Up to 35%' },
                { l: 'Tone', v: 'Friendly · expert · honest' },
                { l: 'Never claim', v: 'Medical · cure · prescription' },
              ].map(g => (
                <div key={g.l} style={{ padding: 14, borderRadius: 12, background: 'var(--ink-2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--fg-mute)', marginBottom: 4 }}>{g.l}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{g.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — preview */}
        <div style={{ padding: '32px 40px', overflowY: 'auto', background: 'var(--ink-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Live preview</div>
              <div className="font-display" style={{ fontSize: 24, marginTop: 4 }}>How it'll appear in chat</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }}>Replay</button>
              <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }}>+ Test scenario</button>
            </div>
          </div>

          {/* Test scenario */}
          <div style={{
            padding: 14, borderRadius: 12, marginBottom: 16,
            background: 'var(--ink-3)', border: '1px dashed var(--border-2)',
          }}>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg-mute)', letterSpacing: '0.08em', marginBottom: 6 }}>SCENARIO</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ color: 'var(--fg-dim)' }}>Shopper: </span>combo skin, currently using CeraVe + La Roche, mentioned redness on cheeks. Budget $30–60.
            </div>
          </div>

          <div style={{
            padding: 20, borderRadius: 16, background: 'var(--ink)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <HubbleAvatar size={24}/>
              <span style={{ fontSize: 12, color: 'var(--fg-dim)' }}>Hubble · 0.4s ago</span>
            </div>
            <SponsoredProactive
              product={PRODUCTS.anuaCleanser}
              discount={35}
              similarTo="redness on cheeks + your CeraVe usage"
              intensity="medium"
            />
            <div style={{
              marginTop: 12, padding: 10, borderRadius: 10,
              background: 'rgba(212,255,79,0.06)', border: '1px solid rgba(212,255,79,0.2)',
            }}>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--lime)', letterSpacing: '0.08em', marginBottom: 4 }}>WHY THIS FIRED</div>
              <div style={{ fontSize: 12, color: 'var(--fg-dim)', lineHeight: 1.5 }}>
                Rule <span style={{ color: 'var(--paper)' }}>#2 (competitor switch)</span> matched on <span style={{ color: 'var(--lime)' }}>"CeraVe"</span>; rule <span style={{ color: 'var(--paper)' }}>#1 (concern match)</span> matched on <span style={{ color: 'var(--lime)' }}>"redness"</span>. Stacked discount applied (35%, capped).
            </div>
            </div>
          </div>

          {/* Forecast */}
          <div style={{ marginTop: 24, padding: 20, borderRadius: 16, background: 'var(--ink)', border: '1px solid var(--border)' }}>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Projected weekly impact
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {[
                { l: 'Surfaces', v: '~3,400', delta: '+18%' },
                { l: 'Conversions', v: '~210', delta: '+22%' },
                { l: 'GMV', v: '~$11.8k', delta: '+28%' },
              ].map(f => (
                <div key={f.l}>
                  <div style={{ fontSize: 11, color: 'var(--fg-mute)' }}>{f.l}</div>
                  <div className="font-display" style={{ fontSize: 28, marginTop: 4 }}>{f.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--lime)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{f.delta}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: '12px' }}>Save &amp; deploy v4</button>
            <button className="btn btn-ghost" style={{ padding: '12px 16px' }}>Save draft</button>
          </div>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { SalesAgentBuilder });
