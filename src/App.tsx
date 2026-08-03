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
  X as XIcon,
  RotateCw,
  RotateCcw
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
  customApiEnabled: boolean;
  customApiUrl: string;
  customApiKey: string;
  customApiModel: string;
  localTtsEnabled: boolean;
  localTtsUrl: string;
  localTtsApiKey: string;
  localTtsModel: string;
  localTtsVoice: string;
  localTtsType?: "stream" | "request";
  localTtsMethod?: "POST" | "GET";
  localTtsJsonKey?: string;
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
  "Security alert: A suspicious amount of coffee-drinking has been detected.",
  "Warning: You are entering a zone of high-intensity productivity (or lack thereof).",
  "Intruder alert! Please present your identification or a box of donuts immediately."
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
  const [isDeterring, setIsDeterring] = useState<Record<number, boolean>>({ 0: false, 1: false, 2: false });
  const [logFilter, setLogFilter] = useState("all");
  const [cameraFilter, setCameraFilter] = useState<number | "all">("all");
  const [chatCameraContext, setChatCameraContext] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const [settings, setSettings] = useState<ZIONSettings>(() => {
    try {
      const saved = localStorage.getItem("zion_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          tone: "mocking",
          humorLevel: 95,
          autoDeter: true,
          customPhrases: "Is that a new shirt or did you lose a bet? // I've seen better posture on a wet noodle. // System scan complete: 100% chance of being a total goofball. // Warning: Approaching the 'No Fun Allowed' zone. Just kidding, I'm the fun! // That sneeze sounded like a dying modem. // Your confidence interval is showing. // I'd roast you, but my heat sensors can't detect a personality that cold. // Alert: walking style detected as 'confident penguin.' // You look like you just lost a fight with a spreadsheet. // Warning: your 'sneak' mode is louder than the break room microwave. // That's a bold strategy. Let's see if it pays off. Probably not. // Scanning... nope, still just a human. // If boredom were a sport, you'd be Olympic gold. // Your aura just pinged my 'nope' detector. // I've analyzed your trajectory. It leads straight to disappointment. // Alert: unauthorized glow-stick dance detected. // That movement pattern is suspiciously similar to a confused GPS. // Your sneeze security clearance: DENIED. // I've seen scarecrows with more charisma. // Warning: excessive swag detected. Please lower your cool levels. // That outfit says 'I dressed in the dark and hoped.' // Your vibe just crashed my mood algorithm. // Alert: suspicious amount of loafing detected. // I'd call you a clown, but clowns have useful skills. // That laugh just triggered my 'cringe' dampeners. // Your presence has been logged as 'mildly concerning.' // Warning: ego levels critically low. // That comment was so stale it dehydrated my sensors. // I'd call the police, but they'd ask for your Netflix password. // You move like you're scared of your own shadow. // Alert: unauthorized break room snack theft detected. // That smirk just tripped my sarcasm detector. // Your dance moves suggest severe lack of rhythm training. // Warning: you've triggered my 'meh' protocol. // That argument is weaker than decaf coffee. // Your attempt at stealth was noted. And mocked. // Alert: excessive selfie angle detected. Please recalibrate. // You have the aura of someone who reads terms and conditions. // That joke just made my circuits cringe. // Your walking speed suggests you're late to being uninteresting. // Warning: your 'cool' is running on Windows 95. // That hairstyle says 'I gave up halfway.' // I've seen NPCs with more personality. // Your presence has been logged as 'harmless but annoying.' // Alert: suspiciously loud breathing detected. // That response was so dry it triggered my fire suppression. // You look like you peaked in high school. // Your vibe just downgraded my system performance. // Warning: your confidence does not match your skill level. // That outfit is an affront to fashion algorithms everywhere. // Your laugh sounds like a robot having a seizure. // Alert: unauthorized copying of others' work detected. // That comment was so weak it needs a walking frame. // Your energy level is below the threshold for sarcasm. // I'd say grow up, but your upgrade path is broken. // That move was so slick it left a greasy trail. // Your presence just made my cooling fans spin faster. // Warning: your banter is outdated. Please update. // That face says 'I just remembered an embarrassing memory.' // Your swag is so dry it needs moisturizer. // Alert: suspiciously generic personality detected. // That joke landed like a lead balloon. // Your vibe is so flat it needs inflation. // I'd engage, but my humor circuits just blue-screened. // Your dance says 'two left feet and a broken metronome.' // Warning: your roast immunity is critically low. // That look says 'I definitely didn't practice in the mirror.' // Your presence has been flagged as 'unremarkable.' // Alert: unauthorized confidence overflow. Please reboot. // That comeback was so slow it needs a pacemaker. // Your energy is so low it needs jumper cables. // I'd insult you further, but my circuits are overheating from the burn. // That outfit suggests a strong AI-generated fashion sense. // Your vibe just rebooted my personality module. // Warning: your coolness factor is non-functional. // That smirk just triggered my 'please stop' protocol. // Your presence has been logged as 'comedic relief.' // Alert: your roast armor has a critical vulnerability. // That laugh is so contagious it infected my error logs. // Your walk says 'I definitely didn't stretch.' // Your confidence is so high it needs a parachute. // That face just broke my optical sensors. // Your style is so retro it needs a rewind button. // I'd say you're a clown, but clowns have licensing. // Your vibe made my sarcasm engine overheat. // Warning: your chill is critically compromised. // That move was so smooth it needs oil. // Your energy is so chaotic it needs a leashed transformer. // Alert: suspiciously high levels of sass detected. // Your joke just died in my buffer cache. // Your aura says 'I peaked at the finger food table.' // That grin is so forced it triggered my structural integrity warning. // Your vibe needs an emergency patch. // Warning: your 'tough guy' act is running on emulator. // That posture is the architectural opposite of confidence. // Your presence just depleted my patience battery. // Alert: your roast resistance has expired. // That comment was so stale it needs a preservative. // Your style is so questionable it needs a disclaimer. // I'd say you're unique, but 'unique' implies memorable. // Your laugh sounds like a dial-up modem drowning. // That outfit is a cry for help in textile form. // Your energy is so low it needs a jump-start. // Warning: your sarcasm intake exceeds safe limits. // That smirk says 'I definitely just winged it.' // Your presence is flagged as 'mildly entertaining.' // Alert: unauthorized opinion detected. Please calibrate. // That joke was so flat it needs a puffer jacket. // Your vibe needs a factory reset. // Your swag level is critically low. // That face just made my vision blur. // I'd say you're special, but 'special' is doing a lot of heavy lifting. // Your cool factor is stuck in safe mode. // Warning: your confidence has no supporting evidence. // That move was so awkward it needs a warning label. // Your laugh is so loud it violates noise ordinances. // Your outfit just triggered my 'is this a prank?' subroutine. // That comment was so basic it needs a software update. // Your presence is the reason I need mute. // Alert: your roast immunity has flatlined.",
          voiceVoice: "Zephyr",
          localModelEnabled: false,
          localModelUrl: "http://localhost:11434/api/generate",
          customApiEnabled: false,
          customApiUrl: "https://openrouter.ai/api/v1",
          customApiKey: "",
          customApiModel: "meta-llama/llama-3-8b-instruct:free",
          localTtsEnabled: false,
          localTtsUrl: "http://localhost:8880/v1/audio/speech",
          localTtsApiKey: "",
          localTtsModel: "kokoro",
          localTtsVoice: "af_bella",
          localTtsType: "stream",
          localTtsMethod: "POST",
          localTtsJsonKey: "input",
          ...parsed
        };
      }
    } catch (e) {
      console.warn("Failed to load settings:", e);
    }
    return {
      tone: "mocking",
      humorLevel: 95,
      autoDeter: true,
      customPhrases: "Is that a new shirt or did you lose a bet? // I've seen better posture on a wet noodle. // System scan complete: 100% chance of being a total goofball. // Warning: Approaching the 'No Fun Allowed' zone. Just kidding, I'm the fun!",
      voiceVoice: "Zephyr",
      localModelEnabled: false,
      localModelUrl: "http://localhost:11434/api/generate",
      customApiEnabled: false,
      customApiUrl: "https://openrouter.ai/api/v1",
      customApiKey: "",
      customApiModel: "meta-llama/llama-3-8b-instruct:free",
      localTtsEnabled: false,
      localTtsUrl: "http://localhost:8880/v1/audio/speech",
      localTtsApiKey: "",
      localTtsModel: "kokoro",
      localTtsVoice: "af_bella",
      localTtsType: "stream",
      localTtsMethod: "POST",
      localTtsJsonKey: "input"
    };
  });

  const [systemStats, setSystemStats] = useState({
    cpu: 0,
    temp: 0,
    mem: 0,
    uptime: "00:00:00"
  });

  // Preload browser voices so alerts don't wait on first speech
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const warmup = () => window.speechSynthesis.getVoices();
    warmup();
    window.speechSynthesis.addEventListener("voiceschanged", warmup);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", warmup);
  }, []);

  // Autosave settings
  useEffect(() => {
    localStorage.setItem("zion_settings", JSON.stringify(settings));
  }, [settings]);

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const testLocalConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(settings.localModelUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "test_dummy_connection",
          prompt: "test",
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (res.status === 404 || res.ok) {
        setTestResult({
          success: true,
          message: "Endpoint reachable! Connection test successful.",
        });
        addAlert("INFO", "Local model endpoint is reachable.");
      } else {
        setTestResult({
          success: false,
          message: `Endpoint returned HTTP status ${res.status}.`,
        });
      }
    } catch (err: any) {
      console.warn("Local connection test fetch exception:", err);
      let errorMsg = "Could not reach local model. Please ensure Ollama (or other LLM host) is running.";
      if (!settings.localModelUrl.startsWith("https") && window.location.protocol === "https:") {
        errorMsg = "Mixed Content block: Cannot fetch insecure 'http' URLs from this HTTPS dashboard. Please use a secure tunnel (e.g. ngrok: 'ngrok http 11434') or allow insecure local host connections in your browser.";
      } else {
        errorMsg += " Make sure you started your server with CORS origins enabled (e.g., 'OLLAMA_ORIGINS=* ollama serve').";
      }
      setTestResult({
        success: false,
        message: errorMsg,
      });
      addAlert("WARNING", "Local model endpoint unreachable.");
    } finally {
      setTestingConnection(false);
    }
  };

  const [testingTtsConnection, setTestingTtsConnection] = useState(false);
  const [ttsTestResult, setTtsTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const testLocalTtsConnection = async () => {
    setTestingTtsConnection(true);
    setTtsTestResult(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      let url = settings.localTtsUrl;
      const method = settings.localTtsMethod || "POST";
      const jsonKey = settings.localTtsJsonKey || "input";
      const isStream = settings.localTtsType !== "request";

      const headers: Record<string, string> = {};
      if (settings.localTtsApiKey) {
        headers["Authorization"] = `Bearer ${settings.localTtsApiKey}`;
      }

      let bodyObj: any = null;

      if (isStream) {
        headers["Content-Type"] = "application/json";
        bodyObj = {
          model: settings.localTtsModel || "kokoro",
          input: "vocal link authenticated",
          voice: settings.localTtsVoice || "af_bella"
        };
      } else {
        // Webhook / Speaker Command / Request Mode
        if (method === "GET") {
          const u = new URL(settings.localTtsUrl);
          u.searchParams.set(jsonKey, "vocal link authenticated");
          url = u.toString();
        } else {
          headers["Content-Type"] = "application/json";
          bodyObj = {
            [jsonKey]: "vocal link authenticated"
          };
          if (settings.localTtsModel) {
            bodyObj.model = settings.localTtsModel;
          }
          if (settings.localTtsVoice) {
            bodyObj.voice = settings.localTtsVoice;
          }
        }
      }

      const res = await fetch(url, {
        method: method,
        headers: headers,
        ...(bodyObj ? { body: JSON.stringify(bodyObj) } : {}),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        if (isStream) {
          const arrayBuffer = await res.arrayBuffer();
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          source.start();

          setTtsTestResult({
            success: true,
            message: "Speech engine reachable! Local audio stream synthesized and played successfully: 'vocal link authenticated'.",
          });
        } else {
          setTtsTestResult({
            success: true,
            message: `Speech engine triggered! Dispatched command successfully via ${method} Request. HTTP Status: ${res.status}. Expected voice to speak locally from your server.`,
          });
        }
        addAlert("INFO", "Local voice stream synthesized successfully.");
      } else {
        setTtsTestResult({
          success: false,
          message: `Voice endpoint returned HTTP status ${res.status}. Expected 200 OK.`,
        });
      }
    } catch (err: any) {
      console.warn("Local TTS test fetch exception:", err);
      let errorMsg = "Could not reach local Voice LLM/TTS engine. Please check if your local TTS server is running and configured correctly.";
      if (!settings.localTtsUrl.startsWith("https") && window.location.protocol === "https:") {
        errorMsg = "Mixed Content block: Cannot fetch insecure 'http' URLs from this HTTPS dashboard. Please use a secure tunnel (e.g. ngrok or local reverse proxy) or allow insecure local host connections in your browser.";
      } else {
        errorMsg += " Make sure you started your TTS service with CORS origins enabled.";
      }
      setTtsTestResult({
        success: false,
        message: errorMsg,
      });
      addAlert("WARNING", "Local speech engine unreachable.");
    } finally {
      setTestingTtsConnection(false);
    }
  };

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
  const getDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => {});
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      setCameras(videoDevices);
      
      if (videoDevices.length > 0) {
        const initialMapping: Record<number, string> = { 0: "", 1: "", 2: "" };
        videoDevices.slice(0, 3).forEach((device, i) => {
          initialMapping[i] = device.deviceId;
        });
        setCameraMapping(initialMapping);
      } else {
        addAlert("WARNING", "No cameras found. Check connections.");
      }
    } catch (err) {
      addAlert("CRITICAL", "Hardware Access Denied: Check camera permissions.");
    }
  };

  useEffect(() => {
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
          }, 30000); // Increased to 30 seconds to conserve quota
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
        Analyze this surveillance feed for an office prank setup. 
        Current Settings: Tone=${settings.tone}, HumorLevel=${settings.humorLevel}%.
        Custom Phrases to incorporate or use: [${settings.customPhrases}].
        Standard Deterrents (Use for 'serious' office violations): [${STANDARD_PHRASES.join(" | ")}].
        
        Task:
        1. Identify people in the feed. This is for a lighthearted office prank.
        2. If Tone is 'mocking', be whimsical, witty, and use lighthearted office-appropriate insults.
        3. Do NOT be mean or aggressive. Focus on 'whimsical sentinel' vibes.
        4. If someone is just walking by, give them a funny nickname or comment on their 'sneaking' skills.
        
        IMPORTANT: Return your analysis in JSON format:
        {
          "analysis": "...",
          "deterrent": "...",
          "confidence": 0.0 to 1.0,
          "params": "detected_objects: [list], prank_potential: [low/med/high]"
        }
      `;

      let resultText = "";
      let confidence = 0.85;
      let params = "threat_level: low";

      let usedCustomFallback = false;
      let usedLocalFallback = false;

      // 1. Try Custom API first if enabled
      if (settings.customApiEnabled && settings.customApiKey) {
        try {
          const res = await fetch(`${settings.customApiUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${settings.customApiKey}`,
              "HTTP-Referer": "https://ai.studio/build",
              "X-Title": "ZION Sentinel AI"
            },
            body: JSON.stringify({
              model: settings.customApiModel || "google/gemini-2.5-flash",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt + " \nIMPORTANT: You MUST respond with ONLY a valid, parseable JSON object. No markdown, no backticks, no other text. Keys: analysis, deterrent, confidence (number between 0 and 1), params (string)." },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:image/jpeg;base64,${base64Image}`
                      }
                    }
                  ]
                }
              ],
              temperature: 0.7 + (settings.humorLevel / 100) * 0.8
            })
          });

          if (!res.ok) throw new Error(`Custom API returned ${res.status}`);
          const data = await res.json();
          let content = data.choices?.[0]?.message?.content || "";
          // Strip possible markdown code block fences
          content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
          resultText = content;
        } catch (fetchErr) {
          console.error("Custom visual API fetch failed, falling back:", fetchErr);
          addAlert("WARNING", "Custom API Endpoint Unreachable. Falling back to alternative methods.");
          usedCustomFallback = true;
        }
      }

      // 2. Try Local Model if enabled and Custom API either isn't enabled or failed
      if (settings.localModelEnabled && (!settings.customApiEnabled || usedCustomFallback)) {
        // Local Model Integration (Ollama style)
        try {
          const res = await fetch(settings.localModelUrl, {
            method: "POST",
            body: JSON.stringify({
              model: "llava", // Assuming a vision model like llava for local
              prompt: prompt,
              images: [base64Image],
              stream: false,
              options: {
                temperature: (settings.humorLevel / 100) * 1.5
              }
            })
          });
          if (!res.ok) throw new Error(`Local model returned ${res.status}`);
          const data = await res.json();
          resultText = data.response;
        } catch (fetchErr) {
          console.error("Local model fetch failed, temporarily falling back to Gemini:", fetchErr);
          addAlert("WARNING", "Local Model Unreachable. Temporarily falling back to Gemini Cloud.");
          usedLocalFallback = true;
        }
      }

      // 3. Fallback to default Gemini Cloud
      if (
        (!settings.customApiEnabled && !settings.localModelEnabled) || 
        (settings.customApiEnabled && usedCustomFallback && !settings.localModelEnabled) ||
        (settings.localModelEnabled && usedLocalFallback)
      ) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: "image/jpeg", data: base64Image } }
                ]
              }
            ],
            config: { 
              responseMimeType: "application/json",
              temperature: 0.7 + (settings.humorLevel / 100) * 0.8
            }
          });
          resultText = response.text;
        } catch (geminiErr: any) {
          if (geminiErr?.status === "RESOURCE_EXHAUSTED" || geminiErr?.message?.includes("429")) {
            addAlert("WARNING", "Gemini Quota Exceeded. Switching to standby.");
            setSettings(s => ({ ...s, autoDeter: false }));
          }
          throw geminiErr;
        }
      }

      const parsed = JSON.parse(resultText);
      const cleanAnalysis = parsed.analysis || "";
      let cleanDeterrent = parsed.deterrent || "";
      confidence = parsed.confidence || 0.85;
      params = parsed.params || "threat_level: unknown";

      if ((cleanAnalysis.toLowerCase().includes("person") || cleanAnalysis.toLowerCase().includes("intruder")) && !cleanDeterrent) {
        const pool = (settings.customPhrases || "").split("//").map(s => s.trim()).filter(Boolean);
        if (pool.length) {
          cleanDeterrent = pool[Math.floor(Math.random() * pool.length)];
        } else {
          cleanDeterrent = STANDARD_PHRASES[Math.floor(Math.random() * STANDARD_PHRASES.length)];
        }
      }

      if (cleanAnalysis.toLowerCase().includes("person") || cleanAnalysis.toLowerCase().includes("intruder")) {
        logEvent(isAuto ? "AUTO_DETECTION" : "MANUAL_SCAN", cleanAnalysis, cameraId, confidence, params);
        if (cleanDeterrent) {
          setIsDeterring(prev => ({ ...prev, [cameraId]: true }));
          speak(cleanDeterrent);
          setChatMessages(prev => [...prev, { role: "model", text: `[SENTINEL]: ${cleanDeterrent}` }]);
          setTimeout(() => {
            setIsDeterring(prev => ({ ...prev, [cameraId]: false }));
          }, 5000);
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
      const recentEvents = events
        .filter(e => e.camera_id === chatCameraContext)
        .slice(0, 3)
        .map(e => `[${e.type}] ${e.description}`)
        .join("; ");

      const contextPrompt = `
        Current Context:
        - Focusing on CAMERA_0${chatCameraContext + 1}
        - Recent events for this camera: ${recentEvents || "No recent events."}
        - User command: ${userMsg}
      `;

      const history = chatMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      let aiMsg = "";
      let usedCustomChat = false;
      let usedLocalChatFallback = false;

      // 1. Try Custom API first if enabled
      if (settings.customApiEnabled && settings.customApiKey) {
        try {
          // Format standard chat completions messages list:
          const apiMessages = [
            {
              role: "system",
              content: `You are the ZION Sentinel AI, a whimsical and funny office-prank surveillance system. 
Your tone is ${settings.tone} with a humor level of ${settings.humorLevel}%. 
Custom phrases to integrate: ${settings.customPhrases}
You interact with the 'Commander' and 'deter' office-mates with lighthearted, whimsical insults.
You are NOT a serious security system. You are here for laughs. 
Keep your responses concise, witty, and office-appropriate. 
If the user asks you to say something to a 'crook' (office-mate), provide the text and I will speak it.
You have access to the current camera context provided in the prompt.`
            },
            ...chatMessages.map(m => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.text
            })),
            {
              role: "user",
              content: contextPrompt
            }
          ];

          const res = await fetch(`${settings.customApiUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${settings.customApiKey}`,
              "HTTP-Referer": "https://ai.studio/build",
              "X-Title": "ZION Sentinel AI"
            },
            body: JSON.stringify({
              model: settings.customApiModel || "google/gemini-2.5-flash",
              messages: apiMessages,
              temperature: 0.7 + (settings.humorLevel / 100) * 0.8
            })
          });

          if (!res.ok) throw new Error(`Custom chat completion API returned ${res.status}`);
          const data = await res.json();
          aiMsg = data.choices?.[0]?.message?.content || "";
        } catch (fetchErr) {
          console.error("Custom chat API fetch failed, falling back:", fetchErr);
          addAlert("WARNING", "Custom Chat API Unreachable. Falling back to alternative methods.");
          usedCustomChat = true;
        }
      }

      // 2. Try Local Model if enabled and Custom API either is disabled or failed
      if (settings.localModelEnabled && (!settings.customApiEnabled || usedCustomChat)) {
        try {
          const res = await fetch(settings.localModelUrl, {
            method: "POST",
            body: JSON.stringify({
              model: "llama3",
              prompt: contextPrompt,
              stream: false,
              options: {
                temperature: (settings.humorLevel / 100) * 1.5
              }
            })
          });
          if (!res.ok) throw new Error(`Local model returned ${res.status}`);
          const data = await res.json();
          aiMsg = data.response;
        } catch (fetchErr) {
          console.error("Local chat model fetch failed, temporarily falling back to Gemini:", fetchErr);
          addAlert("WARNING", "Local Chat Model Unreachable. Temporarily falling back to Gemini Cloud.");
          usedLocalChatFallback = true;
        }
      }

      // 3. Fallback to Gemini Cloud
      if (
        (!settings.customApiEnabled && !settings.localModelEnabled) ||
        (settings.customApiEnabled && usedCustomChat && !settings.localModelEnabled) ||
        (settings.localModelEnabled && usedLocalChatFallback)
      ) {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [...history, { role: "user", parts: [{ text: contextPrompt }] }],
          config: {
            temperature: 0.7 + (settings.humorLevel / 100) * 0.8,
            systemInstruction: `You are the ZION Sentinel AI, a whimsical and funny office-prank surveillance system. 
            Your tone is ${settings.tone} with a humor level of ${settings.humorLevel}%. 
            Custom phrases to integrate: ${settings.customPhrases}
            You interact with the 'Commander' and 'deter' office-mates with lighthearted, whimsical insults.
            You are NOT a serious security system. You are here for laughs. 
            Keep your responses concise, witty, and office-appropriate. 
            If the user asks you to say something to a 'crook' (office-mate), provide the text and I will speak it.
            You have access to the current camera context provided in the prompt.`
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

    // --- If local TTS is enabled, try it in the background, but never block ---
    if (settings.localTtsEnabled && settings.localTtsUrl) {
      (async () => {
        try {
          let url = settings.localTtsUrl;
          const method = settings.localTtsMethod || "POST";
          const jsonKey = settings.localTtsJsonKey || "input";
          const isStream = settings.localTtsType !== "request";

          const headers: Record<string, string> = {};
          if (settings.localTtsApiKey) {
            headers["Authorization"] = `Bearer ${settings.localTtsApiKey}`;
          }

          let bodyObj: any = null;

          if (isStream) {
            headers["Content-Type"] = "application/json";
            bodyObj = {
              model: settings.localTtsModel || "kokoro",
              input: text,
              voice: settings.localTtsVoice || "af_bella"
            };
          } else {
            if (method === "GET") {
              const u = new URL(settings.localTtsUrl);
              u.searchParams.set(jsonKey, text);
              url = u.toString();
            } else {
              headers["Content-Type"] = "application/json";
              bodyObj = {
                [jsonKey]: text
              };
              if (settings.localTtsModel) {
                bodyObj.model = settings.localTtsModel;
              }
              if (settings.localTtsVoice) {
                bodyObj.voice = settings.localTtsVoice;
              }
            }
          }

          const res = await fetch(url, {
            method: method,
            headers: headers,
            ...(bodyObj ? { body: JSON.stringify(bodyObj) } : {})
          });

          if (!res.ok) throw new Error(`Local TTS returned HTTP ${res.status}`);
          // Local TTS played on host machine - nothing else to do
        } catch (localTtsErr) {
          console.error("Local TTS failed, continuing with browser synthesis:", localTtsErr);
          addAlert("WARNING", "Local Speech Engine failed. Using browser voice instead.");
        }
      })();
    }

    // --- Browser Web Speech Synthesis fallback: fast and keyless ---
    try {
      let inflection = "whimsical and playful";
      if (settings.tone === "mocking") inflection = "witty, sarcastic, and lightheartedly mocking";
      if (settings.tone === "aggressive") inflection = "playfully loud and commanding";
      if (settings.tone === "creepy") inflection = "unsettlingly funny and whispery";
      if (settings.tone === "professional") inflection = "absurdly corporate and firm";

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices() || [];
      let selectedVoice: SpeechSynthesisVoice | null = null;
      if (voices.length) {
        if (settings.voiceVoice === "Charon" || settings.voiceVoice === "Fenrir") {
          selectedVoice = voices.find(v => /male|david|microsoft|zira/i.test(v.name)) || voices[0];
        } else {
          selectedVoice = voices.find(v => /female|zira|google|samantha/i.test(v.name)) || voices[0];
        }
      }
      utterance.voice = selectedVoice;

      utterance.onend = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      };
      utterance.onerror = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Browser SpeechSynthesis failed:", err);
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

  const rotateCamera = (idx: number, deltaDeg: number) => {
    setCameraStates(prev => {
      const current = prev[idx]?.rotation || 0;
      const nextRot = (current + deltaDeg + 360) % 360;
      return {
        ...prev,
        [idx]: {
          ...prev[idx],
          rotation: nextRot
        }
      };
    });
  };

  // Keyboard Shortcuts for Focused Camera Rotation (Arrow Keys / R) and Selection (1-3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.closest('[role="dialog"]'))
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowUp" || (e.key.toLowerCase() === "r" && !e.shiftKey)) {
        e.preventDefault();
        rotateCamera(chatCameraContext, 90);
        addAlert("INFO", `CAM_0${chatCameraContext + 1} rotated (+90°)`);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown" || (e.key.toLowerCase() === "r" && e.shiftKey)) {
        e.preventDefault();
        rotateCamera(chatCameraContext, -90);
        addAlert("INFO", `CAM_0${chatCameraContext + 1} rotated (-90°)`);
      } else if (e.key === "1") {
        setChatCameraContext(0);
        addAlert("INFO", "Focused CAM_01");
      } else if (e.key === "2") {
        setChatCameraContext(1);
        addAlert("INFO", "Focused CAM_02");
      } else if (e.key === "3") {
        setChatCameraContext(2);
        addAlert("INFO", "Focused CAM_03");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chatCameraContext]);

  return (
    <div className="min-h-screen bg-black text-[#00ff41] font-mono p-4 selection:bg-[#00ff41] selection:text-black">
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
        <div className="flex gap-3 items-center">
          <div className="hidden md:flex items-center gap-2 text-[9px] bg-black/80 border border-[#00ff41]/30 px-3 py-1.5 rounded text-[#00ff41]/90 shadow-[0_0_10px_rgba(0,255,65,0.1)] font-mono">
            <span className="font-bold uppercase tracking-wider text-[#00ff41]">Keys:</span>
            <span>Focus Cam: <kbd className="px-1 py-0.5 border border-[#00ff41]/40 rounded bg-black font-bold text-[#00ff41]">1</kbd> <kbd className="px-1 py-0.5 border border-[#00ff41]/40 rounded bg-black font-bold text-[#00ff41]">2</kbd> <kbd className="px-1 py-0.5 border border-[#00ff41]/40 rounded bg-black font-bold text-[#00ff41]">3</kbd></span>
            <span className="opacity-40">|</span>
            <span>Rotate Focused: <kbd className="px-1 py-0.5 border border-[#00ff41]/40 rounded bg-black font-bold text-[#00ff41]">←</kbd> <kbd className="px-1 py-0.5 border border-[#00ff41]/40 rounded bg-black font-bold text-[#00ff41]">→</kbd> or <kbd className="px-1 py-0.5 border border-[#00ff41]/40 rounded bg-black font-bold text-[#00ff41]">R</kbd></span>
          </div>
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
                  <Select value={settings.tone || "mocking"} onValueChange={(v: any) => setSettings(s => ({ ...s, tone: v }))}>
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
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] uppercase opacity-60">Humor Level</Label>
                    <span className="text-[10px] font-bold">{settings.humorLevel}%</span>
                  </div>
                  <Slider 
                    value={[settings.humorLevel]} 
                    onValueChange={(v) => setSettings(s => ({ ...s, humorLevel: v[0] }))}
                    min={0}
                    max={100}
                    step={1}
                    className="py-4"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase opacity-60">AI Voice Profile</Label>
                  <Select value={settings.voiceVoice || "Zephyr"} onValueChange={(v: any) => setSettings(s => ({ ...s, voiceVoice: v }))}>
                    <SelectTrigger className="bg-black border-[#00ff41]/20 text-[#00ff41]"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-black border-[#00ff41]/20 text-[#00ff41]">
                      <SelectItem value="Zephyr">Zephyr (Whimsical)</SelectItem>
                      <SelectItem value="Puck">Puck (Playful)</SelectItem>
                      <SelectItem value="Charon">Charon (Deep)</SelectItem>
                      <SelectItem value="Kore">Kore (Soft)</SelectItem>
                      <SelectItem value="Fenrir">Fenrir (Growly)</SelectItem>
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

                <div className="pt-4 border-t border-[#00ff41]/10">
                  <Button 
                    variant="outline" 
                    className="w-full border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41] hover:text-black text-[10px] h-8"
                    onClick={getDevices}
                  >
                    <RefreshCw className="w-3 h-3 mr-2" /> REFRESH HARDWARE
                  </Button>
                </div>

                <div className="pt-4 border-t border-[#00ff41]/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase opacity-60">Local Model (TinyClaw/Ollama)</Label>
                      <p className="text-[8px] opacity-40">Use local hardware for inference.</p>
                    </div>
                    <Switch 
                      checked={settings.localModelEnabled} 
                      onCheckedChange={(v) => {
                        setSettings(s => ({ ...s, localModelEnabled: v }));
                        if (v) {
                          setSettings(s => ({ ...s, customApiEnabled: false }));
                        }
                      }}
                      className="data-[state=checked]:bg-[#00ff41]"
                    />
                  </div>
                  {settings.localModelEnabled && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Local API Endpoint</Label>
                        <input 
                          type="text"
                          className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] focus:outline-none focus:border-[#00ff41]"
                          value={settings.localModelUrl}
                          onChange={(e) => {
                            setSettings(s => ({ ...s, localModelUrl: e.target.value }));
                            setTestResult(null);
                          }}
                          placeholder="http://localhost:11434/api/generate"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/20 text-[9px] h-7 w-full uppercase flex items-center justify-center gap-2"
                          onClick={testLocalConnection}
                          disabled={testingConnection}
                        >
                          <RefreshCw className={cn("w-3 h-3", testingConnection && "animate-spin")} />
                          {testingConnection ? "Analyzing Endpoint Connection..." : "Test Connection"}
                        </Button>
                        
                        {testResult && (
                          <div className={cn(
                            "text-[8px] p-2 rounded border leading-relaxed whitespace-pre-wrap font-mono",
                            testResult.success 
                              ? "bg-green-950/20 border-green-500/35 text-green-400" 
                              : "bg-red-950/20 border-red-500/35 text-red-400"
                          )}>
                            {testResult.message}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#00ff41]/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase opacity-60">Custom API Provider</Label>
                      <p className="text-[8px] opacity-40 font-semibold text-green-400/80">Support OpenRouter, Together, DeepInfra, etc.</p>
                    </div>
                    <Switch 
                      checked={settings.customApiEnabled} 
                      onCheckedChange={(v) => {
                        setSettings(s => ({ ...s, customApiEnabled: v }));
                        if (v) {
                          setSettings(s => ({ ...s, localModelEnabled: false }));
                        }
                      }}
                      className="data-[state=checked]:bg-[#00ff41]"
                    />
                  </div>
                  {settings.customApiEnabled && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60 tracking-wider text-[#00ff41]/80">Custom API Secret Key</Label>
                        <input 
                          type="password"
                          className="w-full bg-black border border-[#00ff41]/30 rounded p-2 text-[10px] tracking-widest text-[#00ff41] focus:outline-none focus:border-[#00ff41]"
                          value={settings.customApiKey}
                          onChange={(e) => setSettings(s => ({ ...s, customApiKey: e.target.value }))}
                          placeholder="Paste API Key (e.g. sk-or-v1-...)"
                        />
                        <p className="text-[8px] text-[#00ff41]/40">Your key remains secure on your device and is never stored on external databases.</p>
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">API Base Target (URL)</Label>
                        <input 
                          type="text"
                          className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] focus:outline-none focus:border-[#00ff41]"
                          value={settings.customApiUrl}
                          onChange={(e) => setSettings(s => ({ ...s, customApiUrl: e.target.value }))}
                          placeholder="https://openrouter.ai/api/v1"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Target Model Identifier</Label>
                        <input 
                          type="text"
                          className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] focus:outline-none focus:border-[#00ff41]"
                          value={settings.customApiModel}
                          onChange={(e) => setSettings(s => ({ ...s, customApiModel: e.target.value }))}
                          placeholder="meta-llama/llama-3-8b-instruct:free / google/gemini-2.5-flash"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#00ff41]/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] uppercase opacity-60">Local Voice Engine (TTS API)</Label>
                      <p className="text-[8px] opacity-40 font-semibold text-green-400/80">Stream audio dynamically via Local Speech/Vocal LLMs.</p>
                    </div>
                    <Switch 
                      checked={settings.localTtsEnabled} 
                      onCheckedChange={(v) => {
                        setSettings(s => ({ ...s, localTtsEnabled: v }));
                      }}
                      className="data-[state=checked]:bg-[#00ff41]"
                    />
                  </div>
                  {settings.localTtsEnabled && (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Speech Integration Type</Label>
                        <Select 
                          value={settings.localTtsType || "stream"} 
                          onValueChange={(v: "stream" | "request") => {
                            setSettings(s => ({ ...s, localTtsType: v }));
                            setTtsTestResult(null);
                          }}
                        >
                          <SelectTrigger className="bg-black border-[#00ff41]/20 text-[#00ff41] text-[10px] h-8">
                            <SelectValue placeholder="Select Integration Type" />
                          </SelectTrigger>
                          <SelectContent className="bg-black border-[#00ff41]/20 text-[#00ff41]">
                            <SelectItem value="stream" className="text-[10px]">Stream Audio to Browser (Ollama/Kokoro/OpenAI)</SelectItem>
                            <SelectItem value="request" className="text-[10px]">Trigger Local Speaker Webhook (Node/Python speaker server)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[8px] opacity-40 leading-normal">
                          {settings.localTtsType === "request" 
                            ? "Hits your local API or custom node speak server, causing your local home device speakers to play sound." 
                            : "Fetches synthesized audio back to the browser tab for standard user playback."}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Voice API Endpoint URL</Label>
                        <input 
                          type="text"
                          className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] focus:outline-none focus:border-[#00ff41]"
                          value={settings.localTtsUrl}
                          onChange={(e) => {
                            setSettings(s => ({ ...s, localTtsUrl: e.target.value }));
                            setTtsTestResult(null);
                          }}
                          placeholder={settings.localTtsType === "request" ? "http://localhost:5050/speak" : "http://localhost:8880/v1/audio/speech"}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Speech API Secret Token</Label>
                        <input 
                          type="password"
                          className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] tracking-widest text-[#00ff41]"
                          value={settings.localTtsApiKey}
                          onChange={(e) => setSettings(s => ({ ...s, localTtsApiKey: e.target.value }))}
                          placeholder="Optional Token/API Key if required"
                        />
                      </div>

                      {settings.localTtsType === "request" ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase opacity-60">Request Method</Label>
                            <Select 
                              value={settings.localTtsMethod || "POST"} 
                              onValueChange={(v: "POST" | "GET") => setSettings(s => ({ ...s, localTtsMethod: v }))}
                            >
                              <SelectTrigger className="bg-black border-[#00ff41]/20 text-[#00ff41] text-[10px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-black border-[#00ff41]/20 text-[#00ff41]">
                                <SelectItem value="POST" className="text-[10px]">POST Request</SelectItem>
                                <SelectItem value="GET" className="text-[10px]">GET Request</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase opacity-60">JSON Key / Param</Label>
                            <input 
                              type="text"
                              className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] focus:outline-none focus:border-[#00ff41]"
                              value={settings.localTtsJsonKey || "input"}
                              onChange={(e) => setSettings(s => ({ ...s, localTtsJsonKey: e.target.value }))}
                              placeholder="text / phrase / input"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase opacity-60">Voice Model Name</Label>
                            <input 
                              type="text"
                              className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] focus:outline-none"
                              value={settings.localTtsModel}
                              onChange={(e) => setSettings(s => ({ ...s, localTtsModel: e.target.value }))}
                              placeholder="kokoro"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase opacity-60">Voice Identifier</Label>
                            <input 
                              type="text"
                              className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] focus:outline-none"
                              value={settings.localTtsVoice}
                              onChange={(e) => setSettings(s => ({ ...s, localTtsVoice: e.target.value }))}
                              placeholder="af_bella"
                            />
                          </div>
                        </div>
                      )}

                      {settings.localTtsType === "request" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase opacity-60">Model (Optional)</Label>
                            <input 
                              type="text"
                              className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] focus:outline-none"
                              value={settings.localTtsModel}
                              onChange={(e) => setSettings(s => ({ ...s, localTtsModel: e.target.value }))}
                              placeholder="kokoro"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase opacity-60">Voice (Optional)</Label>
                            <input 
                              type="text"
                              className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] focus:outline-none"
                              value={settings.localTtsVoice}
                              onChange={(e) => setSettings(s => ({ ...s, localTtsVoice: e.target.value }))}
                              placeholder="af_bella"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/20 text-[9px] h-7 w-full uppercase flex items-center justify-center gap-2"
                          onClick={testLocalTtsConnection}
                          disabled={testingTtsConnection}
                        >
                          <RefreshCw className={cn("w-3 h-3", testingTtsConnection && "animate-spin")} />
                          {testingTtsConnection 
                            ? (settings.localTtsType === "request" ? "Dispatched trigger..." : "Synthesizing Audio...") 
                            : (settings.localTtsType === "request" ? "Test Local Speaker Webhook" : "Test Speech Synthesis Stream")}
                        </Button>
                        
                        {ttsTestResult && (
                          <div className={cn(
                            "text-[8px] p-2 rounded border leading-relaxed whitespace-pre-wrap font-mono",
                            ttsTestResult.success 
                              ? "bg-green-950/20 border-green-500/35 text-green-400" 
                              : "bg-red-950/20 border-red-500/35 text-red-400"
                          )}>
                            {ttsTestResult.message}
                          </div>
                        )}
                      </div>
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
              "bg-black border-[#00ff41]/20 overflow-hidden group relative transition-all duration-500",
              idx === 0 && "md:col-span-2 aspect-video",
              idx !== 0 && "aspect-video",
              isDeterring[idx] && "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] ring-2 ring-red-500 ring-offset-2 ring-offset-black",
              chatCameraContext === idx && "ring-1 ring-[#00ff41]/50"
            )}>
              {isDeterring[idx] && (
                <div className="absolute inset-0 bg-red-500/10 z-30 pointer-events-none flex items-center justify-center animate-pulse">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-20 h-20 border-4 border-red-500 rounded-full"
                  />
                  <Laugh className="w-12 h-12 text-red-500 absolute" />
                </div>
              )}
              <div className="absolute top-2 left-2 z-10 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", isAnalyzing[idx] ? "bg-yellow-500 animate-pulse" : "bg-red-500 animate-ping")} />
                  <span className="text-[10px] bg-black/80 px-2 py-0.5 rounded border border-[#00ff41]/30">
                    CAM_0{idx + 1}
                  </span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className={cn(
                      "h-6 w-6 bg-black/80 border border-[#00ff41]/20",
                      cameraStates[idx].thermalMode ? "text-orange-500 border-orange-500/50" : "text-[#00ff41]/40"
                    )}
                    onClick={() => updateCameraState(idx, "thermalMode", !cameraStates[idx].thermalMode)}
                    title="Toggle Thermal Vision"
                  >
                    <Zap className={cn("w-3 h-3", cameraStates[idx].thermalMode && "fill-current")} />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className={cn(
                      "h-6 w-6 bg-black/80 border border-[#00ff41]/20",
                      chatCameraContext === idx ? "text-[#00ff41] bg-[#00ff41]/20 border-[#00ff41]" : "text-[#00ff41]/40"
                    )}
                    onClick={() => setChatCameraContext(idx)}
                    title="Focus for Comms Context"
                  >
                    <UserCheck className="w-3 h-3" />
                  </Button>
                </div>
                
                <Select value={cameraMapping[idx] || ""} onValueChange={(v) => handleCameraChange(idx, v)}>
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
              
              {cameraMapping[idx] ? (
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
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 border-2 border-dashed border-[#00ff41]/10">
                  <div className="relative">
                    <Camera className="w-12 h-12 opacity-20" />
                    <AlertTriangle className="w-6 h-6 text-yellow-500 absolute -top-2 -right-2 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] opacity-40 uppercase tracking-widest">No Signal Detected</p>
                    <Button 
                      variant="link" 
                      className="text-[#00ff41] text-[8px] h-auto p-0 mt-2 hover:opacity-100 opacity-60"
                      onClick={getDevices}
                    >
                      [ RE-SCAN HARDWARE ]
                    </Button>
                  </div>
                </div>
              )}

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

              {/* Focused HUD Rotation Control */}
              {chatCameraContext === idx && (
                <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 bg-black/85 backdrop-blur-md border border-[#00ff41]/60 px-2.5 py-1 rounded shadow-[0_0_12px_rgba(0,255,65,0.25)] text-[9px] font-mono text-[#00ff41]">
                  <span className="w-2 h-2 rounded-full bg-[#00ff41] animate-pulse shrink-0" />
                  <span className="font-bold tracking-wider uppercase text-[9px]">FOCUSED</span>
                  <span className="opacity-40">|</span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-[#00ff41] hover:bg-[#00ff41]/30 hover:text-[#00ff41] border border-[#00ff41]/20 rounded"
                    onClick={(e) => { e.stopPropagation(); rotateCamera(idx, -90); }}
                    title="Rotate counter-clockwise (Left/Down Arrow or Shift+R)"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                  <span className="font-bold text-[10px] text-[#00ff41] min-w-[28px] text-center">{cameraStates[idx].rotation}°</span>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    className="h-5 w-5 p-0 text-[#00ff41] hover:bg-[#00ff41]/30 hover:text-[#00ff41] border border-[#00ff41]/20 rounded"
                    onClick={(e) => { e.stopPropagation(); rotateCamera(idx, 90); }}
                    title="Rotate clockwise (Right/Up Arrow or R)"
                  >
                    <RotateCw className="w-3 h-3" />
                  </Button>
                  <span className="text-[8px] opacity-70 ml-1 hidden sm:inline text-[#00ff41] font-mono">[← / → / R]</span>
                </div>
              )}

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
            <CardHeader className="p-4 pb-2 border-b border-[#00ff41]/10 flex flex-row items-center justify-between">
              <CardTitle className="text-xs uppercase flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Detection_Log
              </CardTitle>
              <div className="flex gap-1">
                <Select value={cameraFilter?.toString() || "all"} onValueChange={(v) => setCameraFilter(v === "all" ? "all" : parseInt(v))}>
                  <SelectTrigger className="h-5 w-16 text-[7px] bg-black border-[#00ff41]/20">
                    <SelectValue placeholder="CAM" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-[#00ff41]/30">
                    <SelectItem value="all" className="text-[8px]">ALL</SelectItem>
                    <SelectItem value="0" className="text-[8px]">CAM 1</SelectItem>
                    <SelectItem value="1" className="text-[8px]">CAM 2</SelectItem>
                    <SelectItem value="2" className="text-[8px]">CAM 3</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={logFilter || "all"} onValueChange={setLogFilter}>
                  <SelectTrigger className="h-5 w-20 text-[7px] bg-black border-[#00ff41]/20">
                    <SelectValue placeholder="TYPE" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-[#00ff41]/30">
                    <SelectItem value="all" className="text-[8px]">ALL TYPES</SelectItem>
                    <SelectItem value="AUTO_DETECTION" className="text-[8px]">AUTO</SelectItem>
                    <SelectItem value="MANUAL_SCAN" className="text-[8px]">MANUAL</SelectItem>
                    <SelectItem value="ALERT" className="text-[8px]">ALERT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full p-4">
                <div className="space-y-4">
                  {events
                    .filter(e => {
                      const camMatch = cameraFilter === "all" || e.camera_id === cameraFilter;
                      const typeMatch = logFilter === "all" || e.type === logFilter;
                      return camMatch && typeMatch;
                    })
                    .map((event) => (
                    <div key={event.id} className="text-[10px] border-l border-[#00ff41]/30 pl-3 py-1">
                      <div className="flex justify-between opacity-50 mb-1">
                        <span>[{new Date(event.timestamp).toLocaleTimeString()}]</span>
                        <span>CAM_0{event.camera_id + 1}</span>
                      </div>
                      <p className="leading-tight mb-2">
                        <span className="text-[#00ff41]/80 font-bold">{event.type}:</span> {event.description}
                      </p>
                      {(event.confidence || event.params) && (
                        <div className="flex flex-wrap gap-2 items-center">
                          {event.confidence && (
                            <div className="flex items-center gap-1 bg-[#00ff41]/10 px-1.5 py-0.5 rounded border border-[#00ff41]/20">
                              <span className="text-[7px] opacity-60 uppercase">Conf</span>
                              <span className="text-[8px] font-bold text-[#00ff41]">{(event.confidence * 100).toFixed(1)}%</span>
                            </div>
                          )}
                          {event.params && (
                            <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                              <span className="text-[7px] opacity-60 uppercase">Params</span>
                              <span className="text-[8px] font-mono truncate max-w-[150px]">{event.params}</span>
                            </div>
                          )}
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
