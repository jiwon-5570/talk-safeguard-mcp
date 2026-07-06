export type BusinessStatus = "ACTIVE" | "CLOSED" | "SUSPENDED" | "UNKNOWN" | "API_NOT_CONFIGURED";

export interface BusinessVerification {
  status: BusinessStatus;
  source: string;
  warnings: string[];
  safeAction: string;
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

function fallback(number: string, warning?: string): BusinessVerification {
  const configuredStatus = sampleBusinesses[number];
  const warnings = [
    ...(warning === undefined ? [] : [warning]),
    "현재 결과는 공모전 시연용 로컬 샘플이며 실시간 국세청 조회 결과가 아닙니다.",
    "사업자등록 상태가 정상이어도 거래 상대방의 신원이나 거래 안전을 보장하지 않습니다.",
  ];
  return {
    status: configuredStatus ?? "API_NOT_CONFIGURED",
    source: "국세청 사업자등록정보 형식 기반 sample fallback",
    warnings,
    safeAction: "국세청·홈택스 등 공식 경로와 판매자 명의, 결제 수단을 함께 확인하고 개인계좌 선입금은 피하세요.",
  };
}

export async function verifyBusinessRegistration(
  businessRegistrationNumber: string,
  _representativeName?: string,
  _startDate?: string,
): Promise<BusinessVerification> {
  const number = normalizeBusinessNumber(businessRegistrationNumber);
  if (number.length !== 10) {
    return {
      status: "UNKNOWN",
      source: "입력 형식 검사",
      warnings: ["사업자등록번호는 숫자 10자리여야 합니다.", "번호 형식만으로 거래 안전을 판단할 수 없습니다."],
      safeAction: "정확한 사업자등록번호를 다시 확인하고 공식 조회 경로를 이용하세요.",
    };
  }

  const checksumWarning = hasValidBusinessNumberChecksum(number)
    ? undefined
    : "사업자등록번호 검증식과 일치하지 않습니다. 입력 번호를 다시 확인하세요.";
  const apiKey = process.env.NTS_BUSINESS_API_KEY?.trim();
  const actualMode = process.env.PUBLIC_DATA_MODE?.trim().toLowerCase() === "actual";
  if (!actualMode || !apiKey) {
    const modeWarning = [
      checksumWarning,
      ...(actualMode && !apiKey ? ["PUBLIC_DATA_MODE=actual이지만 국세청 API 키가 없어 sample fallback을 사용합니다."] : []),
    ].filter((warning): warning is string => warning !== undefined).join(" ") || undefined;
    return fallback(number, modeWarning);
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
    return {
      status: mapStatus(body.data?.[0]),
      source: "국세청 사업자등록정보 진위확인 및 상태조회 서비스",
      warnings,
      safeAction: "사업자 상태와 통신판매업 신고를 함께 확인하고 안전결제 등 구매자 보호 수단을 사용하세요.",
    };
  } catch {
    return fallback(number, "국세청 API 호출에 실패하여 로컬 샘플로 대체했습니다.");
  }
}
