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
  customApiEnabled: boolean;
  customApiUrl: string;
  customApiKey: string;
  customApiModel: string;
  localTtsEnabled: boolean;
  localTtsUrl: string;
  localTtsApiKey: string;
  localTtsModel: string;
  localTtsVoice: string;
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
      localTtsVoice: "af_bella"
    };
  });

  const [systemStats, setSystemStats] = useState({
    cpu: 0,
    temp: 0,
    mem: 0,
    uptime: "00:00:00"
  });

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

      const res = await fetch(settings.localTtsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(settings.localTtsApiKey ? { "Authorization": `Bearer ${settings.localTtsApiKey}` } : {})
        },
        body: JSON.stringify({
          model: settings.localTtsModel || "kokoro",
          input: "vocal link authenticated",
          voice: settings.localTtsVoice || "af_bella"
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();

        setTtsTestResult({
          success: true,
          message: "Speech engine reachable! Local voice synthesized successfully: 'vocal link authenticated'. Playing brief sample.",
        });
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
      const cleanDeterrent = parsed.deterrent || "";
      confidence = parsed.confidence || 0.85;
      params = parsed.params || "threat_level: unknown";

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

    // --- Try Local Voice/TTS first if enabled ---
    if (settings.localTtsEnabled && settings.localTtsUrl) {
      try {
        const res = await fetch(settings.localTtsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(settings.localTtsApiKey ? { "Authorization": `Bearer ${settings.localTtsApiKey}` } : {})
          },
          body: JSON.stringify({
            model: settings.localTtsModel || "kokoro",
            input: text,
            voice: settings.localTtsVoice || "af_bella"
          })
        });
        if (!res.ok) throw new Error(`Local TTS returned HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.onended = () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          audioContext.close();
        };
        source.start();
        return; // Successfully spoke!
      } catch (localTtsErr) {
        console.error("Local TTS failed, falling back to standard methods:", localTtsErr);
        addAlert("WARNING", "Local Speech Engine failed. Falling back to Cloud/Native TTS.");
      }
    }

    try {
      let inflection = "whimsical and playful";
      if (settings.tone === "mocking") inflection = "witty, sarcastic, and lightheartedly mocking";
      if (settings.tone === "aggressive") inflection = "playfully loud and commanding";
      if (settings.tone === "creepy") inflection = "unsettlingly funny and whispery";
      if (settings.tone === "professional") inflection = "absurdly corporate and firm";

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
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
      console.warn("Gemini TTS failed, falling back to local Browser Web Speech Synthesis:", err);
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
        
        const voices = window.speechSynthesis.getVoices();
        // Try to match a native voice corresponding slightly to voiceVoice setting if possible
        let selectedVoice = null;
        if (settings.voiceVoice === "Charon" || settings.voiceVoice === "Fenrir") {
          selectedVoice = voices.find(v => v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("david") || v.name.toLowerCase().includes("microsoft"));
        } else {
          selectedVoice = voices.find(v => v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("google"));
        }
        utterance.voice = selectedVoice || voices[0] || null;

        utterance.onend = () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
        };
        utterance.onerror = () => {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
        };
        
        window.speechSynthesis.speak(utterance);
      } catch (speechErr) {
        console.error("Local SpeechSynthesis failed:", speechErr);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      }
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
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Voice API Endpoint</Label>
                        <input 
                          type="text"
                          className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] focus:outline-none focus:border-[#00ff41]"
                          value={settings.localTtsUrl}
                          onChange={(e) => {
                            setSettings(s => ({ ...s, localTtsUrl: e.target.value }));
                            setTtsTestResult(null);
                          }}
                          placeholder="http://localhost:8880/v1/audio/speech"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase opacity-60">Speech API Secret Token</Label>
                        <input 
                          type="password"
                          className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px] tracking-widest text-[#00ff41]"
                          value={settings.localTtsApiKey}
                          onChange={(e) => setSettings(s => ({ ...s, localTtsApiKey: e.target.value }))}
                          placeholder="Optional token (e.g. ElevenLabs, API keys etc.)"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase opacity-60">Voice Model</Label>
                          <input 
                            type="text"
                            className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px]"
                            value={settings.localTtsModel}
                            onChange={(e) => setSettings(s => ({ ...s, localTtsModel: e.target.value }))}
                            placeholder="kokoro"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase opacity-60">Voice Identifier</Label>
                          <input 
                            type="text"
                            className="w-full bg-black border border-[#00ff41]/20 rounded p-2 text-[10px]"
                            value={settings.localTtsVoice}
                            onChange={(e) => setSettings(s => ({ ...s, localTtsVoice: e.target.value }))}
                            placeholder="af_bella"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/20 text-[9px] h-7 w-full uppercase flex items-center justify-center gap-2"
                          onClick={testLocalTtsConnection}
                          disabled={testingTtsConnection}
                        >
                          <RefreshCw className={cn("w-3 h-3", testingTtsConnection && "animate-spin")} />
                          {testingTtsConnection ? "Synthesizing Audio stream..." : "Test Speech synthesis"}
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
