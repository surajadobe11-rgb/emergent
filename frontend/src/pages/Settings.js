import { useState, useEffect } from 'react';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2, X, Building2, Users, BookOpen } from 'lucide-react';

function CompanyTab() {
  const [form, setForm] = useState({ name: '', gst_number: '', address: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/settings/company').then(res => {
      setForm({ name: res.data.name || '', gst_number: res.data.gst_number || '', address: res.data.address || '', email: res.data.email || '', phone: res.data.phone || '' });
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings/company', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-xl">
      {[
        { key: 'name', label: 'Company Name', placeholder: 'Acme Pvt Ltd' },
        { key: 'gst_number', label: 'GST Number', placeholder: '27AABCU9603R1ZX' },
        { key: 'address', label: 'Address', placeholder: 'Mumbai, Maharashtra' },
        { key: 'email', label: 'Email', placeholder: 'accounts@company.com' },
        { key: 'phone', label: 'Phone', placeholder: '+91-22-12345678' },
      ].map(f => (
        <div key={f.key}>
          <label className="text-xs text-slate-400 mb-1.5 block">{f.label}</label>
          <input className="fin-input text-sm" placeholder={f.placeholder} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
        </div>
      ))}
      <button onClick={handleSave} disabled={saving} className="btn-primary mt-2" data-testid="save-company-btn">
        {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : saved ? '✓ Saved!' : 'Save Changes'}
      </button>
    </div>
  );
}

function UsersTab() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'accountant' });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = () => {
    api.get('/settings/users').then(res => setUsers(res.data.users || [])).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAdd = async () => {
    if (!newUser.email || !newUser.password || !newUser.name) { setError('All fields required'); return; }
    setAdding(true);
    setError('');
    try {
      await api.post('/settings/users', newUser);
      setShowAdd(false);
      setNewUser({ email: '', password: '', name: '', role: 'accountant' });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add user');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Delete this user?')) return;
    await api.delete(`/settings/users/${userId}`);
    fetchUsers();
  };

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">{users.length} users in your organization</p>
        {user?.role === 'admin' && (
          <button onClick={() => setShowAdd(true)} className="btn-primary" data-testid="add-user-btn">
            <Plus size={13} /> Add User
          </button>
        )}
      </div>

      {showAdd && (
        <div className="glass-card rounded-xl p-5 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-200">Add New User</h4>
            <button onClick={() => { setShowAdd(false); setError(''); }} className="text-slate-500"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="fin-input text-sm" placeholder="Full Name" value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} />
            <input type="email" className="fin-input text-sm" placeholder="Email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
            <input type="password" className="fin-input text-sm" placeholder="Password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
            <select className="fin-input text-sm" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
              <option value="accountant">Accountant</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={handleAdd} disabled={adding} className="btn-primary text-sm">
            {adding ? 'Adding...' : 'Add User'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id || u.email} className="glass-card rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-200">
                {u.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="text-sm font-medium text-slate-200" style={{ fontFamily: 'IBM Plex Sans' }}>{u.name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge ${u.role === 'admin' ? 'badge-indigo' : u.role === 'accountant' ? 'badge-success' : 'badge-muted'}`}>{u.role}</span>
              {user?.role === 'admin' && u.email !== user.email && (
                <button onClick={() => handleDelete(u.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function COATab() {
  const [accounts, setAccounts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newAcc, setNewAcc] = useState({ code: '', name: '', type: 'expense' });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const fetchAccounts = () => {
    api.get('/settings/coa').then(res => setAccounts(res.data.accounts || [])).finally(() => setLoading(false));
  };
  useEffect(() => { fetchAccounts(); }, []);

  const handleAdd = async () => {
    if (!newAcc.code || !newAcc.name) { setError('Code and name are required'); return; }
    setAdding(true);
    setError('');
    try {
      await api.post('/settings/coa', newAcc);
      setShowAdd(false);
      setNewAcc({ code: '', name: '', type: 'expense' });
      fetchAccounts();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add account');
    } finally {
      setAdding(false);
    }
  };

  const typeColors = { asset: 'badge-indigo', liability: 'badge-danger', equity: 'badge-warning', revenue: 'badge-success', expense: 'badge-muted' };

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">{accounts.length} accounts in chart of accounts</p>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary" data-testid="add-account-btn">
          <Plus size={13} /> Add Account
        </button>
      </div>

      {showAdd && (
        <div className="glass-card rounded-xl p-5 mb-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-200">Add Account</h4>
          <div className="grid grid-cols-3 gap-3">
            <input className="fin-input text-sm" placeholder="Code (e.g. 5080)" value={newAcc.code} onChange={e => setNewAcc(p => ({ ...p, code: e.target.value }))} />
            <input className="fin-input text-sm" placeholder="Account Name" value={newAcc.name} onChange={e => setNewAcc(p => ({ ...p, name: e.target.value }))} />
            <select className="fin-input text-sm" value={newAcc.type} onChange={e => setNewAcc(p => ({ ...p, type: e.target.value }))}>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={handleAdd} disabled={adding} className="btn-primary text-sm">
            {adding ? 'Adding...' : 'Add Account'}
          </button>
        </div>
      )}

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="fin-table">
          <thead><tr><th>Code</th><th>Name</th><th>Type</th></tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.code}>
                <td className="font-mono text-indigo-300">{a.code}</td>
                <td style={{ fontFamily: 'IBM Plex Sans' }}>{a.name}</td>
                <td><span className={`badge ${typeColors[a.type] || 'badge-muted'}`}>{a.type}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('company');

  const tabs = [
    { key: 'company', label: 'Company', icon: Building2 },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'coa', label: 'Chart of Accounts', icon: BookOpen },
  ];

  return (
    <div className="space-y-6 animate-fade-in" data-testid="settings-page">
      <h1 className="page-header">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(15,23,42,0.5)', width: 'fit-content' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            data-testid={`tab-${t.key}`}
          >
            <t.icon size={14} strokeWidth={1.5} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="animate-fade-in">
        {activeTab === 'company' && <CompanyTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'coa' && <COATab />}
      </div>
    </div>
  );
}
