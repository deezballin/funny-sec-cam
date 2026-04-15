import React, { useState, useEffect, useRef } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Camera, 
  Shield, 
  Activity, 
  Terminal, 
  AlertTriangle, 
  Volume2, 
  Cpu, 
  Zap, 
  Eye,
  Settings as SettingsIcon,
  History,
  Mic,
  Maximize2,
  RefreshCw,
  Ghost,
  Laugh,
  Angry,
  UserCheck,
  X as XIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/src/lib/utils";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Event {
  id: number;
  timestamp: string;
  type: string;
  description: string;
  camera_id: number;
  confidence?: number;
  params?: string;
}

interface ZIONSettings {
  tone: "mocking" | "aggressive" | "professional" | "creepy";
  humorLevel: number;
  autoDeter: boolean;
  customPhrases: string;
  voiceVoice: "Zephyr" | "Puck" | "Charon" | "Kore" | "Fenrir";
  localModelEnabled: boolean;
  localModelUrl: string;
}

interface CameraState {
  brightness: number;
  contrast: number;
  saturation: number;
  rotation: number;
  thermalMode: boolean;
}

interface Alert {
  id: string;
  type: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  timestamp: Date;
}

// Fixed phrases that cannot be changed
const STANDARD_PHRASES = [
  "Unauthorized access detected. Authorities have been notified.",
  "You are being monitored by ZION Vision Command. Exit immediately.",
  "Biometric data captured. Facial recognition in progress."
];

interface Message {
  role: "user" | "model";
  text: string;
}

export default function App() {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraMapping, setCameraMapping] = useState<Record<number, string>>({ 0: "", 1: "", 2: "" });
  const [cameraStates, setCameraStates] = useState<Record<number, CameraState>>({
    0: { brightness: 100, contrast: 100, saturation: 100, rotation: 0, thermalMode: false },
    1: { brightness: 100, contrast: 100, saturation: 100, rotation: 0, thermalMode: false },
    2: { brightness: 100, contrast: 100, saturation: 100, rotation: 0, thermalMode: false }
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<Record<number, boolean>>({ 0: false, 1: false, 2: false });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [settings, setSettings] = useState<ZIONSettings>({
    tone: "mocking",
    humorLevel: 80,
    autoDeter: true,
    customPhrases: "I'm working here, go away! // Who invited you? // System breach detected: Ugly human found. // Is that your face or did you sit on a waffle iron?",
    voiceVoice: "Zephyr",
    localModelEnabled: false,
    localModelUrl: "http://localhost:11434/api/generate"
  });
  const [systemStats, setSystemStats] = useState({
    cpu: 0,
    temp: 0,
    mem: 0,
    uptime: "00:00:00"
  });

  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisIntervals = useRef<Record<number, NodeJS.Timeout>>({});
  const isSpeakingRef = useRef(false);

  // Alert System
  const addAlert = (type: Alert["type"], message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setAlerts(prev => [{ id, type, message, timestamp: new Date() }, ...prev].slice(0, 5));
    if (type === "CRITICAL") {
      speak(`Critical Alert: ${message}`);
    }
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  // Initialize cameras
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === "videoinput");
        setCameras(videoDevices);
        
        const initialMapping: Record<number, string> = {};
        videoDevices.slice(0, 3).forEach((device, i) => {
          initialMapping[i] = device.deviceId;
        });
        setCameraMapping(initialMapping);
      } catch (err) {
        addAlert("CRITICAL", "Hardware Access Denied: Check camera permissions.");
      }
    }

    getDevices();
    fetchEvents();

    const interval = setInterval(() => {
      const cpu = Math.floor(Math.random() * 40) + 10;
      const temp = Math.floor(Math.random() * 15) + 45;
      
      if (cpu > 85) addAlert("WARNING", "High CPU Load Detected");
      if (temp > 75) addAlert("CRITICAL", "Thermal Overload Imminent");

      setSystemStats({
        cpu,
        temp,
        mem: Math.floor(Math.random() * 20) + 30,
        uptime: new Date().toLocaleTimeString()
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      Object.values(analysisIntervals.current).forEach(clearInterval);
    };
  }, []);

  // Real-time Analysis Loop
  useEffect(() => {
    if (settings.autoDeter) {
      [0, 1, 2].forEach(idx => {
        if (!analysisIntervals.current[idx] && cameraMapping[idx]) {
          analysisIntervals.current[idx] = setInterval(() => {
            analyzeVision(idx, true);
          }, 15000); // Analyze every 15 seconds in auto mode
        }
      });
    } else {
      Object.values(analysisIntervals.current).forEach(clearInterval);
      analysisIntervals.current = {};
    }
  }, [settings.autoDeter, cameraMapping]);

  useEffect(() => {
    Object.entries(cameraMapping).forEach(async ([idxStr, deviceId]) => {
      const idx = parseInt(idxStr);
      if (!deviceId) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId as string } }
        });
        if (videoRefs[idx].current) {
          videoRefs[idx].current!.srcObject = stream;
        }
      } catch (err) {
        addAlert("WARNING", `Feed Lost: Camera 0${idx + 1}`);
      }
    });
  }, [cameraMapping]);

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error("Error fetching events:", err);
    }
  };

  const logEvent = async (type: string, description: string, cameraId: number, confidence?: number, params?: string) => {
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description, camera_id: cameraId, confidence, params })
      });
      fetchEvents();
    } catch (err) {
      console.error("Error logging event:", err);
    }
  };

  const captureFrame = (cameraId: number) => {
    const video = videoRefs[cameraId].current;
    if (!video || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg").split(",")[1];
  };

  const analyzeVision = async (cameraId: number, isAuto = false) => {
    if (isAnalyzing[cameraId]) return;
    setIsAnalyzing(prev => ({ ...prev, [cameraId]: true }));

    const base64Image = captureFrame(cameraId);
    if (!base64Image) {
      setIsAnalyzing(prev => ({ ...prev, [cameraId]: false }));
      return;
    }

    try {
      const prompt = `
        Analyze this surveillance feed. 
        Current Settings: Tone=${settings.tone}, HumorLevel=${settings.humorLevel}%, CustomPhrases=[${settings.customPhrases}].
        Standard Deterrents (Use if serious threat): [${STANDARD_PHRASES.join(" | ")}].
        
        Task:
        1. If you see a person, identify if they are an intruder or just someone bothering the user.
        2. If Tone is 'mocking', focus on wit and insults.
        3. If it's a serious anomaly (weapon, mask, forced entry), use a Standard Deterrent.
        4. If it's just someone being annoying, use a Custom Phrase or generate a new one.
        
        IMPORTANT: Return your analysis in JSON format:
        {
          "analysis": "...",
          "deterrent": "...",
          "confidence": 0.0 to 1.0,
          "params": "detected_objects: [list], threat_level: [low/med/high]"
        }
      `;

      let resultText = "";
      let confidence = 0.85;
      let params = "threat_level: low";

      if (settings.localModelEnabled) {
        // Local Model Integration (Ollama style)
        const res = await fetch(settings.localModelUrl, {
          method: "POST",
          body: JSON.stringify({
            model: "llava", // Assuming a vision model like llava for local
            prompt: prompt,
            images: [base64Image],
            stream: false
          })
        });
        const data = await res.json();
        resultText = data.response;
      } else {
        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType: "image/jpeg", data: base64Image } }
              ]
            }
          ],
          config: { responseMimeType: "application/json" }
        });
        resultText = response.text;
      }

      const parsed = JSON.parse(resultText);
      const cleanAnalysis = parsed.analysis || "";
      const cleanDeterrent = parsed.deterrent || "";
      confidence = parsed.confidence || 0.85;
      params = parsed.params || "threat_level: unknown";

      if (cleanAnalysis.toLowerCase().includes("person") || cleanAnalysis.toLowerCase().includes("intruder")) {
        logEvent(isAuto ? "AUTO_DETECTION" : "MANUAL_SCAN", cleanAnalysis, cameraId, confidence, params);
        if (cleanDeterrent) {
          speak(cleanDeterrent);
          setChatMessages(prev => [...prev, { role: "model", text: `[SENTINEL]: ${cleanDeterrent}` }]);
        }
      }
    } catch (err) {
      console.error("Vision analysis error:", err);
    } finally {
      setIsAnalyzing(prev => ({ ...prev, [cameraId]: false }));
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setIsChatLoading(true);

    try {
      const history = chatMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      let aiMsg = "";
      if (settings.localModelEnabled) {
        const res = await fetch(settings.localModelUrl, {
          method: "POST",
          body: JSON.stringify({
            model: "llama3",
            prompt: userMsg,
            stream: false
          })
        });
        const data = await res.json();
        aiMsg = data.response;
      } else {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [...history, { role: "user", parts: [{ text: userMsg }] }],
          config: {
            systemInstruction: `You are the ZION Sentinel AI, a high-tech surveillance and deterrence system. 
            Your tone is ${settings.tone} with a humor level of ${settings.humorLevel}%. 
            You interact with the user (the commander) and can also be used to speak to would-be crooks.
            Keep your responses concise and technical. If the user asks you to say something to the crook, provide the text and I will speak it.`
          }
        });
        aiMsg = response.text;
      }

      setChatMessages(prev => [...prev, { role: "model", text: aiMsg }]);
      
      if (aiMsg.length < 200) {
        speak(aiMsg);
      }
    } catch (err) {
      console.error("Chat error:", err);
      addAlert("WARNING", "Comms Link Interrupted");
    } finally {
      setIsChatLoading(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addAlert("WARNING", "Voice Input not supported.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setChatInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const speak = async (text: string) => {
    if (isSpeakingRef.current) return;
    isSpeakingRef.current = true;
    setIsSpeaking(true);

    try {
      let inflection = "robotic and authoritative";
      if (settings.tone === "mocking") inflection = "witty, sarcastic, and mocking";
      if (settings.tone === "aggressive") inflection = "loud, angry, and commanding";
      if (settings.tone === "creepy") inflection = "unsettling, slow, and whispery";
      if (settings.tone === "professional") inflection = "calm, firm, and corporate";

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say with a ${inflection} voice: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: settings.voiceVoice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Int16Array(len / 2);
        
        for (let i = 0; i < len; i += 2) {
          const low = binaryString.charCodeAt(i) & 0xff;
          const high = binaryString.charCodeAt(i + 1) & 0xff;
          let val = (high << 8) | low;
          if (val > 32767) val -= 65536;
          bytes[i / 2] = val;
        }
        
        const float32Data = new Float32Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
          float32Data[i] = bytes[i] / 32768.0;
        }

        const buffer = audioContext.createBuffer(1, float32Data.length, 24000);
        buffer.getChannelData(0).set(float32Data);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.onended = () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          audioContext.close();
        };
        source.start();
      } else {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      }
    } catch (err) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  };

  const handleCameraChange = (idx: number, deviceId: string) => {
    setCameraMapping(prev => ({ ...prev, [idx]: deviceId }));
  };

  const updateCameraState = (idx: number, key: keyof CameraState, val: number | boolean) => {
    setCameraStates(prev => ({
      ...prev,
      [idx]: { ...prev[idx], [key]: val }
    }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#00ff41] font-mono p-4 selection:bg-[#00ff41] selection:text-black">
      {/* Critical Alerts Overlay */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md space-y-2 px-4">
        <AnimatePresence>
          {alerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "p-3 rounded border flex items-center justify-between shadow-[0_0_20px_rgba(0,0,0,0.5)]",
                alert.type === "CRITICAL" ? "bg-red-900/90 border-red-500 text-white animate-pulse" : 
                alert.type === "WARNING" ? "bg-yellow-900/90 border-yellow-500 text-white" : 
                "bg-blue-900/90 border-blue-500 text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-tighter">{alert.message}</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon-xs" 
                onClick={() => removeAlert(alert.id)}
                className="hover:bg-white/20"
              >
                <XIcon className="w-3 h-3" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#00ff41]/30 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#00ff41]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase">ZION Vision Command</h1>
            <p className="text-[10px] opacity-60 italic">
              {settings.autoDeter ? "AUTO_SENTINEL: ACTIVE" : "MANUAL_MODE: READY"} // {systemStats.uptime}
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <Dialog>
            <DialogTrigger render={<Button variant="outline" className="border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41] hover:text-black gap-2" />}>
              <SettingsIcon className="w-4 h-4" /> CONFIG
            </DialogTrigger>
            <DialogContent className="bg-black border-[#00ff41]/30 text-[#00ff41] max-w-md">
              <DialogHeader>
                <DialogTitle className="text-[#00ff41] uppercase tracking-widest">ZION_OS Configuration</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] uppercase opacity-60">Auto-Sentinel Mode</Label>
                    <p className="text-[8px] opacity-40">Continuous AI scanning and deterrence.</p>
                  </div>
                  <Switch 
                    checked={settings.autoDeter} 
                    onCheckedChange={(v) => setSettings(s => ({ ...s, autoDeter: v }))}
                    className="data-[state=checked]:bg-[#00ff41]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase opacity-60">Deterrence Tone</Label>
                  <Select value={settings.tone} onValueChange={(v: any) => setSettings(s => ({ ...s, tone: v }))}>
                    <SelectTrigger className="bg-black border-[#00ff41]/20 text-[#00ff41]"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-black border-[#00ff41]/20 text-[#00ff41]">
                      <SelectItem value="mocking">Mocking</SelectItem>
                      <SelectItem value="aggressive">Aggressive</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="creepy">Creepy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase opacity-60">Custom Phrases (Split by //)</Label>
                  <textarea 
                    className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-xs h-20 focus:outline-none focus:border-[#00ff41]"
                    value={settings.customPhrases}
                    onChange={(e) => setSettings(s => ({ ...s, customPhrases: e.target.value }))}
                  />
                  <p className="text-[8px] opacity-40">Standard deterrents are always active and cannot be modified.</p>
                </div>

                <div className="pt-4 border-t border-[#00ff41]/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase opacity-60">Local Model (TinyClaw/Ollama)</Label>
                      <p className="text-[8px] opacity-40">Use local hardware for inference.</p>
                    </div>
                    <Switch 
                      checked={settings.localModelEnabled} 
                      onCheckedChange={(v) => setSettings(s => ({ ...s, localModelEnabled: v }))}
                      className="data-[state=checked]:bg-[#00ff41]"
                    />
                  </div>
                  {settings.localModelEnabled && (
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase opacity-60">Local API Endpoint</Label>
                      <input 
                        type="text"
                        className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] focus:outline-none focus:border-[#00ff41]"
                        value={settings.localModelUrl}
                        onChange={(e) => setSettings(s => ({ ...s, localModelUrl: e.target.value }))}
                        placeholder="http://localhost:11434/api/generate"
                      />
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2].map((idx) => (
            <Card key={idx} className={cn(
              "bg-black border-[#00ff41]/20 overflow-hidden group relative",
              idx === 0 && "md:col-span-2 aspect-video",
              idx !== 0 && "aspect-video"
            )}>
              <div className="absolute top-2 left-2 z-10 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", isAnalyzing[idx] ? "bg-yellow-500 animate-pulse" : "bg-red-500 animate-ping")} />
                  <span className="text-[10px] bg-black/80 px-2 py-0.5 rounded border border-[#00ff41]/30">
                    CAM_0{idx + 1}
                  </span>
                </div>
                
                <Select value={cameraMapping[idx]} onValueChange={(v) => handleCameraChange(idx, v)}>
                  <SelectTrigger className="h-6 w-32 bg-black/80 border-[#00ff41]/20 text-[8px] uppercase">
                    <SelectValue placeholder="Select Camera" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-[#00ff41]/20 text-[#00ff41]">
                    {cameras.map(cam => (
                      <SelectItem key={cam.deviceId} value={cam.deviceId} className="text-[10px]">
                        {cam.label || `Camera ${cam.deviceId.slice(0, 4)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <video 
                ref={videoRefs[idx]} 
                autoPlay 
                playsInline 
                muted 
                style={{ 
                  filter: `brightness(${cameraStates[idx].brightness}%) contrast(${cameraStates[idx].contrast}%) saturate(${cameraStates[idx].saturation}%) ${cameraStates[idx].thermalMode ? 'grayscale(1) brightness(1.2) contrast(1.5) invert(1) sepia(1) hue-rotate(200deg) saturate(3)' : ''}`,
                  transform: `rotate(${cameraStates[idx].rotation}deg)`
                }}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-300"
              />

              {/* Stream Controls Overlay */}
              <div className="absolute top-2 right-2 z-10 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 p-3 rounded border border-[#00ff41]/30 shadow-xl backdrop-blur-md w-48">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-[9px] uppercase font-bold text-[#00ff41]">Thermal Vision</Label>
                  <Switch 
                    checked={cameraStates[idx].thermalMode}
                    onCheckedChange={(v) => updateCameraState(idx, "thermalMode", v as any)}
                    className="scale-75 data-[state=checked]:bg-orange-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-[9px] uppercase font-bold tracking-tighter text-[#00ff41]/80">Brightness</Label>
                    <span className="text-[8px] opacity-50">{cameraStates[idx].brightness}%</span>
                  </div>
                  <Slider 
                    value={[cameraStates[idx].brightness]} 
                    onValueChange={(vals) => updateCameraState(idx, "brightness", vals[0])}
                    max={200} step={1} className="[&_[role=slider]]:size-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-[9px] uppercase font-bold tracking-tighter text-[#00ff41]/80">Contrast</Label>
                    <span className="text-[8px] opacity-50">{cameraStates[idx].contrast}%</span>
                  </div>
                  <Slider 
                    value={[cameraStates[idx].contrast]} 
                    onValueChange={(vals) => updateCameraState(idx, "contrast", vals[0])}
                    max={200} step={1} className="[&_[role=slider]]:size-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-[9px] uppercase font-bold tracking-tighter text-[#00ff41]/80">Saturation</Label>
                    <span className="text-[8px] opacity-50">{cameraStates[idx].saturation}%</span>
                  </div>
                  <Slider 
                    value={[cameraStates[idx].saturation]} 
                    onValueChange={(vals) => updateCameraState(idx, "saturation", vals[0])}
                    max={200} step={1} className="[&_[role=slider]]:size-3"
                  />
                </div>

                <div className="space-y-1.5 pt-1 border-t border-[#00ff41]/10">
                  <Label className="text-[9px] uppercase font-bold tracking-tighter text-[#00ff41]/80">Rotation Control</Label>
                  <div className="flex gap-1">
                    {[0, 90, 180, 270].map(deg => (
                      <Button 
                        key={deg}
                        size="icon-xs" 
                        variant="outline" 
                        className={cn(
                          "w-8 h-6 text-[9px] border-[#00ff41]/20 hover:bg-[#00ff41]/10", 
                          cameraStates[idx].rotation === deg && "bg-[#00ff41] text-black border-[#00ff41] hover:bg-[#00ff41]"
                        )}
                        onClick={() => updateCameraState(idx, "rotation", deg)}
                        title={`Rotate ${deg} degrees`}
                      >
                        {deg}°
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute bottom-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-[10px] border-[#00ff41]/30 hover:bg-[#00ff41] hover:text-black"
                  onClick={() => analyzeVision(idx)}
                  disabled={isAnalyzing[idx]}
                >
                  <Eye className="w-3 h-3 mr-1" /> SCAN
                </Button>
              </div>

              <AnimatePresence>
                {isAnalyzing[idx] && (
                  <motion.div 
                    initial={{ top: 0 }}
                    animate={{ top: "100%" }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 w-full h-0.5 bg-[#00ff41] shadow-[0_0_15px_#00ff41] z-20 pointer-events-none"
                  />
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="bg-black border-[#00ff41]/20 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span className="text-xs uppercase font-bold">System_Load</span>
              </div>
              <Badge variant="outline" className="text-[8px] border-[#00ff41]/30">{systemStats.cpu}%</Badge>
            </div>
            <div className="h-1 bg-[#00ff41]/10 rounded-full overflow-hidden">
              <motion.div animate={{ width: `${systemStats.cpu}%` }} className="h-full bg-[#00ff41]" />
            </div>
          </Card>

          <Card className="bg-black border-[#00ff41]/20 h-[450px] flex flex-col">
            <CardHeader className="p-4 pb-2 border-b border-[#00ff41]/10">
              <CardTitle className="text-xs uppercase flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Detection_Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-4">
                  {events.map((event) => (
                    <div key={event.id} className="text-[10px] border-l border-[#00ff41]/30 pl-3 py-1">
                      <div className="flex justify-between opacity-50 mb-1">
                        <span>[{new Date(event.timestamp).toLocaleTimeString()}]</span>
                        <span>CAM_0{event.camera_id + 1}</span>
                      </div>
                      <p className="leading-tight">
                        <span className="text-[#00ff41]/80 font-bold">{event.type}:</span> {event.description}
                      </p>
                      {(event.confidence || event.params) && (
                        <div className="mt-1 flex gap-2 opacity-40 text-[8px]">
                          {event.confidence && <span>CONF: {(event.confidence * 100).toFixed(1)}%</span>}
                          {event.params && <span>PARAMS: {event.params}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* COMMS / Chat Panel */}
          <Card className="bg-black border-[#00ff41]/20 h-[450px] flex flex-col">
            <CardHeader className="p-4 pb-2 border-b border-[#00ff41]/10">
              <CardTitle className="text-xs uppercase flex items-center gap-2">
                <Mic className="w-4 h-4" /> Comms_Interface
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {chatMessages.length === 0 && (
                    <p className="text-[10px] opacity-40 italic text-center mt-10">
                      Secure comms link established. Awaiting command...
                    </p>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={cn(
                      "text-[10px] p-2 rounded border",
                      msg.role === "user" ? "bg-[#00ff41]/5 border-[#00ff41]/20 ml-4" : "bg-black border-[#00ff41]/40 mr-4"
                    )}>
                      <span className="font-bold uppercase block mb-1 opacity-60">
                        {msg.role === "user" ? "Commander" : "Sentinel"}
                      </span>
                      {msg.text}
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="text-[10px] animate-pulse opacity-50">Processing...</div>
                  )}
                </div>
              </ScrollArea>
              <form onSubmit={handleSendMessage} className="p-2 border-t border-[#00ff41]/10 flex gap-2">
                <Button 
                  type="button" 
                  size="icon-xs" 
                  variant="outline" 
                  className={cn("h-7 w-7 border-[#00ff41]/30", isListening && "bg-red-500/20 border-red-500 text-red-500 animate-pulse")}
                  onClick={startListening}
                >
                  <Mic className="w-3 h-3" />
                </Button>
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Enter command..."
                  className="flex-1 bg-black border border-[#00ff41]/20 rounded px-2 py-1 text-[10px] focus:outline-none focus:border-[#00ff41]"
                />
                <Button type="submit" size="sm" variant="outline" className="h-7 text-[8px] border-[#00ff41]/30">
                  SEND
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
