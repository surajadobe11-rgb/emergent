import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import { Upload, Zap, Search, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

function UploadModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);   // { headers, detected_columns, preview_rows, total_rows }
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFileSelect = async (selected) => {
    setFile(selected);
    setPreview(null);
    setError('');
    if (!selected) return;
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append('file', selected);
      const res = await api.post('/transactions/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not preview file');
    } finally {
      setPreviewing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/transactions/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const ColTag = ({ label, value }) => value ? (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
      <span className="text-slate-500">{label}:</span>
      <span className="text-indigo-300 font-medium">{value}</span>
    </div>
  ) : null;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 580 }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-100" style={{ fontFamily: 'Work Sans, sans-serif' }}>Upload Bank Statement</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        {result ? (
          /* ── Success State ── */
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap size={24} color="#10B981" />
            </div>
            <p className="text-emerald-400 font-semibold text-lg mb-1">{result.count} transactions imported!</p>
            <div className="flex justify-center gap-4 mt-3 mb-5 text-sm">
              <span className="text-emerald-400"><span className="font-mono font-bold">{result.classified}</span> auto-classified</span>
              {result.unclassified > 0 && <span className="text-amber-400"><span className="font-mono font-bold">{result.unclassified}</span> need review</span>}
              {result.skipped > 0 && <span className="text-slate-500"><span className="font-mono font-bold">{result.skipped}</span> skipped</span>}
            </div>
            {/* Show what columns were detected */}
            <div className="text-left bg-slate-900/50 rounded-xl p-4 mb-5 text-xs space-y-1">
              <p className="text-slate-500 mb-2 font-medium">Columns auto-detected from your file:</p>
              {Object.entries(result.detected_columns || {}).filter(([, v]) => v && v !== 'not detected').map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-slate-400">
                  <span className="w-16 text-slate-600 capitalize">{k}:</span>
                  <span className="text-indigo-300">" {v} "</span>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="btn-primary">Done</button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-4">
              Upload any bank statement — columns are <span className="text-indigo-300 font-medium">auto-detected</span>. 
              Supports HDFC, ICICI, SBI, Axis, Kotak and any CSV / Excel / <span className="text-indigo-300 font-medium">PDF</span> format.
            </p>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all mb-4 ${file ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-700 hover:border-indigo-500/40'}`}
              onClick={() => document.getElementById('csv-upload').click()}
            >
              <Upload size={28} className={`mx-auto mb-2 ${file ? 'text-indigo-400' : 'text-slate-500'}`} />
              <p className="text-slate-400 text-sm font-medium">
                {file ? file.name : 'Click to select or drag & drop'}
              </p>
              <p className="text-slate-600 text-xs mt-1">Supports .csv, .xlsx and .pdf — any bank format</p>
            </div>
            <input id="csv-upload" type="file" accept=".csv,.xlsx,.xls,.txt,.pdf" className="hidden"
              onChange={e => handleFileSelect(e.target.files[0])} />

            {/* Preview / Column detection */}
            {previewing && (
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Analysing file structure...
              </div>
            )}

            {preview && !previewing && (
              <div className="mb-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Auto-detected columns</p>
                  <div className="flex flex-wrap gap-2">
                    <ColTag label="Date"     value={preview.detected_columns.date} />
                    <ColTag label="Narration" value={preview.detected_columns.narration} />
                    <ColTag label="Debit"    value={preview.detected_columns.debit} />
                    <ColTag label="Credit"   value={preview.detected_columns.credit} />
                    <ColTag label="Amount"   value={preview.detected_columns.amount} />
                    <ColTag label="Type"     value={preview.detected_columns.type} />
                  </div>
                  {!preview.detected_columns.date && !preview.detected_columns.narration && (
                    <p className="text-amber-400 text-xs mt-2">
                      Columns not fully detected — the import will still attempt to process your file.
                    </p>
                  )}
                </div>

                {/* Preview rows */}
                {preview.preview_rows?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
                      Preview ({preview.total_rows} total rows)
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-white/8" style={{ maxHeight: 160 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', fontFamily: 'IBM Plex Mono' }}>
                        <thead>
                          <tr style={{ background: 'rgba(30,41,59,0.8)' }}>
                            {preview.headers.map(h => (
                              <th key={h} style={{ padding: '6px 10px', color: '#6366F1', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.preview_rows.map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              {preview.headers.map(h => (
                                <td key={h} style={{ padding: '5px 10px', color: '#94A3B8', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {String(row[h] || '').slice(0, 40)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={handleUpload}
                disabled={!file || loading || previewing}
                className="btn-primary flex-1 justify-center"
                data-testid="upload-confirm-btn"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Upload size={14} /> Import & Auto-Classify</>
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ClassifyModal({ txn, categories, onClose, onSuccess }) {
  const [form, setForm] = useState({ category: txn.category || '', account_code: txn.account_code || '', account_name: txn.account_name || '' });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.patch(`/transactions/${txn.id}/classify`, form);
      onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const COA_OPTIONS = [
    { code: '4010', name: 'Sales Revenue', category: 'Sales Revenue' },
    { code: '4020', name: 'Service Revenue', category: 'Service Revenue' },
    { code: '4030', name: 'Other Income', category: 'Other Income' },
    { code: '5010', name: 'Salary Expense', category: 'Salary Expense' },
    { code: '5020', name: 'Rent Expense', category: 'Rent Expense' },
    { code: '5030', name: 'Utilities', category: 'Utilities' },
    { code: '5040', name: 'Bank Charges', category: 'Bank Charges' },
    { code: '5050', name: 'Office Supplies', category: 'Office Supplies' },
    { code: '5060', name: 'GST/Tax Payment', category: 'GST/Tax Payment' },
    { code: '5070', name: 'Miscellaneous Expense', category: 'Miscellaneous' },
    { code: '1100', name: 'Fixed Assets', category: 'Asset Purchase' },
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-100" style={{ fontFamily: 'Work Sans, sans-serif' }}>Classify Transaction</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>
        <p className="text-sm text-slate-400 mb-6 truncate">{txn.narration}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Account / Category</label>
            <select
              className="fin-input"
              value={form.account_code}
              onChange={e => {
                const opt = COA_OPTIONS.find(o => o.code === e.target.value);
                if (opt) setForm({ account_code: opt.code, account_name: opt.name, category: opt.category });
              }}
            >
              <option value="">Select account...</option>
              {COA_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.code} — {o.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={!form.account_code || loading} className="btn-primary flex-1 justify-center">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Classification'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Transactions() {
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [classifyTxn, setClassifyTxn] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/transactions', { params });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAIClassify = async () => {
    setClassifying(true);
    try {
      const res = await api.post('/transactions/ai-classify-all');
      alert(`✓ AI classified ${res.data.count} transactions`);
      fetchData();
    } finally {
      setClassifying(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="transactions-page">
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={fetchData} />}
      {classifyTxn && <ClassifyModal txn={classifyTxn} onClose={() => setClassifyTxn(null)} onSuccess={fetchData} />}

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="page-header">Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data.total} total transactions</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleAIClassify} disabled={classifying} className="btn-secondary" data-testid="ai-classify-btn">
            <Zap size={14} />
            {classifying ? 'Classifying...' : 'AI Classify All'}
          </button>
          <button onClick={() => setShowUpload(true)} className="btn-primary" data-testid="upload-csv-btn">
            <Upload size={14} />
            Upload CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            className="fin-input pl-9 text-sm"
            placeholder="Search narration..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            data-testid="search-input"
          />
        </div>
        <select className="fin-input text-sm w-36" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="credit">Credit</option>
          <option value="debit">Debit</option>
        </select>
        <select className="fin-input text-sm w-40" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="classified">Classified</option>
          <option value="unclassified">Unclassified</option>
        </select>
        {(search || typeFilter || statusFilter) && (
          <button className="btn-ghost text-xs" onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setPage(1); }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Narration</th>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                  <th>Type</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(t => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">{new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                    <td style={{ fontFamily: 'IBM Plex Sans, sans-serif', maxWidth: 220 }} className="truncate">{t.narration}</td>
                    <td><span className="badge badge-indigo">{t.category || '—'}</span></td>
                    <td className={`text-right font-mono ${t.type === 'credit' ? 'amount-credit' : 'amount-debit'}`}>
                      {t.type === 'credit' ? '+' : '-'}{fmt(t.amount)}
                    </td>
                    <td><span className={`badge ${t.type === 'credit' ? 'badge-success' : 'badge-danger'}`}>{t.type}</span></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(t.confidence || 0) * 100}%`, background: t.confidence > 0.8 ? '#10B981' : t.confidence > 0.5 ? '#F59E0B' : '#F43F5E' }} />
                        </div>
                        <span className="text-xs text-slate-500">{Math.round((t.confidence || 0) * 100)}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${t.status === 'classified' ? 'badge-success' : 'badge-warning'}`}>
                        {t.is_ai_classified && t.status === 'classified' ? 'AI ✓' : t.status}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => setClassifyTxn(t)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        data-testid={`classify-btn-${t.id}`}
                      >
                        Classify
                      </button>
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-slate-500 py-10" style={{ fontFamily: 'IBM Plex Sans' }}>No transactions found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
            <span className="text-xs text-slate-500">Page {page} of {data.pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-40">
                <ChevronLeft size={14} /> Prev
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === data.pages} className="btn-ghost text-xs py-1.5 px-3 disabled:opacity-40">
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
