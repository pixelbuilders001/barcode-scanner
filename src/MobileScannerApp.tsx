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
    Sparkles
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

    // Scans History
    const [scanHistory, setScanHistory] = useState<ScanItem[]>([]);
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState<boolean>(false);

    // Camera State
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
    const [cameraError, setCameraError] = useState<string>('');

    // Refs
    const peerRef = useRef<Peer | null>(null);
    const connRef = useRef<any | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
    const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Request permission & list devices
    const initCamera = async () => {
        setCameraError('');
        try {
            // Explicitly request media access to trigger permission dialog
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            // Stop tracks immediately to avoid keeping the camera locked by getUserMedia
            stream.getTracks().forEach(track => track.stop());

            const codeReader = codeReaderRef.current || new BrowserMultiFormatReader();
            codeReaderRef.current = codeReader;

            const devices = await codeReader.listVideoInputDevices();
            setVideoDevices(devices);

            if (devices.length > 0) {
                const rearDevice = devices.find(d =>
                    d.label.toLowerCase().includes('back') ||
                    d.label.toLowerCase().includes('rear') ||
                    d.label.toLowerCase().includes('environment')
                );
                const defaultDev = rearDevice ? rearDevice.deviceId : devices[0].deviceId;
                setSelectedDeviceId(prev => prev || defaultDev);
            } else {
                setCameraError('No camera devices found.');
            }
        } catch (err: any) {
            console.error('Camera permissions or enumerate error:', err);
            setCameraError(err.message || 'Could not gain access to camera devices.');
        }
    };

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
    };

    // 3. Initialize Camera Scanning
    useEffect(() => {
        if (!isSessionSet || !isCameraActive) {
            if (codeReaderRef.current) {
                codeReaderRef.current.reset();
            }
            return;
        }

        initCamera();

        return () => {
            if (codeReaderRef.current) {
                codeReaderRef.current.reset();
            }
        };
    }, [isSessionSet, isCameraActive]);

    // Bind video scanning when device changes
    useEffect(() => {
        if (!isSessionSet || !selectedDeviceId || !isCameraActive || !videoRef.current) return;

        const codeReader = codeReaderRef.current;
        if (!codeReader) return;

        setCameraError('');

        // Start decoding from video device
        codeReader.decodeFromVideoDevice(
            selectedDeviceId,
            videoRef.current,
            (result, _err) => {
                if (result) {
                    const barcodeText = result.getText();
                    handleScannedBarcode(barcodeText);
                }
                // Ignore normal scanning logs when barcode is not found in slot
            }
        ).catch((err) => {
            console.error('Error starting video decode:', err);
            // Frequently on iOS/Chrome if permission is blocked or camera is busy
            setCameraError('Could not launch camera feed. Check permissions.');
        });

        return () => {
            codeReader.reset();
        };
    }, [selectedDeviceId, isSessionSet, isCameraActive]);

    // Handle successful scan
    const handleScannedBarcode = (barcode: string) => {
        // Check cooldown
        if (cooldown) return;

        // Trigger cooldown
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

    return (
        <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 max-h-screen overflow-hidden">
            {/* Top Banner Header */}
            <header className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md z-10 select-none">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <h1 className="font-bold text-base tracking-tight text-white">POS Scanner</h1>
                        <p className="text-[10px] text-slate-400">Low-Latency WebRTC Link</p>
                    </div>
                </div>

                {/* Live Status Indicator */}
                {isSessionSet && (
                    <div className="flex items-center gap-3">
                        <div className={clsx(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold select-none border shadow-lg',
                            connectionStatus === 'live' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-950/20',
                            connectionStatus === 'connecting' && 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse',
                            connectionStatus === 'offline' && 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        )}>
                            <span className={clsx(
                                'w-2 h-2 rounded-full ring-2',
                                connectionStatus === 'live' && 'bg-emerald-400 ring-emerald-900',
                                connectionStatus === 'connecting' && 'bg-amber-400 ring-amber-900',
                                connectionStatus === 'offline' && 'bg-rose-400 ring-rose-900'
                            )} />
                            <span className="capitalize">{connectionStatus === 'live' ? 'Live' : connectionStatus}</span>
                        </div>
                        {connectionStatus === 'live' && (
                            <button
                                onClick={handleDisconnect}
                                className="p-1 px-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md border border-slate-800 transition-colors"
                                title="Disconnect Session"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-y-auto custom-scrollbar relative">

                {/* State A: Missing Session ID */}
                {!isSessionSet ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 select-none">
                        <div className="w-full max-w-sm p-6 rounded-2xl glass-panel space-y-6 shadow-2xl relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl" />
                            <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-blue-500/10 rounded-full blur-xl" />

                            <div className="text-center space-y-2 relative">
                                <div className="w-14 h-14 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto border border-slate-700 shadow-md">
                                    <Camera className="w-6 h-6 text-emerald-400" />
                                </div>
                                <h2 className="text-lg font-bold text-white tracking-tight">Connect to Sales Desk</h2>
                                <p className="text-xs text-slate-400 max-w-[280px] mx-auto">
                                    Enter the 5-character session code shown on your POS checkout screen.
                                </p>
                            </div>

                            <form onSubmit={handleSessionIdSubmit} className="space-y-4 relative">
                                <div>
                                    <label htmlFor="sessionId" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 px-0.5">
                                        Terminal Session Code
                                    </label>
                                    <input
                                        id="sessionId"
                                        type="text"
                                        required
                                        maxLength={10}
                                        value={sessionId}
                                        onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                                        placeholder="e.g. S-9A2"
                                        className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-4 py-3.5 text-center font-mono text-xl font-bold tracking-wider text-white uppercase placeholder-slate-600 transition-all shadow-inner"
                                        autoComplete="off"
                                        autoFocus
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={!sessionId.trim()}
                                    className={clsx(
                                        'w-full py-3.5 rounded-xl font-semibold text-sm transition-all focus:outline-none flex items-center justify-center gap-2 active:scale-[0.98]',
                                        sessionId.trim()
                                            ? 'bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-lg shadow-emerald-950/40 text-black'
                                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                    )}
                                >
                                    <Link className="w-4 h-4" />
                                    Establish Link
                                </button>
                            </form>
                        </div>

                        {/* Quick Helper Tips */}
                        <div className="mt-8 max-w-xs text-center space-y-2 text-[11px] text-slate-500">
                            <p>💡 Tip: You can scan codes instantly by opening the POS site scanner link containing <code className="bg-slate-800/80 px-1.5 py-0.5 rounded text-slate-400">?session=CODE</code></p>
                        </div>
                    </div>
                ) : (

                    /* State B: Scanner Viewport & Logs */
                    <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">

                        {/* Connection Banner Layer if not live */}
                        {connectionStatus !== 'live' && (
                            <div className="p-4 rounded-xl border flex flex-col gap-3 shadow-lg select-none glass-card border-slate-800">
                                <div className="flex items-start gap-3">
                                    {connectionStatus === 'connecting' ? (
                                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                            <WifiOff className="w-5 h-5 animate-bounce" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-semibold text-white">
                                            {connectionStatus === 'connecting' ? 'Linking to POS console...' : 'Disconnected'}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
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
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-2 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <RotateCw className="w-3.5 h-3.5" />
                                        Retry Connection
                                    </button>
                                    <button
                                        onClick={handleDisconnect}
                                        className="bg-transparent hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800 py-2 px-3 rounded-lg text-xs transition-colors"
                                    >
                                        Change Code
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Video Viewfinder Section */}
                        <div className="relative flex-none aspect-[4/3] w-full max-w-md mx-auto rounded-3xl overflow-hidden glass-panel border border-slate-800 shadow-2xl bg-black">
                            {isCameraActive && !cameraError ? (
                                <>
                                    <video
                                        ref={videoRef}
                                        className="w-full h-full object-cover"
                                        playsInline
                                        muted
                                    />

                                    {/* Viewfinder Bounding Box Laser Overlay overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none">
                                        <div className="relative w-3/4 h-2/3 border-2 border-emerald-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.05)]">
                                            {/* Bounding Box corners indicator */}
                                            <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
                                            <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
                                            <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
                                            <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />

                                            {/* Animated Laser Scanning Line */}
                                            <div className="absolute w-full h-[3px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-scanner-laser" />
                                        </div>
                                    </div>

                                    {/* Visual Scan Confirmation Toast Alert */}
                                    {cooldown && lastScanned && (
                                        <div className="absolute inset-x-4 bottom-4 flex justify-center pointer-events-none animate-bounce">
                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-950/60 border border-emerald-400">
                                                <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                                <span>Sent: <strong className="font-mono">{lastScanned}</strong></span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Active Link Session Code Watermark */}
                                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-sm border border-slate-800 text-[10px] text-slate-400 font-mono pointer-events-none select-none">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>POS ID: {sessionId}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none text-slate-400 space-y-4">
                                    <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                                        <WifiOff className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-semibold text-white text-sm">
                                            {cameraError ? 'Camera Access Pending' : 'Camera is Disabled'}
                                        </p>
                                        <p className="text-xs text-slate-550 max-w-[220px]">
                                            {cameraError || 'Activate the camera via the start toggle below to start barcode capture.'}
                                        </p>
                                    </div>
                                    {(!isCameraActive || cameraError) && (
                                        <button
                                            onClick={cameraError ? handleRetryCamera : () => setIsCameraActive(true)}
                                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold py-2 px-4 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/30 font-bold"
                                        >
                                            <Play className="w-3.5 h-3.5 fill-current text-slate-950" />
                                            {cameraError ? 'Allow/Retry Camera' : 'Start Camera Feed'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Viewfinder Controls & Camera Selector */}
                        {isCameraActive && !cameraError && (
                            <div className="w-full max-w-md mx-auto grid grid-cols-12 gap-2 text-xs">
                                {/* Camera dropdown selector */}
                                <div className="col-span-9 relative">
                                    <select
                                        value={selectedDeviceId}
                                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                                        className="w-full bg-slate-950 text-slate-300 border border-slate-800 rounded-xl py-3 px-3 pl-8 appearance-none focus:outline-none focus:ring-1 focus:ring-slate-700 transition"
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

                                {/* Stop feed toggle */}
                                <button
                                    onClick={() => setIsCameraActive(false)}
                                    className="col-span-3 bg-slate-950 hover:bg-rose-500/15 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 py-3 rounded-xl transition flex items-center justify-center gap-1.5"
                                    title="Pause Camera"
                                >
                                    <Square className="w-3.5 h-3.5 fill-current" />
                                </button>
                            </div>
                        )}

                        {/* Local Session Scan History Feed */}
                        <div className="flex-1 flex flex-col min-h-0 bg-slate-950/50 rounded-2xl border border-slate-850 p-4 relative">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 select-none flex-none">
                                <div className="flex items-center gap-1.5">
                                    <History className="w-4 h-4 text-emerald-400" />
                                    <h3 className="font-semibold text-xs tracking-wide text-white uppercase">History Feed</h3>
                                </div>
                                <div className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">
                                    {scanHistory.length} items
                                </div>
                            </div>

                            {/* Items scroll list */}
                            <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2">
                                {scanHistory.length > 0 ? (
                                    scanHistory.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
                                        >
                                            <div className="min-w-0 pr-2">
                                                <p className="font-mono text-sm font-bold text-white tracking-wider truncate">
                                                    {item.barcode}
                                                </p>
                                                <p className="text-[10px] text-slate-500 mt-0.5">
                                                    Scanned at {item.timestamp}
                                                </p>
                                            </div>

                                            {/* Sync Receipt Indicators */}
                                            <div className="flex items-center gap-1">
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
                                    <div className="h-full flex flex-col items-center justify-center p-6 text-center select-none text-slate-500 space-y-2">
                                        <div className="w-10 h-10 bg-slate-900/60 rounded-xl flex items-center justify-center text-slate-600 border border-slate-800">
                                            <History className="w-5 h-5" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-semibold text-slate-400">Scanner Ready</p>
                                            <p className="text-[10px] text-slate-650 max-w-[190px]">
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
            <footer className="text-center py-3 select-none text-[10px] border-t border-slate-800 bg-slate-950/50 text-slate-500 font-mono tracking-wider flex-none">
                POS SCANNER PWA © 2026 • RTC DATA CAPTURE
            </footer>
        </div>
    );
}
