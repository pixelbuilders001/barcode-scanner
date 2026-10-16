import React, { useState } from 'react';
import { X, Keyboard, Send, ShieldCheck } from 'lucide-react';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitBarcode: (barcode: string) => void;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  isOpen,
  onClose,
  onSubmitBarcode,
}) => {
  const [value, setValue] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) {
      onSubmitBarcode(trimmed);
      setValue('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-6 space-y-5 relative shadow-2xl animate-scale-in">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Keyboard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Manual Barcode Entry
            </h3>
            <p className="text-[11px] text-slate-400">
              Type damaged or unreadable tag numbers
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              autoFocus
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 890103038372"
              className="w-full bg-slate-950/90 border border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 text-center font-mono text-xl font-bold tracking-wider text-white placeholder-slate-600 transition-all outline-none shadow-inner"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-semibold text-xs border border-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/40 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send to Cart</span>
            </button>
          </div>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
          <ShieldCheck className="w-3 h-3 text-emerald-500/60" />
          <span>Directly broadcasts to current POS session channel</span>
        </div>
      </div>
    </div>
  );
};
