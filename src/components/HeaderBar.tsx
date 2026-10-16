import React from 'react';
import {
  WifiOff,
  RotateCw,
  LogOut,
  Volume2,
  VolumeX,
  Radio,
  Download
} from 'lucide-react';
import { clsx } from 'clsx';

interface HeaderBarProps {
  isSessionSet: boolean;
  sessionId: string;
  connectionStatus: 'offline' | 'connecting' | 'live';
  isMuted: boolean;
  onToggleMute: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  isAppInstalled: boolean;
  onInstallPwa: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  isSessionSet,
  sessionId,
  connectionStatus,
  isMuted,
  onToggleMute,
  onReconnect,
  onDisconnect,
  isAppInstalled,
  onInstallPwa,
}) => {
  return (
    <header className="relative z-30 flex-none safe-top px-4 py-2.5 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
      <div className="flex items-center justify-between max-w-lg mx-auto w-full gap-2">
        {/* Brand / Session Identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex-none">
            <div className="w-8 h-8 rounded-xl bg-slate-900 border border-white/10 p-1 flex items-center justify-center shadow-inner overflow-hidden">
              <img
                src="/applogo.png"
                alt="POS Scanner"
                className="w-full h-full object-contain"
              />
            </div>
            {isSessionSet && connectionStatus === 'live' && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-slate-950" />
              </span>
            )}
          </div>

          {!isSessionSet ? (
            <h1 className="text-sm font-bold text-white tracking-tight leading-none">
              POS Scanner
            </h1>
          ) : (
            <div className="flex items-center gap-1.5">
              <div
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold tracking-wider border backdrop-blur-md transition-colors',
                  connectionStatus === 'live' &&
                    'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
                  connectionStatus === 'connecting' &&
                    'bg-amber-500/10 border-amber-500/30 text-amber-300',
                  connectionStatus === 'offline' &&
                    'bg-rose-500/10 border-rose-500/30 text-rose-300'
                )}
              >
                {connectionStatus === 'live' && <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />}
                {connectionStatus === 'connecting' && (
                  <div className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                )}
                {connectionStatus === 'offline' && <WifiOff className="w-3 h-3 text-rose-400" />}
                <span>POS-{sessionId}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-none">
          {/* Download / Install App icon */}
          {!isAppInstalled && (
            <button
              onClick={onInstallPwa}
              type="button"
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-emerald-500/15 text-slate-300 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30 transition-all active:scale-95 shadow-sm"
              title="Install App"
              aria-label="Install App"
            >
              <Download className="w-4 h-4 text-emerald-400" />
            </button>
          )}

          {/* Audio Beep Mute Toggle */}
          <button
            onClick={onToggleMute}
            type="button"
            className={clsx(
              'p-2 rounded-xl border transition-all active:scale-95',
              isMuted
                ? 'bg-white/[0.03] border-white/10 text-slate-500 hover:text-slate-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
            )}
            title={isMuted ? 'Unmute scanner beep' : 'Mute scanner beep'}
            aria-label="Toggle Sound"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Reconnect / Disconnect controls when connected */}
          {isSessionSet && (
            <>
              {connectionStatus !== 'live' && (
                <button
                  onClick={onReconnect}
                  type="button"
                  className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 transition-all active:scale-95"
                  title="Reconnect to terminal"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onDisconnect}
                type="button"
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 transition-all active:scale-95"
                title="Disconnect from POS"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
