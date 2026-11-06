import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, CalendarCheck2, CalendarRange, ConciergeBell, BedDouble, Sparkles, UsersRound, ReceiptText,
  FileBarChart, ShieldCheck, Bell, Search, LogOut, PanelLeftClose, PanelLeft, X, Inbox,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import type { NotificationItem } from '../lib/types';
import { initials, avatarTone, cx, fmtDate, fmtTime, todayISO } from '../lib/format';
import { Modal } from '../ui';

const NAV = [
  { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard, subsection: 'Overview' },
  { id: 'reservations', path: '/reservations', label: 'Reservations', icon: CalendarCheck2, subsection: 'Operations' },
  { id: 'calendar', path: '/calendar', label: 'Reservation Calendar', icon: CalendarRange },
  { id: 'front-desk', path: '/front-desk', label: 'Front Desk', icon: ConciergeBell, subsection: 'Stay Management' },
  { id: 'rooms', path: '/rooms', label: 'Rooms & Suites', icon: BedDouble },
  { id: 'housekeeping', path: '/housekeeping', label: 'Housekeeping', icon: Sparkles },
  { id: 'guests', path: '/guests', label: 'Guest Profiles', icon: UsersRound, subsection: 'Business' },
  { id: 'billing', path: '/billing', label: 'Billing & Payments', icon: ReceiptText },
  { id: 'reports', path: '/reports', label: 'Reports', icon: FileBarChart },
  { id: 'staff', path: '/staff', label: 'Staff & Users', icon: ShieldCheck },
];

export default function AppLayout() {
  const { user, logout, can } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchModal, setSearchModal] = useState(false);
  const [searchResults, setSearchResults] = useState<{ reservations: { id: number; confirmation_no: string; guest_name: string; status: string; check_in: string }[]; rooms: { id: number; number: string; status: string; category_name: string }[] } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => {
      api.get<{ notifications: NotificationItem[] }>('/api/notifications').then((r) => setNotifs(r.notifications.filter((n) => !n.read))).catch(() => {});
    }, 25000);
    api.get<{ notifications: NotificationItem[] }>('/api/notifications').then((r) => setNotifs(r.notifications)).catch(() => {});
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModal(true);
        setTimeout(() => searchRef.current?.focus(), 30);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => {
    setSearchModal(false);
    setNotifOpen(false);
    setUserOpen(false);
  }, [loc.pathname]);

  const runSearch = async () => {
    const q = search.trim();
    if (q.length < 2) return;
    const [rs, rm] = await Promise.all([
      api.get<{ reservations: { id: number; confirmation_no: string; guest_name: string; status: string; check_in: string }[] }>(`/api/reservations?q=${encodeURIComponent(q)}&limit=6`),
      api.get<{ rooms: { id: number; number: string; status: string; category_name: string }[] }>(`/api/rooms?q=${encodeURIComponent(q)}`),
    ]);
    setSearchResults({ reservations: rs.reservations, rooms: rm.rooms });
  };

  const unread = notifs.filter((n) => !n.read).length;
  const items = NAV.filter((n) => can(n.id));
  let lastSub = '';

  return (
    <div className="app-shell h-full flex bg-canvas">
      {/* ---------------- Sidebar ---------------- */}
      <aside className={`sidebar-sheen text-slate-300 flex flex-col shrink-0 transition-[width] duration-300 ${collapsed ? 'w-[76px]' : 'w-[258px]'} max-lg:hidden`}>
        <div className="flex items-center gap-3 px-5 h-[74px] border-b border-white/5">
          <div className="ga-seal size-9 rounded-xl grid place-items-center shrink-0">
            <span className="font-display text-[15px] font-semibold text-white">GA</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display text-[15px] font-semibold text-gold-300 leading-tight truncate">Grand Aurelia</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">Management Suite</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {items.map((n) => {
            if (n.subsection) lastSub = n.subsection;
            return (
              <div key={n.id}>
                {n.subsection && !collapsed && (
                  <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">{n.subsection}</p>
                )}
                <NavLink to={n.path} end={n.path === '/'}
                  className={({ isActive }) => cx(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-all',
                    isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')}>
                  <n.icon className="size-[18px] shrink-0 group-hover:text-gold-400 transition-colors" strokeWidth={2} />
                  {!collapsed && <span className="truncate">{n.label}</span>}
                  {!collapsed && isActiveDot(n.path) && <span className="live-dot ml-auto size-1.5 rounded-full bg-gold-400" />}
                </NavLink>
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-slate-500 hover:text-slate-300 hover:bg-white/5 transition">
            {collapsed ? <PanelLeft className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!collapsed && 'Collapse menu'}
          </button>
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="topbar-print-hide h-[74px] shrink-0 bg-white/85 backdrop-blur border-b border-line flex items-center gap-3 px-4 sm:px-6 z-30">
          <button className="lg:hidden grid place-items-center size-9 rounded-lg text-slate-500" onClick={() => setCollapsed(false)}>
            <PanelLeftClose className="size-5" />
          </button>

          <div className="lg:hidden flex items-center gap-2.5">
            <div className="ga-seal size-8 rounded-lg grid place-items-center"><span className="font-display text-[13px] font-semibold text-white">GA</span></div>
            <p className="font-display font-semibold text-ink-900">Grand Aurelia</p>
          </div>

          {/* search */}
          <button
            onClick={() => { setSearchModal(true); setTimeout(() => searchRef.current?.focus(), 30); }}
            className="hidden md:flex items-center gap-2.5 w-[320px] rounded-xl border border-line bg-canvas px-3.5 py-2 text-[13px] text-slate-400 hover:border-gold-300 hover:bg-gold-50/40 transition">
            <Search className="size-4" />
            <span className="flex-1 text-left">Search guests, reservations, rooms…</span>
            <kbd className="rounded-md border border-line bg-white px-1.5 text-[10px] font-bold text-slate-400">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
              <span className="live-dot size-1.5 rounded-full bg-emerald-500" /> Live · {fmtDate(todayISO()).slice(0, 6)}
            </span>

            {/* notifications */}
            <div className="relative">
              <button onClick={() => { setNotifOpen((o) => !o); setUserOpen(false); api.get<{ notifications: NotificationItem[] }>('/api/notifications').then((r) => setNotifs(r.notifications)).catch(() => {}); }}
                className="relative grid place-items-center size-9 rounded-xl text-slate-500 hover:bg-slate-100 transition">
                <Bell className="size-[19px]" />
                {unread > 0 && (
                  <span className="absolute top-1 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9.5px] font-bold grid place-items-center border-2 border-white">{unread}</span>
                )}
              </button>
              {notifOpen && (
                <div className="anim-modal absolute right-0 top-11 w-[360px] card !rounded-2xl overflow-hidden shadow-pop z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-white">
                    <p className="font-bold text-[13.5px] text-ink-900">Notifications</p>
                    {!notifs.some((n) => n.read === 0) ? <span className="text-[11px] text-slate-400">All read</span> : (
                      <button className="text-[11.5px] font-bold text-gold-600 hover:underline"
                        onClick={() => api.post('/api/notifications/read-all').then(() => setNotifs((n) => n.map((x) => ({ ...x, read: 1 }))))}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                    {notifs.length === 0 && (
                      <div className="py-10 text-center text-slate-400">
                        <Inbox className="size-7 mx-auto mb-1.5" />
                        <p className="text-[13px]">You're all caught up</p>
                      </div>
                    )}
                    {notifs.map((n) => (
                      <button key={n.id} onClick={() => { api.post(`/api/notifications/${n.id}/read`).catch(() => {}); setNotifOpen(false); if (n.link) nav(n.link.replace(/^#/, '')); }}
                        className={cx('w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition', !n.read && 'bg-gold-50/50')}>
                        <span className={cx('mt-1 size-2 rounded-full shrink-0', n.read ? 'bg-slate-200' : 'bg-gold-500')} />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-bold text-ink-900 truncate">{n.title}</span>
                          <span className="block text-[12.5px] text-slate-500 leading-snug">{n.message}</span>
                          <span className="block text-[10.5px] text-slate-400 mt-1">{fmtDate(n.created_at)} · {fmtTime(n.created_at)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* user */}
            <div className="relative">
              <button onClick={() => { setUserOpen((o) => !o); setNotifOpen(false); }}
                className="flex items-center gap-2.5 rounded-xl pl-1.5 pr-2.5 py-1.5 hover:bg-slate-100 transition">
                <div className={cx('size-9 rounded-xl grid place-items-center text-[13px] font-bold', avatarTone(user?.name || ''))}>{initials(user?.name || '')}</div>
                <div className="hidden sm:block text-left">
                  <p className="text-[13px] font-bold text-ink-900 leading-tight">{user?.name}</p>
                  <p className="text-[11px] text-slate-400">{user?.role}</p>
                </div>
              </button>
              {userOpen && (
                <div className="anim-modal absolute right-0 top-11 w-56 card !rounded-2xl p-1.5 shadow-pop z-50">
                  <div className="px-3 py-2.5 mb-1 rounded-xl bg-slate-50">
                    <p className="text-[13px] font-bold text-ink-900">{user?.name}</p>
                    <p className="text-[11.5px] text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <button onClick={() => { setUserOpen(false); nav('/staff'); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-100">
                    <ShieldCheck className="size-4 text-slate-400" /> User management
                  </button>
                  <button onClick={() => { logout(); nav('/login'); }} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-rose-500 hover:bg-rose-50">
                    <LogOut className="size-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto" id="main-scroll">
          <Outlet />
        </main>
      </div>

      {/* mobile nav */}
      <MobileNav items={items} />

      {/* global search modal */}
      <Modal open={searchModal} onClose={() => setSearchModal(false)} width="max-w-lg">
        <div className="flex items-center gap-2.5 border-b border-line pb-3 mb-4">
          <Search className="size-4.5 text-slate-400" />
          <input ref={searchRef} value={search} onChange={(e) => { setSearch(e.target.value); runSearch(); }} onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Search reservations, guests, room numbers…" className="flex-1 outline-none text-[15px] bg-transparent placeholder:text-slate-300" />
          {search && <X className="size-4 text-slate-300 cursor-pointer" onClick={() => { setSearch(''); setSearchResults(null); }} />}
        </div>
        {!searchResults && <p className="text-[13px] text-slate-400">Type at least 2 characters and press Enter. Tip: try a guest name, confirmation number or room number.</p>}
        {searchResults && (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto">
            <div>
              <p className="label-base">Reservations</p>
              {searchResults.reservations.length === 0 && <p className="text-[13px] text-slate-400">No reservations matched.</p>}
              {searchResults.reservations.map((r) => (
                <Link key={r.id} to={`/reservations?q=${r.confirmation_no}`} onClick={() => setSearchModal(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition">
                  <div>
                    <p className="text-[13.5px] font-bold text-ink-900">{r.guest_name} · {r.confirmation_no}</p>
                    <p className="text-[12px] text-slate-400">{fmtDate(r.check_in)}</p>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">{r.status}</span>
                </Link>
              ))}
            </div>
            <div>
              <p className="label-base">Rooms</p>
              {searchResults.rooms.length === 0 && <p className="text-[13px] text-slate-400">No rooms matched.</p>}
              {searchResults.rooms.map((r) => (
                <Link key={r.id} to={`/rooms?q=${r.number}`} onClick={() => setSearchModal(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition">
                  <p className="text-[13.5px] font-bold text-ink-900">Room {r.number} <span className="text-slate-400 font-medium">· {r.category_name}</span></p>
                  <span className="text-[11px] font-bold text-slate-400">{r.status}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const isActiveDot = (p: string) => p === '/';

function MobileNav({ items }: { items: typeof NAV }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line flex overflow-x-auto px-1.5 py-1.5 no-print">
      {items.map((n) => (
        <NavLink key={n.id} to={n.path} end={n.path === '/'}
          className={({ isActive }) => cx('flex-1 min-w-[64px] flex flex-col items-center gap-1 rounded-xl px-1.5 py-1.5 text-[9.5px] font-bold transition',
            isActive ? 'bg-gold-50 text-gold-600' : 'text-slate-400')}>
          <n.icon className="size-5" strokeWidth={2} />
          {n.label.split(' ')[0]}
        </NavLink>
      ))}
    </nav>
  );
}
