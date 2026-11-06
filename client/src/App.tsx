import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ToastProvider, Loading } from './ui';
import AppLayout from './layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reservations from './pages/Reservations';
import ReservationsCalendar from './pages/ReservationsCalendar';
import FrontDesk from './pages/FrontDesk';
import CheckIn from './pages/CheckIn';
import CheckOut from './pages/CheckOut';
import Rooms from './pages/Rooms';
import Housekeeping from './pages/Housekeeping';
import Guests from './pages/Guests';
import Billing from './pages/Billing';
import Reports from './pages/Reports';
import Staff from './pages/Staff';

function Guard({ page, children }: { page: string; children: React.ReactNode }) {
  const { user, can } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!can(page)) return (
    <div className="p-10 text-center">
      <p className="font-display text-xl font-semibold text-ink-900">Restricted area</p>
      <p className="text-[13.5px] text-slate-400 mt-2">Your role ({user.role}) does not have access to this module.</p>
    </div>
  );
  return children;
}

function Shell() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Guard page="dashboard"><Dashboard /></Guard>} />
        <Route path="/reservations" element={<Guard page="reservations"><Reservations /></Guard>} />
        <Route path="/calendar" element={<Guard page="calendar"><ReservationsCalendar /></Guard>} />
        <Route path="/front-desk" element={<Guard page="front-desk"><FrontDesk /></Guard>} />
        <Route path="/check-in/:id" element={<Guard page="front-desk"><CheckIn /></Guard>} />
        <Route path="/check-out/:id" element={<Guard page="front-desk"><CheckOut /></Guard>} />
        <Route path="/rooms" element={<Guard page="rooms"><Rooms /></Guard>} />
        <Route path="/housekeeping" element={<Guard page="housekeeping"><Housekeeping /></Guard>} />
        <Route path="/guests" element={<Guard page="guests"><Guests /></Guard>} />
        <Route path="/billing" element={<Guard page="billing"><Billing /></Guard>} />
        <Route path="/reports" element={<Guard page="reports"><Reports /></Guard>} />
        <Route path="/staff" element={<Guard page="staff"><Staff /></Guard>} />
      </Route>
      <Route path="*" element={<Loading label="Page not found — redirecting…" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
