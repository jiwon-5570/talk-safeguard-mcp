import { describe, expect, it } from "vitest";
import { checkPhishingUrlTool } from "../mcp/tools/checkPhishingUrl.js";

describe("check_phishing_url", () => {
  it("공식 스팸 URL CSV 데이터셋과 일치하는 URL을 탐지한다", () => {
    const result = checkPhishingUrlTool({ url: "hxxps://bit.ly/2F3ZKuZ" });
    expect(result.normalizedUrl).toBe("https://bit.ly/2F3ZKuZ");
    expect(result.matchedKnownPattern).toBe(true);
    expect(["HIGH", "CRITICAL"]).toContain(result.riskLevel);
    expect(result.matchedDataSource).toBe("official-spam-url-dataset");
    expect(result.riskScore).toBeGreaterThanOrEqual(60);
    expect(result.networkFetchPolicy).toContain("직접 접속하지");
  });

  it("공식 서비스와 유사한 비공식 도메인을 탐지한다", () => {
    const result = checkPhishingUrlTool({ url: "https://kakao-login-security.example.org" });
    expect(result.riskLevel).not.toBe("LOW");
    expect(result.suspiciousSignals.join(" ")).toContain("공식 도메인");
  });

  it("카카오페이 이벤트 유사 도메인을 휴리스틱으로 HIGH 이상 판단한다", () => {
    const result = checkPhishingUrlTool({ url: "http://kakao-pay-event.example.com/verify" });
    expect(["HIGH", "CRITICAL"]).toContain(result.riskLevel);
    expect(result.matchedKnownPattern).toBe(false);
    expect(result.matchedDataSource).toBe("heuristic");
    expect(result.suspiciousSignals.join(" ")).toMatch(/kakao|공식 도메인|브랜드/u);
  });

  it("카카오 공식 도메인의 일반 이벤트 경로를 과도하게 경고하지 않는다", () => {
    const result = checkPhishingUrlTool({ url: "https://www.kakao.com/event" });
    expect(result.riskLevel).toBe("LOW");
    expect(result.riskScore).toBe(0);
  });

  it.each([
    "https://bit.ly/example",
    "http://192.168.10.20/login",
    "https://xn--kakao-9za.example/verify",
    "hxxps://gov24-check.example.com/pay",
  ])("단축·IP·punycode·변형 URL 신호를 반환한다: %s", (url) => {
    const result = checkPhishingUrlTool({ url });
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.matchedDataSource.length).toBeGreaterThan(0);
    expect(result.suspiciousSignals.length).toBeGreaterThan(0);
  });

  it.each([
    "https://kakao.com@account-check.example.com/login",
    "http://127.0.0.1/admin",
    "https://download.example.com/security-update.apk",
    "https://example.com/login?redirect=https://account-check.example.net",
  ])("사용자정보 위장·내부주소·설치파일·리디렉션 위험을 탐지한다: %s", (url) => {
    const result = checkPhishingUrlTool({ url });
    expect(result.canOpen).not.toBe("YES");
    expect(result.riskScore).toBeGreaterThanOrEqual(20);
    expect(result.suspiciousSignals.length).toBeGreaterThan(0);
  });
});
