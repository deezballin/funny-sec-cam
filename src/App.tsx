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
  UserCheck
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
}

interface ZIONSettings {
  tone: "mocking" | "aggressive" | "professional" | "creepy";
  humorLevel: number;
  autoDeter: boolean;
  customPhrases: string;
  voiceVoice: "Zephyr" | "Puck" | "Charon" | "Kore" | "Fenrir";
}

export default function App() {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraMapping, setCameraMapping] = useState<Record<number, string>>({ 0: "", 1: "", 2: "" });
  const [events, setEvents] = useState<Event[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [settings, setSettings] = useState<ZIONSettings>({
    tone: "mocking",
    humorLevel: 80,
    autoDeter: false,
    customPhrases: "I'm working here, go away! // Who invited you? // System breach detected: Ugly human found.",
    voiceVoice: "Zephyr"
  });
  const [systemStats, setSystemStats] = useState({
    cpu: 0,
    temp: 0,
    mem: 0,
    uptime: "00:00:00"
  });

  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize cameras
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === "videoinput");
        setCameras(videoDevices);
        
        // Default mapping
        const initialMapping: Record<number, string> = {};
        videoDevices.slice(0, 3).forEach((device, i) => {
          initialMapping[i] = device.deviceId;
        });
        setCameraMapping(initialMapping);
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    }

    getDevices();
    fetchEvents();

    const interval = setInterval(() => {
      setSystemStats({
        cpu: Math.floor(Math.random() * 40) + 10,
        temp: Math.floor(Math.random() * 15) + 45,
        mem: Math.floor(Math.random() * 20) + 30,
        uptime: new Date().toLocaleTimeString()
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Update streams when mapping changes
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
        console.error(`Error starting stream for cam ${idx}:`, err);
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

  const logEvent = async (type: string, description: string, cameraId: number) => {
    try {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description, camera_id: cameraId })
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

  const analyzeVision = async (cameraId: number) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);

    const base64Image = captureFrame(cameraId);
    if (!base64Image) {
      setIsAnalyzing(false);
      return;
    }

    try {
      const prompt = `
        Analyze this surveillance feed. 
        Current Settings: Tone=${settings.tone}, HumorLevel=${settings.humorLevel}%, CustomPhrases=[${settings.customPhrases}].
        
        Task:
        1. If you see a person, describe their appearance and actions.
        2. If the person is an intruder or just someone bothering the user while they work, generate a deterrent comment.
        3. The comment should match the Tone and HumorLevel. 
        4. Use the CustomPhrases as inspiration or directly if appropriate.
        5. If Tone is 'mocking', be witty and insulting. If 'aggressive', be loud and commanding. If 'creepy', be unsettling and whispery.
        
        Format: [Analysis] ... [Deterrent] ...
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: base64Image } }
            ]
          }
        ]
      });

      const result = response.text;
      const [analysis, deterrent] = result.split("[Deterrent]");
      const cleanAnalysis = analysis.replace("[Analysis]", "").trim();
      const cleanDeterrent = deterrent?.trim() || "";

      logEvent("AI_SCAN", cleanAnalysis, cameraId);

      if (cleanDeterrent) {
        speak(cleanDeterrent);
      }
    } catch (err) {
      console.error("Vision analysis error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const speak = async (text: string) => {
    if (isSpeaking) return;
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
          setIsSpeaking(false);
          audioContext.close();
        };
        source.start();
      } else {
        setIsSpeaking(false);
      }
    } catch (err) {
      console.error("TTS error:", err);
      setIsSpeaking(false);
    }
  };

  const handleCameraChange = (idx: number, deviceId: string) => {
    setCameraMapping(prev => ({ ...prev, [idx]: deviceId }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#00ff41] font-mono p-4 selection:bg-[#00ff41] selection:text-black">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#00ff41]/30 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#00ff41] animate-pulse" />
          <div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase">ZION Vision Command</h1>
            <p className="text-[10px] opacity-60 italic">System Status: Operational // Secure Link Established</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41] hover:text-black gap-2">
                <SettingsIcon className="w-4 h-4" /> SETTINGS
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-black border-[#00ff41]/30 text-[#00ff41] max-w-md">
              <DialogHeader>
                <DialogTitle className="text-[#00ff41] uppercase tracking-widest">ZION_OS Configuration</DialogTitle>
                <DialogDescription className="text-[#00ff41]/60 text-xs">Adjust AI deterrence parameters and system behavior.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase opacity-60">Deterrence Tone</Label>
                  <Select 
                    value={settings.tone} 
                    onValueChange={(v: any) => setSettings(s => ({ ...s, tone: v }))}
                  >
                    <SelectTrigger className="bg-black border-[#00ff41]/20 text-[#00ff41]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-[#00ff41]/20 text-[#00ff41]">
                      <SelectItem value="mocking" className="focus:bg-[#00ff41] focus:text-black">Mocking / Witty</SelectItem>
                      <SelectItem value="aggressive" className="focus:bg-[#00ff41] focus:text-black">Aggressive / Loud</SelectItem>
                      <SelectItem value="professional" className="focus:bg-[#00ff41] focus:text-black">Professional / Firm</SelectItem>
                      <SelectItem value="creepy" className="focus:bg-[#00ff41] focus:text-black">Creepy / Unsettling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-[10px] uppercase opacity-60">Humor Level</Label>
                    <span className="text-[10px]">{settings.humorLevel}%</span>
                  </div>
                  <Slider 
                    value={[settings.humorLevel]} 
                    onValueChange={(vals) => setSettings(s => ({ ...s, humorLevel: vals[0] }))}
                    max={100} 
                    step={1}
                    className="[&_[role=slider]]:bg-[#00ff41] [&_[role=slider]]:border-[#00ff41]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase opacity-60">Voice Profile</Label>
                  <Select 
                    value={settings.voiceVoice} 
                    onValueChange={(v: any) => setSettings(s => ({ ...s, voiceVoice: v }))}
                  >
                    <SelectTrigger className="bg-black border-[#00ff41]/20 text-[#00ff41]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-black border-[#00ff41]/20 text-[#00ff41]">
                      <SelectItem value="Zephyr" className="focus:bg-[#00ff41] focus:text-black">Zephyr (Robotic)</SelectItem>
                      <SelectItem value="Puck" className="focus:bg-[#00ff41] focus:text-black">Puck (Playful)</SelectItem>
                      <SelectItem value="Charon" className="focus:bg-[#00ff41] focus:text-black">Charon (Deep)</SelectItem>
                      <SelectItem value="Kore" className="focus:bg-[#00ff41] focus:text-black">Kore (Sharp)</SelectItem>
                      <SelectItem value="Fenrir" className="focus:bg-[#00ff41] focus:text-black">Fenrir (Gravelly)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase opacity-60">Auto-Deterrence</Label>
                  <Switch 
                    checked={settings.autoDeter} 
                    onCheckedChange={(v) => setSettings(s => ({ ...s, autoDeter: v }))}
                    className="data-[state=checked]:bg-[#00ff41]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase opacity-60">Custom Phrases (Split by //)</Label>
                  <textarea 
                    className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-xs h-20 focus:outline-none focus:border-[#00ff41]"
                    value={settings.customPhrases}
                    onChange={(e) => setSettings(s => ({ ...s, customPhrases: e.target.value }))}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Separator orientation="vertical" className="h-10 bg-[#00ff41]/20" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase opacity-50">Uptime</span>
            <span className="text-sm">{systemStats.uptime}</span>
          </div>
          <Separator orientation="vertical" className="h-10 bg-[#00ff41]/20" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase opacity-50">Threat Level</span>
            <Badge variant="outline" className="border-[#00ff41] text-[#00ff41] bg-[#00ff41]/10">Alpha-1</Badge>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Camera Grid */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2].map((idx) => (
            <Card key={idx} className={cn(
              "bg-black border-[#00ff41]/20 overflow-hidden group relative",
              idx === 0 && "md:col-span-2 aspect-video",
              idx !== 0 && "aspect-video"
            )}>
              <div className="absolute top-2 left-2 z-10 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-[10px] bg-black/80 px-2 py-0.5 rounded border border-[#00ff41]/30">
                    CAM_0{idx + 1}
                  </span>
                </div>
                
                <Select 
                  value={cameraMapping[idx]} 
                  onValueChange={(v) => handleCameraChange(idx, v)}
                >
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
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />

              <div className="absolute bottom-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-[10px] border-[#00ff41]/30 hover:bg-[#00ff41] hover:text-black"
                  onClick={() => analyzeVision(idx)}
                  disabled={isAnalyzing}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  {isAnalyzing ? "SCANNING..." : "AI_SCAN"}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-[10px] border-[#00ff41]/30 hover:bg-[#00ff41] hover:text-black"
                  onClick={() => speak("Intruder detected. Please exit the premises before I release the digital hounds.")}
                  disabled={isSpeaking}
                >
                  <Volume2 className="w-3 h-3 mr-1" />
                  TEST_VOICE
                </Button>
              </div>

              {/* Scan Overlay */}
              <AnimatePresence>
                {isAnalyzing && (
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Active Mode Badge */}
          <Card className="bg-black border-[#00ff41]/20 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {settings.tone === "mocking" && <Laugh className="w-5 h-5 text-yellow-500" />}
              {settings.tone === "aggressive" && <Angry className="w-5 h-5 text-red-500" />}
              {settings.tone === "creepy" && <Ghost className="w-5 h-5 text-purple-500" />}
              {settings.tone === "professional" && <UserCheck className="w-5 h-5 text-blue-500" />}
              <span className="text-xs uppercase font-bold tracking-widest">{settings.tone}_MODE</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className={cn("w-1 h-3 rounded-full", i <= (settings.humorLevel / 33) ? "bg-[#00ff41]" : "bg-[#00ff41]/20")} />
              ))}
            </div>
          </Card>

          {/* System Health */}
          <Card className="bg-black border-[#00ff41]/20">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs uppercase flex items-center gap-2">
                <Activity className="w-4 h-4" /> System_Health
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] uppercase opacity-60">
                  <span>CPU_Load</span>
                  <span>{systemStats.cpu}%</span>
                </div>
                <div className="h-1 bg-[#00ff41]/10 rounded-full overflow-hidden">
                  <motion.div 
                    animate={{ width: `${systemStats.cpu}%` }}
                    className="h-full bg-[#00ff41]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase opacity-60 block">Temp</span>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span className="text-sm">{systemStats.temp}°C</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase opacity-60 block">Memory</span>
                  <div className="flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    <span className="text-sm">{systemStats.mem}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event Log */}
          <Card className="bg-black border-[#00ff41]/20 h-[350px] flex flex-col">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs uppercase flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Event_Log
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
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="text-[10px] border-[#00ff41]/20 hover:bg-red-900/20 hover:text-red-500 hover:border-red-500">
              <AlertTriangle className="w-3 h-3 mr-1" /> PANIC
            </Button>
            <Button variant="outline" className="text-[10px] border-[#00ff41]/20 hover:bg-[#00ff41] hover:text-black" onClick={() => window.location.reload()}>
              <RefreshCw className="w-3 h-3 mr-1" /> REBOOT
            </Button>
          </div>
        </div>
      </main>

      {/* Hidden Canvas for Frame Capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Footer Decoration */}
      <footer className="mt-8 pt-4 border-t border-[#00ff41]/10 flex justify-between items-center opacity-30 text-[8px] uppercase tracking-[0.2em]">
        <span>ZION_OS v4.1.0 // Kernel: 5.10.0-PI4</span>
        <span>Encrypted_Session: 0x8F2A...9C1E</span>
        <span>Location: Classified</span>
      </footer>
    </div>
  );
}
