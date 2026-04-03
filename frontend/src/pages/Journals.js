import { useState, useEffect } from 'react';
import api from '@/services/api';
import { Plus, X, Check } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const ACCOUNTS = [
  { code: '1010', name: 'Cash & Bank' }, { code: '1020', name: 'Accounts Receivable' },
  { code: '1100', name: 'Fixed Assets' }, { code: '2010', name: 'Accounts Payable' },
  { code: '2020', name: 'GST Payable' }, { code: '3010', name: "Owner's Equity" },
  { code: '4010', name: 'Sales Revenue' }, { code: '4020', name: 'Service Revenue' },
  { code: '4030', name: 'Other Income' }, { code: '5010', name: 'Salary Expense' },
  { code: '5020', name: 'Rent Expense' }, { code: '5030', name: 'Utilities' },
  { code: '5040', name: 'Bank Charges' }, { code: '5050', name: 'Office Supplies' },
  { code: '5060', name: 'GST/Tax Expense' }, { code: '5070', name: 'Misc Expense' },
];

function CreateJournalModal({ onClose, onSuccess }) {
  const emptyLine = { account_code: '', account_name: '', debit: '', credit: '', description: '' };
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', reference: '' });
  const [lines, setLines] = useState([{ ...emptyLine }, { ...emptyLine }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const updateLine = (idx, field, value) => {
    setLines(ls => ls.map((l, i) => i === idx ? { ...l, [field]: value } : l));
    if (field === 'account_code') {
      const acc = ACCOUNTS.find(a => a.code === value);
      if (acc) setLines(ls => ls.map((l, i) => i === idx ? { ...l, account_code: value, account_name: acc.name } : l));
    }
  };

  const handleSubmit = async () => {
    if (!form.description || !form.date) { setError('Date and description are required'); return; }
    if (!isBalanced) { setError('Journal must be balanced (Debits = Credits)'); return; }
    const validLines = lines.filter(l => l.account_code && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) { setError('At least 2 lines required'); return; }

    setLoading(true);
    setError('');
    try {
      await api.post('/journals', {
        ...form,
        lines: validLines.map(l => ({ ...l, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0 })),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create journal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 680 }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-100" style={{ fontFamily: 'Work Sans, sans-serif' }}>New Journal Entry</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Date</label>
            <input type="date" className="fin-input text-sm" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-400 mb-1.5 block">Description</label>
            <input type="text" className="fin-input text-sm" placeholder="Journal description..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        <div className="mb-5">
          <label className="text-xs text-slate-400 mb-1.5 block">Reference</label>
          <input type="text" className="fin-input text-sm" placeholder="JE-001" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
        </div>

        {/* Lines */}
        <div className="space-y-2 mb-3">
          <div className="grid gap-2 text-xs text-slate-500 pb-1" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto' }}>
            <span>Account</span><span>Debit (₹)</span><span>Credit (₹)</span><span>Note</span><span></span>
          </div>
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 items-center" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto' }}>
              <select className="fin-input text-xs py-2" value={line.account_code} onChange={e => updateLine(idx, 'account_code', e.target.value)}>
                <option value="">Select account...</option>
                {ACCOUNTS.map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
              </select>
              <input type="number" className="fin-input text-xs py-2" placeholder="0.00" value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)} min="0" />
              <input type="number" className="fin-input text-xs py-2" placeholder="0.00" value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)} min="0" />
              <input type="text" className="fin-input text-xs py-2" placeholder="Note..." value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
              <button onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))} disabled={lines.length <= 2} className="text-slate-600 hover:text-red-400 disabled:opacity-30 transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <button onClick={() => setLines(ls => [...ls, { ...emptyLine }])} className="btn-ghost text-xs mb-5">
          <Plus size={13} /> Add Line
        </button>

        {/* Balance indicator */}
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg mb-5 text-sm ${isBalanced ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
          <span className={isBalanced ? 'text-emerald-400' : 'text-red-400'}>
            {isBalanced ? <Check size={14} className="inline mr-1" /> : '✗'} {isBalanced ? 'Balanced' : 'Not balanced'}
          </span>
          <div className="flex gap-4 text-xs font-mono">
            <span className="text-slate-400">DR: <span className="text-slate-200">{fmt(totalDebit)}</span></span>
            <span className="text-slate-400">CR: <span className="text-slate-200">{fmt(totalCredit)}</span></span>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !isBalanced} className="btn-primary flex-1 justify-center">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Post Journal Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Journals() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/journals', { params: { page, limit: 20 } });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page]);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="journals-page">
      {showCreate && <CreateJournalModal onClose={() => setShowCreate(false)} onSuccess={fetchData} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Journal Entries</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data.total} entries — Double-entry bookkeeping</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary" data-testid="create-journal-btn">
          <Plus size={14} /> New Entry
        </button>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th>Status</th>
                <th>Lines</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(j => (
                <>
                  <tr key={j.id} className="cursor-pointer" onClick={() => setExpanded(expanded === j.id ? null : j.id)}>
                    <td className="whitespace-nowrap">{new Date(j.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                    <td className="font-mono text-indigo-300 text-xs">{j.reference || '—'}</td>
                    <td style={{ fontFamily: 'IBM Plex Sans' }}>{j.description}</td>
                    <td className="text-right amount-debit">{fmt(j.total_debit)}</td>
                    <td className="text-right amount-credit">{fmt(j.total_credit)}</td>
                    <td><span className="badge badge-success">{j.status}</span></td>
                    <td className="text-slate-500 text-xs">{j.lines?.length || 0} lines</td>
                  </tr>
                  {expanded === j.id && (
                    <tr key={`${j.id}-lines`}>
                      <td colSpan={7} style={{ background: 'rgba(15,23,42,0.6)', padding: 0 }}>
                        <div className="px-6 py-4">
                          <table className="w-full text-xs" style={{ fontFamily: 'IBM Plex Mono' }}>
                            <thead>
                              <tr className="text-slate-500">
                                <th className="text-left pb-2 font-medium">Account</th>
                                <th className="text-right pb-2 font-medium">Debit</th>
                                <th className="text-right pb-2 font-medium">Credit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(j.lines || []).map((l, i) => (
                                <tr key={i} className="border-t border-white/5">
                                  <td className="py-1.5 text-slate-300">{l.account_code} — {l.account_name}</td>
                                  <td className="text-right py-1.5 amount-debit">{l.debit > 0 ? fmt(l.debit) : '—'}</td>
                                  <td className="text-right py-1.5 amount-credit">{l.credit > 0 ? fmt(l.credit) : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
