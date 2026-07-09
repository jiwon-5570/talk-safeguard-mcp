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
  if (/(?:이미|방금)?\s*(?:(?:링크|url|주소)(?:를|에)?\s*)?(?:눌렀|클릭했|열었|접속했|들어갔)|(?:링크|url|주소)\s*(?:클릭|접속|열었|눌렀).*했|눌러버렸/u.test(value)) return "ASK_AFTER_CLICK";
  if (/(?:이미\s*)?(?:송금|입금|이체|결제)했|이미\s*(?:송금|입금|이체|결제)|돈\s*(?:보냈|보냄)|계좌로\s*보냈/u.test(value)) return "ASK_AFTER_SENT_MONEY";
  if (/신고|상담(?!원)|요약|증거|피해\s*정리|경찰|금감원|공유용|부모님.*설명|가족.*설명/u.test(value)) return "ASK_REPORT";
  if (/(?:투자|리딩)\s*방|VIP\s*(?:주식|코인)?\s*리딩방|투자해도|가입해도|방\s*들어가도|수익방|단타방|코인방/u.test(value)) {
    return "ASK_JOIN_INVESTMENT";
  }
  if (/사업자\s*(?:번호|등록번호)|쇼핑몰|판매자|상점|스토어|공구|공동구매|중고|결제해도|구매해도|판매자.*믿어도|믿을만|안전결제|개인계좌/u.test(value)) return "ASK_TRUST_SELLER";
  if (/인증번호|otp|보안카드|인증\s*코드|보안\s*코드|알려줘도|입력해도|번호.*보내|코드.*보내/u.test(value)) return "ASK_ENTER_AUTH_CODE";
  if (/앱\s*설치|원격\s*앱|보안\s*앱|설치해도|깔아도|다운로드|원격제어|팀뷰어|애니데스크/u.test(value)) return "ASK_INSTALL_APP";
  if (/링크.*눌러도|URL.*열어도|링크.*열어도|접속해도|들어가도\s*돼|눌러도\s*(?:돼|되|될까)|클릭해도|열어봐도|이\s*링크/u.test(value)) return "ASK_OPEN_LINK";
  if (/송금해도|입금해도|이체해도|결제해도|보내도\s*돼|돈\s*보내도|계좌.*보내도|선입금/u.test(value)) return "ASK_SEND_MONEY";
  if (/사기야|위험해|진짜야|믿어도\s*돼|정상.*맞|괜찮아|안전해|의심돼|수상해/u.test(value)) return "ASK_IF_SCAM";
  return "UNKNOWN";
}
