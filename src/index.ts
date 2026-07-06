import "dotenv/config";
import { createHttpApp } from "./server.js";
import { logger } from "./utils/logger.js";

const parsedPort = Number.parseInt(process.env.PORT ?? "3000", 10);
const port = Number.isFinite(parsedPort) ? parsedPort : 3000;
const app = createHttpApp();

app.listen(port, "0.0.0.0", () => {
  logger.info("server_started", { port, mcpEndpoint: "/mcp", infoEndpoint: "/mcp/info" });
});
