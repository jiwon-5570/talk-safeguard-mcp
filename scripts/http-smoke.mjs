import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = new URL(process.env.MCP_URL ?? "http://127.0.0.1:3000/mcp");
const client = new Client({ name: "talk-safeguard-http-smoke", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(endpoint);

try {
  const healthResponse = await fetch(new URL("/health", endpoint));
  const health = await healthResponse.json();
  if (!healthResponse.ok || health.status !== "ok" || health.messageLogging !== false) {
    throw new Error("/health 응답이 예상과 다릅니다.");
  }
  const infoResponse = await fetch(new URL("/mcp/info", endpoint));
  const info = await infoResponse.json();
  if (!infoResponse.ok || info.privacyMode !== "no-message-storage" || info.tools?.length !== 8) {
    throw new Error("/mcp/info 응답이 예상과 다릅니다.");
  }
  await client.connect(transport);
  const listed = await client.listTools();
  if (listed.tools.length !== 8) throw new Error(`도구 수 불일치: ${listed.tools.length}`);
  const result = await client.callTool({
    name: "analyze_message_risk",
    arguments: { message: "오늘 저녁 7시에 가족방에서 여행 일정 이야기하자." },
  });
  if (result.isError === true || result.structuredContent?.["riskLevel"] !== "LOW") {
    throw new Error("HTTP MCP 도구 호출 결과가 예상과 다릅니다.");
  }
  console.log(`HTTP health/info, MCP 연결, tools/list ${listed.tools.length}개, analyze_message_risk 호출 확인 완료`);
} finally {
  await client.close();
}
