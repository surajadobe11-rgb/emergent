import { useState, useEffect } from 'react';
import api from '@/services/api';
import { GitCompare, Check, Zap } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function Reconciliation() {
  const [data, setData] = useState({ bank_transactions: [], journal_entries: [] });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoMatching, setAutoMatching] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [selectedJournal, setSelectedJournal] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [unmatchedRes, summaryRes] = await Promise.all([
        api.get('/reconciliation/unmatched'),
        api.get('/reconciliation/summary'),
      ]);
      setData(unmatchedRes.data);
      setSummary(summaryRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const res = await api.post('/reconciliation/auto-match');
      alert(`✓ ${res.data.message}`);
      fetchData();
    } finally {
      setAutoMatching(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedTxn || !selectedJournal) return;
    setConfirming(selectedTxn);
    try {
      await api.post('/reconciliation/confirm', { transaction_id: selectedTxn, journal_id: selectedJournal });
      setSelectedTxn(null);
      setSelectedJournal(null);
      fetchData();
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="reconciliation-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Bank Reconciliation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Match bank transactions against book entries</p>
        </div>
        <button onClick={handleAutoMatch} disabled={autoMatching} className="btn-primary" data-testid="auto-match-btn">
          <Zap size={14} /> {autoMatching ? 'Matching...' : 'Auto Match'}
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Transactions', value: summary.total_transactions, color: '#6366F1' },
            { label: 'Reconciled', value: summary.reconciled, color: '#10B981' },
            { label: 'Unreconciled', value: summary.unreconciled, color: '#F59E0B' },
            { label: 'Reconciliation Rate', value: `${summary.reconciliation_rate}%`, color: '#6366F1' },
          ].map(s => (
            <div key={s.label} className="kpi-card">
              <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">{s.label}</div>
              <div className="text-xl font-bold tabular-nums" style={{ color: s.color, fontFamily: 'IBM Plex Mono' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Match button */}
      {selectedTxn && selectedJournal && (
        <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <GitCompare size={16} className="text-indigo-400" />
          <span className="text-sm text-indigo-300 flex-1">Transaction and journal entry selected. Confirm the match?</span>
          <button onClick={handleConfirm} disabled={!!confirming} className="btn-primary text-xs py-2" data-testid="confirm-match-btn">
            <Check size={13} /> Confirm Match
          </button>
          <button onClick={() => { setSelectedTxn(null); setSelectedJournal(null); }} className="btn-ghost text-xs py-2">Clear</button>
        </div>
      )}

      {/* Two-panel layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bank Transactions */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: 'Work Sans, sans-serif' }}>Bank Transactions</h3>
            <p className="text-xs text-slate-500 mt-0.5">Click to select for matching</p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : data.bank_transactions.length === 0 ? (
              <div className="text-center text-slate-500 py-10 text-sm" style={{ fontFamily: 'IBM Plex Sans' }}>All transactions reconciled!</div>
            ) : (
              data.bank_transactions.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTxn(selectedTxn === t.id ? null : t.id)}
                  className={`px-5 py-3.5 border-b border-white/5 cursor-pointer transition-all ${selectedTxn === t.id ? 'bg-indigo-500/15 border-indigo-500/20' : 'hover:bg-slate-800/30'}`}
                  data-testid={`bank-txn-${t.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{new Date(t.date).toLocaleDateString('en-IN')}</span>
                    <span className={`text-sm font-mono font-semibold ${t.type === 'credit' ? 'amount-credit' : 'amount-debit'}`}>
                      {t.type === 'credit' ? '+' : '-'}{fmt(t.amount)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate" style={{ fontFamily: 'IBM Plex Sans' }}>{t.narration}</p>
                  {selectedTxn === t.id && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-indigo-400">
                      <Check size={11} /> Selected
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Journal Entries */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-slate-200" style={{ fontFamily: 'Work Sans, sans-serif' }}>Journal Entries</h3>
            <p className="text-xs text-slate-500 mt-0.5">Click to select for matching</p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
            {data.journal_entries.length === 0 ? (
              <div className="text-center text-slate-500 py-10 text-sm">No journal entries</div>
            ) : (
              data.journal_entries.map(j => (
                <div
                  key={j.id}
                  onClick={() => setSelectedJournal(selectedJournal === j.id ? null : j.id)}
                  className={`px-5 py-3.5 border-b border-white/5 cursor-pointer transition-all ${selectedJournal === j.id ? 'bg-emerald-500/10 border-emerald-500/20' : 'hover:bg-slate-800/30'}`}
                  data-testid={`journal-${j.id}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{new Date(j.date).toLocaleDateString('en-IN')} · {j.reference}</span>
                    <span className="text-sm font-mono font-semibold text-slate-200">{fmt(j.total_debit)}</span>
                  </div>
                  <p className="text-xs text-slate-300 truncate" style={{ fontFamily: 'IBM Plex Sans' }}>{j.description}</p>
                  {selectedJournal === j.id && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
                      <Check size={11} /> Selected
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
