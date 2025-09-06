import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import routes from "./routes";
import { verifyPostgresConnection } from "./config/prisma";
import { apiLimiter } from "./middleware/rateLimiter";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

const app = express();

// Trust proxy for rate limiting behind reverse proxy (Render)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "https://warehousewizard-frontend.onrender.com"
  ],
  credentials: true,
}));
app.use(compression());

// Rate limiting
app.use("/api", apiLimiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

(async () => {
  // Connect to PostgreSQL database via Prisma
  await verifyPostgresConnection();
  
  // Setup API routes
  app.use("/api", routes);
  
  const server = require("http").createServer(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve API only (no Vite, no frontend)
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    console.log(`🚀 Server running on port ${port}`); // ✅ Backend running at http://localhost:5000
    console.log(`📊 Connected to PostgreSQL via Prisma`);
  });
})();