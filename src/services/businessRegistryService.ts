export type BusinessStatus = "ACTIVE" | "CLOSED" | "SUSPENDED" | "UNKNOWN" | "API_NOT_CONFIGURED";

import type { CanProceed } from "../mcp/schemas.js";

interface BusinessVerificationBase {
  status: BusinessStatus;
  source: string;
  warnings: string[];
  safeAction: string;
}

export interface BusinessVerification extends BusinessVerificationBase {
  businessDecision: string;
  canTrustSeller: CanProceed;
  remainingRisks: string[];
  transactionChecklist: string[];
}

interface NtsStatusItem {
  b_stt_cd?: string;
  b_stt?: string;
}

interface NtsResponse {
  data?: NtsStatusItem[];
}

const sampleBusinesses: Record<string, Exclude<BusinessStatus, "API_NOT_CONFIGURED">> = {
  "1234567890": "ACTIVE",
  "0000000000": "CLOSED",
};

export function normalizeBusinessNumber(value: string): string {
  return value.replace(/\D/gu, "");
}

export function hasValidBusinessNumberChecksum(value: string): boolean {
  const digits = normalizeBusinessNumber(value).split("").map(Number);
  if (digits.length !== 10) return false;
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5] as const;
  const weighted = weights.reduce((sum, weight, index) => sum + (digits[index] ?? 0) * weight, 0);
  const ninth = digits[8] ?? 0;
  const check = (10 - ((weighted + Math.floor((ninth * 5) / 10)) % 10)) % 10;
  return check === digits[9];
}

function mapStatus(item: NtsStatusItem | undefined): BusinessStatus {
  if (item?.b_stt_cd === "01" || item?.b_stt?.includes("계속")) return "ACTIVE";
  if (item?.b_stt_cd === "02" || item?.b_stt?.includes("휴업")) return "SUSPENDED";
  if (item?.b_stt_cd === "03" || item?.b_stt?.includes("폐업")) return "CLOSED";
  return "UNKNOWN";
}

function decodeApiKey(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function withBusinessDecision(value: BusinessVerificationBase): BusinessVerification {
  const canTrustSeller: CanProceed = value.status === "CLOSED" || value.status === "SUSPENDED" ? "NO" : "CHECK_FIRST";
  const businessDecision = value.status === "ACTIVE"
    ? "국세청 사업자등록 상태는 정상으로 확인됐지만 거래 안전을 보장하지는 않습니다. 판매자 정보와 결제 조건을 추가 확인하세요."
    : value.status === "CLOSED" || value.status === "SUSPENDED"
      ? "현재 사업자 상태로는 거래를 진행하지 않는 것이 안전합니다. 공식 조회 결과와 판매자 설명을 다시 확인하세요."
      : "사업자 상태를 충분히 확인하지 못했습니다. 확인 전에는 판매자를 신뢰하거나 송금하지 마세요.";
  return {
    ...value,
    businessDecision,
    canTrustSeller,
    remainingRisks: [
      "사업자등록 상태가 정상이어도 거래 안전을 보장하지 않습니다.",
      "개인계좌 선입금, 안전결제 거부, 카톡 주문만 가능, 지나치게 낮은 가격은 별도 위험 신호입니다.",
      "정상 사업자 정보가 사기범에게 도용됐을 가능성도 확인해야 합니다.",
    ],
    transactionChecklist: [
      "국세청 공식 경로에서 사업자 상태를 다시 확인하세요.",
      "공정거래위원회 통신판매사업자 등록 정보를 함께 확인하세요.",
      "판매자 상호·대표자·주소·입금 계좌 명의가 서로 일치하는지 확인하세요.",
      "개인계좌 선입금보다 구매자 보호가 적용되는 안전결제를 사용하세요.",
    ],
  };
}

function sampleFallback(number: string, warning?: string): BusinessVerification {
  const configuredStatus = sampleBusinesses[number];
  const warnings = [
    ...(warning === undefined ? [] : [warning]),
    "현재 결과는 PUBLIC_DATA_MODE=sample에서만 사용하는 로컬 샘플이며 실시간 국세청 조회 결과가 아닙니다.",
    "실제 운영에서는 PUBLIC_DATA_MODE=actual과 API 키를 설정해 공공데이터 API만 사용하세요.",
  ];
  return withBusinessDecision({
    status: configuredStatus ?? "API_NOT_CONFIGURED",
    source: "국세청 사업자등록정보 형식 기반 sample fallback",
    warnings,
    safeAction: "운영 환경에서는 실제 국세청 API 조회가 성공한 뒤에만 참고하세요.",
  });
}

function actualUnavailable(status: BusinessStatus, source: string, warnings: string[]): BusinessVerification {
  return withBusinessDecision({
    status,
    source,
    warnings,
    safeAction: "실제 국세청 API 조회가 완료되지 않았습니다. API 키, 활용신청 상태, 네트워크 상태를 확인한 뒤 다시 조회하세요.",
  });
}

export async function verifyBusinessRegistration(
  businessRegistrationNumber: string,
  _representativeName?: string,
  _startDate?: string,
): Promise<BusinessVerification> {
  const number = normalizeBusinessNumber(businessRegistrationNumber);
  if (number.length !== 10) {
    return withBusinessDecision({
      status: "UNKNOWN",
      source: "입력 형식 검증",
      warnings: ["사업자등록번호는 숫자 10자리여야 합니다.", "번호 형식만으로 거래 안전을 판단할 수 없습니다."],
      safeAction: "정확한 사업자등록번호를 다시 확인하고 공식 조회 경로를 이용하세요.",
    });
  }

  const checksumWarning = hasValidBusinessNumberChecksum(number)
    ? undefined
    : "사업자등록번호가 검증식과 일치하지 않습니다. 입력 번호를 다시 확인하세요.";
  const apiKey = process.env.NTS_BUSINESS_API_KEY?.trim();
  const publicDataMode = process.env.PUBLIC_DATA_MODE?.trim().toLowerCase() ?? "actual";
  const actualMode = publicDataMode === "actual";

  if (!actualMode) return sampleFallback(number, checksumWarning);
  if (!apiKey) {
    return actualUnavailable("API_NOT_CONFIGURED", "국세청 API 미설정", [
      ...(checksumWarning === undefined ? [] : [checksumWarning]),
      "PUBLIC_DATA_MODE=actual이지만 NTS_BUSINESS_API_KEY가 설정되지 않았습니다.",
    ]);
  }

  try {
    const endpoint = new URL("https://api.odcloud.kr/api/nts-businessman/v1/status");
    endpoint.searchParams.set("serviceKey", decodeApiKey(apiKey));
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ b_no: [number] }),
      signal: AbortSignal.timeout(7_000),
    });
    if (!response.ok) throw new Error(`NTS_HTTP_${response.status}`);
    const body = (await response.json()) as NtsResponse;
    const warnings = [
      ...(checksumWarning === undefined ? [] : [checksumWarning]),
      "사업자등록 상태가 정상이어도 거래 상대방의 신원이나 거래 안전을 보장하지 않습니다.",
    ];
    return withBusinessDecision({
      status: mapStatus(body.data?.[0]),
      source: "국세청 사업자등록정보 진위확인 및 상태조회 API",
      warnings,
      safeAction: "사업자 상태와 통신판매 신고를 함께 확인하고 안전결제 또는 구매자 보호 수단을 사용하세요.",
    });
  } catch (error) {
    return actualUnavailable("UNKNOWN", "국세청 사업자등록정보 진위확인 및 상태조회 API", [
      ...(checksumWarning === undefined ? [] : [checksumWarning]),
      `국세청 API 호출에 실패했습니다: ${error instanceof Error ? error.message : "UNKNOWN_ERROR"}`,
      "actual 모드에서는 API 실패 시 sample 데이터로 대체하지 않습니다.",
    ]);
  }
}
