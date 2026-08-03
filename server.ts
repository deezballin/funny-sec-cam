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
