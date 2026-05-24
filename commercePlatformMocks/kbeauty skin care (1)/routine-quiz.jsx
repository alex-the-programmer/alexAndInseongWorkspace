// Skin quiz — different from onboarding (which captures *what you already use*).
// This captures who you are, then "builds" a recommendation.

const QUIZ = [
  {
    key: 'skinType', kind: 'single',
    q: 'How would you describe your skin most days?',
    help: 'Pick whichever feels closest. We can refine later.',
    options: [
      { v: 'oily',      title: 'Oily',       sub: 'Shiny by midday, large pores' },
      { v: 'combo',     title: 'Combination',sub: 'Oily T-zone, normal cheeks' },
      { v: 'normal',    title: 'Normal',     sub: 'Balanced, rarely reacts' },
      { v: 'dry',       title: 'Dry',        sub: 'Tight, sometimes flaky' },
      { v: 'sensitive', title: 'Sensitive',  sub: 'Reacts to most products' },
    ],
  },
  {
    key: 'concerns', kind: 'multi',
    q: 'What would you like to work on?',
    help: 'Choose up to 3 — we\'ll prioritize these.',
    max: 3,
    options: [
      'Acne & breakouts', 'Dark spots / PIH', 'Redness', 'Dullness',
      'Fine lines', 'Dehydration', 'Texture', 'Dark circles', 'Enlarged pores',
    ],
  },
  {
    key: 'sensitivity', kind: 'slider',
    q: 'How reactive is your skin?',
    help: 'On a typical day, how often does a new product sting, flush, or break you out?',
    min: 1, max: 5, labels: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
  },
  {
    key: 'climate', kind: 'single',
    q: 'Where are you mostly using these?',
    options: [
      { v: 'humid', title: 'Humid', sub: 'Hot, sticky' },
      { v: 'temperate', title: 'Temperate', sub: 'Four seasons' },
      { v: 'dry', title: 'Dry', sub: 'Low humidity, indoor heat' },
      { v: 'cold', title: 'Cold', sub: 'Winter most of the year' },
    ],
  },
  {
    key: 'budget', kind: 'single',
    q: 'What\'s comfortable per product?',
    help: 'We won\'t recommend anything past your ceiling.',
    options: [
      { v: 'lo', title: 'Under $20',   sub: 'Drugstore-friendly' },
      { v: 'md', title: '$20 – $40',  sub: 'Mid-range Korean staples' },
      { v: 'hi', title: '$40 – $80',  sub: 'Premium K-beauty' },
      { v: 'any', title: 'Cost doesn\'t matter', sub: 'Pick the best regardless' },
    ],
  },
];

function QuizSheet({ onClose, onComplete }) {
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState({});
  const [showBuild, setShowBuild] = React.useState(false);
  const q = QUIZ[step];
  const pct = ((step + 1) / QUIZ.length) * 100;
  const isLast = step === QUIZ.length - 1;
  const a = answers[q.key];

  const canNext = q.kind === 'single' ? !!a
    : q.kind === 'multi' ? (a && a.length > 0)
    : q.kind === 'slider' ? a !== undefined
    : false;

  function next() {
    if (isLast) {
      setShowBuild(true);
      setTimeout(() => onComplete(answers), 1600);
    } else {
      setStep(step + 1);
    }
  }
  function back() { if (step > 0) setStep(step - 1); }

  function setSingle(v) { setAnswers(p => ({ ...p, [q.key]: v })); }
  function toggleMulti(v) {
    setAnswers(p => {
      const cur = p[q.key] || [];
      if (cur.includes(v)) return { ...p, [q.key]: cur.filter(x => x !== v) };
      if (q.max && cur.length >= q.max) return p;
      return { ...p, [q.key]: [...cur, v] };
    });
  }

  if (showBuild) {
    return (
      <div className="scrim">
        <div className="sheet" style={{ maxWidth: 480 }}>
          <div className="sheet-body" style={{ padding: 56, textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 22px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--orange-soft)', animation: 'pulse 1.4s ease-in-out infinite' }}/>
              <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', background: 'var(--orange)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RIcon.Sparkles style={{ width: 22, height: 22 }}/>
              </div>
            </div>
            <h2 className="serif" style={{ fontSize: 32, margin: '0 0 8px', letterSpacing: -0.4 }}>Building your routine…</h2>
            <p className="muted" style={{ margin: 0, fontSize: 14.5 }}>Comparing 2,341 products against your skin profile.</p>
          </div>
          <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); opacity: .8; } 50% { transform: scale(1.15); opacity: .4; } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="sheet-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="avatar-bot" style={{ background: 'var(--ink)' }}><RIcon.Wand style={{ width: 14, height: 14 }}/></span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>Skin quiz</div>
              <div className="muted" style={{ fontSize: 12 }}>5 questions · ~90 seconds</div>
            </div>
          </div>
          <div className="pbar" style={{ marginLeft: 12 }}><span style={{ width: `${pct}%` }}/></div>
          <div className="step-count">{step + 1} / {QUIZ.length}</div>
          <button className="iconbtn-close" onClick={onClose} aria-label="Close"><RIcon.Close/></button>
        </div>

        <div className="sheet-body">
          <div className="q-eyebrow">Question {step + 1}</div>
          <h2 className="q-title">{q.q}</h2>
          {q.help && <p className="q-help">{q.help}</p>}

          {q.kind === 'single' && (
            <div className="opt-grid">
              {q.options.map(o => (
                <button key={o.v} className={'opt' + (a === o.v ? ' on' : '')} onClick={() => setSingle(o.v)}>
                  <span>
                    <div className="opt-title">{o.title}</div>
                    {o.sub && <div className="opt-sub">{o.sub}</div>}
                  </span>
                  <span className="check"><RIcon.CheckSm style={{ width: 12, height: 12 }}/></span>
                </button>
              ))}
            </div>
          )}

          {q.kind === 'multi' && (
            <div className="chip-row">
              {q.options.map(o => {
                const on = (a || []).includes(o);
                return (
                  <button key={o} className={'chip' + (on ? ' on' : '')} onClick={() => toggleMulti(o)}>
                    {on && <RIcon.CheckSm style={{ width: 12, height: 12 }}/>}
                    {o}
                  </button>
                );
              })}
            </div>
          )}

          {q.kind === 'slider' && (
            <div>
              <input type="range" min={q.min} max={q.max} step={1} value={a || 3}
                onChange={(e) => setSingle(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--orange)' }}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12.5, color: 'var(--ink-3)' }}>
                {q.labels.map((l, i) => (
                  <span key={i} style={{ fontWeight: (a || 3) === (i + 1) ? 600 : 400, color: (a || 3) === (i + 1) ? 'var(--ink)' : undefined }}>{l}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sheet-foot">
          <button className="btn btn-ghost btn-sm" onClick={back} disabled={step === 0} style={{ opacity: step === 0 ? 0.4 : 1 }}>
            <RIcon.ArrowLeft style={{ width: 16, height: 16 }}/> Back
          </button>
          <button className="btn btn-primary btn-sm" onClick={next} disabled={!canNext} style={{ opacity: canNext ? 1 : 0.45, pointerEvents: canNext ? undefined : 'none' }}>
            {isLast ? 'Build my routine' : 'Continue'} <RIcon.ArrowRight style={{ width: 16, height: 16 }}/>
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { QuizSheet });
