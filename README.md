# 톡세이프가드 MCP

톡세이프가드 MCP는 카카오톡 이용자가 받은 의심 메시지에 대해 “눌러도 되는지, 송금해도 되는지, 믿어도 되는지”를 행동 전에 확인하도록 돕는 사기 위험 판단 보조 MCP입니다.

현재 버전: `1.1.0`

> 이 서비스는 사기 확정 판정이나 수사기관의 판정을 대신하지 않습니다. 결과는 위험 신호에 기반한 보조 판단이며, 최종 확인은 공식 기관을 통해 진행해야 합니다.

## 핵심 사용 목적

톡세이프가드는 받은 카카오톡 메시지가 사기 위험이 있는지 확인하는 도구입니다.

사용자는 다음처럼 질문할 수 있습니다.

- 이 링크 눌러도 돼?
- 이거 사기야?
- 송금해도 돼?
- 사업자번호가 있으면 믿어도 돼?
- 이 투자방 들어가도 돼?
- 이미 링크를 눌렀는데 어떻게 해?
- 신고해야 하면 어떤 내용을 정리해야 해?

톡세이프가드는 사기 확정 판정을 내리지 않습니다. 대신 위험 신호, 확인 체크리스트, 지금 하면 안 되는 행동, 다음 행동을 안내합니다.

## 문제 정의

카카오톡에는 가족 대화, 오픈채팅, 쇼핑, 공동구매, 중고거래, 투자 정보가 한곳에 모입니다. 공격자는 이 신뢰 관계를 이용해 가족·기관 사칭, 택배 스미싱, 투자 리딩방, 개인계좌 선입금, 인증번호 요구, 원격제어 앱 설치를 유도합니다. 특히 긴급성과 권위를 함께 내세우면 사용자가 링크를 누르거나 송금한 뒤에야 위험을 알아차리기 쉽습니다.

경찰청 공개 통계는 보이스피싱을 기관사칭형과 대출사기형 등으로 구분해 현황을 제공합니다. 톡세이프가드는 이 유형 체계와 URL·사업자 공공데이터를 실제 행동 전 확인 절차로 연결합니다.

## 해결 방법

1. 메시지에서 URL, 금액, 긴급 표현, 사칭 표현, 사업자등록번호, 전화·계좌번호 후보를 메모리에서 일시 추출합니다.
2. 피싱·불법 스팸 URL 샘플과 도메인 휴리스틱을 적용합니다.
3. 명시된 가중치와 위험 조합으로 0~100점 및 `LOW`/`MEDIUM`/`HIGH`/`CRITICAL` 등급을 계산합니다.
4. 가족 사칭, 기관 사칭, 배송 스미싱, 대출, 투자 리딩방, 쇼핑·중고 선입금, 인증번호, 원격 앱 설치 유형을 분류합니다.
5. 질문에 대한 직접 답변, 진행 가능 여부, 확인 체크리스트, 금지 행동, 다음 행동과 상담·신고 요약문을 생성합니다.

AI 모델이 없어도 동일한 규칙으로 재현 가능한 결과를 내는 MVP입니다. 향후 AI 분류를 추가하더라도 최종 안전 문구와 점수 경계는 서버 규칙이 통제하도록 설계했습니다.

## MCP 도구 9개

| 도구 | 역할 |
|---|---|
| `check_kakao_message` | 대표 통합 도구. 메시지와 질문을 받아 판단, 진행 가능 여부, 근거, 체크리스트와 다음 행동을 한 번에 반환 |
| `analyze_message_risk` | “눌러도 되는지·송금해도 되는지·믿어도 되는지”에 대한 판단 요약, 근거, 체크리스트와 다음 행동 생성 |
| `extract_risk_indicators` | URL, 전화·계좌·사업자번호 후보, 금액, 긴급·민감정보 요구 추출 |
| `check_phishing_url` | URL 위험도와 클릭 가능 여부, 도메인 근거, 공식 확인 절차 반환 |
| `classify_scam_type` | 14개 구체 의심 유형과 미분류 위험 신호 분류 및 근거 반환 |
| `verify_business_info` | 사업자 상태와 판매자 신뢰 가능 여부, 남은 위험과 거래 체크리스트 반환 |
| `verify_online_seller` | 통신판매업 등록과 구매 진행 가능 여부, 안전구매 체크리스트 반환 |
| `check_investment_room_risk` | 투자방 참여·입금 가능 여부와 원금 보장·고수익·외부 입금 위험 분석 |
| `generate_safe_action_guide` | 사용자 상황별 진행 가능 여부, 즉시 행동, 확인 체크리스트와 신고 경로 생성 |

모든 도구 응답은 `safetyMessage`와 `disclaimer`를 포함합니다.

처음 사용하는 클라이언트는 `check_kakao_message`를 호출하면 됩니다. 세부 URL·사업자·통신판매업·투자 분석이 필요할 때 나머지 전문 도구를 이어서 사용할 수 있습니다.

`analyze_message_risk`의 핵심 응답은 `decisionSummary`, `verdict`, `canProceed`, `userQuestionAnswer`, `verificationChecklist`, `evidenceSummary`, `nextStepGuide`, `incidentReportSummary` 순서로 활용할 수 있습니다. `familyShareMessage`는 기존 클라이언트 호환을 위한 deprecated 필드이며 핵심 안내로 사용하지 않습니다.

## 활용 공공데이터 5개

| 데이터 | MVP 활용 |
|---|---|
| [한국인터넷진흥원_피싱사이트 URL](https://www.data.go.kr/data/15109780/fileData.do) | 로컬 샘플 및 피싱 URL 패턴 점검 |
| [통신 빅데이터플랫폼_불법 스팸 URL 데이터셋](https://www.data.go.kr/data/15134609/fileData.do) | `hxxp`, 스미싱 URL 패턴 및 단축 URL 규칙 |
| [경찰청_보이스피싱 현황](https://www.data.go.kr/data/15063815/fileData.do) | 문제 근거 및 기관사칭·대출사기·메신저피싱 분류 참고 |
| [국세청_사업자등록정보 진위확인 및 상태조회](https://www.data.go.kr/data/15081808/openapi.do) | 사업자 운영 상태 실시간 보조 조회 |
| [공정거래위원회_통신판매사업자 등록상세](https://www.data.go.kr/data/15126315/openapi.do) | 온라인 판매자 신고·영업 상태 보조 조회 |

샘플 JSON은 원본 공공데이터 전체를 재배포하지 않으며, 데이터 형식과 위험 패턴을 설명하기 위한 데모 레코드입니다. 실제 데이터 이용 조건과 최신 명세는 각 제공기관에서 확인해야 합니다. 법무부 보이스피싱 사례 데이터는 범위에서 제외했습니다.

## 설치 및 실행

요구 환경은 Node.js 20 이상입니다.

```bash
cd talk-safeguard-mcp
npm install
copy .env.example .env
npm run dev
```

macOS/Linux에서는 `cp .env.example .env`를 사용합니다. 서버는 기본적으로 다음 주소를 제공합니다.

- 상태 확인: `GET http://localhost:3000/health`
- 서비스·도구 정보: `GET http://localhost:3000/mcp/info`
- MCP Streamable HTTP: `POST http://localhost:3000/mcp`
- 개발·심사 종합 분석: `POST http://localhost:3000/debug/analyze` (`ENABLE_DEBUG_ENDPOINT=true`일 때만)

프로덕션 실행:

```bash
npm run build
npm start
```

서버는 단순 도구 호출에 적합한 stateless Streamable HTTP와 JSON 응답 모드를 사용합니다. 클라이언트별 세션 상태나 사용자 입력을 보관하지 않습니다.

## 환경변수

| 이름 | 기본/예시 | 설명 |
|---|---|---|
| `PORT` | `3000` | HTTP 포트 |
| `NODE_ENV` | `development` | 실행 환경 |
| `NTS_BUSINESS_API_KEY` | 빈 값 | 국세청 공공데이터 API 키 |
| `FTC_ONLINE_SELLER_API_KEY` | 빈 값 | 공정위 공공데이터 API 키 |
| `PHISHING_DATA_MODE` | `actual` | actual 모드에서는 로컬 샘플 피싱 목록 미사용, 휴리스틱/공식 도메인 검증 사용 |
| `SPAM_URL_DATA_MODE` | `actual` | actual 모드에서는 공공데이터 공식 CSV 기반 불법 스팸 URL 데이터셋 사용 |
| `PUBLIC_DATA_MODE` | `actual` | `actual`일 때 국세청·공정위 실제 API 호출, 실패 시 sample fallback 미사용 |
| `LOG_LEVEL` | `info` | 서버 구조 로그 수준 |
| `ENABLE_DEBUG_ENDPOINT` | `true` | `/debug/analyze` 활성화. 운영에서는 `false` 권장 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | IP 해시 기준 요청 제한 시간 |
| `RATE_LIMIT_MAX` | `60` | 제한 시간당 최대 요청 수 |
| `TRUST_PROXY` | `false` | 신뢰할 수 있는 단일 reverse proxy 뒤에서만 `true` |
| `ALLOWED_ORIGINS` | 빈 값 | 쉼표 구분 Origin. 개발에서는 허용, production에서 비어 있으면 교차 출처 요청 거부 |

`PUBLIC_DATA_MODE=actual`과 해당 API 키를 함께 설정하면 실제 국세청·공정위 API를 호출합니다. actual 모드에서는 키가 없거나 API 호출에 실패해도 sample 데이터로 대체하지 않고, 응답의 `source`와 `warnings`에 실패 사유를 명확히 반환합니다. `PUBLIC_DATA_MODE=sample`은 테스트/데모 전용입니다.

`SPAM_URL_DATA_MODE=actual`에서는 공공데이터포털에서 내려받은 공식 CSV(`src/data/official-spam-urls.csv`)를 사용합니다. `PHISHING_DATA_MODE=actual`에서는 로컬 샘플 피싱 목록을 사용하지 않고 휴리스틱·공식 도메인 검증만 적용합니다. `sample-*` JSON은 테스트/데모 전용이며 운영 actual 모드에서는 사용하지 않습니다.

## 테스트와 검증

```bash
npm test
npm run typecheck
npm run validate
npm run build
```

`validate`는 TypeScript strict 타입 검사, 테스트, 필수 문서·환경변수·endpoint, 대표 도구를 포함한 MCP 도구 9개 등록, 모든 도구의 안전 고지, 메시지 원문 직접 로그 금지 패턴을 확인합니다. 테스트는 가족 사칭, 카카오페이 사칭, 상품권, 계정 탈취, 청첩장·부고, 투자 리딩방, 택배 스미싱, 쇼핑 선입금, 정상 메시지, URL 정규화와 운영 보안 계층을 포함합니다.

## Docker

```bash
docker build -t talk-safeguard-mcp .
docker run --rm -p 3000:3000 --env-file .env talk-safeguard-mcp
```

멀티 스테이지 이미지가 TypeScript를 빌드하고 런타임 의존성만 최종 이미지에 포함합니다.

## PlayMCP 등록

PlayMCP 화면과 심사 절차는 바뀔 수 있으므로 제출 시 [PlayMCP 공식 사이트](https://playmcp.kakao.com/)의 안내를 최종 기준으로 사용합니다.

1. 이 서버를 외부에서 접근 가능한 HTTPS 환경에 배포합니다.
2. `https://배포도메인/health`와 `https://배포도메인/mcp`를 확인합니다.
3. PlayMCP 개발자 화면에서 새 MCP 서버를 만들고 Streamable HTTP 서버 URL로 `https://배포도메인/mcp`를 등록합니다.
4. 도구 탐색 결과에 `check_kakao_message`가 첫 번째로 표시되고 위 9개 도구가 모두 나타나는지 확인한 뒤 데모 프롬프트로 호출 결과를 점검합니다.
5. 서비스 설명, 개인정보 처리 원칙, 이용 공공데이터와 안전 고지를 입력합니다.
6. 공모전 제출 시 공개 범위와 참가 상태를 공식 공모전 안내에 맞게 설정합니다.

서버는 `helmet`, CORS allowlist, 메모리 rate limit을 기본 적용합니다. 공개 배포 전에는 HTTPS, 접근 정책, 비밀키 관리와 운영 모니터링을 배포 플랫폼에서 추가하고 서버 로그에는 메시지 본문을 남기지 마세요.

## 안전 정책

상세 운영 기준과 취약점 제보 절차는 [SECURITY.md](./SECURITY.md)를 참고하세요.

- 개인, 전화번호, 계좌번호를 범죄자 또는 범죄 수단으로 단정하지 않습니다.
- “사기 가능성”, “위험 신호”, “공식 경로 확인 권장”으로 표현합니다.
- 정상 사업자·통신판매업 등록 여부는 거래 안전을 보장하지 않는다고 명시합니다.
- 이미 송금·설치·정보 제공을 했다면 해당 은행 고객센터, 경찰 112, 금융감독원 1332 등 공식 경로를 안내합니다.
- 분석 결과만으로 신고 필요성을 배제하거나 링크의 안전을 보장하지 않습니다.

## 개인정보 처리 원칙

외부 API 전송 항목과 보관 정책은 [PRIVACY.md](./PRIVACY.md), 전체 요청 흐름은 [ARCHITECTURE.md](./ARCHITECTURE.md)를 참고하세요.

- 사용자 메시지는 요청 처리 중 메모리의 호출 스택에서만 사용하며 파일, 데이터베이스, 캐시, 분석 로그에 저장하지 않습니다.
- 로거 인터페이스는 이벤트명과 위험 등급 같은 비식별 메타데이터만 허용하고, 메시지·URL·전화·계좌 원문을 전달하지 않습니다.
- `extract_risk_indicators`의 민감정보 후보는 현재 호출 응답에만 반환되고 서버에 잔존시키지 않습니다.
- 사업자 조회 API를 설정한 경우 입력된 사업자등록번호는 조회를 위해 해당 공공기관 API로 전송되지만 이 서버에는 저장하지 않습니다.
- HTTP 응답은 `Cache-Control: no-store`를 사용합니다.

## 데모

발표용 입력은 [demo-prompts.md](./demo-prompts.md), 공모전 요약은 [submission-summary.md](./submission-summary.md)를 참고하세요.

## 실제 사용 예시

```text
사용자:
이 카톡 위험해?
“엄마 나 폰 고장났어. 급하게 80만원만 보내줘. 전화는 안 돼.”

톡세이프가드:
판단: 가족/지인 사칭과 급한 송금 요구가 함께 있어 사기 위험이 매우 높습니다.
진행 가능 여부: NO
직접 답변: 송금하지 않는 것이 안전합니다.
확인 방법: 기존에 저장된 가족 번호로 직접 전화하세요.
```

개발·심사 환경에서는 같은 흐름을 HTTP로도 확인할 수 있습니다.

```bash
curl -X POST http://localhost:3000/debug/analyze \
  -H "Content-Type: application/json" \
  -d '{"message":"엄마 나 폰 고장났어. 급하게 80만원만 보내줘. 전화는 안 돼.","userSituation":"before_click"}'
```

응답에는 종합 분석, 위험 요소 추출, 사기 유형 분류, URL 분석, 투자 키워드 분석(해당 시), `safetyMessage`, `disclaimer`가 포함됩니다. 운영에서는 `ENABLE_DEBUG_ENDPOINT=false`로 비활성화하세요.

## 확인 중심 후속 질문

MCP 서버는 메시지 원문이나 대화 상태를 저장하지 않습니다. MCP 클라이언트가 이전 결과와 현재 `userSituation`을 다음 호출에 전달하면 아래처럼 확인 중심의 후속 질문을 이어갈 수 있습니다.

1. 이 메시지 사기야?
2. 그럼 링크 눌러도 돼?
3. 이미 링크 눌렀는데 개인정보는 안 넣었어.
4. 사업자번호도 있는데 이걸로 확인해줘.
5. 그럼 결제해도 돼?
6. 신고해야 할 상황이면 요약해줘.

## 카카오톡에 꼭 필요한 이유

- 가족방과 지인 관계를 악용한 메신저피싱에 송금 전 한 번 더 확인하게 합니다.
- 오픈채팅 투자 리딩방의 원금 보장·해외거래소 입금 유도를 함께 점검합니다.
- 카톡 주문·공동구매·중고거래의 개인계좌 선입금 위험을 알립니다.
- 카카오페이·선물하기·이벤트·계정 보호를 사칭한 링크를 점검합니다.
- 시니어와 디지털 취약 이용자도 `YES`, `NO`, `CHECK_FIRST`와 쉬운 한국어 답변으로 다음 행동을 빠르게 이해할 수 있습니다.
- 피해 확정 판정보다 사용자가 행동하기 전 멈추고 공식 경로로 확인하도록 돕는 예방형 MCP입니다.

## 실사용 한계

- 규칙과 데이터에 없는 새로운 수법을 포함해 모든 사기를 100% 탐지할 수 없습니다.
- 정상 사업자나 통신판매업 정보도 사칭·도용될 수 있어 거래 안전을 보장하지 않습니다.
- 피싱 URL 데이터는 최신성이 중요하며 sample 데이터는 실시간 차단 목록이 아닙니다.
- LOW 결과도 안전 보증이 아니며 최종 확인은 사용자가 공식 기관·기존 연락처로 직접 해야 합니다.
- 이미 송금·앱 설치·정보 제공이 발생했다면 은행 고객센터, 경찰 112, 금융감독원 1332 등 공식 경로를 즉시 이용해야 합니다.

## 배포 전 체크리스트

- [ ] HTTPS 적용
- [ ] `ALLOWED_ORIGINS` 설정
- [ ] API 키를 GitHub에 커밋하지 않기
- [ ] `NODE_ENV=production`
- [ ] `ENABLE_DEBUG_ENDPOINT=false` 권장
- [ ] rate limit 값 설정
- [ ] `/health` 확인
- [ ] `/mcp/info` 확인
- [ ] `/mcp` 등록 확인
- [ ] 대표 `check_kakao_message`와 MCP tool 9개 확인
