// 4 navbar variations laid out on a design canvas.

const Artboard = ({ children }) => (
  <div className="ab">{children}</div>
);

const HeroHint = ({ headline }) => (
  <div className="hero">
    <h1 dangerouslySetInnerHTML={{ __html: headline }} />
  </div>
);

// ---------- V1: Editorial split nav ----------
const V1 = () => (
  <Artboard>
    <nav className="v1">
      <div className="wordmark">soone<span className="dotmark"/></div>
      <div className="links">
        <a href="#" className="active">Chat</a>
        <a href="#">Your Skin Routine</a>
      </div>
      <div className="right">
        <button className="iconbtn" aria-label="Theme"><Icon.Moon/></button>
        <button className="iconbtn" aria-label="Notifications"><Icon.Bell/><span className="dot"/></button>
        <button className="userchip">
          <span className="avatar">In</span>
          Inseong
          <Icon.ChevronDown className="caret" style={{ width: 14, height: 14 }}/>
        </button>
      </div>
    </nav>
    <HeroHint headline='Skin that feels <i>like yours</i>'/>
  </Artboard>
);

// ---------- V2: Single floating pill ----------
const V2 = () => (
  <Artboard>
    <div className="v2-wrap">
      <div className="v2">
        <span className="brand">soone</span>
        <span className="link active">Chat</span>
        <span className="link">Your Skin Routine</span>
        <span className="sep"/>
        <div className="tray">
          <button className="iconbtn" aria-label="Theme"><Icon.Moon/></button>
          <button className="iconbtn" aria-label="Notifications"><Icon.Bell/><span className="dot"/></button>
        </div>
        <div className="userpill">
          <span className="avatar">In</span>
          <span className="name">Inseong</span>
        </div>
      </div>
    </div>
    <HeroHint headline='The morning <i>ritual</i>'/>
  </Artboard>
);

// ---------- V3: Centered serif logo ----------
const V3 = () => (
  <Artboard>
    <nav className="v3">
      <div className="nav-l">
        <a href="#" className="active">Chat</a>
        <a href="#">Your Skin Routine</a>
      </div>
      <div className="center">
        soone
        <span className="sub">Seoul · Est. 2024</span>
      </div>
      <div className="nav-r">
        <button className="iconbtn" aria-label="Theme" style={{ border: 'none' }}><Icon.Moon/></button>
        <button className="iconbtn" aria-label="Notifications" style={{ border: 'none' }}><Icon.Bell/><span className="dot"/></button>
        <div className="greet">
          <span className="hi">Hello,</span>
          <span className="name">Inseong</span>
        </div>
        <span className="avatar">In</span>
      </div>
    </nav>
    <HeroHint headline='A quieter kind of <i>glow</i>'/>
  </Artboard>
);

// ---------- V4: Utility row + main nav with iconography ----------
const V4 = () => (
  <Artboard>
    <nav className="v4">
      <div className="util">
        <span className="promo"><span className="pulse"/>Your evening check-in is ready — 3 new tips from Soone</span>
        <span className="links">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon.Globe style={{ width: 12, height: 12 }}/> EN / KR</span>
          <span>Help</span>
          <span>Sign out</span>
        </span>
      </div>
      <div className="main">
        <div className="wordmark">soone<span className="dotmark"/></div>
        <div className="nav">
          <a href="#" className="active"><Icon.Sparkles className="ic" style={{ width: 16, height: 16 }}/>Chat</a>
          <a href="#"><Icon.Droplet className="ic" style={{ width: 16, height: 16 }}/>Your Skin Routine</a>
        </div>
        <div style={{ flex: 1 }}/>
        <div className="actions">
          <button className="iconbtn" aria-label="Theme"><Icon.Moon/></button>
          <button className="iconbtn" aria-label="Notifications"><Icon.Bell/><span className="dot"/></button>
          <span className="avatar" title="Inseong">In</span>
        </div>
      </div>
    </nav>
    <HeroHint headline='Built for <i>your</i> skin'/>
  </Artboard>
);

// ---------- Tiny dark-mode preview of V2 ----------
const V2Dark = () => (
  <Artboard style={{}}>
    <style>{`
      .ab.dark { background: #1B1613; color: #F2E8DF; }
      .ab.dark .hero { background: linear-gradient(180deg, #211915 0%, #2A201B 100%); border-color: rgba(255,255,255,0.06); }
      .ab.dark .hero h1 { color: #F2E8DF; }
      .ab.dark .hero h1 i { color: #E8B7A6; }
      .ab.dark .v2 { background: #241C18; border-color: rgba(255,255,255,0.08); box-shadow: 0 12px 30px -18px rgba(0,0,0,0.6); }
      .ab.dark .v2 .brand { color: #F2E8DF; border-right-color: rgba(255,255,255,0.10); }
      .ab.dark .v2 .link { color: #B4A398; }
      .ab.dark .v2 .link:hover { background: rgba(255,255,255,0.05); color: #F2E8DF; }
      .ab.dark .v2 .link.active { background: #F2E8DF; color: #1B1613; }
      .ab.dark .v2 .iconbtn { color: #E5D6C8; }
      .ab.dark .v2 .iconbtn:hover { background: rgba(255,255,255,0.05); }
      .ab.dark .v2 .sep { background: rgba(255,255,255,0.10); }
      .ab.dark .v2 .userpill { background: rgba(255,255,255,0.06); }
      .ab.dark .v2 .userpill .name { color: #F2E8DF; }
      .ab.dark .v2 .badge { border-color: #241C18; background: #E8B7A6; color: #1B1613; }
    `}</style>
    <div className="ab dark" style={{ position: 'absolute', inset: 0 }}>
      <div className="v2-wrap">
        <div className="v2">
          <span className="brand">soone</span>
          <span className="link active">Chat</span>
          <span className="link">Your Skin Routine</span>
          <span className="sep"/>
          <div className="tray">
            <button className="iconbtn" aria-label="Theme"><Icon.Sun/></button>
            <button className="iconbtn" aria-label="Notifications"><Icon.Bell/><span className="dot"/></button>
          </div>
          <div className="userpill">
            <span className="avatar">In</span>
            <span className="name">Inseong</span>
          </div>
        </div>
      </div>
      <HeroHint headline='Night, <i>restored</i>'/>
    </div>
  </Artboard>
);

// ---------- Page ----------
const App = () => (
  <DesignCanvas>
    <DCSection id="before" title="Before" subtitle="The current bar">
      <DCArtboard id="orig" label="Current" width={1400} height={140}>
        <div style={{ background: '#FBF7F2', height: '100%', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <button style={{ width: 44, height: 44, borderRadius: '50%', background: '#F6DDD1', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#2A1F1A' }}>
            <Icon.Moon/>
          </button>
          {['Chat','Your Skin Routine'].map(t => (
            <span key={t} style={{ padding: '12px 26px', borderRadius: 999, border: '1px solid rgba(42,31,26,0.10)', color: '#2A1F1A', fontSize: 17 }}>{t}</span>
          ))}
          <span style={{ color: '#8C7A6E', fontSize: 17, padding: '0 10px' }}>Inseong</span>
          <span style={{ padding: '12px 26px', borderRadius: 999, border: '1px solid rgba(42,31,26,0.10)', color: '#2A1F1A', fontSize: 17 }}>Sign out</span>
        </div>
      </DCArtboard>
      <DCPostIt width={260}>
        <b>What's not working:</b><br/>
        · "Inseong" is unstyled text in a row of pills — feels like a bug.<br/>
        · Every action looks equally important (Sign&nbsp;out as loud as Shop).<br/>
        · No logo / brand presence, no cart, no search.<br/>
        · The moon icon is the only color — it overweights a utility.
      </DCPostIt>
    </DCSection>

    <DCSection id="after" title="After" subtitle="Four directions — pick one or mix">
      <DCArtboard id="v1" label="A · Editorial split" width={1400} height={520}>
        <V1/>
      </DCArtboard>
      <DCArtboard id="v2" label="B · Floating pill" width={1400} height={520}>
        <V2/>
      </DCArtboard>
      <DCArtboard id="v3" label="C · Centered wordmark" width={1400} height={520}>
        <V3/>
      </DCArtboard>
      <DCArtboard id="v4" label="D · Utility + iconographic" width={1400} height={520}>
        <V4/>
      </DCArtboard>
    </DCSection>

    <DCSection id="dark" title="Dark mode" subtitle="Same system, after sunset">
      <DCArtboard id="v2dark" label="B · Floating pill / dark" width={1400} height={520}>
        <V2Dark/>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
