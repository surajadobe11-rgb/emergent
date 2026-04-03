import { useState, useEffect } from 'react';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, X, Building2, Trash2, Edit2, Users, CheckCircle } from 'lucide-react';

const fmt = (n) => n?.toLocaleString('en-IN') || '0';

function ClientModal({ client, onClose, onSave }) {
  const isEdit = !!client?.id;
  const [form, setForm] = useState({
    name: client?.name || '',
    gst_number: client?.gst_number || '',
    address: client?.address || '',
    email: client?.email || '',
    phone: client?.phone || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Company name is required'); return; }
    setLoading(true);
    setError('');
    try {
      if (isEdit) {
        await api.put(`/clients/${client.id}`, form);
      } else {
        await api.post('/clients', form);
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save client');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-100" style={{ fontFamily: 'Work Sans, sans-serif' }}>
            {isEdit ? 'Edit Client' : 'New Client Profile'}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Company Name *</label>
            <input className="fin-input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Ratan Enterprises Pvt Ltd" data-testid="client-name-input" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">GSTIN (GST Number)</label>
            <input className="fin-input" value={form.gst_number} onChange={e => setForm(f => ({...f, gst_number: e.target.value}))} placeholder="e.g. 27AABCU9603R1ZX" data-testid="client-gst-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Email</label>
              <input className="fin-input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="accounts@company.com" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Phone</label>
              <input className="fin-input" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+91-80-12345678" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Address</label>
            <input className="fin-input" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="123, Business Park, Mumbai - 400001" />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 justify-center" data-testid="save-client-btn">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (isEdit ? 'Update Client' : 'Create Client')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Clients() {
  const { activeCompanyId, setActiveCompanyId } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [switched, setSwitched] = useState('');

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await api.get('/clients');
      setClients(res.data.clients || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/clients/${id}`);
      if (activeCompanyId === id) {
        const remaining = clients.find(c => c.id !== id);
        if (remaining) setActiveCompanyId(remaining.id, remaining.name);
      }
      fetchClients();
      setDeleteConfirm(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed');
    }
  };

  const handleSwitch = (client) => {
    setActiveCompanyId(client.id, client.name);
    setSwitched(client.id);
    setTimeout(() => setSwitched(''), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="clients-page">
      {(showModal || editClient) && (
        <ClientModal
          client={editClient}
          onClose={() => { setShowModal(false); setEditClient(null); }}
          onSave={fetchClients}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <h3 className="text-lg font-semibold text-slate-100 mb-3" style={{ fontFamily: 'Work Sans, sans-serif' }}>Delete Client?</h3>
            <p className="text-sm text-slate-400 mb-6">
              This will permanently delete <span className="text-slate-200 font-medium">{deleteConfirm.name}</span> and all associated data (transactions, journals, assets). This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors">
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Client Profiles</h1>
          <p className="text-sm text-slate-500 mt-0.5">{clients.length} client{clients.length !== 1 ? 's' : ''} · Admin managed</p>
        </div>
        <button onClick={() => { setEditClient(null); setShowModal(true); }} className="btn-primary" data-testid="new-client-btn">
          <Plus size={14} /> New Client
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {clients.map(client => (
            <div
              key={client.id}
              data-testid={`client-card-${client.id}`}
              className={`glass-card rounded-2xl p-5 transition-all ${client.id === activeCompanyId ? 'border border-indigo-500/40 bg-indigo-500/5' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-slate-100" style={{ fontFamily: 'Work Sans, sans-serif' }}>{client.name}</h3>
                    {client.id === activeCompanyId && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Active</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                    {client.gst_number && <span>GSTIN: <span className="text-slate-400 font-mono">{client.gst_number}</span></span>}
                    {client.email && <span>{client.email}</span>}
                    {client.phone && <span>{client.phone}</span>}
                  </div>
                  {client.address && <p className="text-xs text-slate-600 mt-1">{client.address}</p>}
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-6 text-center flex-shrink-0">
                  {[
                    { label: 'Transactions', value: fmt(client.transaction_count) },
                    { label: 'Journals', value: fmt(client.journal_count) },
                    { label: 'Assets', value: fmt(client.asset_count) },
                  ].map(stat => (
                    <div key={stat.label}>
                      <div className="text-lg font-bold text-slate-200 font-mono">{stat.value}</div>
                      <div className="text-xs text-slate-600">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                {client.id !== activeCompanyId ? (
                  <button
                    onClick={() => handleSwitch(client)}
                    className="btn-secondary text-xs py-1.5 px-3"
                    data-testid={`switch-to-${client.id}`}
                  >
                    {switched === client.id ? <><CheckCircle size={12} className="text-emerald-400" /> Switched!</> : 'Switch To'}
                  </button>
                ) : (
                  <span className="text-xs text-indigo-400 flex items-center gap-1.5">
                    <CheckCircle size={12} /> Currently Active
                  </span>
                )}
                <button
                  onClick={() => setEditClient(client)}
                  className="btn-ghost text-xs py-1.5 px-3"
                  data-testid={`edit-client-${client.id}`}
                >
                  <Edit2 size={12} /> Edit
                </button>
                {client.id !== 'acme-tech-001' && (
                  <button
                    onClick={() => setDeleteConfirm(client)}
                    className="btn-ghost text-xs py-1.5 px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    data-testid={`delete-client-${client.id}`}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}

          {clients.length === 0 && (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Users size={40} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 font-medium">No clients yet</p>
              <p className="text-slate-600 text-sm mt-1">Create your first client profile to get started</p>
              <button onClick={() => setShowModal(true)} className="btn-primary mt-6">
                <Plus size={14} /> Create First Client
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
