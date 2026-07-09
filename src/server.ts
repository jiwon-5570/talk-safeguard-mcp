import { createHash, randomBytes } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { analyzeMessageRiskTool } from "./mcp/tools/analyzeMessageRisk.js";
import { checkKakaoMessageTool } from "./mcp/tools/checkKakaoMessage.js";
import { checkInvestmentRoomRiskTool } from "./mcp/tools/checkInvestmentRoomRisk.js";
import { checkPhishingUrlTool } from "./mcp/tools/checkPhishingUrl.js";
import { classifyScamTypeTool } from "./mcp/tools/classifyScamType.js";
import { extractRiskIndicatorsTool } from "./mcp/tools/extractRiskIndicators.js";
import { generateSafeActionGuideTool } from "./mcp/tools/generateSafeActionGuide.js";
import { verifyBusinessInfoTool } from "./mcp/tools/verifyBusinessInfo.js";
import { verifyOnlineSellerTool } from "./mcp/tools/verifyOnlineSeller.js";
import {
  AnalyzeMessageInputSchema,
  CheckKakaoMessageInputSchema,
  CheckUrlInputSchema,
  MessageInputSchema,
  SafeActionGuideInputSchema,
  VerifyBusinessInputSchema,
  VerifyOnlineSellerInputSchema,
} from "./mcp/schemas.js";
import { toToolResult } from "./mcp/responses.js";
import { logger } from "./utils/logger.js";

export const SERVICE_NAME = "talk-safeguard-mcp";
export const SERVICE_VERSION = "1.1.0";
export const PRIMARY_TOOL = "check_kakao_message";
export const SERVICE_DESCRIPTION = "카카오톡 의심 메시지에 대해 눌러도 되는지, 송금해도 되는지, 믿어도 되는지를 행동 전에 확인하는 사기 위험 판단 보조 MCP";

export const TOOL_NAMES = [
  "check_kakao_message",
  "analyze_message_risk",
  "extract_risk_indicators",
  "check_phishing_url",
  "classify_scam_type",
  "verify_business_info",
  "verify_online_seller",
  "check_investment_room_risk",
  "generate_safe_action_guide",
] as const;

function serviceToolDescription(description: string): string {
  return `톡세이프가드(talksafeguard) 서비스 도구입니다. ${description}`;
}

function readOnlyToolAnnotations(title: string, openWorldHint = false): ToolAnnotations {
  return {
    title,
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint,
  };
}

export function createTalkSafeguardServer(): McpServer {
  const server = new McpServer({ name: SERVICE_NAME, version: SERVICE_VERSION });

  server.registerTool(
    "check_kakao_message",
    {
      title: "카카오톡 메시지 사기 위험 확인",
      description: serviceToolDescription("카카오톡 메시지와 사용자의 질문을 받아 눌러도 되는지, 송금해도 되는지, 믿어도 되는지에 직접 답합니다."),
      annotations: readOnlyToolAnnotations("톡세이프가드 카카오톡 메시지 사기 위험 확인"),
      inputSchema: CheckKakaoMessageInputSchema,
    },
    async (input) => toToolResult(checkKakaoMessageTool(input)),
  );
  server.registerTool(
    "analyze_message_risk",
    {
      title: "카카오톡 메시지 종합 위험 분석",
      description: serviceToolDescription("메시지의 위험 신호를 분석하고 사용자의 질문에 진행 가능 여부, 근거, 확인 체크리스트와 다음 행동으로 답합니다."),
      annotations: readOnlyToolAnnotations("톡세이프가드 카카오톡 메시지 종합 위험 분석"),
      inputSchema: AnalyzeMessageInputSchema,
    },
    async (input) => toToolResult(analyzeMessageRiskTool(input)),
  );
  server.registerTool(
    "extract_risk_indicators",
    {
      title: "위험 요소 추출",
      description: serviceToolDescription("URL, 금전 요구, 전화번호·계좌번호 후보 등 위험 분석 요소를 메모리에서만 일시 추출합니다."),
      annotations: readOnlyToolAnnotations("톡세이프가드 위험 요소 추출"),
      inputSchema: MessageInputSchema,
    },
    async (input) => toToolResult(extractRiskIndicatorsTool(input)),
  );
  server.registerTool(
    "check_phishing_url",
    {
      title: "피싱 URL 점검",
      description: serviceToolDescription("URL을 정규화하고 의심 도메인 규칙과 비교해 링크를 열어도 되는지와 공식 확인 방법을 안내합니다."),
      annotations: readOnlyToolAnnotations("톡세이프가드 피싱 URL 점검"),
      inputSchema: CheckUrlInputSchema,
    },
    async (input) => toToolResult(checkPhishingUrlTool(input)),
  );
  server.registerTool(
    "classify_scam_type",
    {
      title: "의심 유형 분류",
      description: serviceToolDescription("메시지를 가족 사칭, 기관 사칭, 스미싱, 투자 리딩방, 선입금 등 유형으로 분류합니다."),
      annotations: readOnlyToolAnnotations("톡세이프가드 의심 유형 분류"),
      inputSchema: MessageInputSchema,
    },
    async (input) => toToolResult(classifyScamTypeTool(input)),
  );
  server.registerTool(
    "verify_business_info",
    {
      title: "사업자등록 상태 확인",
      description: serviceToolDescription("국세청 사업자등록정보 API로 사업자등록 상태를 보조 확인합니다. actual 모드에서는 sample fallback을 사용하지 않습니다."),
      annotations: readOnlyToolAnnotations("톡세이프가드 사업자등록 상태 확인", true),
      inputSchema: VerifyBusinessInputSchema,
    },
    async (input) => toToolResult(await verifyBusinessInfoTool(input)),
  );
  server.registerTool(
    "verify_online_seller",
    {
      title: "통신판매사업자 확인",
      description: serviceToolDescription("공정거래위원회 통신판매사업자 등록상세 API로 통신판매업 등록 여부를 보조 확인합니다. actual 모드에서는 sample fallback을 사용하지 않습니다."),
      annotations: readOnlyToolAnnotations("톡세이프가드 통신판매사업자 확인", true),
      inputSchema: VerifyOnlineSellerInputSchema,
    },
    async (input) => toToolResult(await verifyOnlineSellerTool(input)),
  );
  server.registerTool(
    "check_investment_room_risk",
    {
      title: "투자 리딩방 위험 분석",
      description: serviceToolDescription("원금·수익 보장, 고수익, 해외거래소 유도 신호를 분석해 투자방 참여·입금 가능 여부를 안내합니다."),
      annotations: readOnlyToolAnnotations("톡세이프가드 투자 리딩방 위험 분석"),
      inputSchema: MessageInputSchema,
    },
    async (input) => toToolResult(checkInvestmentRoomRiskTool(input)),
  );
  server.registerTool(
    "generate_safe_action_guide",
    {
      title: "상황별 안전 대응 가이드",
      description: serviceToolDescription("클릭·송금·앱 설치·정보 제공 여부에 맞춰 진행 가능 여부, 즉시 행동, 확인 체크리스트와 신고 경로를 안내합니다."),
      annotations: readOnlyToolAnnotations("톡세이프가드 상황별 안전 대응 가이드"),
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

function envPositiveInteger(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  return fallback;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

function createRateLimitMiddleware() {
  const windowMs = envPositiveInteger("RATE_LIMIT_WINDOW_MS", 60_000);
  const maxRequests = envPositiveInteger("RATE_LIMIT_MAX", 60);
  const entries = new Map<string, RateLimitEntry>();
  const salt = randomBytes(32).toString("hex");

  return (request: Request, response: Response, next: NextFunction): void => {
    if (request.path === "/health") {
      next();
      return;
    }

    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
    const rawAddress = request.ip || request.socket.remoteAddress || "unknown";
    const clientKey = createHash("sha256").update(salt).update(rawAddress).digest("hex");
    const current = entries.get(clientKey);
    const entry = current === undefined || current.resetAt <= now
      ? { count: 1, resetAt: now + windowMs }
      : { count: current.count + 1, resetAt: current.resetAt };
    entries.set(clientKey, entry);

    const remaining = Math.max(0, maxRequests - entry.count);
    response.setHeader("RateLimit-Limit", maxRequests);
    response.setHeader("RateLimit-Remaining", remaining);
    response.setHeader("RateLimit-Reset", Math.ceil(entry.resetAt / 1_000));
    if (entry.count > maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1_000));
      response.setHeader("Retry-After", retryAfterSec);
      response.status(429).json({
        error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        retryAfterSec,
      });
      return;
    }
    next();
  };
}

function createCorsMiddleware(allowedOrigins: Set<string>, production: boolean) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.header("origin");
    if (origin === undefined) {
      next();
      return;
    }
    const allowDevelopmentOrigin = !production && allowedOrigins.size === 0;
    if (!allowDevelopmentOrigin && !allowedOrigins.has(origin)) {
      response.status(403).json({ error: "허용되지 않은 Origin입니다." });
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.append("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept,Mcp-Session-Id,Last-Event-ID");
    response.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id,RateLimit-Limit,RateLimit-Remaining,RateLimit-Reset");
    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }
    next();
  };
}

export function createHttpApp() {
  const app = express();
  const production = process.env.NODE_ENV === "production";
  const allowedOrigins = configuredOrigins();
  if (production && allowedOrigins.size === 0) {
    logger.warn("cors_allowlist_missing_in_production");
  }
  if (envFlag("TRUST_PROXY", false)) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "64kb" }));
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use(createCorsMiddleware(allowedOrigins, production));
  app.use(createRateLimitMiddleware());

  app.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      tools: TOOL_NAMES.length,
      primaryTool: PRIMARY_TOOL,
      privacyMode: "no-message-storage",
      messageLogging: false,
      dataRetention: "none",
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/mcp/info", (_request, response) => {
    response.json({
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      description: SERVICE_DESCRIPTION,
      primaryTool: PRIMARY_TOOL,
      toolCount: TOOL_NAMES.length,
      tools: TOOL_NAMES,
      purpose: SERVICE_DESCRIPTION,
      privacyMode: "no-message-storage",
      dataMode: {
        phishing: process.env.PHISHING_DATA_MODE ?? "actual",
        spamUrl: process.env.SPAM_URL_DATA_MODE ?? "actual",
        publicData: process.env.PUBLIC_DATA_MODE ?? "actual",
        business: "actual-api-no-sample-fallback",
        onlineSeller: "actual-api-no-sample-fallback",
      },
      safetyPolicy: "risk-signal-only-no-fraud-certification",
    });
  });

  app.post("/debug/analyze", async (request, response) => {
    if (!envFlag("ENABLE_DEBUG_ENDPOINT", !production)) {
      response.status(404).json({ error: "요청한 endpoint를 찾을 수 없습니다." });
      return;
    }
    try {
      const input = AnalyzeMessageInputSchema.parse(request.body);
      const analysis = analyzeMessageRiskTool(input);
      const indicators = extractRiskIndicatorsTool({ message: input.message });
      const classification = classifyScamTypeTool({ message: input.message });
      const urlAnalysis = indicators.urls.map((url) => checkPhishingUrlTool({ url }));
      const investmentAnalysis = /리딩방|원금\s*보장|수익\s*보장|해외\s*거래소|급등주|코인\s*선물/u.test(input.message)
        ? checkInvestmentRoomRiskTool({ message: input.message })
        : undefined;
      response.json({
        analysis,
        indicators,
        classification,
        ...(urlAnalysis.length > 0 ? { urlAnalysis } : {}),
        ...(investmentAnalysis === undefined ? {} : { investmentAnalysis }),
        safetyMessage: analysis.safetyMessage,
        disclaimer: analysis.disclaimer,
      });
    } catch {
      response.status(400).json({ error: "요청 형식을 확인해 주세요." });
    }
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
