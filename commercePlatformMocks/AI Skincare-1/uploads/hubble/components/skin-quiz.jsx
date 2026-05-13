/* Hubble — End-to-end Onboarding Skin Quiz
   Flow: intro → 6 questions (varied UX) → loading → results
*/

const QUIZ_STEPS = [
  {
    id: 'feel',
    kind: 'choice',
    title: ['How would you describe your skin ', { em: 'right now' }, ' — not in general, but this week?'],
    sub: "Skin shifts with weather, stress, and hormones. I'll bias my recs toward what you're feeling today, not a permanent label.",
    options: [
      { id: 'tight',    emoji: '◐', t: 'Tight + dehydrated',                sub: 'Like it needs a drink' },
      { id: 'oily',     emoji: '◑', t: 'Oily, clogging up',                  sub: 'Glow at noon, not in a good way' },
      { id: 'reactive', emoji: '◒', t: 'Reactive + red',                     sub: 'Stinging from things that used to be fine' },
      { id: 'fine',     emoji: '◓', t: 'Mostly fine — wanting to upgrade',   sub: 'No fires; just curious' },
      { id: 'aging',    emoji: '◔', t: 'Noticing texture / fine lines',      sub: 'Mostly cheeks + 11s' },
    ],
    allowOther: true,
  },
  {
    id: 'concerns',
    kind: 'multi',
    title: ['What are your ', { em: 'top concerns' }, ' lately?'],
    sub: "Pick 1–4. I'll prioritize ingredients that target these and avoid ones that flare them up.",
    options: [
      { id: 'redness',  t: 'Redness',           sub: 'Visible flush · rosacea-leaning' },
      { id: 'dehydra', t: 'Dehydration',       sub: 'Tight after cleansing' },
      { id: 'acne',     t: 'Breakouts',         sub: 'Hormonal · congestion' },
      { id: 'texture',  t: 'Texture / pores',   sub: 'Bumpy or rough patches' },
      { id: 'lines',    t: 'Fine lines',        sub: 'Cheeks · 11s · forehead' },
      { id: 'dark',     t: 'Dark spots',        sub: 'Post-acne · sun' },
      { id: 'dull',     t: 'Dullness',          sub: 'Lacking glow' },
      { id: 'eye',      t: 'Under-eye',         sub: 'Puffiness · circles' },
    ],
    max: 4,
  },
  {
    id: 'budget',
    kind: 'budget',
    title: ['What\'s your ', { em: 'comfortable spend' }, ' per product?'],
    sub: "I'll never push past your range. Drag to set — I'll show good options at every tier.",
    min: 8, max: 120, defaultLow: 30, defaultHigh: 80,
  },
  {
    id: 'routine',
    kind: 'routine',
    title: ['Which steps are ', { em: 'already in your routine' }, '?'],
    sub: "Tap each step that's part of your AM or PM. We'll fill in the gaps.",
    am: [
      { id: 'cleanser_am',  t: 'Cleanser',  on: true },
      { id: 'toner_am',     t: 'Toner',     on: true },
      { id: 'serum_am',     t: 'Serum',     on: true },
      { id: 'moist_am',     t: 'Moisturizer', on: true },
      { id: 'spf_am',       t: 'SPF',       on: true },
      { id: 'eye_am',       t: 'Eye cream', on: false },
    ],
    pm: [
      { id: 'oil_pm',       t: 'Oil cleanser', on: false },
      { id: 'cleanser_pm',  t: 'Cleanser',  on: true },
      { id: 'exfo_pm',      t: 'Exfoliant', on: false },
      { id: 'treat_pm',     t: 'Treatment / retinol', on: false },
      { id: 'serum_pm',     t: 'Serum',     on: true },
      { id: 'moist_pm',     t: 'Moisturizer', on: true },
    ],
  },
  {
    id: 'loved',
    kind: 'love',
    title: ["Anything you've ", { em: 'genuinely loved' }, ' lately?'],
    sub: "Type a brand or product. I'll match the formula vibe and avoid duplicating what already works.",
    suggestions: ['Beauty of Joseon Glow Serum', 'CeraVe Hydrating Cleanser', 'La Roche-Posay Toleriane', 'Glow Recipe Watermelon Toner', 'COSRX Snail 96', 'Innisfree Green Tea Seed', 'Anua Heartleaf 77'],
  },
  {
    id: 'avoid',
    kind: 'avoid',
    title: ['Anything we should ', { em: 'steer clear' }, ' of?'],
    sub: "Ingredients you've reacted to, allergies, or just things you don't like. I'll filter results around these.",
    chips: [
      { id: 'fragrance', t: 'Fragrance',     on: true,  bad: true },
      { id: 'alcohol',   t: 'Drying alcohol', on: true,  bad: true },
      { id: 'sulfates',  t: 'SLS · sulfates' },
      { id: 'essential', t: 'Essential oils' },
      { id: 'mineral',   t: 'Mineral oil' },
      { id: 'silicones', t: 'Silicones' },
      { id: 'animal',    t: 'Animal-derived' },
      { id: 'aha',       t: 'Strong AHAs' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Title renderer (handles { em: '...' } inline highlights)
function QuizTitle({ parts }) {
  return (
    <div className="font-display" style={{
      fontSize: 'clamp(34px, 4.6vw, 56px)', lineHeight: 1.05,
      letterSpacing: '-0.02em', color: 'var(--paper)',
    }}>
      {parts.map((p, i) => typeof p === 'string'
        ? <span key={i}>{p}</span>
        : <em key={i} style={{ color: 'var(--coral)', fontStyle: 'italic' }}>{p.em}</em>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Q1: Single choice with emoji glyph
function ChoiceQuestion({ step, value, onChange }) {
  const [other, setOther] = React.useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {step.options.map(opt => {
        const selected = value === opt.id;
        return (
          <button key={opt.id} onClick={() => onChange(opt.id)} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '20px 24px', borderRadius: 16,
            background: selected ? 'var(--paper)' : 'var(--ink-2)',
            color: selected ? 'var(--ink)' : 'var(--fg)',
            border: selected ? '1px solid var(--paper)' : '1px solid var(--border-2)',
            textAlign: 'left', transition: 'all .15s ease', cursor: 'pointer',
          }}>
            <span style={{
              fontSize: 28, fontFamily: 'var(--font-display)',
              color: selected ? 'var(--coral)' : 'var(--fg-dim)',
            }}>{opt.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 500 }}>{opt.t}</div>
              <div style={{ fontSize: 13, opacity: 0.65, marginTop: 2 }}>{opt.sub}</div>
            </div>
            {selected && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--coral)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)',
              }}>
                <Icon name="check" size={14} stroke={2.4}/>
              </div>
            )}
          </button>
        );
      })}
      {step.allowOther && (
        <div style={{ marginTop: 8, padding: 16, border: '1px dashed var(--border-2)', borderRadius: 12 }}>
          <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Or describe it yourself
          </div>
          <input
            value={other}
            onChange={e => { setOther(e.target.value); onChange('other:' + e.target.value); }}
            placeholder="Mostly tight, a little broken-out around the chin…"
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--fg)', fontSize: 15, padding: '4px 0',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Q2: Multi-select chips (with cap)
function MultiQuestion({ step, value = [], onChange }) {
  const toggle = id => {
    if (value.includes(id)) onChange(value.filter(v => v !== id));
    else if (value.length < step.max) onChange([...value, id]);
  };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {step.options.map(opt => {
          const selected = value.includes(opt.id);
          return (
            <button key={opt.id} onClick={() => toggle(opt.id)} style={{
              padding: '18px 18px', borderRadius: 14, textAlign: 'left',
              background: selected ? 'var(--coral)' : 'var(--ink-2)',
              color: selected ? 'var(--ink)' : 'var(--fg)',
              border: selected ? '1px solid var(--coral)' : '1px solid var(--border-2)',
              transition: 'all .15s ease', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: selected ? 'var(--ink)' : 'transparent',
                border: selected ? 'none' : '1.5px solid var(--border-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--coral)', flexShrink: 0,
              }}>
                {selected && <Icon name="check" size={13} stroke={2.6}/>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{opt.t}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{opt.sub}</div>
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 16, fontSize: 12, color: 'var(--fg-mute)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
        {value.length}/{step.max} SELECTED · pick at least one
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Q3: Budget — dual-handle range (visual only, with values)
function BudgetQuestion({ step, value, onChange }) {
  const v = value || { low: step.defaultLow, high: step.defaultHigh };
  const pct = (n) => ((n - step.min) / (step.max - step.min)) * 100;

  const tier = v.high < 25 ? 'Drugstore-tier · I have you covered'
             : v.high < 60 ? 'Mid-tier · the sweet spot for most K-beauty'
             : v.high < 95 ? 'Mid–luxury · room for hero serums'
             :               'Luxury · we can include splurge picks';

  return (
    <div>
      <div style={{
        padding: 28, borderRadius: 20,
        background: 'var(--ink-2)', border: '1px solid var(--border-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
          <div className="font-display" style={{ fontSize: 64, lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--paper)' }}>
            ${v.low}<span style={{ color: 'var(--fg-mute)' }}> – </span>${v.high}
          </div>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.06em' }}>per product</span>
        </div>

        {/* Track */}
        <div style={{ position: 'relative', height: 36, marginTop: 12 }}>
          <div style={{
            position: 'absolute', top: 16, left: 0, right: 0, height: 4,
            background: 'var(--ink-4)', borderRadius: 2,
          }}/>
          <div style={{
            position: 'absolute', top: 16, height: 4, borderRadius: 2,
            left: `${pct(v.low)}%`, right: `${100 - pct(v.high)}%`,
            background: 'var(--coral)',
          }}/>
          {/* Tick marks */}
          {[step.min, 30, 60, 90, step.max].map(t => (
            <div key={t} style={{
              position: 'absolute', top: 24, left: `${pct(t)}%`,
              transform: 'translateX(-50%)',
              fontSize: 10, color: 'var(--fg-mute)', fontFamily: 'var(--font-mono)',
            }}>${t}</div>
          ))}
          {/* Handles */}
          <input type="range" min={step.min} max={step.max} value={v.low}
            onChange={e => onChange({ ...v, low: Math.min(+e.target.value, v.high - 5) })}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: 36,
              background: 'transparent', appearance: 'none', WebkitAppearance: 'none',
              pointerEvents: 'none',
            }}
            className="hubble-range hubble-range-low"
          />
          <input type="range" min={step.min} max={step.max} value={v.high}
            onChange={e => onChange({ ...v, high: Math.max(+e.target.value, v.low + 5) })}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, width: '100%', height: 36,
              background: 'transparent', appearance: 'none', WebkitAppearance: 'none',
              pointerEvents: 'none',
            }}
            className="hubble-range hubble-range-high"
          />
          <style>{`
            .hubble-range::-webkit-slider-thumb {
              -webkit-appearance: none; appearance: none;
              width: 24px; height: 24px; border-radius: 50%;
              background: var(--paper); border: 3px solid var(--coral);
              cursor: grab; pointer-events: auto;
              box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            }
            .hubble-range::-moz-range-thumb {
              width: 24px; height: 24px; border-radius: 50%;
              background: var(--paper); border: 3px solid var(--coral);
              cursor: grab; pointer-events: auto;
              box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            }
            .hubble-range::-webkit-slider-runnable-track { background: transparent; height: 4px; }
            .hubble-range::-moz-range-track { background: transparent; height: 4px; }
          `}</style>
        </div>

        <div style={{ marginTop: 28, padding: 14, borderRadius: 10, background: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--lime)',
          }}/>
          <span style={{ fontSize: 13, color: 'var(--fg-dim)' }}>{tier}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Q4: Routine builder (AM/PM grid)
function RoutineQuestion({ step, value, onChange }) {
  const v = value || { am: step.am.filter(x => x.on).map(x => x.id), pm: step.pm.filter(x => x.on).map(x => x.id) };
  const toggle = (slot, id) => {
    const next = { ...v, [slot]: v[slot].includes(id) ? v[slot].filter(x => x !== id) : [...v[slot], id] };
    onChange(next);
  };
  const StepBtn = ({ slot, item }) => {
    const on = v[slot].includes(item.id);
    return (
      <button onClick={() => toggle(slot, item.id)} style={{
        padding: '14px 12px', borderRadius: 12, fontSize: 12, fontWeight: 500,
        background: on ? 'var(--paper)' : 'transparent',
        color: on ? 'var(--ink)' : 'var(--fg-dim)',
        border: on ? '1px solid var(--paper)' : '1px dashed var(--border-2)',
        cursor: 'pointer', transition: 'all .15s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        textAlign: 'center',
      }}>
        <span style={{ fontSize: 16, opacity: on ? 1 : 0.4 }}>{on ? '●' : '○'}</span>
        {item.t}
      </button>
    );
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {[['am','Morning','☀'], ['pm','Evening','☾']].map(([slot, label, gly]) => (
        <div key={slot} style={{ padding: 18, borderRadius: 16, background: 'var(--ink-2)', border: '1px solid var(--border-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span className="font-display" style={{ fontSize: 22, color: 'var(--coral)' }}>{gly}</span>
            <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--fg-mute)', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-mute)' }}>{v[slot].length} steps</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {step[slot].map(item => <StepBtn key={item.id} slot={slot} item={item}/>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Q5: Loved products — chip-suggest + freeform
function LoveQuestion({ step, value = [], onChange }) {
  const [text, setText] = React.useState('');
  const add = (s) => { if (s && !value.includes(s)) onChange([...value, s]); setText(''); };
  return (
    <div>
      <div style={{
        padding: 16, borderRadius: 14,
        background: 'var(--ink-2)', border: '1px solid var(--border-2)',
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minHeight: 56,
      }}>
        {value.map(v => (
          <span key={v} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 10px 6px 12px', borderRadius: 999,
            background: 'var(--coral)', color: 'var(--ink)', fontSize: 13, fontWeight: 500,
          }}>
            {v}
            <button onClick={() => onChange(value.filter(x => x !== v))} style={{ display: 'flex', color: 'var(--ink)', opacity: 0.7 }}>
              <Icon name="x" size={12} stroke={2.4}/>
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(text); } }}
          placeholder={value.length ? 'Add another…' : 'Type a product or brand and press Enter'}
          style={{
            flex: 1, minWidth: 200, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--fg)', fontSize: 14, padding: '6px 4px',
          }}
        />
      </div>
      <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginTop: 20, marginBottom: 10 }}>
        Popular with people like you
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {step.suggestions.filter(s => !value.includes(s)).map(s => (
          <button key={s} onClick={() => add(s)} style={{
            padding: '8px 14px', borderRadius: 999,
            background: 'transparent', border: '1px solid var(--border-2)',
            color: 'var(--fg)', fontSize: 13, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Icon name="plus" size={11}/> {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Q6: Avoid — toggle chips with bad-state
function AvoidQuestion({ step, value, onChange }) {
  const v = value || step.chips.filter(c => c.on).map(c => c.id);
  const toggle = id => onChange(v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {step.chips.map(c => {
          const on = v.includes(c.id);
          return (
            <button key={c.id} onClick={() => toggle(c.id)} style={{
              padding: '10px 16px', borderRadius: 999,
              background: on ? 'var(--coral)' : 'transparent',
              color: on ? 'var(--ink)' : 'var(--fg)',
              border: on ? '1px solid var(--coral)' : '1px solid var(--border-2)',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'all .15s ease',
            }}>
              {on ? <Icon name="x" size={12} stroke={2.4}/> : <Icon name="plus" size={12}/>}
              {c.t}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 24, padding: 16, border: '1px dashed var(--border-2)', borderRadius: 12 }}>
        <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Allergies or other notes
        </div>
        <input
          placeholder="Salicylic acid stings me… also vegan-only"
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--fg)', fontSize: 15, padding: '4px 0',
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Intro screen
function QuizIntro({ onStart }) {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--ink)',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <HubbleWordmark height={20}/>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>Already have an account →</button>
      </header>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        maxWidth: 720, margin: '0 auto', padding: '0 32px', textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <HubbleAvatar size={56}/>
        </div>
        <div className="font-mono" style={{ fontSize: 11, color: 'var(--coral)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
          Skin quiz · 6 questions · ~5 min
        </div>
        <div className="font-display" style={{ fontSize: 'clamp(48px, 7vw, 88px)', lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--paper)' }}>
          Let me get to know<br/>your <em style={{ color: 'var(--coral)' }}>skin</em>.
        </div>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--fg-dim)', maxWidth: 540, margin: '24px auto 0' }}>
          Six honest questions. No filler. By the end I'll have enough to recommend products you'll actually finish — and I won't ask any of this twice.
        </p>
        <div style={{ marginTop: 40, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onStart} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: 15 }}>
            Start the quiz <Icon name="arrow" size={14}/>
          </button>
          <button className="btn btn-ghost" style={{ padding: '14px 28px', fontSize: 15 }}>
            Skip — just chat
          </button>
        </div>
        <div style={{ marginTop: 64, display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { l: 'Private', s: 'Your answers stay yours' },
            { l: 'No upsell', s: 'Brands pay us, not you' },
            { l: 'Adapts', s: 'Re-quiz anytime your skin shifts' },
          ].map(b => (
            <div key={b.l} style={{ textAlign: 'left', maxWidth: 160 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{b.l}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-mute)', marginTop: 2 }}>{b.s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Loading screen — between quiz and results
function QuizLoading({ onDone }) {
  const [phase, setPhase] = React.useState(0);
  const phases = [
    'Reading your answers',
    'Cross-referencing 14,200 products',
    'Filtering for your concerns',
    'Removing what you\'re avoiding',
    'Ranking by your budget',
    'Drafting your routine',
  ];
  React.useEffect(() => {
    if (phase < phases.length) {
      const t = setTimeout(() => setPhase(phase + 1), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => onDone && onDone(), 600);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--ink)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32,
    }}>
      <HubbleAvatar size={64} mood="thinking"/>
      <div className="font-display" style={{ fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05, letterSpacing: '-0.02em', color: 'var(--paper)', marginTop: 32, textAlign: 'center', maxWidth: 600 }}>
        Building your <em style={{ color: 'var(--coral)' }}>skin profile</em>…
      </div>
      <div style={{ marginTop: 40, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {phases.map((p, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 10,
            background: i === phase ? 'var(--ink-3)' : 'transparent',
            opacity: i > phase ? 0.3 : 1,
            transition: 'opacity .3s ease',
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              background: i < phase ? 'var(--lime)' : i === phase ? 'transparent' : 'var(--ink-3)',
              border: i === phase ? '2px solid var(--coral)' : 'none',
              borderTopColor: i === phase ? 'transparent' : undefined,
              animation: i === phase ? 'qspin 0.7s linear infinite' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {i < phase && <Icon name="check" size={11} color="var(--ink)" stroke={3}/>}
            </div>
            <span style={{ fontSize: 13, color: i <= phase ? 'var(--fg)' : 'var(--fg-mute)' }}>{p}</span>
          </div>
        ))}
        <style>{`@keyframes qspin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RESULTS — skin profile + recommended routine
function QuizResults({ answers, onChat }) {
  // Derive readable profile from answers
  const profile = {
    'Skin type': 'Combination, sensitive',
    'This week': 'Reactive · red',
    'Concerns':  'Redness · dehydration · fine lines',
    'Budget':    answers.budget ? `$${answers.budget.low}–$${answers.budget.high}` : '$30–$80',
    'Avoiding':  'Fragrance · drying alcohol',
    'Loves':     'Beauty of Joseon serum',
  };
  const recs = [
    { product: PRODUCTS.peachPHCleanser, slot: 'AM · cleanser' },
    { product: PRODUCTS.anuaCleanser,    slot: 'AM · toner' },
    { product: PRODUCTS.cosrxSnail,      slot: 'AM/PM · serum' },
    { product: PRODUCTS.glowAvocado,     slot: 'PM · eye + treatment' },
  ];
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 32px', borderBottom: '1px solid var(--border)',
      }}>
        <HubbleWordmark height={20}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="dot dot-pulse"/>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Profile saved
          </span>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px' }}>
        <div className="font-mono" style={{ fontSize: 11, color: 'var(--coral)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
          Done · here's what I have
        </div>
        <div className="font-display" style={{ fontSize: 'clamp(40px, 6vw, 76px)', lineHeight: 1, letterSpacing: '-0.03em', color: 'var(--paper)' }}>
          Your skin profile,<br/>
          version <em style={{ color: 'var(--coral)' }}>one</em>.
        </div>
        <p style={{ fontSize: 16, color: 'var(--fg-dim)', maxWidth: 560, marginTop: 20, lineHeight: 1.5 }}>
          We'll keep refining as you check in. For now — here's what I'd build for you, and why.
        </p>

        {/* Profile + Routine */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginTop: 40 }}>
          {/* Profile */}
          <div style={{
            padding: 24, borderRadius: 20, background: 'var(--ink-2)',
            border: '1px solid var(--border)', alignSelf: 'start',
          }}>
            <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 4 }}>
              Skin profile · v1
            </div>
            <div className="font-display" style={{ fontSize: 28, marginBottom: 20 }}>The basics</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Object.entries(profile).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 12, color: 'var(--fg-mute)' }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 12, marginTop: 16 }}>
              Edit answers
            </button>
          </div>

          {/* Recommended routine */}
          <div>
            <div style={{
              padding: 24, borderRadius: 20, background: 'var(--paper)', color: 'var(--ink)',
              marginBottom: 16,
            }}>
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 4 }}>
                Recommended starter routine
              </div>
              <div className="font-display" style={{ fontSize: 32, lineHeight: 1.1, marginBottom: 12 }}>
                Four products. One thoughtful order.
              </div>
              <div style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                Designed around your reactive week, dehydration, and the BoJ serum you already love. Total at full price: <strong>$112</strong>. With the offers Hubble found you: <strong style={{ color: 'var(--coral)' }}>$84</strong>.
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recs.map((r, i) => (
                <div key={r.product.id} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: 14, borderRadius: 14, background: 'var(--ink-2)', border: '1px solid var(--border)',
                }}>
                  <div className="font-mono" style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'var(--ink-3)', color: 'var(--coral)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, flexShrink: 0,
                  }}>{String(i+1).padStart(2,'0')}</div>
                  <div style={{ flex: 1 }}>
                    <div className="font-mono" style={{ fontSize: 10, color: 'var(--fg-mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {r.slot}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2, color: 'var(--paper)' }}>
                      {r.product.brand} · <span style={{ color: 'var(--fg-dim)' }}>{r.product.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg-dim)', lineHeight: 1.4, marginTop: 6 }}>
                      {r.product.why}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>${r.product.price}</div>
                    <div style={{ fontSize: 10, color: 'var(--lime)', marginTop: 2 }}>−25% offer</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{
          marginTop: 32, padding: 28, borderRadius: 20,
          background: 'linear-gradient(135deg, var(--coral) 0%, #FF8061 100%)',
          color: 'var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="font-display" style={{ fontSize: 32, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
              Want to talk it through?
            </div>
            <div style={{ fontSize: 14, marginTop: 8, opacity: 0.85 }}>
              Open the chat. Ask me anything — order, layering, what to start with first.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" style={{ background: 'var(--paper)', color: 'var(--ink)', padding: '12px 18px' }}>
              Save routine
            </button>
            <button onClick={onChat} className="btn" style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '12px 18px' }}>
              Open chat <Icon name="arrow" size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main controller
function SkinQuiz({ onChat }) {
  const [phase, setPhase] = React.useState('intro'); // intro | quiz | loading | results
  const [stepIdx, setStepIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState({
    feel: 'reactive',
    concerns: ['redness', 'dehydra'],
    budget: { low: 30, high: 80 },
    routine: { am: ['cleanser_am','toner_am','serum_am','moist_am','spf_am'], pm: ['cleanser_pm','serum_pm','moist_pm'] },
    loved: ['Beauty of Joseon Glow Serum'],
    avoid: ['fragrance', 'alcohol'],
  });
  const step = QUIZ_STEPS[stepIdx];
  const total = QUIZ_STEPS.length;

  const setAns = (id, v) => setAnswers(prev => ({ ...prev, [id]: v }));
  const next = () => stepIdx + 1 >= total ? setPhase('loading') : setStepIdx(stepIdx + 1);
  const back = () => stepIdx === 0 ? setPhase('intro') : setStepIdx(stepIdx - 1);

  if (phase === 'intro')   return <QuizIntro onStart={() => setPhase('quiz')}/>;
  if (phase === 'loading') return <QuizLoading onDone={() => setPhase('results')}/>;
  if (phase === 'results') return <QuizResults answers={answers} onChat={onChat}/>;

  const ans = answers[step.id];
  const canContinue =
    step.kind === 'choice' ? !!ans :
    step.kind === 'multi'  ? Array.isArray(ans) && ans.length > 0 :
    step.kind === 'budget' ? !!ans :
    step.kind === 'routine'? !!ans :
    step.kind === 'love'   ? Array.isArray(ans) && ans.length > 0 :
    step.kind === 'avoid'  ? true :
    true;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 32px', borderBottom: '1px solid var(--border)',
      }}>
        <HubbleWordmark height={20}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.08em' }}>
            STEP {String(stepIdx+1).padStart(2, '0')} / 0{total}
          </span>
          <div style={{ width: 160, height: 4, borderRadius: 2, background: 'var(--ink-3)', overflow: 'hidden' }}>
            <div style={{ width: `${((stepIdx+1)/total)*100}%`, height: '100%', background: 'var(--coral)', transition: 'width .4s ease' }}/>
          </div>
        </div>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>Save & exit</button>
      </header>

      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.05fr',
        maxWidth: 1400, width: '100%', margin: '0 auto', minHeight: 0,
      }}>
        {/* LEFT — Hubble's question */}
        <div style={{ padding: '56px 56px 56px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <HubbleAvatar size={32} mood="thinking"/>
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Hubble is asking · Q{stepIdx+1}
              </span>
            </div>
            <QuizTitle parts={step.title}/>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--fg-dim)', maxWidth: 520, marginTop: 20 }}>
              {step.sub}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 32 }}>
            <button onClick={back} className="btn btn-ghost" style={{ padding: '12px 20px' }}>
              ← Back
            </button>
            <button onClick={next} disabled={!canContinue} className="btn btn-primary" style={{
              padding: '12px 24px',
              opacity: canContinue ? 1 : 0.4, cursor: canContinue ? 'pointer' : 'not-allowed',
            }}>
              {stepIdx + 1 === total ? 'Build my profile' : 'Continue'} <Icon name="arrow" size={14}/>
            </button>
            <span style={{ fontSize: 12, color: 'var(--fg-mute)', marginLeft: 12 }}>
              or press <kbd style={{
                padding: '2px 6px', borderRadius: 4, background: 'var(--ink-3)', border: '1px solid var(--border-2)',
                fontFamily: 'var(--font-mono)', fontSize: 11,
              }}>Enter</kbd>
            </span>
          </div>
        </div>

        {/* RIGHT — answer surface */}
        <div style={{ padding: '56px 64px 56px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          {step.kind === 'choice'  && <ChoiceQuestion  step={step} value={ans} onChange={v => setAns(step.id, v)}/>}
          {step.kind === 'multi'   && <MultiQuestion   step={step} value={ans} onChange={v => setAns(step.id, v)}/>}
          {step.kind === 'budget'  && <BudgetQuestion  step={step} value={ans} onChange={v => setAns(step.id, v)}/>}
          {step.kind === 'routine' && <RoutineQuestion step={step} value={ans} onChange={v => setAns(step.id, v)}/>}
          {step.kind === 'love'    && <LoveQuestion    step={step} value={ans} onChange={v => setAns(step.id, v)}/>}
          {step.kind === 'avoid'   && <AvoidQuestion   step={step} value={ans} onChange={v => setAns(step.id, v)}/>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SkinQuiz, QuizIntro, QuizLoading, QuizResults });
