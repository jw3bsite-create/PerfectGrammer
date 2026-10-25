import { useEffect, type ReactNode } from 'react';
import { Icon } from './components/Icon';
import { ToastHost } from './components/ui';
import { useRoute, type Route } from './lib/router';
import { reloadFromDb, useApp, useReady } from './lib/store';
import { APP_VERSION_TEXT } from './lib/version';
import { SchwaechenBereich } from './schwaechen/Bereich';
import { ZBereich } from './zusammenfassen/Bereich';
import { ZUebungsansicht } from './zusammenfassen/Uebung';
import { ZVolltextSeite } from './zusammenfassen/Volltext';
import { HAUPTFENSTER, SCHWAECHENFENSTER } from './schwaechen/Teile';
import type { Settings } from './lib/types';
import { Heute } from './views/Heute';
import { Kurse, KursSeite } from './views/Kurse';
import { LektionSeite } from './views/Lektion';
import { Ueben } from './views/Ueben';
import { SessionView } from './views/Sitzung';
import { Fehlerbuch } from './views/Fehlerbuch';
import { FehlerDruck } from './views/FehlerDruck';
import { Statistik } from './views/Statistik';
import { AufgabenListe } from './views/AufgabenListe';
import { Einstellungen } from './views/Einstellungen';
import { Willkommen } from './views/Willkommen';

const NAV = [
  { to: '/', key: '', label: 'Heute', icon: 'heute' },
  { to: '/kurse', key: 'kurse', label: 'Kurse', icon: 'kurse' },
  { to: '/ueben', key: 'ueben', label: 'Üben', icon: 'ueben' },
  { to: '/zusammenfassen', key: 'zusammenfassen', label: 'Zusammenfassen', icon: 'text' },
  { to: '/fehlerbuch', key: 'fehlerbuch', label: 'Fehlerbuch', icon: 'fehlerbuch' },
  { to: '/statistik', key: 'statistik', label: 'Statistik', icon: 'statistik' },
  { to: '/einstellungen', key: 'einstellungen', label: 'Einstellungen', icon: 'einstellungen' },
];

/** Auf dem Handy: fünf Plätze in der Leiste; „Zusammenfassen“ erreicht man dort über „Heute“ und „Üben“. */
const TABBAR = ['', 'kurse', 'ueben', 'fehlerbuch', 'statistik'];

function activeKey(route: Route): string {
  const p = route.parts[0] ?? '';
  if (p === 'lektion') return 'kurse';
  return p;
}

function useTheme(settings: Settings) {
  useEffect(() => {
    const root = document.documentElement;
    if (settings.darstellung === 'hell') root.dataset.theme = 'light';
    else if (settings.darstellung === 'dunkel') root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    root.dataset.size = settings.schriftgroesse;
    try {
      localStorage.setItem('sr-darstellung', JSON.stringify(settings.darstellung));
    } catch {
      /* privat */
    }
    const dark = settings.darstellung === 'dunkel' || (settings.darstellung === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#131416' : '#f7f6f2'));
  }, [settings.darstellung, settings.schriftgroesse]);
}

function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const active = activeKey(route);
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Hauptnavigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ß
          </span>
          PerfectGrammar
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.key} href={`#${n.to}`} aria-current={active === n.key ? 'page' : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </a>
          ))}
          <a className="nav-extern" href="#/schwaechen" target={SCHWAECHENFENSTER} title="Öffnet in einem eigenen Fenster">
            <Icon name="target" />
            Meine Schwächen
            <span className="nav-pfeil" aria-hidden="true">
              ↗
            </span>
            <span className="sr-only"> (eigenes Fenster)</span>
          </a>
        </nav>
        <div className="nav-spacer" />
        <div className="nav-foot">
          Alle Daten bleiben auf diesem Gerät.
          <br />
          <span data-version>{APP_VERSION_TEXT}</span>
        </div>
      </aside>
      <main className="main" id="inhalt">
        {children}
      </main>
      <nav className="tabbar" aria-label="Hauptnavigation">
        {NAV.filter((n) => TABBAR.includes(n.key)).map((n) => (
          <a key={n.key} className="tab" href={`#${n.to}`} aria-current={active === n.key || (n.key === '' && active === 'einstellungen') ? 'page' : undefined}>
            <Icon name={n.icon} />
            {n.label}
          </a>
        ))}
      </nav>
      <ToastHost />
    </div>
  );
}

function Page({ route }: { route: Route }) {
  const [a, b, c] = route.parts;
  switch (a) {
    case undefined:
      return <Heute />;
    case 'kurse':
      return b ? <KursSeite kurs={Number(b)} /> : <Kurse />;
    case 'lektion':
      return <LektionSeite id={b ?? ''} />;
    case 'ueben':
      return <Ueben />;
    case 'fehlerbuch':
      return <Fehlerbuch tab={b ?? 'liste'} id={c} query={route.query} />;
    case 'statistik':
      return b === 'aufgaben' ? <AufgabenListe query={route.query} /> : <Statistik />;
    case 'einstellungen':
      return <Einstellungen />;
    case 'zusammenfassen':
      return <ZBereich route={route} />;
    default:
      return <Heute />;
  }
}

export function App() {
  const { ready, error } = useReady();
  const data = useApp();
  const route = useRoute();
  useTheme(data.settings);

  const path = route.parts.join('/');
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  // Hauptfenster benennen: Verweise aus „Meine Schwächen“ in die Kurse öffnen dann hier.
  const bereich = route.parts[0] === 'schwaechen';
  useEffect(() => {
    if (!bereich && !window.name) window.name = HAUPTFENSTER;
  }, [bereich]);

  // Zwei Fenster teilen einen Speicher: Beim Zurückkehren in ein Fenster den Stand neu laden.
  useEffect(() => {
    const neu = () => {
      if (document.visibilityState === 'visible') void reloadFromDb();
    };
    window.addEventListener('focus', neu);
    document.addEventListener('visibilitychange', neu);
    return () => {
      window.removeEventListener('focus', neu);
      document.removeEventListener('visibilitychange', neu);
    };
  }, []);

  if (!ready) {
    return (
      <div className="loading" role="status">
        <div>
          <div className="spinner" />
          Daten werden geladen …
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="loading">
        <div className="card" style={{ maxWidth: 480, margin: 20 }}>
          <h2>Speicher nicht verfügbar</h2>
          <p className="muted" style={{ marginTop: 10 }}>
            Die App konnte ihre Daten nicht öffnen. Im privaten Modus mancher Browser ist der dauerhafte Speicher gesperrt. Öffne die App in einem normalen Fenster oder installiere sie auf dem Home-Bildschirm.
          </p>
          <p className="small muted" style={{ marginTop: 10 }}>
            Meldung: {error}
          </p>
        </div>
      </div>
    );
  }
  if (route.parts[0] === 'sitzung') return <SessionView />;
  if (bereich) return <SchwaechenBereich route={route} />;
  if (route.parts[0] === 'zusammenfassen' && route.parts[1] === 'uebung') return <ZUebungsansicht />;
  if (route.parts[0] === 'zusammenfassen' && route.parts[1] === 'schreiben') return <ZVolltextSeite id={route.parts[2] ?? ''} />;
  if (!data.settings.onboardingErledigt) return <Willkommen />;
  if (route.parts[0] === 'fehlerbuch' && route.parts[1] === 'druck') return <FehlerDruck query={route.query} />;
  return (
    <Shell route={route}>
      <Page route={route} />
    </Shell>
  );
}
