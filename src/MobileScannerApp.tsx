import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { sound } from './lib/sound';
import { BrowserMultiFormatReader } from '@zxing/library';
import { HeaderBar } from './components/HeaderBar';
import { ConnectView } from './components/ConnectView';
import { ScannerView } from './components/ScannerView';
import { HistoryDrawer, type ScanItem } from './components/HistoryDrawer';
import { ManualEntryModal } from './components/ManualEntryModal';
import { PwaPrompt } from './components/PwaPrompt';
import { CameraPermissionPrompt } from './components/CameraPermissionPrompt';

export default function MobileScannerApp() {
  // Connection State
  const [sessionId, setSessionId] = useState<string>('S-');
  const [isSessionSet, setIsSessionSet] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'offline' | 'connecting' | 'live'>('offline');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isQrScannerActive, setIsQrScannerActive] = useState<boolean>(false);
  const [qrError, setQrError] = useState<string>('');
  const [recentSessions, setRecentSessions] = useState<string[]>([]);

  // Sound State
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.getMuted());

  // Modal States
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);
  const [showPwaPrompt, setShowPwaPrompt] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);

  // Scans History
  const [scanHistory, setScanHistory] = useState<ScanItem[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<boolean>(false);

  // Camera State
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string>('');
  const [isFlashOn, setIsFlashOn] = useState<boolean>(false);
  const [isTorchSupported, setIsTorchSupported] = useState<boolean>(true);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState<boolean | null>(null);

  // Refs
  const channelRef = useRef<any | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownRef = useRef<boolean>(false);
  const consecutiveEmptyFramesRef = useRef<number>(0);
  const lastScannedBarcodeRef = useRef<string | null>(null);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
  const qrCodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const handleScannedBarcodeRef = useRef<(barcode: string) => void>(() => {});

  // 1. Load recent sessions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pos_recent_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentSessions(parsed.slice(0, 4));
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const saveRecentSession = (code: string) => {
    try {
      setRecentSessions((prev) => {
        const next = [code, ...prev.filter((c) => c !== code)].slice(0, 4);
        localStorage.setItem('pos_recent_sessions', JSON.stringify(next));
        return next;
      });
    } catch {
      // Ignore
    }
  };

  // 2. Check camera permission status on initial launch
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
          if (status.state === 'granted') {
            setCameraPermissionGranted(true);
            return;
          }
        }
      } catch {
        // Fallback for browsers without permissions.query for camera
      }

      const savedGrant = localStorage.getItem('camera_permission_granted');
      if (savedGrant === 'true') {
        setCameraPermissionGranted(true);
      } else {
        setCameraPermissionGranted(false);
      }
    };
    checkPermission();
  }, []);

  // 3. Detect PWA installation and platform
  useEffect(() => {
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    const checkIsInstalled = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsAppInstalled(isStandalone);
    };

    checkIsInstalled();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
      setShowPwaPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPwa = () => {
    sound.playClick();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(({ outcome }: any) => {
        if (outcome === 'accepted') {
          setIsAppInstalled(true);
        }
        setDeferredPrompt(null);
      });
    } else {
      setShowPwaPrompt(true);
    }
  };

  const grantCameraAccess = async () => {
    sound.playClick();
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach((track) => track.stop());

      await new Promise((resolve) => setTimeout(resolve, 200));

      localStorage.setItem('camera_permission_granted', 'true');
      setCameraPermissionGranted(true);
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Camera permission request error:', err);
      setCameraError('Camera access was denied. Please allow camera permissions in your browser settings.');
      setCameraPermissionGranted(false);
    }
  };

  // 4. Extract Session ID from URL on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session') || params.get('sessionId');
    if (sessionParam && sessionParam.trim().length > 0) {
      let sanitized = sessionParam.trim().toUpperCase();
      if (!sanitized.startsWith('S-')) {
        sanitized = 'S-' + (sanitized.startsWith('S') ? sanitized.slice(1) : sanitized);
      }
      setSessionId(sanitized);
      setIsSessionSet(true);
      saveRecentSession(sanitized);
    }
  }, []);

  const handleSessionInputChange = (val: string) => {
    let raw = val.toUpperCase().trim();
    if (!raw || raw === 'S' || raw === 'S-') {
      setSessionId('S-');
      return;
    }
    if (!raw.startsWith('S-')) {
      if (raw.startsWith('S')) {
        raw = 'S-' + raw.slice(1);
      } else {
        raw = 'S-' + raw;
      }
    }
    if (raw.length > 7) {
      raw = raw.slice(0, 7);
    }
    setSessionId(raw);
  };

  // 5. Initialize Supabase Realtime broadcast channel
  useEffect(() => {
    if (!isSessionSet || !sessionId) return;

    setConnectionStatus('connecting');
    setErrorMessage('');

    const targetChannelName = `room:POS-${sessionId}`;
    console.log(`Connecting to Supabase Realtime Channel: ${targetChannelName}`);

    const channel = supabase.channel(targetChannelName, {
      config: { broadcast: { self: true } },
    });

    channelRef.current = channel;

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Supabase Realtime channel connected live!');
        setConnectionStatus('live');
        setErrorMessage('');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.warn('Supabase channel status:', status);
        setConnectionStatus('offline');
        setErrorMessage(`Connection issue (${status}). Tap Reconnect.`);
        sound.playError();
      }
    });

    return () => {
      cleanupConnection();
    };
  }, [isSessionSet, sessionId]);

  const cleanupConnection = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setConnectionStatus('offline');
  };

  const handleReconnect = () => {
    sound.playClick();
    cleanupConnection();
    if (sessionId) {
      setIsSessionSet(false);
      setTimeout(() => {
        setIsSessionSet(true);
      }, 50);
    }
  };

  const handleDisconnect = () => {
    sound.playClick();
    cleanupConnection();
    setIsSessionSet(false);
    setIsFlashOn(false);
  };

  // 6. QR Code Scanner for Connection Screen
  useEffect(() => {
    if (!isQrScannerActive || isSessionSet) {
      if (qrCodeReaderRef.current) {
        qrCodeReaderRef.current.reset();
      }
      return;
    }

    const qrCodeReader = new BrowserMultiFormatReader();
    qrCodeReaderRef.current = qrCodeReader;
    setQrError('');

    const startQrScanning = async () => {
      try {
        let devices = await qrCodeReader.listVideoInputDevices();
        const needsPermission = devices.length === 0 || devices.every((d) => !d.label);

        if (needsPermission) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          stream.getTracks().forEach((track) => track.stop());
          await new Promise((resolve) => setTimeout(resolve, 300));
          devices = await qrCodeReader.listVideoInputDevices();
        }

        if (devices.length === 0) {
          setQrError('No camera devices found.');
          return;
        }

        const rearDevice = devices.find(
          (d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
        );
        const devId = rearDevice ? rearDevice.deviceId : devices[0].deviceId;

        if (!qrVideoRef.current) return;

        await qrCodeReader.decodeFromVideoDevice(devId, qrVideoRef.current, (result) => {
          if (result) {
            const text = result.getText();
            handleQrDecoded(text);
          }
        });
      } catch (err: any) {
        console.error('QR scanner init error:', err);
        setQrError('Camera access denied or unavailable.');
      }
    };

    startQrScanning();

    const currentReader = qrCodeReader;
    const currentVideo = qrVideoRef.current;
    return () => {
      if (currentReader) {
        try {
          currentReader.reset();
        } catch {}
      }
      if (currentVideo && currentVideo.srcObject) {
        const stream = currentVideo.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        currentVideo.srcObject = null;
      }
    };
  }, [isQrScannerActive, isSessionSet]);

  const handleQrDecoded = async (decodedText: string) => {
    let parsedSession = '';
    try {
      if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
        const url = new URL(decodedText);
        parsedSession = url.searchParams.get('sessionId') || url.searchParams.get('session') || '';
      } else {
        parsedSession = decodedText.trim();
      }
    } catch {
      parsedSession = decodedText.trim();
    }

    if (parsedSession && parsedSession.length > 0) {
      if (qrCodeReaderRef.current) {
        try {
          qrCodeReaderRef.current.reset();
        } catch {}
      }
      if (qrVideoRef.current && qrVideoRef.current.srcObject) {
        const stream = qrVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        qrVideoRef.current.srcObject = null;
      }

      setIsCameraActive(false);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const upper = parsedSession.toUpperCase();
      setSessionId(upper);
      saveRecentSession(upper);
      setIsSessionSet(true);
      setIsQrScannerActive(false);

      sound.playScanSuccess();
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      setTimeout(() => {
        setIsCameraActive(true);
      }, 100);
    }
  };

  // 7. Main Barcode Scanner Camera & Decoding Lifecycle
  useEffect(() => {
    if (!isSessionSet || !isCameraActive) {
      if (codeReaderRef.current) {
        try {
          codeReaderRef.current.reset();
        } catch {}
      }
      setIsFlashOn(false);
      return;
    }

    let cancelled = false;
    const codeReader = codeReaderRef.current || new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;
    setCameraError('');

    const decodeCallback = (result: any, _err: any) => {
      if (cancelled) return;
      if (result) {
        const barcodeText = result.getText();

        if (barcodeText === lastScannedBarcodeRef.current && consecutiveEmptyFramesRef.current < 15) {
          consecutiveEmptyFramesRef.current = 0;
          return;
        }

        consecutiveEmptyFramesRef.current = 0;
        lastScannedBarcodeRef.current = barcodeText;

        setTimeout(() => {
          if (lastScannedBarcodeRef.current === barcodeText) {
            lastScannedBarcodeRef.current = null;
          }
        }, 5000);

        handleScannedBarcodeRef.current(barcodeText);
      } else {
        consecutiveEmptyFramesRef.current += 1;
      }
    };

    const startScanningFlow = async () => {
      let targetDeviceId = selectedDeviceId;
      try {
        let devices = await codeReader.listVideoInputDevices();
        if (devices.length === 0 || devices.every((d) => !d.label)) {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          tempStream.getTracks().forEach((t) => t.stop());
          await new Promise((r) => setTimeout(r, 150));
          devices = await codeReader.listVideoInputDevices();
        }

        if (!cancelled) {
          setVideoDevices(devices);
        }

        if (devices.length > 0) {
          if (!targetDeviceId) {
            const rearDevice = devices.find(
              (d) =>
                d.label.toLowerCase().includes('back') ||
                d.label.toLowerCase().includes('rear') ||
                d.label.toLowerCase().includes('environment')
            );
            targetDeviceId = rearDevice ? rearDevice.deviceId : devices[0].deviceId;
            if (!cancelled) {
              setSelectedDeviceId(targetDeviceId);
            }
          }
        } else {
          if (!cancelled) setCameraError('No camera devices found.');
          return;
        }
      } catch (err: any) {
        console.error('Camera enumeration error:', err);
        if (!cancelled) setCameraError(err.message || 'Could not gain access to camera.');
        return;
      }

      if (cancelled || !targetDeviceId) return;

      for (let i = 0; i < 10 && !cancelled && !videoRef.current; i++) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (cancelled || !videoRef.current) return;

      for (let attempt = 0; attempt < 6 && !cancelled; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 350));
        }
        if (cancelled || !videoRef.current) return;

        try {
          await codeReader.decodeFromVideoDevice(targetDeviceId, videoRef.current, decodeCallback);
          return;
        } catch (err) {
          console.warn(`[Barcode Scanner] Decode attempt ${attempt + 1}/6 failed:`, err);
          if (attempt === 5 && !cancelled) {
            setCameraError('Could not launch camera feed. Check permissions.');
          }
        }
      }
    };

    startScanningFlow();

    const currentReader = codeReader;
    return () => {
      cancelled = true;
      try {
        currentReader.reset();
      } catch {}
      setIsFlashOn(false);
    };
  }, [isSessionSet, isCameraActive, selectedDeviceId]);

  // Handle successful scan (camera or manual entry)
  const handleScannedBarcode = useCallback(
    (barcode: string) => {
      if (cooldown || cooldownRef.current) return;

      cooldownRef.current = true;
      setCooldown(true);
      setLastScanned(barcode);

      // Play synthesized retail beep
      sound.playScanSuccess();

      // Trigger tactile haptics
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 50, 80]);
      }

      // Add to local feed
      const timestampStr = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const newScan: ScanItem = {
        id: Math.random().toString(36).substring(2, 9),
        barcode,
        timestamp: timestampStr,
        status: 'pending',
      };

      // Broadcast payload over Supabase Realtime channel
      if (channelRef.current) {
        try {
          channelRef.current.send({
            type: 'broadcast',
            event: 'scan',
            payload: { barcode, timestamp: Date.now() },
          });
          newScan.status = 'sent';
        } catch (err) {
          console.error('Supabase broadcast error:', err);
          newScan.status = 'failed';
          sound.playError();
        }
      } else {
        newScan.status = 'failed';
        sound.playError();
      }

      setScanHistory((prev) => [newScan, ...prev.slice(0, 19)]);

      cooldownTimeoutRef.current = setTimeout(() => {
        cooldownRef.current = false;
        setCooldown(false);
        setLastScanned(null);
      }, 1500);
    },
    [cooldown]
  );

  handleScannedBarcodeRef.current = handleScannedBarcode;

  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
      }
    };
  }, []);

  const handleSessionIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playClick();
    if (sessionId.trim().length > 0) {
      const upper = sessionId.trim().toUpperCase();
      setSessionId(upper);
      saveRecentSession(upper);
      setIsSessionSet(true);
    }
  };

  const handleSelectRecentSession = (code: string) => {
    sound.playClick();
    setSessionId(code);
    saveRecentSession(code);
    setIsSessionSet(true);
  };

  const handleRetryCamera = () => {
    sound.playClick();
    setCameraError('');
    setIsCameraActive(false);
    setTimeout(() => {
      setIsCameraActive(true);
    }, 50);
  };

  const toggleFlash = () => {
    sound.playClick();
    const video = videoRef.current;
    if (!video) return;
    const track = (video.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
    if (!track) return;
    const next = !isFlashOn;
    const constraints = { advanced: [{ torch: next }] } as unknown as MediaTrackConstraints;
    try {
      track.applyConstraints(constraints).then(
        () => {
          setIsFlashOn(next);
          setIsTorchSupported(true);
        },
        () => {
          setIsTorchSupported(false);
        }
      );
    } catch {
      setIsTorchSupported(false);
    }
  };

  const handleFlipCamera = () => {
    sound.playClick();
    if (videoDevices.length < 2) return;
    const currentIdx = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIdx = (currentIdx + 1) % videoDevices.length;
    setSelectedDeviceId(videoDevices[nextIdx].deviceId);
    setIsFlashOn(false);
  };

  const toggleMute = () => {
    const next = sound.toggleMute();
    setIsMuted(next);
  };

  const handleClearHistory = () => {
    sound.playClick();
    setScanHistory([]);
  };

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden bg-slate-950 text-slate-100 app-bg">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-emerald-500/[0.08] blur-3xl animate-glow-pulse" />
        <div className="absolute -bottom-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-cyan-600/[0.07] blur-3xl animate-glow-pulse [animation-delay:2s]" />
      </div>

      {/* Top Header Bar */}
      <HeaderBar
        isSessionSet={isSessionSet}
        sessionId={sessionId}
        connectionStatus={connectionStatus}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onReconnect={handleReconnect}
        onDisconnect={handleDisconnect}
        isAppInstalled={isAppInstalled}
        onInstallPwa={handleInstallPwa}
      />

      {/* Main Content Viewport */}
      <main className="relative z-10 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
        {cameraPermissionGranted === false ? (
          <CameraPermissionPrompt
            onGrantAccess={grantCameraAccess}
            error={cameraError}
          />
        ) : !isSessionSet ? (
          <ConnectView
            sessionId={sessionId}
            onSessionInputChange={handleSessionInputChange}
            onSubmit={handleSessionIdSubmit}
            isQrScannerActive={isQrScannerActive}
            setIsQrScannerActive={(val) => {
              sound.playClick();
              setQrError('');
              setIsQrScannerActive(val);
            }}
            qrVideoRef={qrVideoRef}
            qrError={qrError}
            onRetryQr={() => {
              setQrError('');
              setIsQrScannerActive(false);
              setTimeout(() => setIsQrScannerActive(true), 50);
            }}
            recentSessions={recentSessions}
            onSelectRecentSession={handleSelectRecentSession}
          />
        ) : (
          <div className="flex-1 flex flex-col p-3 sm:p-4 gap-3 max-w-md mx-auto w-full overflow-hidden">
            {connectionStatus !== 'live' && (
              <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs animate-fade-in flex-none">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping flex-none" />
                  <span className="truncate">{errorMessage || (connectionStatus === 'connecting' ? 'Connecting to terminal...' : 'Disconnected from terminal')}</span>
                </div>
                <button
                  type="button"
                  onClick={handleReconnect}
                  className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 font-semibold text-[11px] transition-all flex-none"
                >
                  Reconnect
                </button>
              </div>
            )}
            {/* Viewfinder with Reticle & Controls */}
            <ScannerView
              videoRef={videoRef}
              isCameraActive={isCameraActive}
              setIsCameraActive={(val) => {
                sound.playClick();
                setIsCameraActive(val);
              }}
              cameraError={cameraError}
              onRetryCamera={handleRetryCamera}
              videoDevices={videoDevices}
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={(id) => {
                sound.playClick();
                setSelectedDeviceId(id);
              }}
              onFlipCamera={handleFlipCamera}
              isTorchSupported={isTorchSupported}
              isFlashOn={isFlashOn}
              onToggleFlash={toggleFlash}
              cooldown={cooldown}
              lastScanned={lastScanned}
              sessionId={sessionId}
              connectionStatus={connectionStatus}
              onOpenManualEntry={() => {
                sound.playClick();
                setIsManualModalOpen(true);
              }}
            />

            {/* Live Scan History Feed Drawer */}
            <HistoryDrawer
              scanHistory={scanHistory}
              onResend={(barcode) => {
                sound.playClick();
                handleScannedBarcode(barcode);
              }}
              onClearHistory={handleClearHistory}
            />
          </div>
        )}
      </main>

      {/* Manual Barcode Entry Fallback Modal */}
      <ManualEntryModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmitBarcode={(code) => handleScannedBarcode(code)}
      />

      {/* PWA High-Conversion Install Sheet */}
      <PwaPrompt
        isOpen={showPwaPrompt}
        onClose={() => setShowPwaPrompt(false)}
        isIos={isIos}
        onNativeInstall={handleInstallPwa}
      />

      {/* Footer Branding & Link */}
      <footer className="relative z-20 text-center py-2 px-4 select-none text-[11px] border-t border-white/[0.05] bg-slate-950/80 backdrop-blur-md text-slate-400 flex items-center justify-center gap-1.5 flex-none font-medium safe-bottom">
        <span>Designed & developed by</span>
        <a
          href="https://pixelbuilder.in"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 font-semibold hover:underline"
        >
          pixelbuilder.in
        </a>
      </footer>
    </div>
  );
}