// Chat-style onboarding wizard. User walks through morning then evening,
// adding products one at a time. Each "slot" is a category pick + product
// name entry (or skip). Friendly, single-question-at-a-time.

const ONB_STEPS = [
  { key: 'morning-cleanser',   slot: 'morning', cat: 'cleanser',   q: 'First up — what do you wash your face with in the morning?' },
  { key: 'morning-toner',      slot: 'morning', cat: 'toner',      q: 'Any toner or essence after that?' },
  { key: 'morning-serum',      slot: 'morning', cat: 'serum',      q: 'How about a serum or treatment?' },
  { key: 'morning-moist',      slot: 'morning', cat: 'moisturizer',q: 'And a moisturizer to seal everything in?' },
  { key: 'morning-spf',        slot: 'morning', cat: 'spf',        q: 'Sunscreen is the whole point of a morning routine. What are you using?' },
  { key: 'evening-cleanser',   slot: 'evening', cat: 'cleanser',   q: 'Switching to evenings — how do you cleanse at night?' },
  { key: 'evening-essence',    slot: 'evening', cat: 'essence',    q: 'Any essence or hydrating layer?' },
  { key: 'evening-serum',      slot: 'evening', cat: 'serum',      q: 'Any actives at night — retinol, AHA, vitamin C?' },
  { key: 'evening-moist',      slot: 'evening', cat: 'moisturizer',q: 'And a night cream or moisturizer?' },
];

function OnboardingSheet({ onClose, onComplete }) {
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState({});       // key -> { brand, name } | null (skipped)
  const [scratch, setScratch] = React.useState({ brand: '', name: '' });
  const [history, setHistory] = React.useState([]);       // chat transcript for rendering

  const cur = ONB_STEPS[step];
  const pct = ((step) / ONB_STEPS.length) * 100;
  const cat = cur ? CAT[cur.cat] : null;
  const isLast = step === ONB_STEPS.length - 1;
  const bodyRef = React.useRef(null);

  // Autoscroll chat to bottom on step change
  React.useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [step, history.length]);

  function commit(label) {
    setHistory(h => [...h, { side: 'bot', text: cur.q }, { side: 'me', text: label }]);
  }

  function next(answer) {
    setAnswers(a => ({ ...a, [cur.key]: answer }));
    commit(answer ? `${answer.brand}${answer.brand && answer.name ? ' · ' : ''}${answer.name}` : 'Skip for now');
    setScratch({ brand: '', name: '' });
    if (isLast) {
      onComplete({ ...answers, [cur.key]: answer });
    } else {
      setStep(step + 1);
    }
  }

  function back() {
    if (step === 0) return;
    setStep(step - 1);
    setHistory(h => h.slice(0, -2));
    const prev = ONB_STEPS[step - 1];
    setAnswers(a => { const { [prev.key]: _, ...rest } = a; return rest; });
  }

  // Suggested popular picks per category for one-tap entry
  const popular = {
    cleanser:   [{ brand: 'COSRX',           name: 'Low pH Good Morning Gel' }, { brand: 'Banila Co',        name: 'Clean It Zero Balm' }, { brand: 'CeraVe',          name: 'Foaming Cleanser' }],
    toner:      [{ brand: 'Anua',            name: 'Heartleaf 77% Toner' },     { brand: 'iUnik',            name: 'Centella Calming Toner' }, { brand: 'Pyunkang Yul', name: 'Essence Toner' }],
    essence:    [{ brand: 'COSRX',           name: 'Snail 96 Mucin Essence' },  { brand: 'SK-II',            name: 'Facial Treatment Essence' }],
    serum:      [{ brand: 'Beauty of Joseon', name: 'Glow Serum' },             { brand: 'The Ordinary',     name: 'Niacinamide 10%' }, { brand: 'Anua', name: 'Niacinamide + TXA' }],
    moisturizer:[{ brand: 'Laneige',         name: 'Cream Skin Refiner' },      { brand: 'Round Lab',        name: '1025 Dokdo Lotion' }, { brand: 'CeraVe', name: 'Moisturizing Cream' }],
    spf:        [{ brand: 'Beauty of Joseon', name: 'Relief Sun Rice SPF 50+' },{ brand: 'Round Lab',        name: 'Birch Juice Sunscreen' }, { brand: 'Anessa', name: 'Perfect UV Sunscreen' }],
  };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="sheet-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="avatar-bot">s</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>Set up your routine</div>
              <div className="muted" style={{ fontSize: 12 }}>Takes about 2 minutes</div>
            </div>
          </div>
          <div className="pbar" style={{ marginLeft: 12 }}><span style={{ width: `${pct}%` }}/></div>
          <div className="step-count">{step + 1} / {ONB_STEPS.length}</div>
          <button className="iconbtn-close" onClick={onClose} aria-label="Close"><RIcon.Close/></button>
        </div>

        <div className="sheet-body" ref={bodyRef}>
          {/* Chat transcript */}
          <div className="chat">
            <div className="bubble-row">
              <span className="avatar-bot">s</span>
              <div className="bubble bot serif">
                Hi — I'm Soone. Let's get your current routine in one place.
              </div>
            </div>
            {history.map((m, i) => m.side === 'bot' ? (
              <div className="bubble-row" key={i}><span className="avatar-bot">s</span><div className="bubble bot">{m.text}</div></div>
            ) : (
              <div className="bubble-row me" key={i}><div className="bubble me">{m.text}</div></div>
            ))}
            {/* Current question */}
            <div className="bubble-row">
              <span className="avatar-bot">s</span>
              <div className="bubble bot">{cur.q}</div>
            </div>
          </div>

          {/* Category context strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 16px', color: 'var(--ink-3)', fontSize: 12.5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--cream)', borderRadius: 999, color: 'var(--ink)' }}>
              {React.createElement(RIcon[cat.icon], { style: { width: 14, height: 14 } })}
              {cat.label} · {cur.slot === 'morning' ? 'Morning' : 'Evening'}
            </span>
          </div>

          {/* Input form */}
          <div style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
            <input className="field" placeholder="Brand (e.g. COSRX)" value={scratch.brand}
              onChange={(e) => setScratch(s => ({ ...s, brand: e.target.value }))} />
            <input className="field" placeholder="Product name" value={scratch.name}
              onChange={(e) => setScratch(s => ({ ...s, name: e.target.value }))} />
          </div>

          {popular[cur.cat] && (
            <div style={{ marginBottom: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Popular picks · tap to use</div>
              <div className="chip-row">
                {popular[cur.cat].map((p, i) => (
                  <button key={i} className="chip" onClick={() => setScratch(p)}>
                    {p.brand} · {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sheet-foot">
          <button className="btn btn-ghost btn-sm" onClick={back} disabled={step === 0} style={{ opacity: step === 0 ? 0.4 : 1 }}>
            <RIcon.ArrowLeft style={{ width: 16, height: 16 }}/> Back
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => next(null)}>
              I don't use one
            </button>
            <button className="btn btn-dark btn-sm" onClick={() => next(scratch.brand || scratch.name ? scratch : null)} disabled={!scratch.brand && !scratch.name}>
              {isLast ? 'Finish' : 'Continue'} <RIcon.ArrowRight style={{ width: 16, height: 16 }}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingSheet });
