import "dotenv/config";
import { createHttpApp } from "./server.js";
import { logger } from "./utils/logger.js";

const parsedPort = Number.parseInt(process.env.PORT ?? "3000", 10);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
const app = createHttpApp();

const server = app.listen(port, "0.0.0.0", () => {
  logger.info("server_started", { port, mcpEndpoint: "/mcp", infoEndpoint: "/mcp/info" });
});

server.on("error", (error) => {
  logger.error("server_start_failed", { error: error instanceof Error ? error.message : "UNKNOWN_ERROR" });
  process.exitCode = 1;
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info("server_shutdown_requested", { signal });
  server.close((error) => {
    if (error !== undefined) {
      logger.error("server_shutdown_failed", { error: error.message });
      process.exitCode = 1;
    }
    process.exit();
  });
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
