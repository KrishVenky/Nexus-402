type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  ts: string;
  level: LogLevel;
  service: string;
  msg: string;
  [key: string]: unknown;
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

const MIN_LEVEL: LogLevel =
  (process.env["LOG_LEVEL"] as LogLevel | undefined) ?? "info";

const shouldLog = (level: LogLevel): boolean =>
  LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];

const emit = (
  level: LogLevel,
  service: string,
  msg: string,
  extra?: Record<string, unknown>
): void => {
  if (!shouldLog(level)) return;
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    service,
    msg,
    ...extra,
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
};

export const createLogger = (service: string) => ({
  debug: (msg: string, extra?: Record<string, unknown>): void =>
    emit("debug", service, msg, extra),
  info: (msg: string, extra?: Record<string, unknown>): void =>
    emit("info", service, msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>): void =>
    emit("warn", service, msg, extra),
  error: (msg: string, extra?: Record<string, unknown>): void =>
    emit("error", service, msg, extra),
});

// Default logger for shared utilities
export const logger = createLogger("nexus-shared");
