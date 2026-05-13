import { Router, type IRouter } from "express";
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const RECORDINGS_DIR = process.env.RECORDINGS_DIR ?? "/tmp/iptv-recordings";

fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

interface ActiveRecording {
  id: string;
  process: ChildProcess;
  outputPath: string;
  filename: string;
  startedAt: number;
  stoppedAt: number | null;
  url: string;
  recentLog: string;
}

const active = new Map<string, ActiveRecording>();

function safeFilename(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9._\- ]/g, "_").slice(0, 120).trim();
}

function fileSizeBytes(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function isAlive(rec: ActiveRecording): boolean {
  return rec.process.exitCode === null && rec.stoppedAt === null;
}

// POST /api/recordings/start
router.post("/recordings/start", (req, res) => {
  const { id, url, filename } = req.body as {
    id?: string;
    url?: string;
    filename?: string;
  };

  if (!id || !url || !filename) {
    res.status(400).json({ error: "id, url and filename are required" });
    return;
  }

  if (active.has(id)) {
    const rec = active.get(id)!;
    res.json({
      id,
      outputPath: rec.outputPath,
      filename: rec.filename,
      startedAt: rec.startedAt,
      alive: isAlive(rec),
    });
    return;
  }

  const safe = safeFilename(filename);
  const outputPath = path.join(RECORDINGS_DIR, safe);

  const ffmpegArgs = [
    "-y",
    "-loglevel", "warning",
    "-i", url,
    "-c", "copy",
    "-avoid_negative_ts", "make_zero",
    outputPath,
  ];

  const proc = spawn("ffmpeg", ffmpegArgs, { stdio: ["ignore", "ignore", "pipe"] });

  const rec: ActiveRecording = {
    id,
    process: proc,
    outputPath,
    filename: safe,
    startedAt: Date.now(),
    stoppedAt: null,
    url,
    recentLog: "",
  };

  let logBuf = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    logBuf += chunk.toString();
    const lines = logBuf.split("\n");
    logBuf = lines.pop() ?? "";
    rec.recentLog = lines.slice(-5).join("\n");
  });

  proc.on("exit", (code, signal) => {
    logger.info({ id, code, signal }, "FFmpeg recording process exited");
    rec.stoppedAt = Date.now();
    // Keep in map for 10 minutes so status/download still work
    setTimeout(() => active.delete(id), 10 * 60 * 1000);
  });

  active.set(id, rec);
  logger.info({ id, outputPath, url }, "Recording started");

  res.json({
    id,
    outputPath,
    filename: safe,
    startedAt: rec.startedAt,
    alive: true,
  });
});

// POST /api/recordings/stop/:id
router.post("/recordings/stop/:id", (req, res) => {
  const rec = active.get(req.params.id!);
  if (!rec) {
    res.status(404).json({ error: "Recording not found" });
    return;
  }
  if (isAlive(rec)) {
    rec.process.kill("SIGTERM");
    logger.info({ id: rec.id }, "Recording stopped via SIGTERM");
  }
  res.json({ ok: true, id: rec.id });
});

// GET /api/recordings/status/:id
router.get("/recordings/status/:id", (req, res) => {
  const rec = active.get(req.params.id!);
  if (!rec) {
    res.status(404).json({ error: "Recording not found" });
    return;
  }
  const alive = isAlive(rec);
  const elapsedMs = alive
    ? Date.now() - rec.startedAt
    : (rec.stoppedAt ?? Date.now()) - rec.startedAt;

  res.json({
    id: rec.id,
    filename: rec.filename,
    outputPath: rec.outputPath,
    fileSize: fileSizeBytes(rec.outputPath),
    elapsedMs,
    alive,
    recentLog: rec.recentLog,
  });
});

// GET /api/recordings/active  — list all currently tracked recordings
router.get("/recordings/active", (_req, res) => {
  const list = Array.from(active.values()).map((rec) => ({
    id: rec.id,
    filename: rec.filename,
    startedAt: rec.startedAt,
    alive: isAlive(rec),
    fileSize: fileSizeBytes(rec.outputPath),
  }));
  res.json(list);
});

// GET /api/recordings/download/:id  — stream the recorded file
router.get("/recordings/download/:id", (req, res) => {
  const rec = active.get(req.params.id!);
  if (!rec) {
    res.status(404).json({ error: "Recording not found" });
    return;
  }
  if (!fs.existsSync(rec.outputPath)) {
    res.status(404).json({ error: "File not yet written" });
    return;
  }
  const stat = fs.statSync(rec.outputPath);
  res.setHeader("Content-Disposition", `attachment; filename="${rec.filename}"`);
  res.setHeader("Content-Type", "video/mp2t");
  res.setHeader("Content-Length", stat.size);
  fs.createReadStream(rec.outputPath).pipe(res);
});

// GET /api/recordings/pipe?url=<encoded_stream_url>
// Pipes any stream through ffmpeg (converting to MPEG-TS) directly to the HTTP response.
// The mobile client uses expo-file-system DownloadResumable to write this to disk in real-time.
// When the client pauses/aborts the download, req "close" fires and ffmpeg is killed.
router.get("/recordings/pipe", (req, res) => {
  const rawUrl = req.query["url"];
  if (!rawUrl || typeof rawUrl !== "string") {
    res.status(400).json({ error: "url query parameter is required" });
    return;
  }

  let streamUrl: string;
  try {
    streamUrl = decodeURIComponent(rawUrl);
  } catch {
    res.status(400).json({ error: "Invalid url encoding" });
    return;
  }

  res.setHeader("Content-Type", "video/mp2t");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");

  const proc = spawn("ffmpeg", [
    "-loglevel", "warning",
    "-i", streamUrl,
    "-c", "copy",
    "-f", "mpegts",
    "pipe:1",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  proc.stdout?.pipe(res);

  req.on("close", () => {
    if (proc.exitCode === null) {
      proc.kill("SIGTERM");
      logger.info({ url: streamUrl.slice(0, 80) }, "Pipe recording stopped by client");
    }
  });

  proc.on("exit", (code, signal) => {
    logger.info({ code, signal }, "Pipe ffmpeg exited");
    if (!res.writableEnded) res.end();
  });
});

export default router;
