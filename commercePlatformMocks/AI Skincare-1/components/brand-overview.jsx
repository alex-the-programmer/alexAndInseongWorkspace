/* Hubble — Brand Login + Dashboard shell + Overview */

const SAMPLE_BRAND = {
  name: 'Anua', initials: 'AN', tone: 'sage',
};

function BrandLogin() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      {/* Left — visual */}
      <div style={{
        background: 'linear-gradient(140deg, var(--coral) 0%, var(--lilac) 100%)',
        position: 'relative', padding: 56, color: 'var(--ink)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <HubbleWordmark height={28} light />
        <div>
          <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, opacity: 0.7 }}>
            Brand Studio
          </div>
          <div className="font-display" style={{ fontSize: 64, lineHeight: 0.95, letterSpacing: '-0.03em' }}>
            Be the answer<br/>at the moment of want.
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6, marginTop: 24, maxWidth: 420, opacity: 0.85 }}>
            Build your AI sales agent, run conversational research, and reward customers who teach you something.
          </p>
        </div>
        <div className="font-mono" style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.05em' }}>
          USED BY ANUA · COSRX · BIODANCE · INNISFREE · GLOW RECIPE · PEACH &amp; LILY · +124 BRANDS
        </div>
      </div>

      {/* Right — form */}
      <div style={{ padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ maxWidth: 380, margin: '0 auto', width: '100%' }}>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            Sign in to your brand
          </div>
          <h1 className="font-display" style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.02em', margin: 0, color: 'var(--paper)' }}>
            Welcome back.
          </h1>
          <p style={{ fontSize: 14, color: 'var(--fg-dim)', lineHeight: 1.5, marginTop: 8 }}>
            New here? <a style={{ color: 'var(--coral)', textDecoration: 'none' }}>Apply to onboard your brand →</a>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
            <button style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '14px 16px', borderRadius: 12, background: 'var(--paper)', color: 'var(--ink)',
              fontSize: 14, fontWeight: 500,
            }}>
              <Icon name="google" size={16} stroke={0}/> Continue with Google
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg-mute)', fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--border-2)' }}/> OR <span style={{ flex: 1, height: 1, background: 'var(--border-2)' }}/>
            </div>
            {[
              { label: 'Work email', icon: 'mail', placeholder: 'maya@anua.com' },
              { label: 'Password', icon: 'lock', placeholder: '••••••••', type: 'password' },
            ].map((f, i) => (
              <div key={i}>
                <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 6 }}>{f.label}</div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', background: 'var(--ink-2)', border: '1px solid var(--border-2)', borderRadius: 12,
                }}>
                  <Icon name={f.icon} size={15} color="var(--fg-mute)"/>
                  <input type={f.type || 'text'} placeholder={f.placeholder} style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--fg)', fontSize: 14,
                  }}/>
                </div>
              </div>
            ))}
            <button className="btn btn-primary" style={{ padding: '14px 16px', justifyContent: 'center', marginTop: 8 }}>
              Sign in to studio
            </button>
            <a style={{ fontSize: 12, color: 'var(--fg-dim)', textAlign: 'center', textDecoration: 'none', marginTop: 8 }}>
              Forgot password?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sidebar shared across dashboard screens
function BrandSidebar({ active, onNav }) {
  const items = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'agent', label: 'Sales agent', icon: 'bot' },
    { id: 'survey', label: 'Surveys', icon: 'survey' },
    { id: 'analytics', label: 'Analytics', icon: 'chart' },
    { id: 'catalog', label: 'Catalog', icon: 'bag' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];
  return (
    <aside style={{
      width: 240, padding: '20px 16px', borderRight: '1px solid var(--border)',
      background: 'var(--ink)', display: 'flex', flexDirection: 'column', gap: 24,
      flexShrink: 0,
    }}>
      <HubbleWordmark height={20}/>
      <button style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
        background: 'var(--ink-3)', border: '1px solid var(--border-2)', borderRadius: 12,
        textAlign: 'left',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, #D6E8D4, #84A87C)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink)', fontSize: 11, fontWeight: 700,
        }}>{SAMPLE_BRAND.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{SAMPLE_BRAND.name}</div>
          <div style={{ fontSize: 10, color: 'var(--fg-mute)', fontFamily: 'var(--font-mono)' }}>BRAND · LIVE</div>
        </div>
        <Icon name="arrowDown" size={14} color="var(--fg-mute)"/>
      </button>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {items.map(it => (
          <button key={it.id} onClick={() => onNav && onNav(it.id)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 12px', borderRadius: 10, textAlign: 'left',
            background: active === it.id ? 'var(--ink-3)' : 'transparent',
            color: active === it.id ? 'var(--paper)' : 'var(--fg-dim)',
            fontSize: 13, fontWeight: 500,
            position: 'relative',
          }}>
            {active === it.id && (
              <span style={{
                position: 'absolute', left: -16, top: '50%', transform: 'translateY(-50%)',
                width: 3, height: 16, background: 'var(--coral)', borderRadius: 2,
              }}/>
            )}
            <Icon name={it.icon} size={15}/>
            {it.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: 12, background: 'var(--ink-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className="dot dot-pulse"/>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Agent live</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-mute)', lineHeight: 1.4 }}>
          Active in 3 conversations right now. Last 24h: 247 customers reached.
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────
function StatCard({ label, value, delta, accent, sub }) {
  const pos = (delta || '').startsWith('+');
  return (
    <div style={{
      padding: 24, borderRadius: 20,
      background: 'var(--ink-2)', border: '1px solid var(--border)',
    }}>
      <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 12 }}>
        {label}
      </div>
      <div className="font-display" style={{ fontSize: 48, lineHeight: 1, letterSpacing: '-0.02em', color: accent || 'var(--paper)' }}>
        {value}
      </div>
      {delta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)',
            color: pos ? 'var(--lime)' : 'var(--coral)',
            padding: '2px 8px', borderRadius: 999,
            background: pos ? 'rgba(212,255,79,0.1)' : 'rgba(255,107,71,0.1)',
            border: `1px solid ${pos ? 'rgba(212,255,79,0.3)' : 'rgba(255,107,71,0.3)'}`,
          }}>{delta}</span>
          {sub && <span style={{ fontSize: 11, color: 'var(--fg-mute)' }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}

function MiniSpark({ data, color }) {
  const max = Math.max(...data); const min = Math.min(...data);
  const w = 100; const h = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"/>
    </svg>
  );
}

function BrandOverview() {
  const [active, setActive] = React.useState('overview');
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--ink)' }}>
      <BrandSidebar active={active} onNav={setActive}/>
      <main style={{ flex: 1, padding: '32px 48px', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Wed, 30 April 2026
            </div>
            <h1 className="font-display" style={{ fontSize: 'clamp(32px, 4.5vw, 56px)', lineHeight: 1, letterSpacing: '-0.03em', margin: 0, color: 'var(--paper)' }}>
              Hi Maya — quiet morning so far.
            </h1>
            <p style={{ fontSize: 15, color: 'var(--fg-dim)', marginTop: 12, maxWidth: 600 }}>
              Your Heartleaf Toner offer pulled in <span style={{ color: 'var(--lime)' }}>$8,420 GMV</span> overnight. Two surveys closed; one ready for your review.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ padding: '10px 16px' }}>
              <Icon name="plus" size={14}/> New survey
            </button>
            <button className="btn btn-primary" style={{ padding: '10px 16px' }}>
              Configure agent →
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard label="GMV · last 7d" value="$48.2k" delta="+34%" sub="vs last week"/>
          <StatCard label="Conversations entered" value="2,148" delta="+12%" accent="var(--coral)"/>
          <StatCard label="Conversion to purchase" value="6.4%" delta="+1.1pt" accent="var(--lime)"/>
          <StatCard label="Avg discount given" value="22%" delta="−3pt" sub="vs target 25%"/>
        </div>

        {/* Two column */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          {/* Live conversations */}
          <div style={{ padding: 24, borderRadius: 20, background: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>Live · last 30 min</div>
                <div className="font-display" style={{ fontSize: 28, marginTop: 4 }}>Where your agent is showing up</div>
              </div>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>View all</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                { user: 'M·R', loc: 'Brooklyn, NY', context: 'Asked about a barrier-repair serum', surfaced: 'Heartleaf Toner', state: 'Considering', spark: [3,4,3,5,6,5,7] },
                { user: 'S·K', loc: 'Austin, TX', context: 'Mentioned redness from retinol', surfaced: 'Heartleaf Toner', state: 'Added to routine ✓', spark: [2,3,4,3,5,6,8], won: true },
                { user: 'J·L', loc: 'Toronto', context: 'Comparing CeraVe to K-beauty', surfaced: 'PHA Cleanser', state: 'Declined offer', spark: [5,4,3,3,2,2,1], lost: true },
                { user: 'A·P', loc: 'San Diego', context: 'Building first routine', surfaced: 'Heartleaf Toner', state: 'In conversation', spark: [1,2,3,4,5,6,7] },
              ].map((c, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '32px 1fr 120px 100px 80px 24px',
                  gap: 16, alignItems: 'center', padding: '16px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: 'var(--ink-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600, color: 'var(--fg-dim)',
                  }}>{c.user}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.context}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-mute)', marginTop: 2 }}>{c.loc} · surfaced {c.surfaced}</div>
                  </div>
                  <div style={{ fontSize: 12, color: c.won ? 'var(--lime)' : c.lost ? 'var(--fg-mute)' : 'var(--fg-dim)' }}>
                    {c.state}
                  </div>
                  <div><MiniSpark data={c.spark} color={c.won ? 'var(--lime)' : c.lost ? '#5a534a' : 'var(--coral)'}/></div>
                  <div className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)' }}>·{i+2}m</div>
                  <Icon name="arrow" size={12} color="var(--fg-mute)"/>
                </div>
              ))}
            </div>
          </div>

          {/* Active offers */}
          <div style={{ padding: 24, borderRadius: 20, background: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>Active offers</div>
            <div className="font-display" style={{ fontSize: 28, marginTop: 4, marginBottom: 20 }}>3 running</div>
            {[
              { name: 'Heartleaf Toner · 25% off', spent: 1240, budget: 2500, color: 'var(--coral)' },
              { name: 'PHA Cleanser launch · 30% off', spent: 380, budget: 1500, color: 'var(--lime)' },
              { name: 'Survey reward · $20 credit', spent: 460, budget: 800, color: 'var(--lilac)' },
            ].map((o, i) => (
              <div key={i} style={{ paddingTop: i ? 16 : 0, paddingBottom: 16, borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{o.name}</div>
                  <div className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)' }}>${o.spent}/${o.budget}</div>
                </div>
                <div style={{ marginTop: 8, height: 4, background: 'var(--ink-3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(o.spent/o.budget)*100}%`, height: '100%', background: o.color }}/>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: 12, marginTop: 8 }}>
              <Icon name="plus" size={12}/> New offer
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { BrandLogin, BrandOverview, BrandSidebar, StatCard, MiniSpark });
