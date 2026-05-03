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
  const [isShutdown, setIsShutdown] = useState(false);
  const [proximityScore, setProximityScore] = useState(0);
  const [facesDetected, setFacesDetected] = useState(0);
  const [sensitivity, setSensitivity] = useState<Sensitivity>('Medium');
  const [history, setHistory] = useState<DetectionLog[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastAlertTime = useRef(0);
  const shutdownTimeout = useRef<number | null>(null);

  const triggerAlert = useCallback(() => {
    const now = Date.now();
    if (now - lastAlertTime.current < 5000) return;
    
    lastAlertTime.current = now;
    setIsAlertActive(true);
    
    // 1. Voice Alert
    const msg = new SpeechSynthesisUtterance("Privacy Zone Breeched.");
    window.speechSynthesis.speak(msg);

    // 2. Vibration
    if ('vibrate' in navigator) navigator.vibrate([200]);

    setIsAlertActive(true);
  }, [facesDetected]);

  const [isRegistered, setIsRegistered] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isUniversalMode, setIsUniversalMode] = useState(true);

  const registerIdentity = async () => {
    if (!videoRef.current || !isActive) return;
    setIsScanning(true);
    
    const faces = await peekGuard.detect(videoRef.current);
    if (faces.length === 1) {
      setTimeout(() => {
        setIsRegistered(true);
        setIsScanning(false);
        const msg = new SpeechSynthesisUtterance("Master Identity Confirmed.");
        window.speechSynthesis.speak(msg);
      }, 1500);
    } else {
      setIsScanning(false);
      const msg = new SpeechSynthesisUtterance("Registration failed.");
      window.speechSynthesis.speak(msg);
    }
  };

  useEffect(() => {
    let animationFrame: number;
    
    const runDetection = async () => {
      if (!isActive || !videoRef.current) return;
      
      const faces = await peekGuard.detect(videoRef.current);
      setFacesDetected(faces.length);

      let maxArea = 0;
      if (faces.length > 0 && videoRef.current) {
        const videoArea = videoRef.current.videoWidth * videoRef.current.videoHeight;
        faces.forEach(face => {
          const faceArea = face.box.width * face.box.height;
          const ratio = (faceArea / videoArea) * 100;
          if (ratio > maxArea) maxArea = ratio;
        });
      }
      setProximityScore(Math.min(100, Math.round(maxArea * 5)));

      const distanceThreshold = sensitivity === 'Low' ? 40 : sensitivity === 'Medium' ? 25 : 15;
      
      let shouldAlert = false;
      if (isRegistered) {
        if (faces.length > 1) shouldAlert = true;
      } else {
        if (maxArea > (distanceThreshold / 10)) shouldAlert = true;
      }
      
      // AUTO ON/OFF LOGIC
      if (shouldAlert) {
        if (!isAlertActive) {
          triggerAlert();
        }
      } else {
        if (isAlertActive) {
          setIsAlertActive(false);
          window.speechSynthesis.cancel(); // Turant voice band karo
          const msg = new SpeechSynthesisUtterance("Safe zone restored.");
          window.speechSynthesis.speak(msg);
        }
      }

      animationFrame = requestAnimationFrame(runDetection);
    };

    if (isActive) {
      runDetection();
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isActive, sensitivity, triggerAlert, isRegistered, isAlertActive]);

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
      {/* Black Out Overlay Triggered by Sensor */}
      <AnimatePresence>
        {isAlertActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="text-red-600 mb-8"
            >
              <AlertTriangle size={160} strokeWidth={2.5} />
            </motion.div>
            <h1 className="text-4xl font-black tracking-widest uppercase text-red-600 text-center px-6">
              SENSOR ALERT: PROXIMITY BREACH
            </h1>
            <p className="mt-4 text-gray-700 font-mono text-xs uppercase tracking-[0.2em] animate-pulse">
              [ SCREEN PROTECTED UNTIL CLEAR ]
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6"
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
        {(isAlertActive || (activeApp && isAlertActive)) && !isShutdown && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="text-red-600 mb-8"
            >
              <AlertTriangle size={120} strokeWidth={2} />
            </motion.div>
            <h1 className="text-5xl font-black tracking-tighter uppercase text-red-600 text-center px-6">
              PROXIMITY BREACH
            </h1>
            <div className="mt-4 flex flex-col items-center">
              <p className="text-gray-500 font-mono text-sm animate-pulse">INITIATING EMERGENCY SHUTDOWN...</p>
              <div className="mt-6 w-64 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3 }}
                  className="h-full bg-red-600"
                />
              </div>
            </div>
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
                <h3 className="text-xs font-mono text-gray-500 tracking-wider uppercase">Proximity Sensor</h3>
                <Activity size={14} className={cn("transition-colors", proximityScore > 50 ? "text-red-500" : "text-green-500")} />
              </div>
              <div className="space-y-4">
                <div className="flex items-end gap-2">
                  <span className={cn(
                    "text-6xl font-black tabular-nums tracking-tighter leading-none transition-colors",
                    proximityScore > 50 ? "text-red-500" : "text-white"
                  )}>
                    {proximityScore}%
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono mb-2 uppercase">Density</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${proximityScore}%` }}
                    className={cn(
                      "h-full transition-colors duration-500",
                      proximityScore > 50 ? "bg-red-500 shadow-[0_0_10px_rgba(239,44,44,0.5)]" : "bg-green-500"
                    )}
                  />
                </div>
                <p className="text-[9px] text-gray-600 font-mono uppercase">Estimated Range: {proximityScore > 50 ? "CRITICAL (<2m)" : proximityScore > 20 ? "ZONE 1 (2-5m)" : "CLEAR"}</p>
              </div>
            </div>

            <div className="bg-[#0D0D0D] border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono text-gray-500 tracking-wider uppercase">Live People Radar</h3>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-red-500 uppercase">Scanning...</span>
                </div>
              </div>
              
              <div className="relative h-32 flex items-center justify-center border border-white/5 rounded-xl bg-black/40 overflow-hidden mb-4">
                {/* Radar Lines */}
                <div className="absolute inset-0 border border-white/5 rounded-full scale-50" />
                <div className="absolute inset-0 border border-white/5 rounded-full scale-75" />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-tr from-green-500/20 to-transparent rounded-full origin-center"
                />
                
                {/* Person Indicators */}
                {Array.from({ length: facesDetected }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,44,44,0.8)]"
                    style={{
                      left: `${30 + Math.random() * 40}%`,
                      top: `${30 + Math.random() * 40}%`
                    }}
                  />
                ))}
                
                {isActive && (
                  <User className="text-green-500 relative z-10" size={24} />
                )}
              </div>

              <div className="flex items-end gap-2">
                <span className={cn(
                  "text-6xl font-black tabular-nums tracking-tighter leading-none transition-colors",
                  facesDetected > 1 ? "text-red-500" : "text-white"
                )}>
                  {facesDetected}
                </span>
                <div className="flex flex-col mb-1">
                  <span className="text-[10px] text-gray-500 font-mono uppercase">People</span>
                  <span className="text-[10px] text-gray-700 font-mono uppercase">Around You</span>
                </div>
              </div>
            </div>
          </div>

          {/* Center: Invisible Sensor Area */}
          <div className="md:col-span-8 flex flex-col gap-6">
            <div className="relative aspect-video bg-[#0D0D0D] border border-white/5 rounded-2xl overflow-hidden group">
              <video 
                ref={videoRef}
                autoPlay 
                muted 
                playsInline
                className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
              />
              
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.05)_0%,transparent_70%)]">
                <div className={cn(
                  "w-32 h-32 rounded-full border-2 border-dashed flex items-center justify-center mb-6 transition-all duration-500",
                  isActive ? "border-green-500/30 animate-[spin_10s_linear_infinite]" : "border-gray-800"
                )}>
                  <div className={cn(
                    "w-24 h-24 rounded-full border flex items-center justify-center transition-all duration-300",
                    isActive ? "border-green-500/50 bg-green-500/5" : "border-gray-800"
                  )}>
                    <Activity size={32} className={cn(
                      "transition-colors",
                      isActive ? "text-green-500" : "text-gray-800"
                    )} />
                  </div>
                </div>
                
                <h4 className={cn(
                  "text-sm font-bold uppercase tracking-widest transition-colors",
                  isActive ? "text-green-500" : "text-gray-600"
                )}>
                  {isActive ? 'GHOST SENSOR ACTIVE' : 'SENSOR OFFLINE'}
                </h4>
                <p className="text-[10px] text-gray-700 mt-2 max-w-[250px] font-mono leading-relaxed uppercase">
                  {cameraError || (isActive ? 'Monitoring background proximity with AI face-vector mapping.' : 'Hardware in standby mode.')}
                </p>

                {isActive && (
                  <div className="mt-8 flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          animate={{ x: [-64, 64] }}
                          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                          className="w-full h-full bg-green-500/40"
                        />
                      </div>
                      <span className="mt-2 text-[8px] font-mono text-gray-600">X-SCANNER</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          animate={{ scaleX: [0.5, 1, 0.5] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="w-full h-full bg-blue-500/40"
                        />
                      </div>
                      <span className="mt-2 text-[8px] font-mono text-gray-600">DENSITY-MAP</span>
                    </div>
                  </div>
                )}
              </div>

              {isActive && (
                <>
                  <div className="absolute top-4 left-4 flex gap-2">
                    <div className="bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-bold font-mono tracking-widest text-green-500">REALTIME</span>
                    </div>
                  </div>
                  
                  {/* Decorative Scan lines */}
                  <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(0,255,0,0.02),rgba(0,255,0,0.01),rgba(0,255,0,0.02))] bg-[length:100%_4px,3px_100%] opacity-20" />
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
