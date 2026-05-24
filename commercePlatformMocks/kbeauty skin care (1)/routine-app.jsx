// Main dashboard. Manages all top-level state and renders:
// - Top nav
// - Hero (varies by state)
// - Empty state OR routine list (current routine is primary)
// - Recommendation banner (after quiz taken)
// - Onboarding sheet, Quiz sheet, Recommendations drawer (modal layers)
// - Demo switcher in the corner so reviewers can hop states quickly.

function TopNav() {
  return (
    <div className="topnav-wrap" data-screen-label="Top nav">
      <div className="topnav">
        <span className="brand">soone</span>
        <span className="link">Chat</span>
        <span className="link active">Your Skin Routine</span>
        <span className="sep"/>
        <button className="iconbtn" aria-label="Theme"><RIcon.Moon/></button>
        <button className="iconbtn" aria-label="Notifications"><RIcon.Bell/><span className="dot"/></button>
        <div className="userpill">
          <span className="avatar">In</span>
          <span className="name">Inseong</span>
        </div>
      </div>
    </div>
  );
}

function Price({ product, size = '' }) {
  const t = window.__currency || 'USD';
  if (!product?.price) return null;
  return (
    <span className={'price' + (size ? ' price-' + size : '')}>
      <span className="now">{fmtPrice(product.price, t)}</span>
      {product.prevPrice && product.prevPrice > product.price && (
        <span className="was">{fmtPrice(product.prevPrice, t)}</span>
      )}
    </span>
  );
}

function StepCard({ idx, product, status, onEdit, onRemove, showPrice }) {
  if (!product) return null;
  const cat = CAT[product.cat];
  return (
    <div className="step">
      <span className="num">{idx + 1}</span>
      <div className="thumb"><div className="ph-bottle" style={{ background: product.color }}>{product.brand[0]}</div></div>
      <div className="body">
        <div className="cat" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {React.createElement(RIcon[cat.icon], { style: { width: 12, height: 12 } })}
          {cat.label}
          {status === 'swap' && <span className="badge-mini badge-swap" style={{ marginLeft: 8 }}>Swapped</span>}
          {status === 'new' && <span className="badge-mini badge-new" style={{ marginLeft: 8 }}>New</span>}
        </div>
        <div className="name"><span className="brand">{product.brand}</span> · {product.name}</div>
      </div>
      {showPrice && product.price ? (
        <div className="price-meta">
          <Price product={product}/>
          {product.prevPrice && product.prevPrice > product.price && <span className="sale-pill">Sale</span>}
        </div>
      ) : null}
      <div className="actions">
        <button className="iconbtn-sm" aria-label="Remove" onClick={onRemove}><RIcon.Trash/></button>
      </div>
    </div>
  );
}

function RoutineList({ slot, routine, recentChanges, onAdd, onRemove, showPrice }) {
  const ids = routine[slot];
  return (
    <div className="stack">
      {ids.map((id, i) => (
        <StepCard key={id + i} idx={i} product={PRODUCTS[id]}
          status={recentChanges[id]}
          showPrice={showPrice}
          onRemove={() => onRemove(slot, i)}/>
      ))}
      <button className="add-step" onClick={onAdd}>
        <span className="plus"><RIcon.Plus style={{ width: 18, height: 18 }}/></span>
        <span>Add a step</span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5 }}>Cleanser, toner, serum, moisturizer…</span>
      </button>
    </div>
  );
}

function Empty({ onSetup, onQuiz }) {
  return (
    <div className="empty">
      <div className="e-icons">
        <span className="ic"><RIcon.Cleanser/></span>
        <span className="ic"><RIcon.Serum/></span>
        <span className="ic"><RIcon.Moisturizer/></span>
        <span className="ic"><RIcon.SPF/></span>
      </div>
      <h2>Let's build <i>your</i> routine.</h2>
      <p>Tell me what you're using today and I'll keep track of it. Take 2 minutes — you can edit anything later.</p>
      <div className="e-cta">
        <button className="btn btn-primary" onClick={onSetup}>
          Set up my routine <RIcon.ArrowRight style={{ width: 16, height: 16 }}/>
        </button>
        <button className="btn btn-ghost" onClick={onQuiz}>
          I don't have one — recommend me one
        </button>
      </div>
    </div>
  );
}

function App() {
  // ============ Tweaks ============
  const [t, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "currency": "USD",
    "showPrices": true,
    "bundleDiscount": 12,
    "shipThreshold": 50,
    "accent": "#F25422"
  }/*EDITMODE-END*/);
  // Expose to descendants without prop-drilling
  window.__currency = t.currency;
  // Live accent
  React.useEffect(() => {
    document.documentElement.style.setProperty('--orange', t.accent);
  }, [t.accent]);

  // ============ State ============
  // 'empty'   - no routine yet, show big setup CTA
  // 'routine' - has a routine, no quiz taken yet
  // 'recs'    - quiz taken, banner visible
  const [view, setView] = React.useState('routine');
  const [slot, setSlot] = React.useState('morning');
  const [routine, setRoutine] = React.useState(SAMPLE_ROUTINE);
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [showQuiz, setShowQuiz] = React.useState(false);
  const [showDrawer, setShowDrawer] = React.useState(false);
  const [appliedRecs, setAppliedRecs] = React.useState({}); // recId -> true
  const [recentChanges, setRecentChanges] = React.useState({}); // id -> 'swap' | 'new'

  // For the demo, recs always exist; we just only *surface* them after quiz
  const recs = SAMPLE_RECS;

  // ============ Handlers ============
  function onboardingDone() {
    setShowOnboarding(false);
    setRoutine(SAMPLE_ROUTINE);
    setView('routine');
  }
  function quizDone() {
    setShowQuiz(false);
    setView('recs');
    setShowDrawer(true);
  }
  function applyRec(s, rec) {
    setAppliedRecs(a => ({ ...a, [rec.recId]: true }));
    setRoutine(r => {
      const next = { ...r, [s]: [...r[s]] };
      if (rec.type === 'swap') {
        const i = next[s].indexOf(rec.currentId);
        if (i >= 0) next[s][i] = rec.recId;
      } else if (rec.type === 'new') {
        // insert in a sensible slot (after similar category position)
        next[s] = [...next[s], rec.recId];
      }
      return next;
    });
    setRecentChanges(rc => ({ ...rc, [rec.recId]: rec.type === 'new' ? 'new' : 'swap' }));
  }
  function applyAll(s) {
    recs[s].filter(r => r.type !== 'keep' && !appliedRecs[r.recId]).forEach(r => applyRec(s, r));
  }
  function dismissRec(s, rec) {
    setAppliedRecs(a => ({ ...a, [rec.recId]: 'dismissed' }));
  }

  // ============ Demo switcher ============
  function setDemoState(k) {
    setAppliedRecs({});
    setRecentChanges({});
    setShowOnboarding(false); setShowQuiz(false); setShowDrawer(false);
    if (k === 'empty') { setView('empty'); setRoutine({ morning: [], evening: [] }); }
    if (k === 'routine') { setView('routine'); setRoutine(SAMPLE_ROUTINE); }
    if (k === 'recs') { setView('recs'); setRoutine(SAMPLE_ROUTINE); }
    if (k === 'recs-open') { setView('recs'); setRoutine(SAMPLE_ROUTINE); setShowDrawer(true); }
  }

  // ============ Derived ============
  const totalChanges = (recs.morning.filter(r => r.type !== 'keep').length) + (recs.evening.filter(r => r.type !== 'keep').length);
  const unappliedChanges = (recs.morning.concat(recs.evening)).filter(r => r.type !== 'keep' && !appliedRecs[r.recId]).length;

  return (
    <div className="page">
      <TopNav/>

      {/* Hero card — content varies by state */}
      {view === 'empty' ? null : (
        <div className="hero" data-screen-label="Routine hero">
          <div className="h-text">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Your skincare routine</div>
            <h1>
              {view === 'recs' ? <>Your routine, <i>refined.</i></> : <>Hi Inseong — <i>what you use, daily.</i></>}
            </h1>
            <div className="h-sub">
              {view === 'recs'
                ? <>Based on your skin quiz, I've drafted some swaps and additions. Apply what feels right — your current routine stays the source of truth.</>
                : <>Everything you're using right now, in one place. Take the skin quiz any time to see what I'd refine.</>
              }
            </div>
          </div>
          <div className="h-cta">
            {view === 'recs' ? (
              <button className="btn btn-primary" onClick={() => setShowDrawer(true)}>
                <RIcon.Sparkles style={{ width: 16, height: 16 }}/> View recommendations
              </button>
            ) : (
              <React.Fragment>
                <button className="btn btn-ghost" onClick={() => setShowOnboarding(true)}>
                  <RIcon.Edit style={{ width: 16, height: 16 }}/> Re-do my routine
                </button>
                <button className="btn btn-primary" onClick={() => setShowQuiz(true)}>
                  <RIcon.Wand style={{ width: 16, height: 16 }}/> Take the skin quiz
                </button>
              </React.Fragment>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {view === 'empty' && (
        <Empty onSetup={() => setShowOnboarding(true)} onQuiz={() => setShowQuiz(true)}/>
      )}

      {/* Routine list — primary content */}
      {view !== 'empty' && (
        <React.Fragment>
          <div className="section-head" data-screen-label="Routine list">
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>What you use today</div>
              <h2>{slot === 'morning' ? 'Morning routine' : 'Evening routine'}</h2>
            </div>
            <div className="meta">
              <div className="muted" style={{ fontSize: 13 }}>
                {routine[slot].length} step{routine[slot].length === 1 ? '' : 's'}
              </div>
              {t.showPrices && routine[slot].length > 0 && (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span className="muted" style={{ fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Slot total</span>
                  <Price product={{ price: routine[slot].reduce((s, id) => s + (PRODUCTS[id]?.price || 0), 0) }} size="lg"/>
                </div>
              )}
              <div className="seg">
                <button className={slot === 'morning' ? 'on' : ''} onClick={() => setSlot('morning')}><RIcon.Sun/>Morning</button>
                <button className={slot === 'evening' ? 'on' : ''} onClick={() => setSlot('evening')}><RIcon.Moon/>Evening</button>
              </div>
            </div>
          </div>

          <RoutineList slot={slot} routine={routine}
            recentChanges={recentChanges}
            showPrice={t.showPrices}
            onAdd={() => setShowOnboarding(true)}
            onRemove={(s, i) => setRoutine(r => ({ ...r, [s]: r[s].filter((_, j) => j !== i) }))}/>
        </React.Fragment>
      )}

      {/* Recommendation banner — only after quiz taken, when drawer closed */}
      {view === 'recs' && !showDrawer && unappliedChanges > 0 && (
        <div className="rec-banner" data-screen-label="Recs banner">
          <div className="rec-icon"><RIcon.Sparkles/></div>
          <div>
            <h3>{unappliedChanges} suggested change{unappliedChanges === 1 ? '' : 's'} from your quiz</h3>
            <p>Compare side-by-side and pick what to apply. Your current routine doesn't change unless you say so.</p>
          </div>
          <div className="rec-cta">
            <button className="btn btn-paper" onClick={() => setShowQuiz(true)}>Re-take quiz</button>
            <button className="btn btn-primary" onClick={() => setShowDrawer(true)}>
              View recommendations <RIcon.ArrowRight style={{ width: 16, height: 16 }}/>
            </button>
          </div>
        </div>
      )}

      {/* If view is 'routine' (no quiz yet), show a quieter quiz nudge below */}
      {view === 'routine' && (
        <div className="rec-banner" data-screen-label="Quiz nudge"
          style={{ background: 'var(--paper)', border: '1px solid var(--line-2)' }}>
          <div className="rec-icon" style={{ background: 'var(--cream)', color: 'var(--ink)' }}><RIcon.Wand/></div>
          <div>
            <h3>Want a second opinion?</h3>
            <p>Take a 90-second skin quiz and I'll suggest where to refine your routine — without touching it.</p>
          </div>
          <div className="rec-cta">
            <button className="btn btn-dark" onClick={() => setShowQuiz(true)}>
              Take the skin quiz <RIcon.ArrowRight style={{ width: 16, height: 16 }}/>
            </button>
          </div>
        </div>
      )}

      {/* ===== Modal layers ===== */}
      {showOnboarding && (
        <OnboardingSheet onClose={() => setShowOnboarding(false)} onComplete={onboardingDone}/>
      )}
      {showQuiz && (
        <QuizSheet onClose={() => setShowQuiz(false)} onComplete={quizDone}/>
      )}
      {showDrawer && view === 'recs' && (
        <RecommendationsDrawer
          recs={recs} slot={slot} onSlotChange={setSlot}
          applied={appliedRecs}
          tweaks={t}
          onApply={applyRec}
          onApplyAll={applyAll}
          onDismiss={dismissRec}
          onClose={() => setShowDrawer(false)}/>
      )}

      {/* ===== Tweaks panel ===== */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Pricing">
          <TweakRadio label="Currency" value={t.currency}
            options={['USD', 'KRW', 'EUR', 'GBP']}
            onChange={(v) => setTweak('currency', v)}/>
          <TweakToggle label="Show prices" value={t.showPrices} onChange={(v) => setTweak('showPrices', v)}/>
          <TweakSlider label="Bundle discount" value={t.bundleDiscount} min={0} max={25} step={1} unit="%"
            onChange={(v) => setTweak('bundleDiscount', v)}/>
          <TweakNumber label="Free ship over" value={t.shipThreshold} min={0} max={500} step={5}
            onChange={(v) => setTweak('shipThreshold', v)}/>
        </TweakSection>
        <TweakSection label="Brand">
          <TweakColor label="Accent color" value={t.accent}
            options={['#F25422', '#C9648C', '#8B6FBD', '#3F7D58', '#1A1410']}
            onChange={(v) => setTweak('accent', v)}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
