/**
 * 사용자 입력은 호출 스택 안에서만 처리하고 캐시·파일·데이터베이스에 전달하지 않는다.
 * 이 래퍼는 분석기가 결과만 반환하도록 호출 경계를 명시한다.
 */
export function processEphemeral<T>(input: string, processor: (value: string) => T): T {
  return processor(input);
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/(?<!\d)(?:\d[-\s]?){10,16}(?!\d)/gu, "[REDACTED_NUMBER]")
    .replace(/(?<!\d)\d{3}-?\d{2}-?\d{5}(?!\d)/gu, "[REDACTED_BUSINESS_NUMBER]")
    .replace(/(?<!\d)0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/gu, "[REDACTED_PHONE]");
}
