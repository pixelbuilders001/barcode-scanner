import React from 'react';
import {
  Camera,
  SwitchCamera,
  Zap,
  Square,
  Play,
  Check,
  Keyboard,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';

interface ScannerViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraActive: boolean;
  setIsCameraActive: (val: boolean) => void;
  cameraError: string;
  onRetryCamera: () => void;
  videoDevices: MediaDeviceInfo[];
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  onFlipCamera: () => void;
  isTorchSupported: boolean;
  isFlashOn: boolean;
  onToggleFlash: () => void;
  cooldown: boolean;
  lastScanned: string | null;
  sessionId: string;
  connectionStatus: 'offline' | 'connecting' | 'live';
  onOpenManualEntry: () => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  videoRef,
  isCameraActive,
  setIsCameraActive,
  cameraError,
  onRetryCamera,
  videoDevices,
  selectedDeviceId,
  onSelectDevice,
  onFlipCamera,
  isTorchSupported,
  isFlashOn,
  onToggleFlash,
  cooldown,
  lastScanned,
  sessionId,
  connectionStatus,
  onOpenManualEntry,
}) => {
  return (
    <div className="flex-none flex flex-col gap-3 w-full max-w-md mx-auto animate-fade-in">
      {/* Viewfinder Frame */}
      <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden glass-panel border border-white/10 shadow-2xl bg-black">
        {isCameraActive && !cameraError ? (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Precision Reticle Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
              <div className="relative w-full max-w-[280px] h-3/4 border border-emerald-500/25 rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.08)] animate-reticle-pulse">
                {/* Precision Corner Brackets */}
                <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-lg shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-lg shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-lg shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-lg shadow-[0_0_8px_rgba(16,185,129,0.5)]" />

                {/* Sweeping Laser Beam */}
                <div className="absolute w-full h-[3px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.85)] animate-scanner-laser" />

                {/* Subtle Centering Pip */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
              </div>
            </div>

            {/* Top Viewport Floating Badges */}
            <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
              {/* POS Session ID Chip */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] text-slate-300 font-mono font-bold select-none">
                <span
                  className={clsx(
                    'w-1.5 h-1.5 rounded-full',
                    connectionStatus === 'live' && 'bg-emerald-400 animate-pulse',
                    connectionStatus === 'connecting' && 'bg-amber-400',
                    connectionStatus === 'offline' && 'bg-rose-400'
                  )}
                />
                <span>POS-{sessionId}</span>
              </div>

              {/* Torch Status Pip */}
              {isFlashOn && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/20 backdrop-blur-md border border-amber-500/40 text-amber-300 text-[10px] font-bold select-none animate-pulse">
                  <Zap className="w-3 h-3 fill-current" />
                  <span>TORCH ON</span>
                </div>
              )}
            </div>

            {/* Scan Confirmation HUD Pop */}
            {cooldown && lastScanned && (
              <div className="absolute inset-x-4 bottom-3 flex justify-center pointer-events-none animate-scale-in">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold shadow-xl shadow-emerald-950/70 border border-emerald-300">
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>
                    Sent: <strong className="font-mono tracking-wider">{lastScanned}</strong>
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none text-slate-400 space-y-3">
            <div className="w-12 h-12 bg-slate-900/90 border border-white/10 rounded-2xl flex items-center justify-center text-slate-500 shadow-inner">
              {cameraError ? <AlertCircle className="w-6 h-6 text-rose-400" /> : <WifiOff className="w-6 h-6" />}
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-white text-sm">
                {cameraError ? 'Camera Error' : 'Camera Feed Paused'}
              </p>
              <p className="text-[11px] text-slate-400 max-w-[220px] leading-relaxed">
                {cameraError || 'Camera feed is paused. Resume to continue scanning products.'}
              </p>
            </div>
            <button
              type="button"
              onClick={cameraError ? onRetryCamera : () => setIsCameraActive(true)}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-950/40 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{cameraError ? 'Retry Permissions' : 'Resume Camera'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Viewfinder Quick Actions Bar */}
      <div className="flex items-center gap-2">
        {/* Camera Selector Dropdown */}
        {videoDevices.length > 0 && isCameraActive && !cameraError && (
          <div className="flex-1 relative">
            <select
              value={selectedDeviceId}
              onChange={(e) => onSelectDevice(e.target.value)}
              className="w-full bg-slate-950/80 text-slate-300 border border-white/10 rounded-2xl py-2.5 px-3 pl-8 text-xs appearance-none focus:outline-none focus:border-emerald-500/50 transition cursor-pointer"
            >
              {videoDevices.map((d, index) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-500">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </div>
        )}

        {/* Camera Flip Button */}
        {videoDevices.length > 1 && isCameraActive && !cameraError && (
          <button
            type="button"
            onClick={onFlipCamera}
            className="p-2.5 rounded-2xl bg-slate-950/80 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-emerald-400 transition-all active:scale-95"
            title="Switch back/front lens"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>
        )}

        {/* Flash / Torch Toggle */}
        {isTorchSupported && isCameraActive && !cameraError && (
          <button
            type="button"
            onClick={onToggleFlash}
            className={clsx(
              'p-2.5 rounded-2xl border transition-all active:scale-95',
              isFlashOn
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-md shadow-amber-950/40'
                : 'bg-slate-950/80 hover:bg-white/10 border-white/10 text-slate-300 hover:text-amber-400'
            )}
            title="Toggle Flash / Torch"
          >
            <Zap className={clsx('w-4 h-4', isFlashOn && 'fill-current')} />
          </button>
        )}

        {/* Pause/Stop Camera */}
        {isCameraActive && !cameraError && (
          <button
            type="button"
            onClick={() => setIsCameraActive(false)}
            className="p-2.5 rounded-2xl bg-slate-950/80 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all active:scale-95"
            title="Pause camera"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        )}

        {/* Manual Barcode Entry Fallback Button */}
        <button
          type="button"
          onClick={onOpenManualEntry}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-white/[0.04] hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-300 text-xs font-semibold transition-all active:scale-95 shadow-sm ml-auto"
          title="Type barcode manually"
        >
          <Keyboard className="w-4 h-4 text-emerald-400" />
          <span className="hidden xs:inline">Manual</span>
        </button>
      </div>
    </div>
  );
};
