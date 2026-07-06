import { analyzeMessage } from "../../services/riskRuleEngine.js";
import { extractRiskIndicators } from "../../utils/extractors.js";
import { INCIDENT_SAFETY_MESSAGE, withSafety } from "../responses.js";
import { CheckKakaoMessageInputSchema } from "../schemas.js";

export function checkKakaoMessageTool(input: unknown) {
  const { message, question, userSituation } = CheckKakaoMessageInputSchema.parse(input);
  const analysis = analyzeMessage(message, userSituation, "unknown", question);
  const indicators = extractRiskIndicators(message);
  const incident = ["sent_money", "installed_app", "shared_info"].includes(userSituation);
  return withSafety(
    {
      decisionSummary: analysis.decisionSummary,
      verdict: analysis.verdict,
      canProceed: analysis.canProceed,
      userQuestionAnswer: analysis.userQuestionAnswer,
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      scamTypes: analysis.scamTypes,
      evidenceSummary: analysis.evidenceSummary,
      verificationChecklist: analysis.verificationChecklist,
      doNotActions: analysis.doNotActions,
      nextStepGuide: analysis.nextStepGuide,
      incidentReportSummary: analysis.incidentReportSummary,
      relatedChecks: {
        hasUrl: indicators.urls.length > 0,
        hasBusinessNumber: indicators.businessRegistrationNumbers.length > 0,
        hasInvestmentSignal: /리딩방|원금\s*보장|수익\s*보장|손실\s*없음|해외\s*거래소|급등주/u.test(message),
        hasMoneyRequest: /송금|입금|이체|보내\s*줘|선입금|결제/u.test(message),
        hasAuthCodeRequest: /인증번호|OTP|보안카드|인증\s*코드/u.test(message),
        hasAppInstallRequest: /원격\s*제어|앱\s*(?:설치|다운로드)|보안\s*앱|팀뷰어|애니데스크/u.test(message),
      },
    },
    incident ? INCIDENT_SAFETY_MESSAGE : undefined,
  );
}
