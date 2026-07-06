import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type NextFunction, type Request, type Response } from "express";
import { analyzeMessageRiskTool } from "./mcp/tools/analyzeMessageRisk.js";
import { checkInvestmentRoomRiskTool } from "./mcp/tools/checkInvestmentRoomRisk.js";
import { checkPhishingUrlTool } from "./mcp/tools/checkPhishingUrl.js";
import { classifyScamTypeTool } from "./mcp/tools/classifyScamType.js";
import { extractRiskIndicatorsTool } from "./mcp/tools/extractRiskIndicators.js";
import { generateSafeActionGuideTool } from "./mcp/tools/generateSafeActionGuide.js";
import { verifyBusinessInfoTool } from "./mcp/tools/verifyBusinessInfo.js";
import { verifyOnlineSellerTool } from "./mcp/tools/verifyOnlineSeller.js";
import {
  AnalyzeMessageInputSchema,
  CheckUrlInputSchema,
  MessageInputSchema,
  SafeActionGuideInputSchema,
  VerifyBusinessInputSchema,
  VerifyOnlineSellerInputSchema,
} from "./mcp/schemas.js";
import { toToolResult } from "./mcp/responses.js";
import { logger } from "./utils/logger.js";

export const TOOL_NAMES = [
  "analyze_message_risk",
  "extract_risk_indicators",
  "check_phishing_url",
  "classify_scam_type",
  "verify_business_info",
  "verify_online_seller",
  "check_investment_room_risk",
  "generate_safe_action_guide",
] as const;

export function createTalkSafeguardServer(): McpServer {
  const server = new McpServer({ name: "talk-safeguard-mcp", version: "1.0.0" });

  server.registerTool(
    "analyze_message_risk",
    {
      title: "카카오톡 메시지 종합 위험 분석",
      description: "메시지의 사칭·송금·링크·개인정보·앱 설치 신호를 분석해 위험도와 안전 행동을 안내합니다.",
      inputSchema: AnalyzeMessageInputSchema,
    },
    async (input) => toToolResult(analyzeMessageRiskTool(input)),
  );
  server.registerTool(
    "extract_risk_indicators",
    {
      title: "위험 요소 추출",
      description: "URL, 금전 요구, 전화번호·계좌번호 후보 등 위험 분석 요소를 메모리에서만 일시 추출합니다.",
      inputSchema: MessageInputSchema,
    },
    async (input) => toToolResult(extractRiskIndicatorsTool(input)),
  );
  server.registerTool(
    "check_phishing_url",
    {
      title: "피싱 URL 점검",
      description: "URL을 정규화하고 공공데이터 형식 기반 샘플 및 의심 도메인 규칙과 비교합니다.",
      inputSchema: CheckUrlInputSchema,
    },
    async (input) => toToolResult(checkPhishingUrlTool(input)),
  );
  server.registerTool(
    "classify_scam_type",
    {
      title: "의심 유형 분류",
      description: "메시지를 가족 사칭, 기관 사칭, 스미싱, 투자 리딩방, 선입금 등 유형으로 분류합니다.",
      inputSchema: MessageInputSchema,
    },
    async (input) => toToolResult(classifyScamTypeTool(input)),
  );
  server.registerTool(
    "verify_business_info",
    {
      title: "사업자등록 상태 확인",
      description: "국세청 API 또는 sample fallback으로 사업자등록 상태를 보조 확인합니다.",
      inputSchema: VerifyBusinessInputSchema,
    },
    async (input) => toToolResult(await verifyBusinessInfoTool(input)),
  );
  server.registerTool(
    "verify_online_seller",
    {
      title: "통신판매사업자 확인",
      description: "공정거래위원회 API 또는 sample fallback으로 통신판매업 등록 여부를 보조 확인합니다.",
      inputSchema: VerifyOnlineSellerInputSchema,
    },
    async (input) => toToolResult(await verifyOnlineSellerTool(input)),
  );
  server.registerTool(
    "check_investment_room_risk",
    {
      title: "투자 리딩방 위험 분석",
      description: "원금·수익 보장, 고수익, 해외거래소 가입과 입금 유도 신호를 분석합니다.",
      inputSchema: MessageInputSchema,
    },
    async (input) => toToolResult(checkInvestmentRoomRiskTool(input)),
  );
  server.registerTool(
    "generate_safe_action_guide",
    {
      title: "상황별 안전 대응 가이드",
      description: "클릭·송금·앱 설치·정보 제공 여부에 맞춘 즉시 대응과 공식 신고 경로를 안내합니다.",
      inputSchema: SafeActionGuideInputSchema,
    },
    async (input) => toToolResult(generateSafeActionGuideTool(input)),
  );

  return server;
}

function configuredOrigins(): Set<string> {
  return new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function createHttpApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const allowed = configuredOrigins();
    const origin = request.header("origin");
    if (origin !== undefined && allowed.size > 0 && !allowed.has(origin)) {
      response.status(403).json({ error: "허용되지 않은 Origin입니다." });
      return;
    }
    next();
  });

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "talk-safeguard-mcp", tools: TOOL_NAMES.length });
  });

  app.post("/mcp", async (request, response) => {
    const server = createTalkSafeguardServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch {
      logger.error("mcp_request_failed");
      if (!response.headersSent) response.status(500).json({ error: "MCP 요청 처리 중 오류가 발생했습니다." });
    }
  });

  app.get("/mcp", (_request, response) => {
    response.status(405).set("Allow", "POST").json({ error: "이 서버는 stateless POST 방식으로 동작합니다." });
  });
  app.delete("/mcp", (_request, response) => {
    response.status(405).set("Allow", "POST").json({ error: "stateless 모드에서는 세션 삭제가 필요하지 않습니다." });
  });
  return app;
}
