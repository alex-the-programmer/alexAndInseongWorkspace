/* Hubble — Conversational Survey Builder */

function SurveyBuilder() {
  const [active, setActive] = React.useState('survey');
  const [step, setStep] = React.useState('chat'); // chat → form

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--ink)' }}>
      <BrandSidebar active={active} onNav={setActive}/>
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden', minWidth: 0 }}>
        {/* LEFT — Hubble interviews you */}
        <div style={{ padding: '32px 40px', overflowY: 'auto', borderRight: '1px solid var(--border)' }}>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            Survey Builder · Conversational
          </div>
          <h1 className="font-display" style={{ fontSize: 'clamp(26px, 3.2vw, 40px)', lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0, color: 'var(--paper)' }}>
            Tell me what you want to learn.
          </h1>
          <p style={{ fontSize: 14, color: 'var(--fg-dim)', lineHeight: 1.6, marginTop: 12, maxWidth: 540 }}>
            I'll interview you about your goals, then draft the survey. You can rewrite anything later in the form editor.
          </p>

          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Message from="ai">
              <div className="font-display" style={{ fontSize: 22, lineHeight: 1.2, color: 'var(--paper)', marginBottom: 8 }}>
                What's the goal of this survey?
              </div>
              <div style={{ color: 'var(--fg-dim)' }}>
                Are you trying to validate a product idea, understand why people switch brands, or something else?
              </div>
            </Message>
            <Message from="user">
              We're launching a PHA cleanser in Q3. I want to understand what people don't love about their current cleanser, and what would make them switch. Plus what they'd want on the bottle.
            </Message>
            <Message from="ai">
              <div className="font-display" style={{ fontSize: 22, lineHeight: 1.2, color: 'var(--paper)', marginBottom: 8 }}>
                Got it. Who do we want to hear from?
              </div>
              <div style={{ color: 'var(--fg-dim)', marginBottom: 8 }}>
                I can target by skin type, age, current routine, or even brands they currently use. Both new shoppers and existing Anua customers?
              </div>
              <QuickReplies options={["New shoppers only", "Existing Anua only", "Mix of both", "Define audience"]}/>
            </Message>
            <Message from="user">Mix of both — but skew 70% new. Sensitive + combo skin, age 22–38.</Message>
            <Message from="ai">
              <div className="font-display" style={{ fontSize: 22, lineHeight: 1.2, color: 'var(--paper)', marginBottom: 8 }}>
                What incentive would feel fair?
              </div>
              <div style={{ color: 'var(--fg-dim)' }}>
                Most surveys here use $10–25 store credit. For a deeper one (10+ minutes), brands sometimes offer a free product. What feels right?
              </div>
              <QuickReplies options={["$15 credit", "$25 credit", "Free PHA cleanser when launched", "Custom"]}/>
            </Message>
            <Message from="user">Free cleanser at launch, capped at first 500.</Message>
            <Message from="ai">
              <div style={{ marginBottom: 12 }}>
                Beautiful. I drafted <span style={{ color: 'var(--lime)' }}>"PHA Cleanser — pre-launch voice"</span>: 9 questions, ~6 min. Mix of multiple choice, open-ended, and a forced rank. Skip-logic so people who don't currently use a cleanser branch out at Q3. Ready for you to review →
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep('form')} className="btn btn-primary" style={{ padding: '10px 16px' }}>Open the draft <Icon name="arrow" size={13}/></button>
                <button className="btn btn-ghost" style={{ padding: '10px 16px' }}>Add a question</button>
              </div>
            </Message>
          </div>
        </div>

        {/* RIGHT — generated form, editable */}
        <div style={{ padding: '32px 40px', overflowY: 'auto', background: 'var(--ink-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Generated draft</div>
              <div className="font-display" style={{ fontSize: 24, marginTop: 4 }}>PHA Cleanser — pre-launch voice</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }}>Preview</button>
              <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }}>
                <Icon name="sliders" size={11}/> Logic
              </button>
            </div>
          </div>

          {/* Meta */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
            padding: 14, background: 'var(--ink-3)', borderRadius: 12, border: '1px solid var(--border)',
            marginBottom: 16,
          }}>
            {[
              { l: 'Audience', v: '70% new · 30% Anua' },
              { l: 'Skin', v: 'Sensitive · combo' },
              { l: 'Reward', v: 'Free cleanser (500 cap)' },
              { l: 'Length', v: '9 Qs · ~6 min' },
            ].map(m => (
              <div key={m.l}>
                <div style={{ fontSize: 10, color: 'var(--fg-mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{m.l}</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* Questions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { n: 1, type: 'Multiple choice', q: 'What cleanser do you currently use most mornings?', opts: ['CeraVe', 'La Roche-Posay', 'Krave Beauty', 'Beauty of Joseon', 'Other (specify)'] },
              { n: 2, type: 'Open-ended', q: "What's one thing you'd change about it if you could?", opts: null },
              { n: 3, type: 'Branch · Skip', q: 'If you don\'t use a cleanser, jump to Q6', opts: null, meta: 'LOGIC' },
              { n: 4, type: 'Forced rank', q: 'Rank what matters most when you\'re shopping for a new cleanser:', opts: ['Soothing claims', 'Texture / how it feels', 'Ingredients list', 'Price', 'Brand story', 'Packaging'] },
              { n: 5, type: 'Slider · 1–10', q: 'How sensitive does your skin feel today?', opts: null },
              { n: 6, type: 'Image select', q: 'Which bottle treatment feels most like Anua to you? (4 mockups)', opts: null },
              { n: 7, type: 'Multiple choice', q: 'PHA is a gentler exfoliating acid. How familiar are you with it?', opts: ['First time hearing of it', 'Heard of it, never tried', 'I use a PHA product currently'] },
              { n: 8, type: 'Open-ended', q: 'What one ingredient claim would make you bookmark this product?', opts: null },
              { n: 9, type: 'Multiple choice', q: 'Where would you most expect to discover a new cleanser?', opts: ['TikTok', 'Friend rec', 'In-store demo', 'Hubble', 'Sephora email'] },
            ].map(qq => (
              <div key={qq.n} style={{
                padding: 14, borderRadius: 12,
                background: qq.meta === 'LOGIC' ? 'rgba(196,181,253,0.06)' : 'var(--ink-3)',
                border: qq.meta === 'LOGIC' ? '1px dashed var(--lilac)' : '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--fg-mute)' }}>Q{String(qq.n).padStart(2,'0')}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                    background: qq.meta === 'LOGIC' ? 'var(--lilac)' : 'var(--ink-4)',
                    color: qq.meta === 'LOGIC' ? 'var(--ink)' : 'var(--fg-dim)',
                    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                  }}>{qq.type}</span>
                  <div style={{ flex: 1 }}/>
                  <Icon name="settings" size={13} color="var(--fg-mute)"/>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, color: 'var(--paper)' }}>
                  {qq.q}
                </div>
                {qq.opts && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {qq.opts.map(o => (
                      <span key={o} style={{
                        padding: '5px 10px', borderRadius: 999, fontSize: 11,
                        background: 'var(--ink-2)', color: 'var(--fg-dim)',
                        border: '1px solid var(--border)',
                      }}>{o}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button className="btn btn-ghost" style={{ justifyContent: 'center', padding: 12, fontSize: 12 }}>
              <Icon name="plus" size={12}/> Add a question
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', padding: 12 }}>Launch survey</button>
            <button className="btn btn-ghost" style={{ padding: '12px 16px' }}>Save draft</button>
          </div>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { SurveyBuilder });
