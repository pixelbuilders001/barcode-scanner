import React, { useState } from 'react';
import {
  History,
  CheckCheck,
  AlertCircle,
  Copy,
  Check,
  Send,
  Trash2,
  ScanLine
} from 'lucide-react';

export interface ScanItem {
  id: string;
  barcode: string;
  timestamp: string;
  status: 'sent' | 'pending' | 'failed';
}

interface HistoryDrawerProps {
  scanHistory: ScanItem[];
  onResend: (barcode: string) => void;
  onClearHistory: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  scanHistory,
  onResend,
  onClearHistory,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950/60 rounded-3xl border border-white/[0.08] p-4 relative overflow-hidden backdrop-blur-xl max-w-md mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-2 flex-none select-none">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <History className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-semibold text-xs tracking-wide text-white uppercase">
              Scan Stream Log
            </h3>
            <p className="text-[10px] text-slate-400">
              Real-time feed piped to terminal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] text-slate-300 font-mono">
            {scanHistory.length} {scanHistory.length === 1 ? 'item' : 'items'}
          </span>
          {scanHistory.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Clear scan history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Items Scroll List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-0.5">
        {scanHistory.length > 0 ? (
          scanHistory.map((item, index) => (
            <div
              key={item.id}
              className="group flex items-center justify-between p-3 rounded-2xl bg-slate-900/70 border border-white/[0.06] hover:border-emerald-500/30 transition-all animate-fade-in"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {/* Barcode & Info */}
              <div className="min-w-0 pr-2">
                <p className="font-mono text-sm font-bold text-white tracking-wider truncate">
                  {item.barcode}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {item.timestamp}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                  {/* Status Indicator */}
                  {item.status === 'sent' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      <CheckCheck className="w-3 h-3 stroke-[2.5]" />
                      Synced
                    </span>
                  )}
                  {item.status === 'pending' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider animate-pulse">
                      <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
                      Sending
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                      <AlertCircle className="w-3 h-3" />
                      Failed
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Actions (Copy & Resend) */}
              <div className="flex items-center gap-1 flex-none">
                <button
                  type="button"
                  onClick={() => handleCopy(item.id, item.barcode)}
                  className="p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.08] transition-all active:scale-95"
                  title="Copy barcode"
                >
                  {copiedId === item.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onResend(item.barcode)}
                  className="p-1.5 rounded-xl bg-white/[0.03] hover:bg-emerald-500/15 text-slate-400 hover:text-emerald-400 border border-white/[0.08] hover:border-emerald-500/25 transition-all active:scale-95"
                  title="Resend to POS Cart (+1 qty)"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-slate-500 space-y-2.5">
            <div className="relative">
              <div className="w-12 h-12 bg-slate-900/80 rounded-2xl flex items-center justify-center text-slate-500 border border-white/[0.06] shadow-inner">
                <ScanLine className="w-6 h-6" />
              </div>
              <span className="absolute -inset-1 rounded-2xl bg-emerald-500/5 blur-md" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-300">Scanner Ready</p>
              <p className="text-[11px] text-slate-500 max-w-[200px] leading-relaxed">
                Scanned items will appear here and stream directly to your POS terminal.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
