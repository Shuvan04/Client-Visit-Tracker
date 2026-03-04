export type Role = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: Role;
  name: string;
  status: 'active' | 'pending';
}

export interface VisitLog {
  id: string;
  user_id: string;
  user_name?: string;
  client_name: string;
  date_from: string;
  date_to: string;
  purpose: 'Installation' | 'Exam Support';
  systems_installed?: number;
  students_enrolled?: number;
  students_attended?: number;
  remarks: string;
  travel_cost: number;
  lodging_cost: number;
  misc_expense: number;
  created_at: string;
}

export interface DashboardStats {
  total_visits: number;
  total_clients: number;
  total_days: number;
  total_installations: number;
  success_rate: number;
}
