import { describe, expect, it } from "vitest";
import { detectQuestionIntent, type UserQuestionIntent } from "../services/questionIntentService.js";

describe("questionIntentService", () => {
  it.each<[string, string, UserQuestionIntent]>([
    ["이거 사기야?", "", "ASK_IF_SCAM"],
    ["이 링크 눌러도 돼?", "", "ASK_OPEN_LINK"],
    ["여기 들어가도 돼?", "http://example.com", "ASK_OPEN_LINK"],
    ["송금해도 돼?", "", "ASK_SEND_MONEY"],
    ["사업자번호 있으면 믿어도 돼?", "", "ASK_TRUST_SELLER"],
    ["이 방 들어가도 돼?", "무료 VIP 리딩방", "ASK_JOIN_INVESTMENT"],
    ["입력해도 돼?", "인증번호를 알려주세요", "ASK_ENTER_AUTH_CODE"],
    ["설치해도 돼?", "보안 앱 설치 안내", "ASK_INSTALL_APP"],
    ["이미 링크 눌렀어", "", "ASK_AFTER_CLICK"],
    ["이미 송금했어", "", "ASK_AFTER_SENT_MONEY"],
    ["입금했어", "", "ASK_AFTER_SENT_MONEY"],
    ["신고용 요약 만들어줘", "", "ASK_REPORT"],
    ["오늘 날씨 어때?", "", "UNKNOWN"],
  ])("%s => %s", (question, message, expected) => {
    expect(detectQuestionIntent(question, message)).toBe(expected);
  });
});
