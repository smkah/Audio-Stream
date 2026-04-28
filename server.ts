import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Server } from "socket.io";
import { createServer } from "http";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);

  // Socket.IO Server setup
  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("audio", (data) => {
      // Broadcast binary audio data to all other clients
      socket.broadcast.emit("audio", data);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
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
    console.log(`NODE_ENV is: ${process.env.NODE_ENV}`);
  });
}

startServer();
