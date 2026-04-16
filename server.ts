import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Database setup
  const db = new Database("zion.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      type TEXT,
      description TEXT,
      camera_id INTEGER
    )
  `);

  // Migration: Add confidence and params if they don't exist
  const tableInfo = db.prepare("PRAGMA table_info(events)").all() as any[];
  const hasConfidence = tableInfo.some(col => col.name === "confidence");
  const hasParams = tableInfo.some(col => col.name === "params");

  if (!hasConfidence) {
    db.exec("ALTER TABLE events ADD COLUMN confidence REAL");
  }
  if (!hasParams) {
    db.exec("ALTER TABLE events ADD COLUMN params TEXT");
  }

  app.use(express.json());

  // API Routes
  app.get("/api/events", (req, res) => {
    const events = db.prepare("SELECT * FROM events ORDER BY timestamp DESC LIMIT 50").all();
    res.json(events);
  });

  app.post("/api/events", (req, res) => {
    const { type, description, camera_id, confidence, params } = req.body;
    const info = db.prepare("INSERT INTO events (type, description, camera_id, confidence, params) VALUES (?, ?, ?, ?, ?)")
      .run(type, description, camera_id, confidence || null, params || null);
    res.json({ id: info.lastInsertRowid });
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
