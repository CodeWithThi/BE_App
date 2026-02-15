import express from "express";
import rootRouter from "./src/routers/root_router.js";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import prisma from "./src/config/database.js";
import { apiLimiter } from "./src/middlewares/rateLimiter.js";
import { validateEnv } from "./src/config/validateEnv.js";
import cache from "./src/config/cache.js";

// ─── Validate environment on startup ───
validateEnv();

const app = express();

// ─── Security Headers ───
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow serving static files cross-origin
}));

// ─── CORS — chỉ cho phép frontend ───
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:8080', 'http://localhost:5173'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ─── Body parsing with size limit ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Gzip compression — reduce ~70% response size ───
app.use(compression());

// ─── Rate limiting — 100 req/min per IP ───
app.use("/api", apiLimiter);

// ─── API Routes ───
app.use("/api/v1", rootRouter);

// ─── Static files (avatars, uploads) ───
app.use(express.static('public'));

// ─── Health Check — server + database ───
app.get("/health", async (req, res) => {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startTime;
    const memUsage = process.memoryUsage();
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
      memory: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      },
      database: {
        status: "connected",
        latency: `${dbLatency}ms`,
      },
      cache: cache.stats(),
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: {
        status: "disconnected",
        error: error.message,
      },
    });
  }
});

// ─── Global error handlers ───
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ [UNHANDLED REJECTION]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("💥 [UNCAUGHT EXCEPTION]", error);
  setTimeout(() => process.exit(1), 3000);
});

// ─── Start Server ───
const port = parseInt(process.env.PORT) || 3069;
app.listen(port, () => {
  console.log(`✅ Server is running on http://localhost:${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒 CORS origins: ${corsOrigins.join(', ')}`);
});

export default app;
