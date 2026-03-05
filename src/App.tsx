import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  PlusCircle, 
  Users, 
  LogOut, 
  ChevronRight, 
  Calendar, 
  Building2, 
  TrendingUp, 
  IndianRupee, 
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  Search,
  Download,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { User, VisitLog, DashboardStats, Role } from './types';
import { CLIENTS } from './constants';

// --- Components ---

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string, key?: React.Key }) => (
  <div className={`bg-white rounded-2xl border border-black/5 shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
    {...props} 
    className="w-full px-4 py-2 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select 
    {...props} 
    className="w-full px-4 py-2 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all bg-white"
  />
);

const Button = ({ children, variant = 'primary', ...props }: any) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-white text-gray-700 border border-black/10 hover:bg-gray-50',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100',
  };
  return (
    <button 
      {...props} 
      className={`px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 ${variants[variant as keyof typeof variants]}`}
    >
      {children}
    </button>
  );
};

const Toast = ({ message, type = 'success', onClose }: { message: string, type?: 'success' | 'error', onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: -20, x: 20 }}
    animate={{ opacity: 1, y: 0, x: 0 }}
    exit={{ opacity: 0, y: -20, x: 20 }}
    className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
      type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
    }`}
  >
    {type === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}
    <p className="text-sm font-medium">{message}</p>
    <button onClick={onClose} className="ml-2 hover:opacity-70">
      <X size={14} />
    </button>
  </motion.div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'logs' | 'activities' | 'users'>('dashboard');
  const [logs, setLogs] = useState<VisitLog[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ total_visits: 0, total_clients: 0, total_days: 0, total_installations: 0, success_rate: 0 });
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<VisitLog | null>(null);
  const [showDetailedVisits, setShowDetailedVisits] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'forgot' | 'reset' | 'activate'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [activationData, setActivationData] = useState({ name: '', password: '', confirmPassword: '' });
  const [resetToken, setResetToken] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Login Form State
  const [loginData, setLoginData] = useState({ username: '', password: '' });

  // Activity Form State
  const [activityData, setActivityData] = useState<Partial<VisitLog>>({
    client_name: '',
    date_from: '',
    date_to: '',
    purpose: 'Installation',
    systems_installed: 0,
    students_enrolled: 0,
    students_attended: 0,
    remarks: '',
    travel_cost: 0,
    lodging_cost: 0,
    misc_expense: 0
  });

  // User Creation State
  const [newUserData, setNewUserData] = useState({ username: '', role: 'user' as Role });

  // Filter States
  const [filters, setFilters] = useState({
    clientName: '',
    date: '',
    purpose: 'All',
    employeeId: 'All'
  });

  const filteredLogs = logs.filter(log => {
    const matchesClient = log.client_name.toLowerCase().includes(filters.clientName.toLowerCase());
    const matchesDate = filters.date ? (log.date_from === filters.date || log.date_to === filters.date) : true;
    const matchesPurpose = filters.purpose === 'All' ? true : log.purpose === filters.purpose;
    const matchesEmployee = filters.employeeId === 'All' ? true : log.user_id.toString() === filters.employeeId;
    return matchesClient && matchesDate && matchesPurpose && matchesEmployee;
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, view]);

  const fetchData = async () => {
    if (!user) return;
    
    // Refresh sliding session
    localStorage.setItem('visit_tracker_session', JSON.stringify({
      user: user,
      timestamp: Date.now()
    }));
    
    try {
      // Fetch Stats
      const statsRes = await fetch(`/api/stats?userId=${user.id}&role=${user.role}`);
      const statsData = await statsRes.json();
      setStats(statsData);

      // Fetch Logs
      const logsRes = await fetch(`/api/logs?userId=${user.id}&role=${user.role}&employeeId=${filters.employeeId}`);
      const logsData = await logsRes.json();
      setLogs(logsData);

      // Fetch Users if Admin
      if (user.role === 'admin') {
        const usersRes = await fetch('/api/users');
        const usersData = await usersRes.json();
        setAllUsers(usersData);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (window.location.pathname === '/activate' && token) {
      setResetToken(token);
      setAuthMode('activate');
    } else if (window.location.pathname === '/reset-password' && token) {
      setResetToken(token);
      setAuthMode('reset');
    }

    // Session Recovery
    const savedSession = localStorage.getItem('visit_tracker_session');
    if (savedSession) {
      try {
        const { user: savedUser, timestamp } = JSON.parse(savedSession);
        const now = Date.now();
        const thirtyMinutes = 30 * 60 * 1000;
        
        if (now - timestamp < thirtyMinutes) {
          setUser(savedUser);
        } else {
          localStorage.removeItem('visit_tracker_session');
        }
      } catch (e) {
        localStorage.removeItem('visit_tracker_session');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        // Save session
        localStorage.setItem('visit_tracker_session', JSON.stringify({
          user: userData,
          timestamp: Date.now()
        }));
      } else {
        const err = await res.json();
        setLoginError(err.error || 'Invalid username or password');
      }
    } catch (err) {
      setLoginError('Connection error');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoginLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authEmail })
      });
      if (res.ok) {
        showToast('Reset link sent to your email');
        setAuthMode('login');
      } else {
        const err = await res.json();
        showToast(err.error, 'error');
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activationData.password !== activationData.confirmPassword) {
      return alert('Passwords do not match');
    }
    setIsLoginLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: activationData.password })
      });
      if (res.ok) {
        alert('Password reset successfully');
        setAuthMode('login');
        window.history.replaceState({}, '', '/');
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activationData.password !== activationData.confirmPassword) {
      return alert('Passwords do not match');
    }
    setIsLoginLoading(true);
    try {
      const res = await fetch('/api/users/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: resetToken, 
          name: activationData.name, 
          password: activationData.password 
        })
      });
      if (res.ok) {
        alert('Account activated successfully');
        setAuthMode('login');
        window.history.replaceState({}, '', '/');
      } else {
        const err = await res.json();
        alert(err.error);
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingLog ? 'PUT' : 'POST';
    const url = editingLog ? `/api/logs/${editingLog.id}` : '/api/logs';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...activityData, user_id: user?.id })
    });

    if (res.ok) {
      setIsModalOpen(false);
      setEditingLog(null);
      setActivityData({
        client_name: '',
        date_from: '',
        date_to: '',
        purpose: 'Installation',
        systems_installed: 0,
        students_enrolled: 0,
        students_attended: 0,
        remarks: '',
        travel_cost: 0,
        lodging_cost: 0,
        misc_expense: 0
      });
      fetchData();
      setView('logs');
    }
  };

  const handleDeleteLog = async (id: number) => {
    if (confirm('Are you sure you want to delete this log?')) {
      await fetch(`/api/logs/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUserData)
    });
    if (res.ok) {
      setNewUserData({ username: '', role: 'user' });
      fetchData();
      showToast('Invitation sent successfully');
    } else {
      const err = await res.json();
      showToast(err.error || 'Error inviting user', 'error');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (confirm('Are you sure you want to delete this user?')) {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      fetchData();
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const res = await fetch(`/api/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: editingUser.username, role: editingUser.role })
    });
    if (res.ok) {
      setEditingUser(null);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.error || 'Error updating user');
    }
  };

  const exportToExcel = () => {
    const data = filteredLogs.map(log => ({
      'Client Name': log.client_name,
      'Employee': log.user_name,
      'Date From': log.date_from,
      'Date To': log.date_to,
      'Purpose': log.purpose,
      'Systems Installed': log.systems_installed,
      'Students Enrolled': log.students_enrolled,
      'Students Attended': log.students_attended,
      'Travel Cost': log.travel_cost,
      'Lodging Cost': log.lodging_cost,
      'Misc Expense': log.misc_expense,
      'Total Cost': log.travel_cost + log.lodging_cost + log.misc_expense,
      'Remarks': log.remarks
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Visit Logs");
    XLSX.writeFile(workbook, `Visit_Logs_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.text("Client Visit Logs", 14, 15);
    
    const tableData = filteredLogs.map(log => [
      log.client_name,
      log.user_name,
      log.date_from,
      log.purpose,
      log.systems_installed,
      log.students_enrolled,
      log.students_attended,
      `Rs. ${log.travel_cost + log.lodging_cost + log.misc_expense}`
    ]);

    autoTable(doc, {
      head: [['Client', 'Employee', 'Date', 'Purpose', 'Systems', 'Enrolled', 'Attended', 'Total Cost']],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`Visit_Logs_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
              <ClipboardList className="text-white w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Client Visit Tracker</h1>
            <p className="text-gray-500 mt-2">Sign in to manage your visits</p>
          </div>

          <Card className="p-8">
            {authMode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <Input 
                    type="email" 
                    placeholder="Enter your email"
                    value={loginData.username}
                    onChange={e => setLoginData({ ...loginData, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                  <Input 
                    type="password" 
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                </div>
                {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
                <div className="flex items-center justify-between gap-4">
                  <Button type="submit" className="flex-1 py-3" disabled={isLoginLoading}>
                    {isLoginLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  <button 
                    type="button"
                    onClick={() => setAuthMode('forgot')}
                    className="text-sm text-indigo-600 hover:underline font-medium whitespace-nowrap"
                  >
                    Forgot Password?
                  </button>
                </div>
              </form>
            )}

            {authMode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <Input 
                    type="email" 
                    placeholder="Enter your email"
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full py-3" disabled={isLoginLoading}>
                  {isLoginLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
                <button 
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="w-full text-sm text-gray-500 hover:underline"
                >
                  Back to Login
                </button>
              </form>
            )}

            {authMode === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-6">
                <h3 className="text-lg font-bold text-center">Reset Password</h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                  <Input 
                    type="password" 
                    placeholder="••••••••"
                    value={activationData.password}
                    onChange={e => setActivationData({ ...activationData, password: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                  <Input 
                    type="password" 
                    placeholder="••••••••"
                    value={activationData.confirmPassword}
                    onChange={e => setActivationData({ ...activationData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full py-3" disabled={isLoginLoading}>
                  {isLoginLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            )}

            {authMode === 'activate' && (
              <form onSubmit={handleActivate} className="space-y-6">
                <h3 className="text-lg font-bold text-center">Activate Account</h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                  <Input 
                    type="text" 
                    placeholder="John Doe"
                    value={activationData.name}
                    onChange={e => setActivationData({ ...activationData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                  <Input 
                    type="password" 
                    placeholder="••••••••"
                    value={activationData.password}
                    onChange={e => setActivationData({ ...activationData, password: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                  <Input 
                    type="password" 
                    placeholder="••••••••"
                    value={activationData.confirmPassword}
                    onChange={e => setActivationData({ ...activationData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full py-3" disabled={isLoginLoading}>
                  {isLoginLoading ? 'Activating...' : 'Activate Account'}
                </Button>
              </form>
            )}
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-black/5 flex flex-col">
        <div className="p-6 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <ClipboardList className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-gray-900 text-lg">VisitTracker</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'dashboard' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          
          <button 
            onClick={() => setView('activities')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'activities' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <PlusCircle size={20} />
            Activities
          </button>

          <button 
            onClick={() => setView('logs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'logs' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <ClipboardList size={20} />
            Visit Logs
          </button>

          {user.role === 'admin' && (
            <button 
              onClick={() => setView('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'users' ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Users size={20} />
              User Management
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-black/5">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setUser(null);
              localStorage.removeItem('visit_tracker_session');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 capitalize">{view.replace('-', ' ')}</h2>
            <p className="text-gray-500">Welcome back, {user.name}</p>
          </div>
          {view === 'logs' && (
            <Button onClick={() => { setEditingLog(null); setIsModalOpen(true); }}>
              <PlusCircle className="inline-block mr-2" size={18} />
              New Visit
            </Button>
          )}
        </header>

        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              <Card className="flex items-center gap-4 relative group">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <ClipboardList size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 font-medium">Total Visits</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_visits}</p>
                </div>
                <button 
                  onClick={() => setShowDetailedVisits(!showDetailedVisits)}
                  className="absolute bottom-2 right-2 p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                  title={showDetailedVisits ? "Hide Details" : "Show Details"}
                >
                  {showDetailedVisits ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </Card>
              <Card className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Building2 size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Unique Clients</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_clients}</p>
                </div>
              </Card>
              <Card className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Days Spent</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_days}</p>
                </div>
              </Card>
              <Card className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total Installations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_installations}</p>
                </div>
              </Card>
              <Card className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.success_rate}%</p>
                </div>
              </Card>
            </motion.div>
          )}

          {view === 'dashboard' && showDetailedVisits && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 space-y-4"
            >
              <h3 className="text-lg font-bold text-gray-900">Recent Visit Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {logs.slice(0, 6).map(log => (
                  <Card key={log.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-gray-900 truncate pr-2">{log.client_name}</h4>
                      <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded uppercase font-bold tracking-tighter">
                        {log.purpose}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{log.date_from}</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-indigo-600 font-medium">{log.user_name}</span>
                      <span className="font-bold">₹{(log.travel_cost + log.lodging_cost + log.misc_expense).toFixed(0)}</span>
                    </div>
                  </Card>
                ))}
              </div>
              <Button variant="secondary" onClick={() => setView('logs')} className="text-sm">View All Logs</Button>
            </motion.div>
          )}

          {view === 'activities' && (
            <motion.div 
              key="activities"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl"
            >
              <Card>
                <h3 className="text-lg font-bold mb-6">Create New Activity</h3>
                <form onSubmit={handleCreateActivity} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Client Name</label>
                      <Input 
                        required
                        value={activityData.client_name}
                        onChange={e => setActivityData({ ...activityData, client_name: e.target.value })}
                        list="client-list"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose</label>
                      <Select 
                        value={activityData.purpose}
                        onChange={e => setActivityData({ ...activityData, purpose: e.target.value as any })}
                      >
                        <option value="Installation">Installation</option>
                        <option value="Exam Support">Exam Support</option>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
                      <Input 
                        type="date" 
                        required
                        value={activityData.date_from}
                        onChange={e => setActivityData({ ...activityData, date_from: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
                      <Input 
                        type="date" 
                        required
                        value={activityData.date_to}
                        onChange={e => setActivityData({ ...activityData, date_to: e.target.value })}
                      />
                    </div>
                  </div>

                  {activityData.purpose === 'Installation' ? (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Systems Installed</label>
                      <Input 
                        type="number" 
                        value={String(activityData.systems_installed || 0)}
                        onChange={e => setActivityData({ ...activityData, systems_installed: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Students Enrolled</label>
                        <Input 
                          type="number" 
                          value={String(activityData.students_enrolled || 0)}
                          onChange={e => setActivityData({ ...activityData, students_enrolled: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Students Attended</label>
                        <Input 
                          type="number" 
                          value={String(activityData.students_attended || 0)}
                          onChange={e => setActivityData({ ...activityData, students_attended: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Remarks</label>
                    <textarea 
                      className="w-full px-4 py-2 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[100px]"
                      value={activityData.remarks}
                      onChange={e => setActivityData({ ...activityData, remarks: e.target.value })}
                    />
                  </div>

                  <div className="border-t border-black/5 pt-6">
                    <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <IndianRupee size={16} /> Expenses
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Travel Cost</label>
                        <Input 
                          type="number" 
                          value={String(activityData.travel_cost || 0)}
                          onChange={e => setActivityData({ ...activityData, travel_cost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Lodging Cost</label>
                        <Input 
                          type="number" 
                          value={String(activityData.lodging_cost || 0)}
                          onChange={e => setActivityData({ ...activityData, lodging_cost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Misc Expense</label>
                        <Input 
                          type="number" 
                          value={String(activityData.misc_expense || 0)}
                          onChange={e => setActivityData({ ...activityData, misc_expense: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full py-3">Create Activity</Button>
                </form>
              </Card>
            </motion.div>
          )}

          {view === 'logs' && (
            <motion.div 
              key="logs"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Filters */}
              <Card className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <ClipboardList size={18} className="text-indigo-600" />
                    Visit Logs 
                    <span className="ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs">
                      {filteredLogs.length} {filteredLogs.length === 1 ? 'Visit' : 'Visits'}
                    </span>
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={exportToExcel}
                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                      title="Download Excel"
                    >
                      <FileSpreadsheet size={14} />
                      Excel
                    </button>
                    <button 
                      onClick={exportToPDF}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                      title="Download PDF"
                    >
                      <FileText size={14} />
                      PDF
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Client Name</label>
                    <Input 
                      placeholder="Search client..." 
                      value={filters.clientName}
                      onChange={e => setFilters({ ...filters, clientName: e.target.value })}
                      list="client-list"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Date</label>
                    <Input 
                      type="date"
                      value={filters.date}
                      onChange={e => setFilters({ ...filters, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Purpose</label>
                    <Select 
                      value={filters.purpose}
                      onChange={e => setFilters({ ...filters, purpose: e.target.value })}
                    >
                      <option value="All">All Purposes</option>
                      <option value="Installation">Installation</option>
                      <option value="Exam Support">Exam Support</option>
                    </Select>
                  </div>
                  {user.role === 'admin' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Employee</label>
                      <Select 
                        value={filters.employeeId}
                        onChange={e => setFilters({ ...filters, employeeId: e.target.value })}
                      >
                        <option value="All">All Employees</option>
                        {allUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
                { (filters.clientName || filters.date || filters.purpose !== 'All' || filters.employeeId !== 'All') && (
                  <button 
                    onClick={() => setFilters({ clientName: '', date: '', purpose: 'All', employeeId: 'All' })}
                    className="mt-4 text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    Clear Filters
                  </button>
                )}
              </Card>

              <div className="grid grid-cols-1 gap-4">
                {filteredLogs.map(log => (
                  <Card key={log.id} className="hover:border-indigo-200 transition-all group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${log.purpose === 'Installation' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                          {log.purpose === 'Installation' ? <TrendingUp size={24} /> : <CheckCircle2 size={24} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-900 text-lg">{log.client_name}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.purpose === 'Installation' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                              {log.purpose}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                            <Calendar size={14} /> {log.date_from} to {log.date_to}
                            {user.role === 'admin' && <span className="ml-2 text-indigo-600 font-medium">• {log.user_name}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-6">
                        <div className="text-right">
                          <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Total Expense</p>
                          <p className="text-lg font-bold text-gray-900">
                            ₹{(log.travel_cost + log.lodging_cost + log.misc_expense).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setEditingLog(log);
                              setActivityData({
                                ...log,
                                systems_installed: log.systems_installed ?? 0,
                                students_enrolled: log.students_enrolled ?? 0,
                                students_attended: log.students_attended ?? 0,
                                travel_cost: log.travel_cost ?? 0,
                                lodging_cost: log.lodging_cost ?? 0,
                                misc_expense: log.misc_expense ?? 0,
                              });
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-black/5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400 font-medium">Details</p>
                        <p className="text-gray-700 mt-1">
                          {log.purpose === 'Installation' 
                            ? `${log.systems_installed} systems installed`
                            : `Success Rate: ${log.students_attended}/${log.students_enrolled} students`}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-gray-400 font-medium">Remarks</p>
                        <p className="text-gray-700 mt-1 italic">"{log.remarks || 'No remarks provided'}"</p>
                      </div>
                    </div>
                  </Card>
                ))}
                {filteredLogs.length === 0 && (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                    <ClipboardList className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-500">No visit logs found matching your filters</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'users' && user.role === 'admin' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <Card className="max-w-xl">
                <h3 className="text-lg font-bold mb-6">{editingUser ? 'Edit User' : 'Invite New User'}</h3>
                <form onSubmit={editingUser ? handleUpdateUser : handleInviteUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address (Username)</label>
                      <Input 
                        type="email"
                        required
                        value={editingUser ? editingUser.username : newUserData.username}
                        onChange={e => editingUser ? setEditingUser({ ...editingUser, username: e.target.value }) : setNewUserData({ ...newUserData, username: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                      <Select 
                        value={editingUser ? editingUser.role : newUserData.role}
                        onChange={e => editingUser ? setEditingUser({ ...editingUser, role: e.target.value as Role }) : setNewUserData({ ...newUserData, role: e.target.value as Role })}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {editingUser && (
                      <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditingUser(null)}>Cancel</Button>
                    )}
                    <Button type="submit" className="flex-1">
                      {editingUser ? 'Update User' : 'Send Invitation'}
                    </Button>
                  </div>
                </form>
              </Card>

              <div className="space-y-4">
                <h3 className="text-lg font-bold">System Users</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allUsers.map(u => (
                    <Card key={u.id} className="flex flex-col gap-4 relative">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${u.status === 'pending' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-gray-100 text-gray-600'}`}>
                          {u.name ? u.name.charAt(0) : <Mail size={20} />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-bold text-gray-900 truncate">{u.name || 'Pending Activation'}</p>
                          <p className="text-xs text-gray-500 truncate">{u.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-black/5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-600'}`}>
                          {u.role}
                        </span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => setEditingUser(u)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {u.status === 'pending' && (
                        <div className="absolute top-2 right-2">
                          <span className="flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                          </span>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-black/5 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingLog ? 'Edit Visit Log' : 'Create New Visit Log'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 max-h-[80vh] overflow-y-auto">
                <form onSubmit={handleCreateActivity} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Client Name</label>
                      <Input 
                        required
                        value={activityData.client_name}
                        onChange={e => setActivityData({ ...activityData, client_name: e.target.value })}
                        list="client-list"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose</label>
                      <Select 
                        value={activityData.purpose}
                        onChange={e => setActivityData({ ...activityData, purpose: e.target.value as any })}
                      >
                        <option value="Installation">Installation</option>
                        <option value="Exam Support">Exam Support</option>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
                      <Input 
                        type="date" 
                        required
                        value={activityData.date_from}
                        onChange={e => setActivityData({ ...activityData, date_from: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
                      <Input 
                        type="date" 
                        required
                        value={activityData.date_to}
                        onChange={e => setActivityData({ ...activityData, date_to: e.target.value })}
                      />
                    </div>
                  </div>

                  {activityData.purpose === 'Installation' ? (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Systems Installed</label>
                      <Input 
                        type="number" 
                        value={String(activityData.systems_installed || 0)}
                        onChange={e => setActivityData({ ...activityData, systems_installed: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Students Enrolled</label>
                        <Input 
                          type="number" 
                          value={String(activityData.students_enrolled || 0)}
                          onChange={e => setActivityData({ ...activityData, students_enrolled: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Students Attended</label>
                        <Input 
                          type="number" 
                          value={String(activityData.students_attended || 0)}
                          onChange={e => setActivityData({ ...activityData, students_attended: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Remarks</label>
                    <textarea 
                      className="w-full px-4 py-2 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[100px]"
                      value={activityData.remarks}
                      onChange={e => setActivityData({ ...activityData, remarks: e.target.value })}
                    />
                  </div>

                  <div className="border-t border-black/5 pt-6">
                    <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <IndianRupee size={16} /> Expenses
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Travel Cost</label>
                        <Input 
                          type="number" 
                          value={String(activityData.travel_cost || 0)}
                          onChange={e => setActivityData({ ...activityData, travel_cost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Lodging Cost</label>
                        <Input 
                          type="number" 
                          value={String(activityData.lodging_cost || 0)}
                          onChange={e => setActivityData({ ...activityData, lodging_cost: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Misc Expense</label>
                        <Input 
                          type="number" 
                          value={String(activityData.misc_expense || 0)}
                          onChange={e => setActivityData({ ...activityData, misc_expense: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1">{editingLog ? 'Update Log' : 'Save Log'}</Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>
      <datalist id="client-list">
        {CLIENTS.map(client => (
          <option key={client} value={client} />
        ))}
      </datalist>
    </div>
  );
}
