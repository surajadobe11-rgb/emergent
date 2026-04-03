import { useState, useEffect } from 'react';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, RefreshCw, X, Calculator } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

function AddAssetModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: '', description: '', purchase_date: new Date().toISOString().split('T')[0],
    purchase_cost: '', useful_life_years: '3', salvage_value: '0',
    depreciation_method: 'SLM', wdv_rate: '0.25'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name || !form.purchase_cost) { setError('Name and cost are required'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/assets', {
        ...form,
        purchase_cost: parseFloat(form.purchase_cost),
        useful_life_years: parseInt(form.useful_life_years),
        salvage_value: parseFloat(form.salvage_value || 0),
        wdv_rate: parseFloat(form.wdv_rate || 0.25),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add asset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-100" style={{ fontFamily: 'Work Sans, sans-serif' }}>Add Fixed Asset</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Asset Name</label>
            <input className="fin-input text-sm" placeholder="Dell XPS Laptop" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Description</label>
            <input className="fin-input text-sm" placeholder="Optional description..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Purchase Date</label>
              <input type="date" className="fin-input text-sm" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Purchase Cost (₹)</label>
              <input type="number" className="fin-input text-sm" placeholder="85000" value={form.purchase_cost} onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Useful Life (Years)</label>
              <input type="number" className="fin-input text-sm" value={form.useful_life_years} onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))} min="1" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Salvage Value (₹)</label>
              <input type="number" className="fin-input text-sm" value={form.salvage_value} onChange={e => setForm(f => ({ ...f, salvage_value: e.target.value }))} min="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Depreciation Method</label>
              <select className="fin-input text-sm" value={form.depreciation_method} onChange={e => setForm(f => ({ ...f, depreciation_method: e.target.value }))}>
                <option value="SLM">SLM (Straight Line)</option>
                <option value="WDV">WDV (Written Down Value)</option>
              </select>
            </div>
            {form.depreciation_method === 'WDV' && (
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">WDV Rate (e.g. 0.25 = 25%)</label>
                <input type="number" className="fin-input text-sm" value={form.wdv_rate} onChange={e => setForm(f => ({ ...f, wdv_rate: e.target.value }))} step="0.01" min="0" max="1" />
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 justify-center">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Add Asset'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Assets() {
  const { user } = useAuth();
  const canWrite = user?.role !== 'viewer';
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [depreciating, setDepreciating] = useState(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/assets');
      setAssets(res.data.assets || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAssets(); }, []);

  const handleDepreciate = async (id) => {
    setDepreciating(id);
    try {
      const res = await api.post(`/assets/${id}/depreciate`);
      alert(`✓ Depreciation calculated: Accumulated ₹${res.data.accumulated_depreciation.toLocaleString('en-IN')}`);
      fetchAssets();
    } finally {
      setDepreciating(null);
    }
  };

  const totalCost = assets.reduce((s, a) => s + (a.purchase_cost || 0), 0);
  const totalNBV = assets.reduce((s, a) => s + (a.net_book_value || 0), 0);
  const totalDep = assets.reduce((s, a) => s + (a.accumulated_depreciation || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="assets-page">
      {showAdd && <AddAssetModal onClose={() => setShowAdd(false)} onSuccess={fetchAssets} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Fixed Assets</h1>
          <p className="text-sm text-slate-500 mt-0.5">{assets.length} assets registered</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary" data-testid="add-asset-btn" style={{ display: canWrite ? '' : 'none' }}>
          <Plus size={14} /> Add Asset
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Asset Cost', value: fmt(totalCost), color: '#6366F1' },
          { label: 'Accumulated Depreciation', value: fmt(totalDep), color: '#F43F5E' },
          { label: 'Net Book Value', value: fmt(totalNBV), color: '#10B981' },
        ].map(s => (
          <div key={s.label} className="kpi-card">
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">{s.label}</div>
            <div className="text-xl font-bold tabular-nums" style={{ color: s.color, fontFamily: 'IBM Plex Mono' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Assets Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Asset Name</th>
                  <th>Purchase Date</th>
                  <th className="text-right">Cost</th>
                  <th>Method</th>
                  <th className="text-right">Accumulated Dep.</th>
                  <th className="text-right">Net Book Value</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => {
                  const depPercent = a.purchase_cost > 0 ? ((a.accumulated_depreciation / a.purchase_cost) * 100).toFixed(0) : 0;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontFamily: 'IBM Plex Sans' }} className="font-medium text-slate-200">{a.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{a.description}</div>
                      </td>
                      <td className="whitespace-nowrap">{new Date(a.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="text-right font-mono">{fmt(a.purchase_cost)}</td>
                      <td>
                        <span className="badge badge-indigo">{a.depreciation_method}</span>
                        {a.depreciation_method === 'WDV' && <div className="text-xs text-slate-500 mt-0.5">{(a.wdv_rate * 100).toFixed(0)}% pa</div>}
                        {a.depreciation_method === 'SLM' && <div className="text-xs text-slate-500 mt-0.5">{a.useful_life_years}yr life</div>}
                      </td>
                      <td className="text-right">
                        <span className="amount-debit font-mono">{fmt(a.accumulated_depreciation)}</span>
                        <div className="w-20 h-1.5 bg-slate-800 rounded-full ml-auto mt-1">
                          <div className="h-full rounded-full bg-rose-500/60" style={{ width: `${Math.min(depPercent, 100)}%` }} />
                        </div>
                      </td>
                      <td className="text-right">
                        <span className="amount-credit font-mono">{fmt(a.net_book_value)}</span>
                      </td>
                      <td><span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-muted'}`}>{a.status}</span></td>
                      <td>
                        <button
                          onClick={() => handleDepreciate(a.id)}
                          disabled={depreciating === a.id}
                          className="btn-ghost text-xs py-1 px-2"
                          data-testid={`depreciate-btn-${a.id}`}
                        >
                          {depreciating === a.id ? <RefreshCw size={12} className="animate-spin" /> : <Calculator size={12} />}
                          Depreciate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
