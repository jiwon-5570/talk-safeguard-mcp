import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpApp, TOOL_NAMES } from "../server.js";

const servers: Server[] = [];

async function startApp(): Promise<string> {
  const app = createHttpApp();
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

describe("HTTP 운영 endpoint", () => {
  it("/health가 개인정보 비저장 운영 상태를 반환한다", async () => {
    const baseUrl = await startApp();
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body["tools"]).toBe(9);
    expect(body["primaryTool"]).toBe("check_kakao_message");
    expect(body["version"]).toBe("1.1.0");
    expect(body["messageLogging"]).toBe(false);
    expect(body["dataRetention"]).toBe("none");
    expect(body["timestamp"]).toEqual(expect.any(String));
  });

  it("/mcp/info가 9개 도구와 실제 데이터 모드를 공개한다", async () => {
    const baseUrl = await startApp();
    const response = await fetch(`${baseUrl}/mcp/info`);
    const body = await response.json() as { version: string; primaryTool: string; toolCount: number; tools: string[]; privacyMode: string; dataMode: Record<string, string> };

    expect(response.status).toBe(200);
    expect(body.tools).toEqual(TOOL_NAMES);
    expect(body.version).toBe("1.1.0");
    expect(body.primaryTool).toBe("check_kakao_message");
    expect(body.toolCount).toBe(9);
    expect(body.privacyMode).toBe("no-message-storage");
    expect(body.dataMode["phishing"]).toBe("official-dataset-and-heuristic-only");
    expect(body.dataMode["spamUrl"]).toBe("official-spam-url-dataset-only");
    expect(body.dataMode["business"]).toBe("actual-api-only");
    expect(body.dataMode["onlineSeller"]).toBe("actual-api-only");
  });

  it("/debug/analyze가 종합·추출·분류·URL 분석을 묶어 반환한다", async () => {
    vi.stubEnv("ENABLE_DEBUG_ENDPOINT", "true");
    const baseUrl = await startApp();
    const response = await fetch(`${baseUrl}/debug/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "카카오페이 이벤트 당첨입니다. http://kakao-pay-event.example.com 에서 본인인증하세요.",
        userSituation: "before_click",
      }),
    });
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body["analysis"]).toBeDefined();
    expect(body["indicators"]).toBeDefined();
    expect(body["classification"]).toBeDefined();
    expect(body["urlAnalysis"]).toBeDefined();
    expect(body["safetyMessage"]).toEqual(expect.any(String));
    expect(body["disclaimer"]).toEqual(expect.any(String));
  });

  it("ENABLE_DEBUG_ENDPOINT=false이면 debug endpoint를 숨긴다", async () => {
    vi.stubEnv("ENABLE_DEBUG_ENDPOINT", "false");
    const baseUrl = await startApp();
    const response = await fetch(`${baseUrl}/debug/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "테스트" }),
    });
    expect(response.status).toBe(404);
  });

  it("debug endpoint는 명시적으로 켜지 않으면 숨긴다", async () => {
    const baseUrl = await startApp();
    const response = await fetch(`${baseUrl}/debug/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "테스트" }),
    });
    expect(response.status).toBe(404);
  });

  it("허용되지 않은 Origin을 403으로 차단한다", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", "https://allowed.example.com");
    const baseUrl = await startApp();
    const response = await fetch(`${baseUrl}/mcp/info`, { headers: { origin: "https://blocked.example.com" } });
    expect(response.status).toBe(403);
  });

  it("요청 한도를 넘으면 429를 반환하고 /health는 제한하지 않는다", async () => {
    vi.stubEnv("RATE_LIMIT_MAX", "2");
    vi.stubEnv("RATE_LIMIT_WINDOW_MS", "60000");
    const baseUrl = await startApp();

    expect((await fetch(`${baseUrl}/mcp/info`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/mcp/info`)).status).toBe(200);
    expect((await fetch(`${baseUrl}/mcp/info`)).status).toBe(429);
    expect((await fetch(`${baseUrl}/health`)).status).toBe(200);
  });

  it("helmet 보안 헤더를 적용한다", async () => {
    const baseUrl = await startApp();
    const response = await fetch(`${baseUrl}/health`);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
  });
});
