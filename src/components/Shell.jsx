import { useState } from 'react';
import { FolderKanban, KeyRound, LayoutDashboard, LogOut, Menu, Search, Settings, Stamp, UserRound, X } from 'lucide-react';
import { VIEWS } from '../model.js';
import { Button, controlClass } from './ui.jsx';

const ICONS = {
  overview: LayoutDashboard,
  projects: FolderKanban,
  issued: Stamp,
  mine: UserRound,
  setup: Settings,
};

export function Shell({ view, onView, query, onQuery, user, onLogout, onPassword, children }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function choose(id) {
    onView(id);
    setOpen(false);
  }

  async function logout() {
    setLeaving(true);
    try {
      await onLogout();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-paper md:grid md:grid-cols-[260px_minmax(0,1fr)]">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>

      {open ? <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 bg-navy-950/50 md:hidden" onClick={() => setOpen(false)} /> : null}

      <aside className={`${open ? 'fixed inset-y-0 left-0 z-40 flex w-[260px]' : 'hidden'} flex-col bg-navy-900 text-white md:sticky md:top-0 md:flex md:h-dvh`}>
        <div className="flex items-center justify-between px-5 py-5">
          <div className="rounded-xl bg-white px-3 py-2">
            <img src="/core-logo.svg" alt="CORE Consulting Engineers" className="h-6 w-auto" />
          </div>
          <button type="button" className="rounded-lg p-2 text-white/80 md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-500">CORE Consulting Engineers</p>
          <p className="mt-1 font-display text-lg">DBPA Tracker</p>
        </div>
        <nav aria-label="Tracker views" className="grid gap-1 px-3">
          {VIEWS.map((item) => {
            const Icon = ICONS[item.id];
            const selected = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => choose(item.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${selected ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-white/55">{user.email}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" className="flex-1 border-transparent bg-white/10 text-white hover:bg-white/15" onClick={onPassword}>
              <KeyRound size={15} aria-hidden="true" />
              Password
            </Button>
            <Button variant="secondary" className="border-transparent bg-white/10 text-white hover:bg-white/15" onClick={logout} disabled={leaving} aria-label="Sign out">
              <LogOut size={15} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="h-1 bg-linear-to-r from-sky-500 via-navy-800 to-sky-500" />
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:px-8">
          <button type="button" className="rounded-lg border border-line bg-white p-2 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          {view === 'setup' ? <div className="flex-1" /> : (
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">Search projects</span>
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                placeholder="Search project no., address, strata, or engineer"
                className={`${controlClass} pl-9`}
              />
            </label>
          )}
        </header>
        <main id="content" className="px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
