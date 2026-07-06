import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTalkSafeguardServer, TOOL_NAMES } from "../src/server.js";

const requiredFiles = [
  "README.md",
  "demo-prompts.md",
  "submission-summary.md",
  "SECURITY.md",
  "PRIVACY.md",
  "ARCHITECTURE.md",
  ".env.example",
  "Dockerfile",
  ".dockerignore",
  "src/index.ts",
  "src/server.ts",
  "src/data/sample-phishing-urls.json",
  "src/data/sample-spam-url-patterns.json",
  "src/tests/httpEndpoints.test.ts",
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

const toolFiles = [
  "src/mcp/tools/analyzeMessageRisk.ts",
  "src/mcp/tools/extractRiskIndicators.ts",
  "src/mcp/tools/checkPhishingUrl.ts",
  "src/mcp/tools/classifyScamType.ts",
  "src/mcp/tools/verifyBusinessInfo.ts",
  "src/mcp/tools/verifyOnlineSeller.ts",
  "src/mcp/tools/checkInvestmentRoomRisk.ts",
  "src/mcp/tools/generateSafeActionGuide.ts",
];

const requiredEnvVars = [
  "ENABLE_DEBUG_ENDPOINT",
  "RATE_LIMIT_WINDOW_MS",
  "RATE_LIMIT_MAX",
  "ALLOWED_ORIGINS",
  "NTS_BUSINESS_API_KEY",
  "FTC_ONLINE_SELLER_API_KEY",
  "PHISHING_DATA_MODE",
  "SPAM_URL_DATA_MODE",
  "PUBLIC_DATA_MODE",
];

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  }));
  return nested.flat();
}

await Promise.all(requiredFiles.map((file) => access(resolve(process.cwd(), file))));
if (TOOL_NAMES.length !== 8 || expectedTools.some((name) => !TOOL_NAMES.includes(name as (typeof TOOL_NAMES)[number]))) {
  throw new Error(`MCP 도구 등록 검증 실패: ${TOOL_NAMES.join(", ")}`);
}

const serverSource = await readFile(resolve(process.cwd(), "src/server.ts"), "utf8");
for (const endpoint of ["/health", "/mcp/info", "/debug/analyze", "/mcp"]) {
  if (!serverSource.includes(endpoint)) throw new Error(`필수 endpoint 구현 누락: ${endpoint}`);
}

const responseSource = await readFile(resolve(process.cwd(), "src/mcp/responses.ts"), "utf8");
if (!responseSource.includes("safetyMessage") || !responseSource.includes("disclaimer")) {
  throw new Error("공통 안전 고지 필드 구현을 찾을 수 없습니다.");
}
for (const toolFile of toolFiles) {
  const source = await readFile(resolve(process.cwd(), toolFile), "utf8");
  if (!source.includes("withSafety")) throw new Error(`안전 고지 적용 누락: ${toolFile}`);
}

const envExample = await readFile(resolve(process.cwd(), ".env.example"), "utf8");
for (const variable of requiredEnvVars) {
  if (!envExample.includes(`${variable}=`)) throw new Error(`.env.example 필수 환경변수 누락: ${variable}`);
}

const sourceFiles = await collectTypeScriptFiles(resolve(process.cwd(), "src"));
const directMessageLogPattern = /(?:logger\.(?:debug|info|warn|error)|console\.(?:log|info|warn|error))\s*\(\s*(?:message|rawMessage|input\.message|request\.body)/u;
for (const sourceFile of sourceFiles) {
  const source = await readFile(sourceFile, "utf8");
  if (directMessageLogPattern.test(source)) throw new Error(`메시지 원문 직접 로그 가능성 발견: ${sourceFile}`);
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

console.log(
  `필수 파일 ${requiredFiles.length}개, endpoint 4개, 환경변수 ${requiredEnvVars.length}개, MCP tools/list 도구 ${TOOL_NAMES.length}개, 원문 로그 금지 패턴 확인 완료`,
);
