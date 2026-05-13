/* Hubble — Brand Analytics */

function BrandAnalytics() {
  const [active, setActive] = React.useState('analytics');

  // Fake data series
  const gmvSeries = [12, 18, 14, 22, 19, 28, 32, 26, 35, 41, 38, 48];
  const convSeries = [3.2, 3.8, 4.1, 4.4, 5.1, 5.8, 6.4];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--ink)' }}>
      <BrandSidebar active={active} onNav={setActive}/>
      <main style={{ flex: 1, padding: '32px 48px', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div className="font-mono" style={{ fontSize: 11, color: 'var(--fg-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Analytics · Last 30 days
            </div>
            <h1 className="font-display" style={{ fontSize: 'clamp(32px, 4vw, 48px)', lineHeight: 1, letterSpacing: '-0.03em', margin: 0, color: 'var(--paper)' }}>
              You're outperforming<br/>your category by <span style={{ color: 'var(--lime)' }}>34%</span>.
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip>30D</Chip><Chip active>90D</Chip><Chip>YTD</Chip><Chip>All</Chip>
          </div>
        </div>

        {/* Top metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard label="GMV" value="$184k" delta="+34%" sub="vs prev"/>
          <StatCard label="Surfaces" value="48,210" delta="+22%" accent="var(--coral)"/>
          <StatCard label="Conv. rate" value="6.4%" delta="+1.7pt" accent="var(--lime)"/>
          <StatCard label="ROAS" value="4.2×" delta="+0.6×" accent="var(--lilac)"/>
        </div>

        {/* GMV chart */}
        <div style={{ padding: 24, borderRadius: 20, background: 'var(--ink-2)', border: '1px solid var(--border)', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-mute)' }}>GMV through Hubble</div>
              <div className="font-display" style={{ fontSize: 28, marginTop: 4 }}>Weekly</div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-dim)' }}>
                <span style={{ width: 10, height: 10, background: 'var(--coral)', borderRadius: 2 }}/> Heartleaf Toner
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-dim)' }}>
                <span style={{ width: 10, height: 10, background: 'var(--lime)', borderRadius: 2 }}/> PHA Cleanser
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-dim)' }}>
                <span style={{ width: 10, height: 10, background: 'var(--lilac)', borderRadius: 2 }}/> Other
              </span>
            </div>
          </div>
          {/* Bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 220 }}>
            {gmvSeries.map((v, i) => {
              const h = (v / 50) * 100;
              const a = h * 0.55, b = h * 0.30, c = h * 0.15;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ height: `${c}%`, background: 'var(--lilac)', borderRadius: '6px 6px 0 0' }}/>
                    <div style={{ height: `${b}%`, background: 'var(--lime)' }}/>
                    <div style={{ height: `${a}%`, background: 'var(--coral)' }}/>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--fg-mute)', textAlign: 'center', marginTop: 8, fontFamily: 'var(--font-mono)' }}>W{i+1}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two-column lower row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          {/* Top conversion paths */}
          <div style={{ padding: 24, borderRadius: 20, background: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-mute)', marginBottom: 4 }}>Top conversion paths</div>
            <div className="font-display" style={{ fontSize: 24, marginBottom: 16 }}>What's working</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { trigger: 'Mentions "redness"', surfaced: 'Heartleaf Toner', conv: 11.2, n: 1240 },
                { trigger: 'Switching from CeraVe', surfaced: 'Heartleaf Toner', conv: 9.8, n: 740 },
                { trigger: 'First-time + sensitive', surfaced: 'Heartleaf Toner', conv: 7.1, n: 2180 },
                { trigger: 'Asks "PHA vs AHA"', surfaced: 'PHA Cleanser', conv: 14.4, n: 320 },
                { trigger: 'Routine for combo skin', surfaced: 'Heartleaf Toner', conv: 5.6, n: 980 },
              ].map((p, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1.5fr 1.4fr 80px 80px',
                  gap: 12, alignItems: 'center', padding: '12px 0',
                  borderTop: i ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.trigger}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-dim)' }}>→ {p.surfaced}</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-mute)', fontFamily: 'var(--font-mono)' }}>{p.n} surf</div>
                  <div style={{ fontSize: 13, color: p.conv > 10 ? 'var(--lime)' : 'var(--paper)', fontWeight: 600, textAlign: 'right' }}>
                    {p.conv}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What we learned (insights from surveys + chat) */}
          <div style={{ padding: 24, borderRadius: 20, background: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--lime)', marginBottom: 4 }}>Insights · auto-generated</div>
            <div className="font-display" style={{ fontSize: 24, marginBottom: 16 }}>What we learned this week</div>
            {[
              { txt: 'Shoppers comparing your toner to Beauty of Joseon convert 3.4× more when we lead with "barrier repair" instead of "soothing".', tag: 'Messaging' },
              { txt: 'PHA Cleanser interest skews younger (22–28) — +18% rate when paired with TikTok-derived language.', tag: 'Audience' },
              { txt: 'Discount sensitivity drops sharply above 30%; consider capping next campaign at 28%.', tag: 'Pricing' },
            ].map((ins, i) => (
              <div key={i} style={{
                padding: 14, borderRadius: 12, marginTop: i ? 10 : 0,
                background: 'var(--ink-3)', border: '1px solid var(--border)',
              }}>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 10,
                  background: 'var(--ink-2)', color: 'var(--lime)', fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em', marginBottom: 8,
                }}>{ins.tag}</span>
                <div style={{ fontSize: 13, lineHeight: 1.5 }}>{ins.txt}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { BrandAnalytics });
