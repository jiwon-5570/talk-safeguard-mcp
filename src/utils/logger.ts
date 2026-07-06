type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function configuredLevel(): LogLevel {
  const value = process.env.LOG_LEVEL?.toLowerCase();
  return value === "debug" || value === "warn" || value === "error" ? value : "info";
}

function write(level: LogLevel, event: string, metadata: Record<string, string | number | boolean> = {}): void {
  if (levels[level] < levels[configuredLevel()]) return;
  // 사용자 메시지, URL, 전화번호, 계좌번호 등 원문은 metadata에 전달하지 않는다.
  const record = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...metadata });
  if (level === "error" || level === "warn") console.error(record);
  else console.log(record);
}

export const logger = {
  debug: (event: string, metadata?: Record<string, string | number | boolean>) => write("debug", event, metadata),
  info: (event: string, metadata?: Record<string, string | number | boolean>) => write("info", event, metadata),
  warn: (event: string, metadata?: Record<string, string | number | boolean>) => write("warn", event, metadata),
  error: (event: string, metadata?: Record<string, string | number | boolean>) => write("error", event, metadata),
};
