import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import env from "./config/env.js";
import connectDB from "./config/db.js";
import healthRouter from "./routes/health.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import authRouter from "./routes/auth.js";
import resumeRouter from "./routes/resume.js";
import dashboardRouter from "../src/routes/dashboard.js";
import insightsRouter from "../src/routes/insights.js";
import versionRouter from "../src/routes/version.js";
import historyRouter from "../src/routes/history.js";

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://ai-resume-roaster-beta.vercel.app",
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

if (!env.isPro) app.use(morgan("dev"));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/resumes", resumeRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/insights", insightsRouter);
app.use("/api/versions", versionRouter);
app.use("/api/history", historyRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    app.listen(env.port, () => {
      console.log(`Server listening on port: ${env.port} (${env.nodeEnv})`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

start();

export default app;
