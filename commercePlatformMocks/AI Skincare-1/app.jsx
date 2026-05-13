/* Hubble — Prototype shell with navigation between screens */

const SCREENS = [
  { id: 'landing',   label: 'Landing',          group: 'Consumer' },
  { id: 'quiz',      label: 'Skin quiz',        group: 'Consumer' },
  { id: 'dashboard', label: 'Dashboard',        group: 'Consumer' },
  { id: 'chat',      label: 'AI chat',          group: 'Consumer' },
  { id: 'login',     label: 'Brand login',      group: 'Brand' },
  { id: 'overview',  label: 'Overview',         group: 'Brand' },
  { id: 'agent',     label: 'Sales agent',      group: 'Brand' },
  { id: 'survey',    label: 'Survey builder',   group: 'Brand' },
  { id: 'analytics', label: 'Analytics',        group: 'Brand' },
];

const DEFAULT_TWEAKS = /*EDITMODE-BEGIN*/{
  "screen": "dashboard",
  "personality": "bff",
  "discountIntensity": "medium",
  "density": "normal",
  "themeAccent": "coral"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(DEFAULT_TWEAKS);

  // Apply theme accent live
  React.useEffect(() => {
    const map = {
      coral: '#FF6B47',
      lime:  '#D4FF4F',
      lilac: '#C4B5FD',
      rose:  '#FF9FB6',
    };
    document.documentElement.style.setProperty('--coral', map[tweaks.themeAccent] || '#FF6B47');
  }, [tweaks.themeAccent]);

  const renderScreen = () => {
    switch (tweaks.screen) {
      case 'landing':   return <MarketingLanding/>;
      case 'quiz':      return <SkinQuiz onChat={() => setTweak('screen', 'chat')} onDashboard={() => setTweak('screen', 'dashboard')}/>;
      case 'dashboard': return <SkinDashboard onChat={() => setTweak('screen', 'chat')} onRequiz={() => setTweak('screen', 'quiz')}/>;
      case 'chat':      return <ConsumerChat personality={tweaks.personality} density={tweaks.density} discountIntensity={tweaks.discountIntensity}/>;
      case 'login':     return <BrandLogin/>;
      case 'overview':  return <BrandOverview/>;
      case 'agent':     return <SalesAgentBuilder/>;
      case 'survey':    return <SurveyBuilder/>;
      case 'analytics': return <BrandAnalytics/>;
      default:          return <ConsumerChat personality={tweaks.personality} density={tweaks.density} discountIntensity={tweaks.discountIntensity}/>;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', flexDirection: 'column' }}>
      {/* Floating screen-switcher */}
      <div style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, padding: 6, borderRadius: 999,
        background: 'rgba(20,20,20,0.85)', backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-2)',
        display: 'flex', gap: 4, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        maxWidth: 'calc(100vw - 40px)', overflowX: 'auto',
      }}>
        {SCREENS.map(s => (
          <button key={s.id} onClick={() => setTweak('screen', s.id)} style={{
            padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
            background: tweaks.screen === s.id ? 'var(--coral)' : 'transparent',
            color: tweaks.screen === s.id ? 'var(--ink)' : 'var(--fg-dim)',
            whiteSpace: 'nowrap',
          }}>{s.label}</button>
        ))}
      </div>

      {/* Active screen with screen label */}
      <div data-screen-label={SCREENS.find(s => s.id === tweaks.screen)?.label} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {renderScreen()}
      </div>

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection title="Screen">
          <TweakSelect
            label="Active screen"
            value={tweaks.screen}
            onChange={v => setTweak('screen', v)}
            options={SCREENS.map(s => ({ value: s.id, label: `${s.group} · ${s.label}` }))}
          />
        </TweakSection>
        <TweakSection title="Theme">
          <TweakRadio
            label="Accent color"
            value={tweaks.themeAccent}
            onChange={v => setTweak('themeAccent', v)}
            options={[
              { value: 'coral', label: 'Coral' },
              { value: 'lime', label: 'Lime' },
              { value: 'lilac', label: 'Lilac' },
              { value: 'rose', label: 'Rose' },
            ]}
          />
        </TweakSection>
        <TweakSection title="Chat experience">
          <TweakRadio
            label="AI personality"
            value={tweaks.personality}
            onChange={v => setTweak('personality', v)}
            options={[
              { value: 'bff', label: 'Best friend' },
              { value: 'derm', label: 'Dermatologist' },
              { value: 'editor', label: 'Editorial' },
            ]}
          />
          <TweakRadio
            label="Density"
            value={tweaks.density}
            onChange={v => setTweak('density', v)}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'normal', label: 'Spacious' },
            ]}
          />
          <TweakRadio
            label="Discount intensity"
            value={tweaks.discountIntensity}
            onChange={v => setTweak('discountIntensity', v)}
            options={[
              { value: 'subtle', label: 'Subtle' },
              { value: 'medium', label: 'Medium' },
              { value: 'prominent', label: 'Prominent' },
            ]}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
