import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

const memoryEvents: any[] = [];
const MAX_EVENTS = 200;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/events", (req, res) => {
    const events = memoryEvents.slice(0, 50);
    res.json(events);
  });

  app.post("/api/events", (req, res) => {
    const { type, description, camera_id, confidence, params } = req.body;
    const entry = {
      id: memoryEvents.length + 1,
      timestamp: new Date().toISOString(),
      type,
      description,
      camera_id,
      confidence: confidence ?? null,
      params: params ?? null,
    };
    memoryEvents.unshift(entry);
    if (memoryEvents.length > MAX_EVENTS) memoryEvents.length = MAX_EVENTS;
    res.json({ id: entry.id });
  });

  // Motion alerts
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

  app.post("/api/telegram/alert", async (req, res) => {
    const { text } = req.body || {};
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return res.json({ ok: false, reason: "telegram_not_configured" });
    }
    try {
      const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text || "🚨 Motion detected in your space.",
          parse_mode: "HTML",
        }),
      });
      const data = await response.json();
      res.json({ ok: data.ok, result: data.result || null, error: data.description || null });
    } catch (err) {
      res.status(500).json({ ok: false, reason: String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ZION Server running on http://localhost:${PORT}`);
  });
}

startServer();
