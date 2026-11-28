import './TabBar.css';

export type Tab = 'check' | 'fitting' | 'discover' | 'closet';

const TABS: { id: Tab; label: string; icon: string }[] = [
  // A chain link, a hanger, a pair of cards, a wardrobe.
  { id: 'check', label: 'Check', icon: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' },
  { id: 'fitting', label: 'Fitting room', icon: 'M12 4a2 2 0 0 1 2 2c0 1-1 1.6-2 2.2V9l8.5 6.2c.8.6.4 1.8-.6 1.8H4.1c-1 0-1.4-1.2-.6-1.8L12 9' },
  { id: 'discover', label: 'Discover', icon: 'M8 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM4.5 7.5 7 7M4.5 7.5l1.6 11 0.9-.1' },
  { id: 'closet', label: 'Closet', icon: 'M5 3h14v18H5zM12 3v18M10 11v2M14 11v2' },
];

/** The app's four sections, pinned to the bottom of the screen. */
export function TabBar({ current, onChange }: { current: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tabbar__tab${t.id === current ? ' is-current' : ''}`}
          aria-current={t.id === current ? 'page' : undefined}
          onClick={() => onChange(t.id)}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d={t.icon} />
          </svg>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
