import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const LOG_DIR = path.join(os.homedir(), ".cloud-agent");
const LOG_FILE = path.join(LOG_DIR, "daemon.log");
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function getLogFilePath(): string {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
  return LOG_FILE;
}

function rotateLogIfNeeded(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > MAX_LOG_SIZE_BYTES) {
        const backupFile = `${filePath}.1`;
        if (fs.existsSync(backupFile)) {
          fs.unlinkSync(backupFile);
        }
        fs.renameSync(filePath, backupFile);
      }
    }
  } catch {
    // Ignore rotation error
  }
}

let isLoggerInitialized = false;

/**
 * Initializes daemon file logging.
 * Intercepts console.log, console.warn, console.error to write to ~/.cloud-agent/daemon.log
 * while preserving terminal output.
 */
export function initDaemonLogger(): void {
  if (isLoggerInitialized) return;
  isLoggerInitialized = true;

  const logPath = getLogFilePath();
  rotateLogIfNeeded(logPath);

  const writeStream = fs.createWriteStream(logPath, { flags: "a", encoding: "utf8" });

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  function stripAnsi(str: string): string {
    return str.replace(/\x1b\[[0-9;]*m/g, "");
  }

  function formatMessage(level: string, args: any[]): string {
    const timestamp = new Date().toISOString();
    const message = args
      .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
      .join(" ");
    return `[${timestamp}] [${level}] ${stripAnsi(message)}\n`;
  }

  console.log = (...args: any[]) => {
    originalLog(...args);
    try {
      writeStream.write(formatMessage("INFO", args));
    } catch {}
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    try {
      writeStream.write(formatMessage("WARN", args));
    } catch {}
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    try {
      writeStream.write(formatMessage("ERROR", args));
    } catch {}
  };
}

/**
 * Reads and streams daemon log file.
 */
export async function tailLogs(options: { lines?: number; follow?: boolean }): Promise<void> {
  const logPath = getLogFilePath();

  if (!fs.existsSync(logPath)) {
    console.log(`\x1b[90mNo daemon logs found at ${logPath}\x1b[0m`);
    console.log(`Start the daemon with 'ca start' to begin recording logs.`);
    return;
  }

  const linesCount = options.lines && options.lines > 0 ? options.lines : 50;

  // Read existing file
  const content = fs.readFileSync(logPath, "utf8");
  const allLines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const recentLines = allLines.slice(-linesCount);

  console.log(`\x1b[1m\x1b[36mDaemon Logs:\x1b[0m ${logPath} (last ${recentLines.length} lines)\n`);
  for (const line of recentLines) {
    printFormattedLogLine(line);
  }

  if (!options.follow) {
    return;
  }

  console.log(`\n\x1b[90m-- Following live logs (Press Ctrl+C to exit) --\x1b[0m\n`);

  let currentSize = fs.statSync(logPath).size;

  const interval = setInterval(() => {
    try {
      if (!fs.existsSync(logPath)) return;
      const stat = fs.statSync(logPath);
      if (stat.size > currentSize) {
        const stream = fs.createReadStream(logPath, {
          start: currentSize,
          end: stat.size,
          encoding: "utf8",
        });
        currentSize = stat.size;
        stream.on("data", (chunk: string | Buffer) => {
          const chunkStr = typeof chunk === "string" ? chunk : chunk.toString("utf8");
          const newLines = chunkStr.split(/\r?\n/).filter((l) => l.trim().length > 0);
          for (const l of newLines) {
            printFormattedLogLine(l);
          }
        });
      } else if (stat.size < currentSize) {
        // File rotated
        currentSize = stat.size;
      }
    } catch {}
  }, 500);

  process.on("SIGINT", () => {
    clearInterval(interval);
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

function printFormattedLogLine(line: string): void {
  if (line.includes("[ERROR]")) {
    console.log(`\x1b[31m${line}\x1b[0m`);
  } else if (line.includes("[WARN]")) {
    console.log(`\x1b[33m${line}\x1b[0m`);
  } else if (line.includes("[INFO]")) {
    console.log(`\x1b[37m${line}\x1b[0m`);
  } else {
    console.log(`\x1b[90m${line}\x1b[0m`);
  }
}
