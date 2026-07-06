export type UserQuestionIntent =
  | "ASK_IF_SCAM"
  | "ASK_OPEN_LINK"
  | "ASK_SEND_MONEY"
  | "ASK_TRUST_SELLER"
  | "ASK_JOIN_INVESTMENT"
  | "ASK_ENTER_AUTH_CODE"
  | "ASK_INSTALL_APP"
  | "ASK_AFTER_CLICK"
  | "ASK_AFTER_SENT_MONEY"
  | "ASK_REPORT"
  | "UNKNOWN";

export function detectQuestionIntent(question?: string, message = ""): UserQuestionIntent {
  const value = `${question ?? ""} ${message}`.toLocaleLowerCase("ko-KR");
  if (/이미\s*(?:링크를?\s*)?(?:눌렀|클릭했)|링크\s*클릭했/u.test(value)) return "ASK_AFTER_CLICK";
  if (/(?:이미\s*)?(?:송금|입금)했|이미\s*(?:송금|입금)|돈\s*보냈/u.test(value)) return "ASK_AFTER_SENT_MONEY";
  if (/신고|상담|요약/u.test(value)) return "ASK_REPORT";
  if (/(?:투자|리딩)\s*방|VIP\s*(?:주식|코인)?\s*리딩방|투자해도|가입해도|방\s*들어가도/u.test(value)) {
    return "ASK_JOIN_INVESTMENT";
  }
  if (/사업자\s*번호|쇼핑몰|판매자|결제해도|구매해도|판매자.*믿어도/u.test(value)) return "ASK_TRUST_SELLER";
  if (/인증번호|OTP|보안카드|인증\s*코드|알려줘도|입력해도/u.test(value)) return "ASK_ENTER_AUTH_CODE";
  if (/앱\s*설치|원격\s*앱|보안\s*앱|설치해도/u.test(value)) return "ASK_INSTALL_APP";
  if (/링크.*눌러도|URL.*열어도|링크.*열어도|접속해도|들어가도\s*돼/u.test(value)) return "ASK_OPEN_LINK";
  if (/송금해도|입금해도|이체해도|보내도\s*돼/u.test(value)) return "ASK_SEND_MONEY";
  if (/사기야|위험해|진짜야|믿어도\s*돼|정상.*맞/u.test(value)) return "ASK_IF_SCAM";
  return "UNKNOWN";
}
