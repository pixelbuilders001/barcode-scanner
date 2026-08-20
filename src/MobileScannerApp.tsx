import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import { BrowserMultiFormatReader } from '@zxing/library';
import {
    WifiOff,
    Camera,
    RotateCw,
    Play,
    Square,
    Check,
    CheckCheck,
    AlertCircle,
    History,
    Link,
    LogOut,
    QrCode,
    X,
    Zap,
    SwitchCamera,
    ScanLine,
    Wifi,
    RefreshCw,
    ShieldCheck,
    Store,
    KeyRound,
    ScanBarcode
} from 'lucide-react';
import { clsx } from 'clsx';

// Types
interface ScanItem {
    id: string;
    barcode: string;
    timestamp: string;
    status: 'sent' | 'pending' | 'failed';
}

export default function MobileScannerApp() {
    // Connection State
    const [sessionId, setSessionId] = useState<string>('');
    const [isSessionSet, setIsSessionSet] = useState<boolean>(false);
    const [connectionStatus, setConnectionStatus] = useState<'offline' | 'connecting' | 'live'>('offline');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [isQrScannerActive, setIsQrScannerActive] = useState<boolean>(false);
    const [qrError, setQrError] = useState<string>('');

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

    // Refs
    const peerRef = useRef<Peer | null>(null);
    const connRef = useRef<any | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
    const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cooldownRef = useRef<boolean>(false);
    const consecutiveEmptyFramesRef = useRef<number>(0);
    const lastScannedBarcodeRef = useRef<string | null>(null);
    const qrVideoRef = useRef<HTMLVideoElement | null>(null);
    const qrCodeReaderRef = useRef<BrowserMultiFormatReader | null>(null);



    // 1. Extract Session ID from URL on load
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sessionParam = params.get('session') || params.get('sessionId');
        if (sessionParam && sessionParam.trim().length > 0) {
            const sanitized = sessionParam.trim().toUpperCase();
            setSessionId(sanitized);
            setIsSessionSet(true);
        }
    }, []);

    // 2. Initialize PeerJS connection when isSessionSet becomes true
    useEffect(() => {
        if (!isSessionSet || !sessionId) return;

        setConnectionStatus('connecting');
        setErrorMessage('');

        // Initialize peer
        // Using default cloud PeerJS server configured for secure wss connections
        const peer = new Peer({
            host: '0.peerjs.com',
            port: 443,
            secure: true,
            debug: 1 // Print only errors or keep it silent
        });

        peerRef.current = peer;

        peer.on('open', (id) => {
            console.log('Client connected as: ', id);
            connectToHost(peer, sessionId);
        });

        peer.on('error', (err) => {
            console.error('PeerJS global error:', err);
            setConnectionStatus('offline');
            setErrorMessage(`Network error: ${err.message || err.type}`);
        });

        // Cleanup on unmount or session reset
        return () => {
            cleanupConnection();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSessionSet, sessionId]);

    // Connect client peer to host peer
    const connectToHost = (peer: Peer, sid: string) => {
        const targetHostId = `POS-${sid}`;
        console.log(`Connecting to WebRTC Host: ${targetHostId}`);

        const conn = peer.connect(targetHostId, {
            reliable: true
        });

        connRef.current = conn;

        conn.on('open', () => {
            console.log('WebRTC connection established successfully!');
            setConnectionStatus('live');
            setErrorMessage('');
        });

        conn.on('data', (data) => {
            // Host might send control signals or acknowledgment
            console.log('Received data from host:', data);
        });

        conn.on('close', () => {
            console.log('Remote host closed reference connection');
            setConnectionStatus('offline');
        });

        conn.on('error', (err) => {
            console.error('WebRTC connection error:', err);
            setConnectionStatus('offline');
            setErrorMessage('Failed to connect to host. Make sure POS is open & online.');
        });
    };

    const cleanupConnection = () => {
        if (connRef.current) {
            connRef.current.close();
            connRef.current = null;
        }
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        setConnectionStatus('offline');
    };

    const handleReconnect = () => {
        cleanupConnection();
        if (sessionId) {
            setIsSessionSet(false);
            // Wait a tick to trigger re-effect
            setTimeout(() => {
                setIsSessionSet(true);
            }, 50);
        }
    };

    const handleDisconnect = () => {
        cleanupConnection();
        setIsSessionSet(false);
        setIsFlashOn(false);
    };

    // 2b. Initialize QR Scanner on Connection Screen
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
                const needsPermission = devices.length === 0 || devices.every(d => !d.label);

                if (needsPermission) {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    stream.getTracks().forEach(track => track.stop());
                    await new Promise(resolve => setTimeout(resolve, 300));
                    devices = await qrCodeReader.listVideoInputDevices();
                }

                if (devices.length === 0) {
                    setQrError('No camera devices found.');
                    return;
                }

                // Prefer back camera
                const rearDevice = devices.find(d =>
                    d.label.toLowerCase().includes('back') ||
                    d.label.toLowerCase().includes('rear') ||
                    d.label.toLowerCase().includes('environment')
                );
                const devId = rearDevice ? rearDevice.deviceId : devices[0].deviceId;

                if (!qrVideoRef.current) return;

                await qrCodeReader.decodeFromVideoDevice(
                    devId,
                    qrVideoRef.current,
                    (result) => {
                        if (result) {
                            const text = result.getText();
                            handleQrDecoded(text);
                        }
                    }
                );
            } catch (err: any) {
                console.error('QR scanner init error:', err);
                setQrError('Camera access denied or failed.');
            }
        };

        startQrScanning();

        return () => {
            if (qrCodeReaderRef.current) {
                qrCodeReaderRef.current.reset();
            }
            if (qrVideoRef.current && qrVideoRef.current.srcObject) {
                const stream = qrVideoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
                qrVideoRef.current.srcObject = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isQrScannerActive, isSessionSet]);

    const handleQrDecoded = async (decodedText: string) => {
        console.log('QR Code decoded:', decodedText);
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
            // 1. Immediately reset QR code reader & stop video tracks
            if (qrCodeReaderRef.current) {
                try {
                    qrCodeReaderRef.current.reset();
                } catch { }
            }
            if (qrVideoRef.current && qrVideoRef.current.srcObject) {
                const stream = qrVideoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
                qrVideoRef.current.srcObject = null;
            }

            // 2. Momentarily deactivate camera state so barcode scanner triggers a clean fresh activation
            setIsCameraActive(false);

            // 3. Wait 300ms for browser hardware layer to release the camera channel
            await new Promise(resolve => setTimeout(resolve, 300));

            // 4. Update session state to mount barcode scanner view
            setSessionId(parsedSession.toUpperCase());
            setIsSessionSet(true);
            setIsQrScannerActive(false);
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }

            // 5. Activate camera state after view mounts to trigger barcode scanner effect
            setTimeout(() => {
                setIsCameraActive(true);
            }, 100);
        }
    };

    // Unified Barcode Scanner Camera & Decoding Lifecycle Hook
    useEffect(() => {
        if (!isSessionSet || !isCameraActive) {
            if (codeReaderRef.current) {
                try { codeReaderRef.current.reset(); } catch { }
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

                // Deduplication: require either a different barcode OR absence from the frame
                if (barcodeText === lastScannedBarcodeRef.current && consecutiveEmptyFramesRef.current < 15) {
                    consecutiveEmptyFramesRef.current = 0;
                    return;
                }

                consecutiveEmptyFramesRef.current = 0;
                lastScannedBarcodeRef.current = barcodeText;

                // Absolute safety fallback: allow scanning the same barcode again after 5 seconds
                setTimeout(() => {
                    if (lastScannedBarcodeRef.current === barcodeText) {
                        lastScannedBarcodeRef.current = null;
                    }
                }, 5000);

                handleScannedBarcode(barcodeText);
            } else {
                consecutiveEmptyFramesRef.current += 1;
            }
        };

        const startScanningFlow = async () => {
            // 1. Enumerate video devices if list is empty
            let targetDeviceId = selectedDeviceId;
            try {
                let devices = await codeReader.listVideoInputDevices();
                if (devices.length === 0 || devices.every(d => !d.label)) {
                    const tempStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                    tempStream.getTracks().forEach(t => t.stop());
                    await new Promise(r => setTimeout(r, 150));
                    devices = await codeReader.listVideoInputDevices();
                }

                if (!cancelled) {
                    setVideoDevices(devices);
                }

                if (devices.length > 0) {
                    if (!targetDeviceId) {
                        const rearDevice = devices.find(d =>
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

            // 2. Wait for HTMLVideoElement to mount in DOM
            for (let i = 0; i < 10 && !cancelled && !videoRef.current; i++) {
                await new Promise(r => setTimeout(r, 50));
            }
            if (cancelled || !videoRef.current) return;

            // 3. Retry loop to bind video device stream to video element
            for (let attempt = 0; attempt < 6 && !cancelled; attempt++) {
                if (attempt > 0) {
                    await new Promise(r => setTimeout(r, 350));
                }
                if (cancelled || !videoRef.current) return;

                try {
                    await codeReader.decodeFromVideoDevice(
                        targetDeviceId,
                        videoRef.current,
                        decodeCallback
                    );
                    return; // Successfully started video decoding!
                } catch (err) {
                    console.warn(`[Barcode Scanner] Decode attempt ${attempt + 1}/6 failed:`, err);
                    if (attempt === 5 && !cancelled) {
                        setCameraError('Could not launch camera feed. Check permissions.');
                    }
                }
            }
        };

        startScanningFlow();

        return () => {
            cancelled = true;
            try {
                codeReader.reset();
            } catch { }
            setIsFlashOn(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSessionSet, isCameraActive, selectedDeviceId]);

    // Handle successful scan
    const handleScannedBarcode = (barcode: string) => {
        // Check cooldown
        if (cooldown || cooldownRef.current) return;

        // Trigger cooldown
        cooldownRef.current = true;
        setCooldown(true);
        setLastScanned(barcode);

        // Make haptic feedback
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([80, 50, 80]);
        }

        // Prepare history item
        const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newScan: ScanItem = {
            id: Math.random().toString(36).substr(2, 9),
            barcode,
            timestamp: timestampStr,
            status: 'pending'
        };

        // Send via WebRTC DataChannel
        if (connRef.current && connectionStatus === 'live') {
            try {
                connRef.current.send(barcode);
                newScan.status = 'sent';
            } catch (err) {
                console.error('WebRTC send error:', err);
                newScan.status = 'failed';
            }
        } else {
            newScan.status = 'failed';
        }

        // Add to history
        setScanHistory(prev => [newScan, ...prev.slice(0, 14)]);

        // Clear alert badge and cooldown in 1.5s
        cooldownTimeoutRef.current = setTimeout(() => {
            cooldownRef.current = false;
            setCooldown(false);
            setLastScanned(null);
        }, 1500);
    };

    // Cleanup timeout when needed
    useEffect(() => {
        return () => {
            if (cooldownTimeoutRef.current) {
                clearTimeout(cooldownTimeoutRef.current);
            }
        };
    }, []);

    // Format Session ID input on user type
    const handleSessionIdSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (sessionId.trim().length > 0) {
            setSessionId(sessionId.trim().toUpperCase());
            setIsSessionSet(true);
        }
    };

    const handleRetryCamera = () => {
        setCameraError('');
        setIsCameraActive(false);
        // Wait a frame & reactivate to force useEffect reload
        setTimeout(() => {
            setIsCameraActive(true);
        }, 50);
    };

    const toggleFlash = () => {
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
        if (videoDevices.length < 2) return;
        const currentIdx = videoDevices.findIndex(d => d.deviceId === selectedDeviceId);
        const nextIdx = (currentIdx + 1) % videoDevices.length;
        setSelectedDeviceId(videoDevices[nextIdx].deviceId);
        setIsFlashOn(false);
    };

    return (
        <div className="relative flex flex-col min-h-screen max-h-screen overflow-hidden bg-slate-950 text-slate-100 app-bg">
            {/* Ambient background glows */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute -top-28 -right-28 w-[26rem] h-[26rem] rounded-full bg-emerald-500/10 blur-3xl animate-glow-pulse" />
                <div className="absolute -bottom-36 -left-28 w-[30rem] h-[30rem] rounded-full bg-blue-600/10 blur-3xl animate-glow-pulse [animation-delay:1.5s]" />
            </div>

            {/* Main Content Area */}
            <main className="relative z-10 flex-1 flex flex-col overflow-y-auto custom-scrollbar">

                {!isSessionSet ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 select-none">
                        <div className="w-full max-w-sm p-6 sm:p-7 rounded-3xl glass-panel space-y-6 shadow-2xl relative overflow-hidden animate-fade-up">
                            <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
                            <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />

                            {/* Scan QR Code Switch button */}
                            <button
                                onClick={() => {
                                    setQrError('');
                                    setIsQrScannerActive(prev => !prev);
                                }}
                                className="absolute top-3 right-3 p-2 hover:bg-white/5 border border-white/10 bg-white/5 rounded-xl text-slate-400 hover:text-emerald-400 transition shadow-sm z-20 group"
                                title={isQrScannerActive ? "Enter session code manually" : "Scan terminal QR Code"}
                                type="button"
                            >
                                {isQrScannerActive ? <X className="w-5 h-5" /> : <QrCode className="w-5 h-5 text-emerald-400 animate-glow-pulse" />}
                            </button>

                            <div className="text-center space-y-3 relative">
                                <div className="relative mx-auto w-fit">
                                    <div className="absolute -inset-3 rounded-full bg-emerald-500/15 blur-2xl" />
                                    <img
                                        src="/applogo.png"
                                        alt="POS Scanner"
                                        className="relative w-16 h-16 rounded-2xl object-cover ring-1 ring-emerald-500/30 shadow-xl shadow-emerald-950/40"
                                    />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-tight">
                                        Connect to Sales Desk
                                    </h2>
                                    <p className="text-xs text-slate-400 max-w-[280px] mx-auto mt-1 leading-relaxed">
                                        {isQrScannerActive
                                            ? "Point your camera at the POS checkout QR code to link instantly."
                                            : "Enter the 5-character session code shown on your POS checkout screen."}
                                    </p>
                                </div>
                            </div>

                            {isQrScannerActive ? (
                                <div className="space-y-4 relative">
                                    <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-white/10 bg-black shadow-inner">
                                        {qrError ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center select-none text-slate-400">
                                                <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                                                <p className="font-semibold text-white text-xs">{qrError}</p>
                                                <button
                                                    onClick={() => {
                                                        setQrError('');
                                                        setIsQrScannerActive(false);
                                                        setTimeout(() => setIsQrScannerActive(true), 50);
                                                    }}
                                                    className="mt-3 bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15 py-1.5 px-3 rounded-lg text-[10px] font-semibold transition"
                                                >
                                                    Retry Camera
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
                                                {/* Viewfinder scanner center target indicator */}
                                                <div className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none">
                                                    <div className="w-2/3 h-2/3 border border-emerald-500/30 rounded-xl relative">
                                                        <div className="absolute -top-[2px] -left-[2px] w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
                                                        <div className="absolute -top-[2px] -right-[2px] w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
                                                        <div className="absolute -bottom-[2px] -left-[2px] w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
                                                        <div className="absolute -bottom-[2px] -right-[2px] w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br" />
                                                    </div>
                                                </div>
                                                {/* Animated Laser Scanning Line */}
                                                <div className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse top-1/2 -translate-y-1/2" />
                                            </>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsQrScannerActive(false)}
                                        className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 rounded-xl text-xs font-semibold transition"
                                    >
                                        Cancel Scanning
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSessionIdSubmit} className="space-y-4 relative">
                                    <div>
                                        <label htmlFor="sessionId" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2 px-0.5">
                                            Terminal Session Code
                                        </label>
                                        <input
                                            id="sessionId"
                                            type="text"
                                            required
                                            maxLength={10}
                                            value={sessionId}
                                            onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                                            placeholder="S-9A2"
                                            className="w-full bg-slate-950/80 border border-white/10 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-4 text-center font-mono text-2xl font-bold tracking-[0.3em] text-white uppercase placeholder-slate-600 transition-all shadow-inner"
                                            autoComplete="off"
                                            autoFocus
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={!sessionId.trim()}
                                        className={clsx(
                                            'group w-full py-4 rounded-2xl font-bold text-sm transition-all focus:outline-none flex items-center justify-center gap-2 active:scale-[0.98]',
                                            sessionId.trim()
                                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 hover:shadow-lg hover:shadow-emerald-500/25 shadow-lg shadow-emerald-950/40'
                                                : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/10'
                                        )}
                                    >
                                        <Link className="w-4 h-4 transition-transform group-hover:rotate-12" />
                                        Establish Link
                                    </button>
                                </form>
                            )}
                        </div>

                        {/* How to use steps */}
                        <div className="w-full max-w-sm mt-8 space-y-4 animate-fade-up" style={{ animationDelay: '150ms' }}>
                            <div className="flex items-center gap-2 px-1">
                                <span className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
                                    <ScanLine className="w-3.5 h-3.5" />
                                </span>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                                    How to use
                                </h3>
                            </div>

                            <div className="relative rounded-2xl glass-card p-5">
                                {/* Vertical connector line */}
                                <div className="absolute left-[26px] top-8 bottom-8 w-px bg-gradient-to-b from-emerald-500/40 via-white/10 to-white/5" />

                                <ol className="space-y-5 relative">
                                    <li className="flex gap-3.5">
                                        <div className="relative flex-none w-[52px] flex flex-col items-center">
                                            <span className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                                                <Store className="w-5 h-5" />
                                            </span>
                                        </div>
                                        <div className="pt-0.5">
                                            <p className="text-sm font-semibold text-white">Open your POS terminal</p>
                                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                Start a checkout on the sales desk and note the session code shown on screen (e.g. <code className="font-mono text-emerald-400 bg-white/5 px-1 py-0.5 rounded">S-9A2</code>).
                                            </p>
                                        </div>
                                    </li>

                                    <li className="flex gap-3.5">
                                        <div className="relative flex-none w-[52px] flex flex-col items-center">
                                            <span className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                                                <KeyRound className="w-5 h-5" />
                                            </span>
                                        </div>
                                        <div className="pt-0.5">
                                            <p className="text-sm font-semibold text-white">Link this phone</p>
                                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                Tap the QR icon above to scan the terminal's QR code, or enter the session code manually and press <span className="text-emerald-400 font-semibold">Establish Link</span>.
                                            </p>
                                        </div>
                                    </li>

                                    <li className="flex gap-3.5">
                                        <div className="relative flex-none w-[52px] flex flex-col items-center">
                                            <span className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                                                <ScanBarcode className="w-5 h-5" />
                                            </span>
                                        </div>
                                        <div className="pt-0.5">
                                            <p className="text-sm font-semibold text-white">Scan & checkout</p>
                                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                Point your camera at any product barcode. Each scan is sent to your POS instantly over a secure WebRTC link.
                                            </p>
                                        </div>
                                    </li>
                                </ol>
                            </div>

                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 select-none">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70" />
                                <span>Direct peer-to-peer • No data leaves your store network</span>
                            </div>
                        </div>

                    </div>
                ) : (

                    /* State B: Scanner Viewport & Logs */
                    <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">

                        {/* Mobile status bar */}
                        <div className="flex items-center justify-between flex-none select-none animate-fade-in">
                            <div className="flex items-center gap-2">
                                <img
                                    src="/applogo.png"
                                    alt=""
                                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-emerald-500/25"
                                />
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-sm bg-slate-950/50
                                    text-slate-300 border-white/10">
                                    <span className={clsx(
                                        'w-1.5 h-1.5 rounded-full ring-2',
                                        connectionStatus === 'live' && 'bg-emerald-400 ring-emerald-500/20',
                                        connectionStatus === 'connecting' && 'bg-amber-400 ring-amber-500/20 animate-pulse',
                                        connectionStatus === 'offline' && 'bg-rose-400 ring-rose-500/20'
                                    )} />
                                    <span className="font-mono tracking-wide">POS-{sessionId}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {connectionStatus !== 'live' && (
                                    <button
                                        onClick={handleReconnect}
                                        className="p-2 text-slate-400 hover:text-emerald-400 bg-white/5 border border-white/10 rounded-xl transition-colors"
                                        title="Retry Connection"
                                    >
                                        <RotateCw className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={handleDisconnect}
                                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 bg-white/5 border border-white/10 rounded-xl transition-colors"
                                    title="Disconnect Session"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Connection Banner Layer if not live */}
                        {connectionStatus !== 'live' && (
                            <div className="p-4 rounded-2xl border border-white/5 flex flex-col gap-3 shadow-lg select-none glass-card animate-fade-in">
                                <div className="flex items-start gap-3">
                                    {connectionStatus === 'connecting' ? (
                                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                            <WifiOff className="w-5 h-5" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-white">
                                            {connectionStatus === 'connecting' ? 'Linking to POS console...' : 'Disconnected'}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                                            {connectionStatus === 'connecting'
                                                ? `Awaiting terminal link matching ID 'POS-${sessionId}'...`
                                                : errorMessage || 'Real-time WebRTC DataChannel connection was interrupted.'}
                                        </p>
                                    </div>
                                </div>

                                {/* Manual retry CTA */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleReconnect}
                                        className="flex-1 bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 py-2.5 px-3 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <RotateCw className="w-3.5 h-3.5" />
                                        Retry Connection
                                    </button>
                                    <button
                                        onClick={handleDisconnect}
                                        className="bg-transparent hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-white/10 py-2.5 px-3 rounded-xl text-xs transition-colors"
                                    >
                                        Change Code
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Live session banner when connected */}
                        {connectionStatus === 'live' && (
                            <div className="flex items-center justify-center gap-2 animate-fade-in select-none">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-semibold">
                                    <Wifi className="w-3.5 h-3.5" />
                                    <span>Streaming to <strong className="font-mono">POS-{sessionId}</strong></span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                </div>
                            </div>
                        )}

                        {/* Video Viewfinder Section */}
                        <div className="relative flex-none aspect-[4/3] w-full max-w-md mx-auto rounded-3xl overflow-hidden glass-panel border border-white/10 shadow-2xl bg-black">
                            {isCameraActive && !cameraError ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        className="w-full h-full object-cover"
                                        playsInline
                                        muted
                                    />

                                    {/* Viewfinder Bounding Box Laser Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none">
                                        <div className="relative w-3/4 h-2/3 border border-emerald-500/25 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.06)]">
                                            {/* Bounding Box corners indicator */}
                                            <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-[3px] border-l-[3px] border-emerald-500 rounded-tl-lg" />
                                            <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-[3px] border-r-[3px] border-emerald-500 rounded-tr-lg" />
                                            <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-[3px] border-l-[3px] border-emerald-500 rounded-bl-lg" />
                                            <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-[3px] border-r-[3px] border-emerald-500 rounded-br-lg" />

                                            {/* Animated Laser Scanning Line */}
                                            <div className="absolute w-full h-[3px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-scanner-laser" />
                                        </div>
                                    </div>

                                    {/* Flash indicator */}
                                    {isFlashOn && (
                                        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-semibold backdrop-blur-sm pointer-events-none select-none">
                                            <Zap className="w-3 h-3 fill-current" />
                                            Torch
                                        </div>
                                    )}

                                    {/* Visual Scan Confirmation Toast Alert */}
                                    {cooldown && lastScanned && (
                                        <div className="absolute inset-x-4 bottom-4 flex justify-center pointer-events-none animate-bounce">
                                            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-950/60 border border-emerald-400/50">
                                                <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                                <span>Sent: <strong className="font-mono tracking-wide">{lastScanned}</strong></span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Active Link Session Code Watermark */}
                                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/70 backdrop-blur-md border border-white/10 text-[10px] text-slate-300 font-mono pointer-events-none select-none">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>POS ID: {sessionId}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none text-slate-400 space-y-4">
                                    <div className="w-12 h-12 bg-slate-900/80 border border-white/10 rounded-xl flex items-center justify-center text-slate-500">
                                        <WifiOff className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-semibold text-white text-sm">
                                            {cameraError ? 'Camera Access Pending' : 'Camera is Disabled'}
                                        </p>
                                        <p className="text-xs text-slate-500 max-w-[220px] leading-relaxed">
                                            {cameraError || 'Activate the camera via the start toggle below to start barcode capture.'}
                                        </p>
                                    </div>
                                    {(!isCameraActive || cameraError) && (
                                        <button
                                            onClick={cameraError ? handleRetryCamera : () => setIsCameraActive(true)}
                                            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-slate-950 font-bold py-2.5 px-5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-950/30"
                                        >
                                            <Play className="w-3.5 h-3.5 fill-current" />
                                            {cameraError ? 'Allow/Retry Camera' : 'Start Camera Feed'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Viewfinder Controls & Camera Selector */}
                        {isCameraActive && !cameraError && (
                            <div className="w-full max-w-md mx-auto flex gap-2 text-xs">
                                {/* Camera dropdown selector */}
                                <div className="flex-1 relative">
                                    <select
                                        value={selectedDeviceId}
                                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                                        className="w-full bg-slate-950/80 text-slate-300 border border-white/10 rounded-2xl py-3 px-3 pl-9 appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-500/40 transition"
                                    >
                                        {videoDevices.map((d, index) => (
                                            <option key={d.deviceId} value={d.deviceId}>
                                                {d.label || `Camera ${index + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
                                        <Camera className="w-3.5 h-3.5" />
                                    </div>
                                </div>

                                {/* Camera flip button */}
                                {videoDevices.length > 1 && (
                                    <button
                                        onClick={handleFlipCamera}
                                        className="bg-slate-950/80 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-emerald-400 px-3.5 py-3 rounded-2xl transition flex items-center justify-center"
                                        title="Switch Camera"
                                    >
                                        <SwitchCamera className="w-4 h-4" />
                                    </button>
                                )}

                                {/* Flash / Torch toggle */}
                                {isTorchSupported && (
                                    <button
                                        onClick={toggleFlash}
                                        className={clsx(
                                            'border px-3.5 py-3 rounded-2xl transition flex items-center justify-center',
                                            isFlashOn
                                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                                : 'bg-slate-950/80 hover:bg-white/10 border-white/10 text-slate-300 hover:text-amber-400'
                                        )}
                                        title="Toggle Flash"
                                    >
                                        <Zap className={clsx('w-4 h-4', isFlashOn && 'fill-current')} />
                                    </button>
                                )}

                                {/* Stop feed toggle */}
                                <button
                                    onClick={() => setIsCameraActive(false)}
                                    className="bg-slate-950/80 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 px-3.5 py-3 rounded-2xl transition flex items-center justify-center"
                                    title="Pause Camera"
                                >
                                    <Square className="w-3.5 h-3.5 fill-current" />
                                </button>
                            </div>
                        )}

                        {/* Local Session Scan History Feed */}
                        <div className="flex-1 flex flex-col min-h-0 bg-slate-950/40 rounded-3xl border border-white/5 p-4 relative">
                            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-3 select-none flex-none">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <History className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-xs tracking-wide text-white uppercase">History Feed</h3>
                                        <p className="text-[9px] text-slate-500">Latest scans piped to terminal</p>
                                    </div>
                                </div>
                                <div className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-400 font-mono">
                                    {scanHistory.length} items
                                </div>
                            </div>

                            {/* Items scroll list */}
                            <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2">
                                {scanHistory.length > 0 ? (
                                    scanHistory.map((item, index) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-white/5 hover:border-emerald-500/20 transition animate-fade-in"
                                            style={{ animationDelay: `${index * 40}ms` }}
                                        >
                                            <div className="min-w-0 pr-2">
                                                <p className="font-mono text-sm font-bold text-white tracking-wider truncate">
                                                    {item.barcode}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                                    <span className="w-1 h-1 rounded-full bg-slate-600" />
                                                    Scanned at {item.timestamp}
                                                </p>
                                            </div>

                                            {/* Sync Receipt Indicators */}
                                            <div className="flex items-center gap-1 flex-none">
                                                {item.status === 'sent' && (
                                                    <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 py-1 px-2 rounded-lg border border-emerald-500/20 text-[10px] uppercase font-bold tracking-wider select-none">
                                                        <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                                        <span>Sent</span>
                                                    </div>
                                                )}
                                                {item.status === 'pending' && (
                                                    <div className="flex items-center gap-1 bg-amber-500/10 text-amber-400 py-1 px-2 rounded-lg border border-amber-500/20 text-[10px] uppercase font-bold tracking-wider select-none animate-pulse">
                                                        <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                                                        <span>Sending</span>
                                                    </div>
                                                )}
                                                {item.status === 'failed' && (
                                                    <div className="flex items-center gap-1 bg-rose-500/10 text-rose-400 py-1 px-2 rounded-lg border border-rose-500/20 text-[10px] uppercase font-bold tracking-wider select-none">
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        <span>Failed</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-slate-500 space-y-3">
                                        <div className="relative">
                                            <div className="w-14 h-14 bg-slate-900/60 rounded-2xl flex items-center justify-center text-slate-600 border border-white/5">
                                                <ScanLine className="w-6 h-6" />
                                            </div>
                                            <span className="absolute -inset-1 rounded-2xl bg-emerald-500/5 blur-lg" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-slate-400">Scanner Ready</p>
                                            <p className="text-[10px] text-slate-600 max-w-[200px] leading-relaxed">
                                                Scanned barcodes will be logged here and piped immediately to your POS terminal.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </main>

            {/* Footer Info Details */}
            <footer className="relative z-10 text-center py-2.5 select-none text-[10px] border-t border-white/5 bg-slate-950/50 text-slate-600 font-mono tracking-widest flex-none flex items-center justify-center gap-2">
                <span>POS SCANNER PWA © 2026</span>
                <span className="w-1 h-1 rounded-full bg-slate-700" />
                <span className="flex items-center gap-1 text-slate-500">
                    <RefreshCw className="w-3 h-3" />
                    RTC DATA CAPTURE
                </span>
            </footer>
        </div>
    );
}