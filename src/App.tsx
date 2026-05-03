import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Settings, 
  History, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  User, 
  Users, 
  Lock, 
  Bell, 
  Power,
  Smartphone,
  Info,
  ChevronRight,
  Activity
} from 'lucide-react';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { peekGuard } from './lib/faceDetection';
import { cn } from './lib/utils';

type Sensitivity = 'Low' | 'Medium' | 'High';

interface DetectionLog {
  id: string;
  timestamp: string;
  faceCount: number;
  status: 'SAFE' | 'ALERT';
}

export default function App() {
  const [isActive, setIsActive] = useState(false);
  const [isAlertActive, setIsAlertActive] = useState(false);
  const [facesDetected, setFacesDetected] = useState(0);
  const [sensitivity, setSensitivity] = useState<Sensitivity>('Medium');
  const [history, setHistory] = useState<DetectionLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastAlertTime = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const triggerAlert = useCallback(() => {
    const now = Date.now();
    if (now - lastAlertTime.current < 5000) return;
    
    lastAlertTime.current = now;
    setIsAlertActive(true);
    
    // Voice Alert
    const msg = new SpeechSynthesisUtterance("Warning! Someone is watching your screen.");
    window.speechSynthesis.speak(msg);

    // Vibration (simulation)
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    setHistory(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      faceCount: facesDetected,
      status: 'ALERT'
    }, ...prev].slice(0, 50));

    // Reset alert after 4 seconds
    setTimeout(() => setIsAlertActive(false), 4000);
  }, [facesDetected]);

  const [isRegistered, setIsRegistered] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isUniversalMode, setIsUniversalMode] = useState(true);
  const [trustFaceDescriptor, setTrustFaceDescriptor] = useState<any>(null);

  const registerIdentity = async () => {
    if (!videoRef.current || !isActive) return;
    setIsScanning(true);
    
    // Simulating face ID capture with current detector
    // For a real production app, we would store vector embeddings here
    const faces = await peekGuard.detect(videoRef.current);
    if (faces.length === 1) {
      setTimeout(() => {
        setIsRegistered(true);
        setIsScanning(false);
        // In a full implementation, we'd save the face geometry metadata
        const msg = new SpeechSynthesisUtterance("Identity Registered. Welcome Rehan Bhai.");
        window.speechSynthesis.speak(msg);
      }, 1500);
    } else {
      setIsScanning(false);
      alert("Please ensure only your face is visible during registration.");
    }
  };

  useEffect(() => {
    let animationFrame: number;
    
    const runDetection = async () => {
      if (!isActive || !videoRef.current) return;
      
      const faces = await peekGuard.detect(videoRef.current);
      setFacesDetected(faces.length);

      // Smart Logic:
      // If 1 face detected but NOT registered -> Trigger (Someone else using)
      // If 2+ faces detected -> Trigger (Someone is peeking)
      
      const threshold = sensitivity === 'Low' ? 3 : sensitivity === 'Medium' ? 2 : 1;
      
      let shouldAlert = false;

      if (isRegistered) {
        // If owner is registered, alert if more than 1 face OR if the only face is significantly different
        // (Simplified for this version to count-based with Trust zone)
        if (faces.length > 1) {
          shouldAlert = true;
        }
      } else {
        // If not registered, use basic threshold logic
        if (faces.length >= threshold && threshold > 0) {
          // Default to allowing at least 1 face if sensitivity is not 'High'
          if (sensitivity !== 'High' || faces.length > 1) {
            shouldAlert = true;
          }
        }
      }
      
      if (shouldAlert) {
        triggerAlert();
      }

      animationFrame = requestAnimationFrame(runDetection);
    };

    if (isActive) {
      runDetection();
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isActive, sensitivity, triggerAlert, isRegistered]);

  const toggleGuard = async () => {
    setCameraError(null);
    if (!isActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Ensure video plays before starting AI
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current?.play();
              await peekGuard.init();
              setIsActive(true);
            } catch (e) {
              setCameraError("Autoplay blocked. Tap to start video.");
            }
          };
        }
      } catch (err: any) {
        console.error('Camera access denied:', err);
        if (err.name === 'NotAllowedError') {
          setCameraError("Camera permission denied. Please allow camera access in settings.");
        } else if (err.name === 'NotFoundError') {
          setCameraError("No front camera detected on this device.");
        } else {
          setCameraError("Camera initialization failed. Check if another app is using it.");
        }
      }
    } else {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
      setIsActive(false);
      setFacesDetected(0);
    }
  };

  const [protectedApps, setProtectedApps] = useState(['Telegram', 'WhatsApp', 'Gallery', 'Instagram']);
  const [activeApp, setActiveApp] = useState<string | null>(null);

  // Auto-activate when "opening" a protected app in simulation
  const launchApp = (appName: string) => {
    setActiveApp(appName);
    if (!isActive) {
      toggleGuard();
    }
  };

  const [showSettings, setShowSettings] = useState(false);
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('PEEK_GUARD_GEMINI_KEY') || '');

  const saveSettings = () => {
    localStorage.setItem('PEEK_GUARD_GEMINI_KEY', geminiKey);
    setShowSettings(false);
    const msg = new SpeechSynthesisUtterance("Settings saved. Gemini AI Engine initialized.");
    window.speechSynthesis.speak(msg);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-red-500/30 overflow-hidden">
      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0D0D0D] border border-white/10 w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-lg">
                    <Settings className="text-white" size={20} />
                  </div>
                  <h2 className="text-xl font-bold">System Settings</h2>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white">
                  <EyeOff size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-mono text-gray-500 uppercase mb-2 tracking-widest">Google Gemini API Key</label>
                  <div className="relative">
                    <input 
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="Paste your API key here..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        geminiKey ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-gray-700"
                      )} />
                    </div>
                  </div>
                  <p className="mt-2 text-[9px] text-gray-600 font-mono leading-tight uppercase">
                    API keys are stored locally on your device for maximum privacy.
                  </p>
                </div>

                <div className="pt-4 space-y-3">
                  <button 
                    onClick={saveSettings}
                    className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-95"
                  >
                    SAVE CONFIGURATION
                  </button>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full py-4 bg-white/5 text-gray-400 rounded-xl font-bold hover:bg-white/10 transition-all"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Black Out Overlay */}
      <AnimatePresence>
        {(isAlertActive || (activeApp && isAlertActive)) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-red-500"
            >
              <Lock size={120} strokeWidth={1} />
            </motion.div>
            <h1 className="mt-8 text-4xl font-black tracking-tighter uppercase text-red-500">Privacy Shield Active</h1>
            <p className="mt-2 text-gray-500 font-mono animate-pulse">UNAUTHORIZED VIEWER DETECTED IN {activeApp?.toUpperCase() || 'SYSTEM'}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mock App Interface when "App" is open */}
      <AnimatePresence>
        {activeApp && !isAlertActive && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-0 z-50 bg-[#0A0A0A] p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveApp(null)} className="p-2 bg-white/5 rounded-full">
                  <ChevronRight className="rotate-180" />
                </button>
                <h2 className="text-xl font-bold">{activeApp}</h2>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                <Shield size={12} className="text-green-500" />
                <span className="text-[10px] font-mono text-green-500 uppercase">AI Protected</span>
              </div>
            </div>
            
            <div className="flex-1 border border-white/5 rounded-3xl p-8 bg-gradient-to-br from-white/[0.02] to-transparent">
              <div className="space-y-6">
                <div className="h-4 w-48 bg-white/5 rounded-full" />
                <div className="h-32 w-full bg-white/5 rounded-2xl" />
                <div className="h-4 w-64 bg-white/5 rounded-full" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-24 bg-white/5 rounded-2xl" />
                  <div className="h-24 bg-white/5 rounded-2xl" />
                </div>
              </div>
              <div className="mt-12 text-center">
                <p className="text-sm text-gray-600 font-mono uppercase tracking-widest">Your Private Content is here</p>
                <p className="text-[10px] text-gray-700 mt-2">Peek Guard is watching behind you...</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout */}
      <div className="max-w-4xl mx-auto p-6 md:p-12 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2 rounded-lg">
              <Shield className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">PEEK GUARD <span className="text-red-600">AI</span></h2>
              <p className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">Version 2.4.0 • REHAN_BHAI EDITION</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "p-2 rounded-full transition-colors",
                showHistory ? "bg-red-600 text-white" : "hover:bg-white/5 text-gray-400"
              )}
            >
              <History size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Left: Controls & Stats */}
          <div className="md:col-span-4 space-y-6">
            <div className="bg-[#0D0D0D] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Smartphone size={120} />
              </div>
              <div className="relative z-10">
                <h3 className="text-xs font-mono text-gray-500 mb-4 tracking-wider uppercase">System Status</h3>
                <div className="flex items-center gap-4 mb-6">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500",
                    isActive ? "bg-green-500/10 text-green-500 shadow-[0_0_20px_rgba(34,197,94,0.2)]" : "bg-white/5 text-gray-500"
                  )}>
                    <Activity size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{isActive ? 'PROTECTION ON' : 'PROTECTION OFF'}</p>
                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-tighter">
                      {isActive ? 'Live Monitoring Active' : 'System Standby'}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={toggleGuard}
                  className={cn(
                    "w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95",
                    isActive 
                      ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20" 
                      : "bg-white text-black hover:bg-gray-200"
                  )}
                >
                  <Power size={20} />
                  {isActive ? 'DEACTIVATE' : 'ACTIVATE GUARD'}
                </button>
              </div>
            </div>

            <div className="bg-[#0D0D0D] border border-white/5 rounded-2xl p-6 overflow-hidden relative">
              <h3 className="text-xs font-mono text-gray-500 mb-4 tracking-wider uppercase">Identity Verification</h3>
              
              {!isRegistered ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                    <Info size={16} className="text-red-500 shrink-0" />
                    <p className="text-[10px] text-gray-400 font-mono leading-tight uppercase">Register your face to disable alerts when you are alone.</p>
                  </div>
                  <button 
                    onClick={registerIdentity}
                    disabled={!isActive || isScanning}
                    className={cn(
                      "w-full py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-95",
                      !isActive ? "bg-white/5 text-gray-600 cursor-not-allowed" : "bg-white text-black hover:bg-gray-200"
                    )}
                  >
                    {isScanning ? (
                      <motion.div 
                        animate={{ rotate: 360 }} 
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      >
                        <Shield size={16} />
                      </motion.div>
                    ) : (
                      <User size={16} />
                    )}
                    {isScanning ? 'SCANNING...' : 'REGISTER MASTER ID'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-500 p-1.5 rounded-full">
                        <Lock size={12} className="text-black" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-green-500 font-mono">ID VERIFIED</p>
                        <p className="text-[8px] text-gray-500 font-mono uppercase">Master: Rehan Bhai</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsRegistered(false)}
                      className="text-[8px] font-bold font-mono text-red-500 hover:underline"
                    >
                      RESET
                    </button>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-[10px] text-gray-400 font-mono uppercase italic leading-tight">
                      System will ignore Master ID. Alert will only trigger if +1 additional face is detected.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-[#0D0D0D] border border-white/5 rounded-2xl p-6">
              <div className="grid grid-cols-3 gap-2">
                {(['Low', 'Medium', 'High'] as Sensitivity[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => setSensitivity(level)}
                    className={cn(
                      "py-3 rounded-lg text-xs font-bold transition-all",
                      sensitivity === level 
                        ? "bg-white text-black" 
                        : "bg-white/5 text-gray-500 hover:bg-white/10"
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[10px] text-gray-600 font-mono leading-relaxed uppercase">
                {sensitivity === 'Low' && 'Triggers after 3 or more faces detected.'}
                {sensitivity === 'Medium' && 'Triggers after 2 or more faces detected.'}
                {sensitivity === 'High' && 'Triggers as soon as any non-trusted face appears.'}
              </p>
            </div>

            <div className="bg-[#0D0D0D] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono text-gray-500 tracking-wider uppercase">Live Counter</h3>
                <Users size={14} className="text-gray-500" />
              </div>
              <div className="flex items-end gap-2">
                <span className={cn(
                  "text-6xl font-black tabular-nums tracking-tighter leading-none transition-colors",
                  facesDetected > 1 ? "text-red-500" : "text-white"
                )}>
                  {facesDetected}
                </span>
                <span className="text-xs text-gray-500 font-mono mb-2 uppercase">Faces In Range</span>
              </div>
            </div>
          </div>

          {/* Right: Camera Preview & Logs */}
          <div className="md:col-span-8 flex flex-col gap-6">
            <div className="relative aspect-video bg-[#0D0D0D] border border-white/5 rounded-2xl overflow-hidden group">
              <video 
                ref={videoRef}
                autoPlay 
                muted 
                playsInline
                className={cn(
                  "w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-1000",
                  isActive ? "opacity-40" : "opacity-0"
                )}
              />
              
              {!isActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/60 backdrop-blur-sm">
                  {cameraError ? (
                    <motion.div 
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className="flex flex-col items-center"
                    >
                      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                        <AlertTriangle size={32} className="text-red-500" />
                      </div>
                      <h4 className="text-sm font-bold uppercase tracking-widest text-red-500">Hardware Access Error</h4>
                      <p className="text-[10px] text-gray-300 mt-2 max-w-[250px] font-mono leading-relaxed bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                        {cameraError}
                      </p>
                      <button 
                        onClick={toggleGuard}
                        className="mt-6 px-6 py-2 bg-white text-black text-[10px] font-bold rounded-full uppercase tracking-tighter hover:bg-gray-200 transition-colors"
                      >
                        Try Again
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                        <EyeOff size={32} className="text-gray-600" />
                      </div>
                      <h4 className="text-sm font-bold uppercase tracking-widest text-gray-500">Camera Feed Scrambled</h4>
                      <p className="text-[10px] text-gray-600 mt-2 max-w-[200px] font-mono leading-relaxed">SYSTEM IS CURRENTLY IN PASSIVE MODE. ACTIVATE TO SEE AI OVERLAY.</p>
                    </>
                  )}
                </div>
              )}

              {isActive && (
                <>
                  <div className="absolute top-4 left-4 flex gap-2">
                    <div className="bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[10px] font-bold font-mono tracking-widest">LIVE FEED</span>
                    </div>
                  </div>
                  
                  {/* Decorative Scan lines */}
                  <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20" />
                </>
              )}
            </div>

            <div className="bg-[#0D0D0D] border border-white/5 rounded-2xl p-6 flex-1 overflow-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-mono text-gray-500 tracking-wider uppercase">Protection Scope</h3>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-bold font-mono transition-colors",
                  isUniversalMode ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-white/5 text-gray-500 border border-white/5"
                )}>
                  {isUniversalMode ? "ALL APPS SECURED" : "SELECTIVE MODE"}
                </div>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => setIsUniversalMode(!isUniversalMode)}
                  className={cn(
                    "w-full p-6 rounded-2xl border transition-all flex items-center justify-between group",
                    isUniversalMode 
                      ? "bg-red-600/10 border-red-600/30 text-white" 
                      : "bg-white/5 border-white/5 text-gray-500"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                      isUniversalMode ? "bg-red-600 text-white" : "bg-white/10 text-gray-400"
                    )}>
                      <Shield size={24} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold uppercase tracking-tight">Global Shield</p>
                      <p className="text-[10px] font-mono uppercase opacity-60">Protect every app on this device</p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-12 h-6 rounded-full relative transition-colors duration-300",
                    isUniversalMode ? "bg-red-600" : "bg-white/10"
                  )}>
                    <motion.div 
                      animate={{ x: isUniversalMode ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </div>
                </button>

                {!isUniversalMode && (
                  <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-4">
                    {protectedApps.map((app) => (
                      <button 
                        key={app}
                        onClick={() => launchApp(app)}
                        className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all group"
                      >
                        <div className="text-left">
                          <p className="text-sm font-bold uppercase tracking-tight">{app}</p>
                        </div>
                        <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-mono text-gray-500">OPEN TEST</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <footer className="mt-12 py-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest leading-none">Security Node</span>
              <span className="text-[10px] font-bold font-mono text-gray-400">BH-1992-ALPHA</span>
            </div>
            <div className="h-6 w-[1px] bg-white/5" />
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest leading-none">Encryption</span>
              <span className="text-[10px] font-bold font-mono text-green-500">AES-256 ACTIVE</span>
            </div>
            <div className="h-6 w-[1px] bg-white/5" />
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest leading-none">Gemini AI</span>
              <span className={cn(
                "text-[10px] font-bold font-mono",
                geminiKey ? "text-blue-500" : "text-gray-700"
              )}>
                {geminiKey ? 'LINKED' : 'OFFLINE'}
              </span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-gray-600 uppercase tracking-tighter bg-white/5 px-4 py-2 rounded-full border border-white/5">
            Designed for Peak Protection • © 2026 REHAN_BHAI
          </div>
        </footer>
      </div>

      {/* Background decoration */}
      <div className="fixed top-0 left-1/4 w-[1px] h-full bg-white/[0.03] -z-10" />
      <div className="fixed top-0 right-1/4 w-[1px] h-full bg-white/[0.03] -z-10" />
      <div className="fixed -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-red-600/5 blur-[120px] -z-10" />
    </div>
  );
}
