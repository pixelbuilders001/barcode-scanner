import React from 'react';
import { X, Share, Download, Smartphone, Check } from 'lucide-react';

interface PwaPromptProps {
  isOpen: boolean;
  onClose: () => void;
  isIos: boolean;
  onNativeInstall?: () => void;
}

export const PwaPrompt: React.FC<PwaPromptProps> = ({
  isOpen,
  onClose,
  isIos,
  onNativeInstall,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xs glass-panel rounded-3xl p-6 text-center space-y-4 shadow-2xl relative animate-scale-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto shadow-inner">
          {isIos ? <Share className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-white tracking-tight">
            Install POS Scanner
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Run as a native fullscreen app without address bar clutter.
          </p>
        </div>

        {/* Benefits */}
        <div className="rounded-2xl bg-slate-950/60 border border-white/[0.06] p-3 text-left space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Check className="w-3.5 h-3.5 text-emerald-400 flex-none" />
            <span>Fast launch directly from home screen</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Check className="w-3.5 h-3.5 text-emerald-400 flex-none" />
            <span>Fullscreen camera view without browser chrome</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Check className="w-3.5 h-3.5 text-emerald-400 flex-none" />
            <span>Works offline & saves battery</span>
          </div>
        </div>

        {isIos ? (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-left text-xs text-slate-300 space-y-2">
            <p className="font-semibold text-emerald-300">Quick 2-Step Setup:</p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
              <li>
                Tap Safari's <span className="font-bold text-white">Share button</span> (square with arrow).
              </li>
              <li>
                Scroll down and tap <span className="font-bold text-white">"Add to Home Screen"</span>.
              </li>
            </ol>
          </div>
        ) : (
          <button
            type="button"
            onClick={onNativeInstall}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-2xl text-xs shadow-lg shadow-emerald-950/40 hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Add to Home Screen</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white text-xs font-semibold transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
