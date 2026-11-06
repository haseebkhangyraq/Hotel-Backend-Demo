export type Role = 'Administrator' | 'Manager' | 'Receptionist' | 'Housekeeping' | 'Accountant';

export interface User { id: number; name: string; email: string; role: Role; phone?: string; active?: number; created_at?: string }

export interface RoomCategory {
  id: number; name: string; slug: string; description: string; base_rate: number;
  max_occupancy: number; size_sqm?: number; bed?: string; amenities: string[];
  room_count?: number; occupied_count?: number;
}

export interface Room {
  id: number; number: string; category_id: number; floor: number; max_occupancy: number;
  rate: number | null; status: RoomStatus; amenities: string[]; notes: string;
  category_name?: string; base_rate?: number; reservation?: {
    id: number; confirmation_no: string; guest_name: string; check_in: string; check_out: string; status: string;
  } | null;
}

export type RoomStatus = 'Available' | 'Reserved' | 'Occupied' | 'Dirty' | 'Cleaning' | 'Maintenance';
export type ReservationStatus = 'Confirmed' | 'Pending' | 'Checked-in' | 'Checked-out' | 'Cancelled' | 'No-show';
export type BookingSource = 'Website' | 'Reception' | 'Phone' | 'Walk-in';
export type PaymentMethod = 'Cash' | 'Credit Card' | 'Debit Card' | 'Bank Transfer' | 'Online Payment';

export interface Guest {
  id: number; full_name: string; phone: string; email: string; nationality: string;
  id_type: string; id_number: string; vip: number; preferences: string; notes: string; created_at: string;
  total_reservations?: number; completed_stays?: number; lifetime_value?: number; last_stay?: string;
}

export interface FolioItem {
  id: number; reservation_id: number; type: string; description: string;
  quantity: number; unit_price: number; amount: number; posted_at: string; posted_by: string;
}

export interface Folio {
  nights: number; ratePerNight: number; items: FolioItem[]; payments: PaymentRow[];
  roomTotal: number; extrasTotal: number; subtotal: number; discount: number; taxRate: number;
  tax: number; total: number; paid: number; balance: number;
}

export interface PaymentRow {
  id: number; reservation_id: number; amount: number; method: PaymentMethod;
  purpose: string; paid_at: string; received_by: string; note: string;
}

export interface Reservation {
  id: number; confirmation_no: string; guest_id: number; category_id: number;
  room_id: number | null; check_in: string; check_out: string; adults: number; children: number;
  status: ReservationStatus; source: BookingSource; rate_per_night: number; discount: number;
  tax_rate: number; advance_payment: number; special_requests: string; notes: string;
  breakfast_plan: string; id_doc_type: string; id_doc_number: string; created_by: string;
  created_at: string; checked_in_at?: string | null; checked_out_at?: string | null;
  cancelled_at?: string | null; cancel_reason?: string | null; invoice_no?: string | null;
  guest_name: string; guest_phone?: string; guest_email?: string; guest_vip?: number;
  category_name: string; room_number: string | null; room_floor?: number | null; nights?: number;
  total?: number; paid?: number; balance?: number;
  guest_nationality?: string; guest_id_type?: string; guest_id_number?: string; guest_preferences?: string;
  folio?: Folio;
}

export interface HousekeepingTask {
  id: number; room_id: number; task_type: string; status: 'Pending' | 'In Progress' | 'Cleaned' | 'Inspected';
  assigned_to: number | null; priority: string; notes: string; created_at: string;
  started_at: string | null; completed_at: string | null;
  room_number: string; room_status: RoomStatus; room_floor: number; category_name: string; staff_name?: string | null;
}

export interface MaintenanceRequest {
  id: number; room_id: number; title: string; detail: string; status: string; reported_by: string;
  created_at: string; resolved_at?: string | null; room_number?: string;
}

export interface ActivityItem { id: number; type: string; message: string; actor: string; reservation_id: number | null; created_at: string }
export interface NotificationItem { id: number; type: string; title: string; message: string; link: string; read: number; created_at: string }

export interface DashboardData {
  today: string;
  rooms: { total: number; available: number; occupied: number; reserved: number; dirty: number; cleaning: number; maintenance: number; occupancyRate: number };
  reservations: { total: number; checkedIn: number; checkedOut: number; confirmed: number; pending: number; cancelled: number; noShow: number };
  arrivalsToday: Reservation[]; departuresToday: Reservation[]; inHouse: Reservation[];
  recentReservations: Reservation[];
  revenueToday: number;
  occSeries: { date: string; occupancy: number; revenue: number }[];
  categoryMix: { name: string; c: number }[];
  housekeepingOpen: number;
  pendingFolios: { id: number; confirmation_no: string; guest_name: string; room_number: string | null; balance: number }[];
}
