import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer from "multer";
import { serveStatic, setupVite } from "./vite";
import { createMemeResult, regenerateCaptionOptions } from "../meme-caption";
import { retrieveMemeInspiration } from "../rag";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting at ${startPort}`);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/api/caption", upload.single("image"), async (request, response) => {
    try {
      if (!request.file) {
        response.status(400).json({ error: "Upload a JPG, PNG, or WEBP image to begin." });
        return;
      }

      const result = await createMemeResult({
        buffer: request.file.buffer,
        mimeType: request.file.mimetype,
        fileName: request.file.originalname,
      });

      response.json(result);
    } catch (error) {
      console.error("[caption] request failed:", error);
      response.status(500).json({ error: "Caption generation failed. Please try again." });
    }
  });

  app.post("/api/regenerate", async (request, response) => {
    try {
      const description =
        typeof request.body?.description === "string"
          ? request.body.description
          : "an everyday campus moment";

      const retrieved =
        Array.isArray(request.body?.retrieved) && request.body.retrieved.length
          ? request.body.retrieved
          : await retrieveMemeInspiration(description, 5);

      response.json(await regenerateCaptionOptions(description, retrieved));
    } catch (error) {
      console.error("[regenerate] request failed:", error);
      response.status(500).json({ error: "Could not generate new captions." });
    }
  });

  const isDevelopment = process.env.NODE_ENV !== "production";
  if (isDevelopment) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = Number(process.env.PORT || 3000);
  const port = await findAvailablePort(preferredPort);

  server.listen(port, () => {
    console.log(`Meme Caption Studio running at http://localhost:${port}`);
  });
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});
