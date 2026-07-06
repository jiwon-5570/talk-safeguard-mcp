import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SafetyNotice } from "./schemas.js";

export const SAFETY_MESSAGE =
  "공식 경로로 직접 확인하기 전까지 링크 클릭, 송금, 앱 설치, 개인정보 입력을 중단하세요.";

export const DISCLAIMER =
  "이 분석은 위험 신호에 기반한 보조 판단이며 사기 확정 판정이 아닙니다. 최종 확인은 해당 기관의 공식 홈페이지·대표번호 등 독립적인 공식 경로를 통해 진행해야 합니다.";

export const INCIDENT_SAFETY_MESSAGE =
  "피해가 발생했거나 송금했다면 즉시 해당 은행 고객센터, 경찰 112, 금융감독원 1332 등 공식 경로에 문의하세요.";

export function withSafety<T extends object>(value: T, safetyMessage = SAFETY_MESSAGE): T & SafetyNotice {
  return {
    ...value,
    safetyMessage,
    disclaimer: DISCLAIMER,
  };
}

export function toToolResult(value: object): CallToolResult {
  const structured = value as Record<string, unknown>;
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: structured,
  };
}
