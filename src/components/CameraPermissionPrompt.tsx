import React from 'react';
import { Camera, ShieldCheck, AlertCircle } from 'lucide-react';

interface CameraPermissionPromptProps {
  onGrantAccess: () => void;
  error?: string;
}

export const CameraPermissionPrompt: React.FC<CameraPermissionPromptProps> = ({
  onGrantAccess,
  error,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 select-none animate-fade-up">
      <div className="w-full max-w-sm p-7 rounded-3xl glass-panel space-y-6 shadow-2xl relative overflow-hidden text-center">
        {/* Ambient glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/50">
          <Camera className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Camera Access Required
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-[270px] mx-auto">
            To scan terminal QR codes and live product barcodes, please allow camera permission.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 flex-none" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onGrantAccess}
          className="w-full py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 hover:shadow-lg hover:shadow-emerald-500/25 shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Allow Camera Access</span>
        </button>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-medium">
          <ShieldCheck className="w-3 h-3 text-emerald-500/70" />
          <span>Camera stream decoded 100% locally in-browser</span>
        </div>
      </div>
    </div>
  );
};
