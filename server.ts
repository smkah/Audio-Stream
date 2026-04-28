import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);

  // WebSocket Server setup
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    console.log("Upgrade request received. URL:", request.url);
    // Attempt to handle all upgrade requests that look like WebSockets
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, req) => {
    console.log("Client connected. URL:", req.url);

    ws.on("message", (data, isBinary) => {
      // Broadcast binary audio data to all other clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data, { binary: isBinary });
        }
      });
    });

    ws.on("close", () => {
      console.log("Client disconnected");
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
