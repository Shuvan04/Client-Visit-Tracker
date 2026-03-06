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
  client_id: string;
  client_name?: string;
  location_id: string;
  location_name?: string;
  date_from: string;
  date_to: string;
  purpose: 'Installation' | 'Exam Support' | 'Exam Support & Installation';
  systems_installed?: number;
  students_enrolled?: number;
  students_attended?: number;
  escalation_level?: 'No' | 'Low' | 'Medium' | 'High';
  remarks: string;
  travel_cost: number;
  lodging_cost: number;
  misc_expense: number;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
}

export interface ClientLocation {
  id: string;
  name: string;
}

export interface DashboardStats {
  total_visits: number;
  total_clients: number;
  total_days: number;
  total_installations: number;
  total_enrolled: number;
  total_attended: number;
  success_rate: number;
  total_expense: number;
}
