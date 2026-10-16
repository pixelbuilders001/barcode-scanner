import React from 'react';
import {
  QrCode,
  Keyboard,
  Link,
  AlertCircle,
  RotateCw,
  Store,
  KeyRound,
  ScanBarcode,
  ShieldCheck,
  Zap,
  Clock
} from 'lucide-react';
import { clsx } from 'clsx';

interface ConnectViewProps {
  sessionId: string;
  onSessionInputChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isQrScannerActive: boolean;
  setIsQrScannerActive: (val: boolean) => void;
  qrVideoRef: React.RefObject<HTMLVideoElement | null>;
  qrError: string;
  onRetryQr: () => void;
  recentSessions: string[];
  onSelectRecentSession: (id: string) => void;
}

export const ConnectView: React.FC<ConnectViewProps> = ({
  sessionId,
  onSessionInputChange,
  onSubmit,
  isQrScannerActive,
  setIsQrScannerActive,
  qrVideoRef,
  qrError,
  onRetryQr,
  recentSessions,
  onSelectRecentSession,
}) => {
  const isValidSession = sessionId.trim().length >= 3 && sessionId.trim() !== 'S-';

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 sm:p-6 max-w-md mx-auto w-full animate-fade-in safe-bottom">
      {/* Top Card: Connection Hub */}
      <div className="w-full glass-panel rounded-3xl p-6 sm:p-7 space-y-6 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl" />

        {/* Title & subtitle */}
        <div className="text-center space-y-2 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Instant Register Sync</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Connect to Sales Desk
          </h2>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Pair this mobile device with your POS checkout terminal to stream barcode scans instantly.
          </p>
        </div>

        {/* Dual Mode Segmented Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-950/70 border border-white/10 relative">
          <button
            type="button"
            onClick={() => setIsQrScannerActive(true)}
            className={clsx(
              'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all',
              isQrScannerActive
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <QrCode className="w-4 h-4" />
            <span>Scan Screen QR</span>
          </button>
          <button
            type="button"
            onClick={() => setIsQrScannerActive(false)}
            className={clsx(
              'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all',
              !isQrScannerActive
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            )}
          >
            <Keyboard className="w-4 h-4" />
            <span>Enter Code</span>
          </button>
        </div>

        {/* Mode Content */}
        {isQrScannerActive ? (
          <div className="space-y-4">
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/10 bg-slate-950 shadow-inner">
              {qrError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-xs">{qrError}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Check camera permissions or switch to manual code entry.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onRetryQr}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                </div>
              ) : (
                <>
                  <video
                    ref={qrVideoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  {/* Viewfinder Reticle Target */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
                    <div className="relative w-full h-full max-w-[240px] max-h-[240px] border border-emerald-500/30 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                      {/* Corner Accents */}
                      <div className="absolute -top-[2px] -left-[2px] w-5 h-5 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-lg" />
                      <div className="absolute -top-[2px] -right-[2px] w-5 h-5 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-lg" />
                      <div className="absolute -bottom-[2px] -left-[2px] w-5 h-5 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-lg" />
                      <div className="absolute -bottom-[2px] -right-[2px] w-5 h-5 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-lg" />

                      {/* Animated Laser Scanning Sweep */}
                      <div className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-scanner-laser" />
                    </div>
                  </div>
                  <div className="absolute bottom-3 inset-x-3 text-center pointer-events-none">
                    <span className="px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] text-slate-300 font-medium">
                      Align terminal QR code inside frame
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="sessionId"
                className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center"
              >
                Terminal Session Code
              </label>
              <div className="relative">
                <input
                  id="sessionId"
                  type="text"
                  required
                  maxLength={7}
                  value={sessionId}
                  onChange={(e) => onSessionInputChange(e.target.value)}
                  placeholder="S-9A2"
                  className="w-full bg-slate-950/90 border border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-4 text-center font-mono text-3xl font-extrabold tracking-[0.25em] text-white uppercase placeholder-slate-600 transition-all shadow-inner outline-none"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-500 text-center">
                Found in the top-right corner of your POS desktop screen.
              </p>
            </div>

            {/* Quick Session Reconnect Chips */}
            {recentSessions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-semibold">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    Recent Terminals
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSessions.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => onSelectRecentSession(code)}
                      className="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-300 text-xs font-mono font-bold transition-all active:scale-95"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!isValidSession}
              className={clsx(
                'group w-full py-4 rounded-2xl font-bold text-sm transition-all focus:outline-none flex items-center justify-center gap-2 active:scale-[0.98]',
                isValidSession
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-950/50 hover:shadow-emerald-500/25'
                  : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/10'
              )}
            >
              <Link className="w-4 h-4 transition-transform group-hover:rotate-12" />
              <span>Connect Terminal</span>
            </button>
          </form>
        )}
      </div>

      {/* How It Works Guide */}
      <div className="w-full mt-6 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Setup Workflow
          </span>
        </div>

        <div className="rounded-2xl glass-card p-4 space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-none mt-0.5">
              <Store className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">1. POS Checkout Screen</p>
              <p className="text-[11px] text-slate-400 leading-snug">
                Locate the session badge or QR code on your sales desk terminal.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-none mt-0.5">
              <KeyRound className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">2. Link Device</p>
              <p className="text-[11px] text-slate-400 leading-snug">
                Scan the QR code or enter code above for automatic real-time handshaking.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-none mt-0.5">
              <ScanBarcode className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">3. Stream Barcodes</p>
              <p className="text-[11px] text-slate-400 leading-snug">
                Scan product tags continuously. Items populate the cart in &lt;100ms.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70" />
          <span>Encrypted broadcast stream • Instant checkout sync</span>
        </div>
      </div>
    </div>
  );
};
