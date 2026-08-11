'use client';

import { useState, useEffect } from 'react';
import { FileText, Loader2 } from 'lucide-react';

interface Report {
  id: string;
  title: string;
  type: string;
  created_at: string;
  content?: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState('executive');

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();
      setReports(data.data || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const generateReport = async () => {
    setGenerating(true);
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType }),
      });
      fetchReports();
    } catch {
    } finally {
      setGenerating(false);
    }
  };

  const reportTypes = [
    { id: 'executive', label: 'Executive Summary' },
    { id: 'pipeline', label: 'Pipeline Report' },
    { id: 'research', label: 'Research Report' },
    { id: 'performance', label: 'Performance Report' },
  ];

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-white tracking-tight">Reports</h1>
        <p className="text-[13px] text-[hsl(215,20%,50%)] mt-0.5">AI-generated insights and analytics</p>
      </div>

      {/* Generate */}
      <div className="glass-card rounded-xl p-4 flex items-center gap-3">
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[12px] text-white focus:outline-none appearance-none cursor-pointer"
        >
          {reportTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          onClick={generateReport}
          disabled={generating}
          className="flex items-center gap-1.5 px-4 h-9 bg-blue-600 hover:bg-blue-500 disabled:bg-[hsl(223,47%,11%)] disabled:text-[hsl(215,16%,35%)] text-white rounded-lg text-[12px] font-medium transition-all"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
          Generate Report
        </button>
      </div>

      {/* Reports list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
      ) : reports.length > 0 ? (
        <div className="space-y-2">
          {reports.map((r, i) => (
            <div
              key={r.id}
              className="glass-card rounded-xl p-4 flex items-center justify-between animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-white">{r.title}</p>
                  <p className="text-[11px] text-[hsl(215,16%,45%)]">
                    {r.type} · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/[0.06] text-[hsl(215,16%,50%)]">
                  {r.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="w-10 h-10 text-[hsl(215,16%,25%)] mb-3" />
          <p className="text-[14px] text-[hsl(215,16%,40%)]">No reports yet</p>
          <p className="text-[12px] text-[hsl(215,16%,30%)] mt-1">Generate your first report to get started</p>
        </div>
      )}
    </div>
  );
}
