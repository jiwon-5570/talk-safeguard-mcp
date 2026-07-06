import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTalkSafeguardServer, TOOL_NAMES } from "../src/server.js";

const requiredFiles = [
  "README.md",
  "demo-prompts.md",
  "submission-summary.md",
  ".env.example",
  "Dockerfile",
  ".dockerignore",
  "src/index.ts",
  "src/server.ts",
  "src/data/sample-phishing-urls.json",
  "src/data/sample-spam-url-patterns.json",
];

const expectedTools = [
  "analyze_message_risk",
  "extract_risk_indicators",
  "check_phishing_url",
  "classify_scam_type",
  "verify_business_info",
  "verify_online_seller",
  "check_investment_room_risk",
  "generate_safe_action_guide",
];

await Promise.all(requiredFiles.map((file) => access(resolve(process.cwd(), file))));
if (TOOL_NAMES.length !== 8 || expectedTools.some((name) => !TOOL_NAMES.includes(name as (typeof TOOL_NAMES)[number]))) {
  throw new Error(`MCP 도구 등록 검증 실패: ${TOOL_NAMES.join(", ")}`);
}

const server = createTalkSafeguardServer();
const client = new Client({ name: "talk-safeguard-validator", version: "1.0.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const listed = await client.listTools();
  const registered = listed.tools.map(({ name }) => name);
  if (registered.length !== 8 || expectedTools.some((name) => !registered.includes(name))) {
    throw new Error(`MCP tools/list 검증 실패: ${registered.join(", ")}`);
  }
} finally {
  await client.close();
  await server.close();
}

console.log(`필수 파일 ${requiredFiles.length}개 및 MCP tools/list 도구 ${TOOL_NAMES.length}개 확인 완료`);
