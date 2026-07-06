import type { ReceivedVia, RiskLevel, ScamType, UserSituation } from "../mcp/schemas.js";
import { extractRiskIndicators, scamKeywords, type RiskIndicators } from "../utils/extractors.js";
import { processEphemeral } from "../utils/privacy.js";
import { clampRiskScore, scoreToRiskLevel } from "../utils/scoring.js";
import { analyzePhishingUrl } from "./phishingUrlService.js";
import { buildFraudDecision, type FraudDecision } from "./fraudDecisionService.js";
import { generateSafetyGuide, scamTypeLabel } from "./safetyGuideService.js";

export interface ScamClassification {
  primaryType: ScamType;
  subTypes: ScamType[];
  confidence: number;
  evidence: string[];
  explanation: string;
}

export interface MessageRiskAnalysis extends FraudDecision {
  riskScore: number;
  riskLevel: RiskLevel;
  scamTypes: ScamType[];
  reasons: string[];
  prohibitedActions: string[];
  recommendedActions: string[];
  /** @deprecated 하위 호환 필드. decisionSummary와 nextStepGuide를 사용하세요. */
  familyShareMessage: string;
  /** @deprecated incidentReportSummary를 사용하세요. */
  reportSummaryTemplate: string;
}

interface MatchedRule {
  type: ScamType;
  evidence: string[];
}

function present(message: string, values: string[]): string[] {
  const lower = message.toLocaleLowerCase("ko-KR");
  return values.filter((value) => lower.includes(value.toLocaleLowerCase("ko-KR")));
}

function classifyRules(message: string): MatchedRule[] {
  const matches: MatchedRule[] = [];
  const hasUrl = /(?:https?|hxxps?):\/\/|www\./iu.test(message);
  const money = present(message, scamKeywords.money);
  const family = present(message, scamKeywords.family);
  const avoidance = present(message, scamKeywords.phoneAvoidance);
  const agency = present(message, scamKeywords.agency);
  const delivery = present(message, scamKeywords.delivery);
  const loan = present(message, scamKeywords.loan);
  const shopping = present(message, scamKeywords.shopping);
  const used = present(message, scamKeywords.usedMarket);
  const auth = present(message, scamKeywords.authCode);
  const remote = present(message, scamKeywords.remoteApp);
  const kakaoBrand = present(message, scamKeywords.kakaoBrand);
  const eventLure = present(message, scamKeywords.eventLure);
  const invitation = present(message, scamKeywords.invitation);
  const publicNotice = present(message, scamKeywords.publicNotice);
  const giftCard = present(message, scamKeywords.giftCard);
  const accountSecurity = present(message, scamKeywords.accountSecurity);
  const investment = present(message, [
    "리딩방", "원금 보장", "수익 보장", "매일 5%", "해외거래소", "급등주", "코인 선물", "입금 인증", "손실 없음",
  ]);

  if (
    accountSecurity.length > 0
    && hasUrl
    && (auth.length > 0 || /비밀번호|인증번호|본인\s*확인|입력/u.test(message))
  ) {
    matches.push({
      type: "ACCOUNT_TAKEOVER",
      evidence: [...kakaoBrand, ...accountSecurity, ...auth, "자격정보 입력 링크"],
    });
  }
  if (kakaoBrand.length > 0 && eventLure.length > 0 && hasUrl && /인증|확인|입력|클릭|접속/u.test(message)) {
    matches.push({
      type: "KAKAO_BRAND_IMPERSONATION",
      evidence: [...kakaoBrand, ...eventLure, "URL 포함"],
    });
  }
  if (giftCard.length > 0 && /사\s*줘|구매|핀번호|상품권\s*번호|사진.*보내|전달/u.test(message)) {
    matches.push({ type: "GIFT_CARD_SCAM", evidence: giftCard });
  }
  if (family.length > 0 && (money.length > 0 || avoidance.length > 0 || giftCard.length > 0)) {
    matches.push({ type: "FAMILY_IMPERSONATION", evidence: [...family, ...money, ...avoidance] });
  }
  if (agency.length > 0 && (auth.length > 0 || remote.length > 0 || /범죄|수사|안전계좌|자금 검사/u.test(message))) {
    matches.push({ type: "AGENCY_IMPERSONATION", evidence: [...agency, ...auth, ...remote] });
  }
  if (delivery.length > 0 && (hasUrl || /입력|확인/u.test(message))) {
    matches.push({ type: "DELIVERY_SMISHING", evidence: [...delivery, ...(hasUrl ? ["URL 포함"] : [])] });
  }
  if (invitation.length > 0 && hasUrl) {
    matches.push({ type: "INVITATION_SMISHING", evidence: [...invitation, "URL 포함"] });
  }
  if (publicNotice.length > 0 && hasUrl && /미납|오류|확인|납부|조회/u.test(message)) {
    matches.push({ type: "PUBLIC_NOTICE_SMISHING", evidence: [...publicNotice, "URL 포함"] });
  }
  if (loan.length > 0 || (/대출/u.test(message) && /수수료|보증료|선입금|저금리/u.test(message))) {
    matches.push({ type: "LOAN_SCAM", evidence: loan.length > 0 ? loan : ["대출 선입금·수수료 요구"] });
  }
  if (investment.length >= 2 || /VIP\s*(?:주식|코인)?\s*리딩방/iu.test(message)) {
    matches.push({ type: "INVESTMENT_ROOM", evidence: investment });
  }
  if (shopping.length > 0 && (/입금|선입금|개인계좌/u.test(message))) {
    matches.push({ type: "SHOPPING_PREPAYMENT", evidence: [...shopping, ...money] });
  }
  if (used.length > 0 && (/입금|선입금|예약금/u.test(message))) {
    matches.push({ type: "USED_MARKET_PREPAYMENT", evidence: [...used, ...money] });
  }
  if (auth.length > 0 && /알려|보내|입력|전달|확인/u.test(message)) {
    matches.push({ type: "AUTH_CODE_REQUEST", evidence: auth });
  }
  if (remote.length > 0) matches.push({ type: "REMOTE_APP_INSTALL", evidence: remote });
  return matches;
}

export function classifyMessage(message: string): ScamClassification {
  return processEphemeral(message, (ephemeralMessage) => {
    const matches = classifyRules(ephemeralMessage);
    if (matches.length === 0) {
      return {
        primaryType: "UNKNOWN_RISK",
        subTypes: [],
        confidence: 0.2,
        evidence: [],
        explanation: "현재 규칙에서 특정 의심 유형을 뚜렷하게 분류할 근거가 적습니다. 이는 안전을 보장한다는 의미가 아닙니다.",
      };
    }
    const primary = matches[0];
    if (primary === undefined) throw new Error("분류 규칙 결과가 비어 있습니다.");
    const evidence = [...new Set(matches.flatMap((match) => match.evidence))];
    return {
      primaryType: primary.type,
      subTypes: matches.slice(1).map((match) => match.type),
      confidence: Math.min(0.98, 0.55 + evidence.length * 0.07),
      evidence,
      explanation: `${scamTypeLabel(primary.type)}과 관련된 복합 위험 신호 ${evidence.length}개가 감지되었습니다. 이는 가능성 분류이며 확정 판정이 아닙니다.`,
    };
  });
}

function addReason(reasons: string[], condition: boolean, reason: string, weight: number): number {
  if (!condition) return 0;
  reasons.push(reason);
  return weight;
}

export function analyzeMessage(
  message: string,
  userSituation: UserSituation = "unknown",
  receivedVia: ReceivedVia = "unknown",
  userQuestion?: string,
): MessageRiskAnalysis {
  return processEphemeral(message, (ephemeralMessage) => {
    const indicators: RiskIndicators = extractRiskIndicators(ephemeralMessage);
    const classification = classifyMessage(ephemeralMessage);
    const types = [classification.primaryType, ...classification.subTypes];
    const reasons: string[] = [];
    const transferRequest = /송금|입금|이체|보내\s*줘|보내줘|선입금/u.test(ephemeralMessage);
    const phoneAvoidance = /전화는?\s*안\s*돼|통화가?\s*안\s*돼|전화하지\s*마|폰\s*고장|휴대폰\s*고장/u.test(ephemeralMessage);
    const impersonation = types.includes("FAMILY_IMPERSONATION") || types.includes("AGENCY_IMPERSONATION");
    const authRequest = types.includes("AUTH_CODE_REQUEST") || /인증번호|OTP|보안카드/u.test(ephemeralMessage);
    const remoteInstall = types.includes("REMOTE_APP_INSTALL");
    const guaranteedReturn = /원금\s*보장|수익\s*보장|손실\s*없음|매일\s*\d+(?:\.\d+)?%/u.test(ephemeralMessage);
    const overseasExchange = /해외\s*거래소|코인\s*선물/u.test(ephemeralMessage);
    const personalPrepay = /개인\s*계좌/u.test(ephemeralMessage) && /입금|선입금|송금/u.test(ephemeralMessage);
    const giftCardRequest = types.includes("GIFT_CARD_SCAM");
    const accountTakeover = types.includes("ACCOUNT_TAKEOVER");
    const kakaoBrandImpersonation = types.includes("KAKAO_BRAND_IMPERSONATION");
    const invitationSmishing = types.includes("INVITATION_SMISHING");
    const publicNoticeSmishing = types.includes("PUBLIC_NOTICE_SMISHING");
    const installRequest = remoteInstall || /앱\s*(?:설치|다운로드)|파일\s*다운로드|프로그램\s*설치/u.test(ephemeralMessage);
    const urlRisk = indicators.urls.map(analyzePhishingUrl);

    let score = 0;
    score += addReason(reasons, indicators.urls.length > 0, "메시지에 외부 URL이 포함되어 있습니다.", 10);
    score += addReason(reasons, urlRisk.some((risk) => risk.riskLevel !== "LOW"), "URL에서 알려진 샘플 또는 의심 도메인 신호가 감지되었습니다.", 15);
    score += addReason(reasons, transferRequest, "송금·입금 요구 표현이 포함되어 있습니다.", 25);
    score += addReason(reasons, indicators.bankAccountCandidates.length > 0, "계좌번호로 보이는 숫자열이 포함되어 있습니다.", 20);
    score += addReason(reasons, phoneAvoidance, "기존 전화 확인을 피하게 하는 표현이 포함되어 있습니다.", 20);
    score += addReason(reasons, indicators.urgentPhrases.length > 0, "긴급성을 강조해 판단 시간을 줄이는 표현이 있습니다.", 10);
    score += addReason(reasons, impersonation, "가족·지인 또는 기관 사칭과 관련된 신호가 있습니다.", 25);
    score += addReason(reasons, authRequest, "인증번호나 금융 인증정보 요구 신호가 있습니다.", 30);
    score += addReason(reasons, remoteInstall, "원격제어 또는 출처 불명 앱 설치 유도 신호가 있습니다.", 35);
    score += addReason(reasons, guaranteedReturn, "원금·수익 보장 또는 손실이 없다는 표현이 있습니다.", 25);
    score += addReason(reasons, overseasExchange, "외부·해외 거래소 가입 유도 신호가 있습니다.", 20);
    score += addReason(reasons, personalPrepay, "개인계좌 선입금을 요구하는 신호가 있습니다.", 20);
    score += addReason(reasons, types.includes("DELIVERY_SMISHING") && indicators.urls.length > 0, "배송 문제를 명목으로 링크 확인을 유도합니다.", 20);
    score += addReason(reasons, /주소.*입력|개인정보.*입력|본인인증/u.test(ephemeralMessage), "개인정보 입력 또는 본인인증을 유도합니다.", 15);
    score += addReason(reasons, types.includes("INVESTMENT_ROOM"), "투자 리딩방·고수익 홍보 신호가 복합적으로 나타납니다.", 20);
    score += addReason(reasons, types.includes("SHOPPING_PREPAYMENT") || types.includes("USED_MARKET_PREPAYMENT"), "비대면 거래에서 선입금을 유도하는 신호가 있습니다.", 10);
    score += addReason(reasons, giftCardRequest, "상품권 구매 또는 핀번호·상품권 번호 전달을 요구합니다.", 35);
    score += addReason(reasons, accountTakeover, "계정 제한을 명목으로 비밀번호나 인증번호 입력을 유도합니다.", 40);
    score += addReason(reasons, kakaoBrandImpersonation, "카카오·카카오페이 이벤트를 사칭해 링크에서 본인확인을 유도합니다.", 30);
    score += addReason(reasons, invitationSmishing, "청첩장·부고 안내를 가장해 외부 링크 확인을 유도합니다.", 35);
    score += addReason(reasons, publicNoticeSmishing, "공공기관·과태료 안내를 가장해 외부 링크 확인을 유도합니다.", 35);
    score += addReason(reasons, installRequest && (invitationSmishing || publicNoticeSmishing), "안내 확인을 명목으로 앱이나 파일 설치를 유도합니다.", 30);

    if (types.includes("FAMILY_IMPERSONATION") && transferRequest && phoneAvoidance) score = Math.max(score, 85);
    if (types.includes("INVESTMENT_ROOM") && guaranteedReturn && overseasExchange) score = Math.max(score, 85);
    if (types.includes("AGENCY_IMPERSONATION") && (remoteInstall || authRequest)) score = Math.max(score, 85);
    if (giftCardRequest && (phoneAvoidance || impersonation)) score = Math.max(score, 85);
    if (accountTakeover && authRequest) score = Math.max(score, 85);
    if (kakaoBrandImpersonation && indicators.urls.length > 0) score = Math.max(score, 70);
    if (invitationSmishing && indicators.urls.length > 0) score = Math.max(score, installRequest ? 85 : 65);
    if (publicNoticeSmishing && indicators.urls.length > 0) score = Math.max(score, 65);
    if (userSituation === "clicked_link") score = Math.max(score + 20, 60);
    if (["sent_money", "installed_app", "shared_info"].includes(userSituation)) score = Math.max(score, 85);

    const riskScore = clampRiskScore(score);
    const riskLevel = scoreToRiskLevel(riskScore);
    const guide = generateSafetyGuide(userSituation, riskLevel, classification.primaryType, {
      hasUrl: indicators.urls.length > 0,
      transferRequested: transferRequest,
      appInstallRequested: installRequest,
      sensitiveInfoRequested: authRequest || indicators.sensitiveInfoRequests.length > 0,
      receivedVia,
    });
    const fraudDecision = buildFraudDecision({
      message: ephemeralMessage,
      ...(userQuestion === undefined ? {} : { userQuestion }),
      userSituation,
      riskScore,
      riskLevel,
      scamTypes: classification.primaryType === "UNKNOWN_RISK" ? ["UNKNOWN_RISK"] : types,
      reasons,
      indicators,
      immediateActions: guide.immediateActions,
      reportGuide: guide.reportGuide,
      incidentReportSummary: guide.incidentReportSummary,
    });
    return {
      ...fraudDecision,
      riskScore,
      riskLevel,
      scamTypes: classification.primaryType === "UNKNOWN_RISK" ? ["UNKNOWN_RISK"] : types,
      reasons,
      prohibitedActions: guide.doNotActions,
      recommendedActions: [...guide.immediateActions, ...guide.reportGuide],
      familyShareMessage: guide.familyShareMessage,
      reportSummaryTemplate: guide.reportSummaryTemplate,
    };
  });
}
