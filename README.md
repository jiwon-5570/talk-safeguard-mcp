# 톡세이프가드 MCP

카카오톡으로 받은 수상한 메시지와 링크를 공공데이터 형식의 샘플과 규칙 기반 위험 분석으로 점검하고, 사용자가 행동하기 전에 안전한 다음 단계를 안내하는 MCP 서버입니다.

> 이 서비스는 사기 확정 판정이나 수사기관의 판정을 대신하지 않습니다. 결과는 위험 신호에 기반한 보조 판단이며, 최종 확인은 공식 기관을 통해 진행해야 합니다.

## 문제 정의

카카오톡에는 가족 대화, 오픈채팅, 쇼핑, 공동구매, 중고거래, 투자 정보가 한곳에 모입니다. 공격자는 이 신뢰 관계를 이용해 가족·기관 사칭, 택배 스미싱, 투자 리딩방, 개인계좌 선입금, 인증번호 요구, 원격제어 앱 설치를 유도합니다. 특히 긴급성과 권위를 함께 내세우면 사용자가 링크를 누르거나 송금한 뒤에야 위험을 알아차리기 쉽습니다.

경찰청 공개 통계는 보이스피싱을 기관사칭형과 대출사기형 등으로 구분해 현황을 제공합니다. 톡세이프가드는 이 유형 체계와 URL·사업자 공공데이터를 실제 행동 전 확인 절차로 연결합니다.

## 해결 방법

1. 메시지에서 URL, 금액, 긴급 표현, 사칭 표현, 사업자등록번호, 전화·계좌번호 후보를 메모리에서 일시 추출합니다.
2. 피싱·불법 스팸 URL 샘플과 도메인 휴리스틱을 적용합니다.
3. 명시된 가중치와 위험 조합으로 0~100점 및 `LOW`/`MEDIUM`/`HIGH`/`CRITICAL` 등급을 계산합니다.
4. 가족 사칭, 기관 사칭, 배송 스미싱, 대출, 투자 리딩방, 쇼핑·중고 선입금, 인증번호, 원격 앱 설치 유형을 분류합니다.
5. 클릭·송금·앱 설치·정보 제공 여부에 따라 즉시 행동, 금지 행동, 가족 공유문, 상담·신고 요약문을 생성합니다.

AI 모델이 없어도 동일한 규칙으로 재현 가능한 결과를 내는 MVP입니다. 향후 AI 분류를 추가하더라도 최종 안전 문구와 점수 경계는 서버 규칙이 통제하도록 설계했습니다.

## MCP 도구 8개

| 도구 | 역할 |
|---|---|
| `analyze_message_risk` | 메시지 종합 위험도, 근거, 금지·권장 행동, 공유문과 신고 요약 생성 |
| `extract_risk_indicators` | URL, 전화·계좌·사업자번호 후보, 금액, 긴급·민감정보 요구 추출 |
| `check_phishing_url` | URL 정규화, 샘플 매칭, 단축·위장 도메인 신호 점검 |
| `classify_scam_type` | 10개 의심 유형 분류 및 근거 반환 |
| `verify_business_info` | 국세청 API 또는 샘플 fallback으로 사업자 상태 보조 확인 |
| `verify_online_seller` | 공정위 API 또는 샘플 fallback으로 통신판매업 등록 보조 확인 |
| `check_investment_room_risk` | 원금·수익 보장, 고수익, 외부 거래소·입금 유도 분석 |
| `generate_safe_action_guide` | 사용자 상황별 즉시 대응, 금지 행동, 공식 신고 경로 생성 |

모든 도구 응답은 `safetyMessage`와 `disclaimer`를 포함합니다.

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
- MCP Streamable HTTP: `POST http://localhost:3000/mcp`

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
| `PHISHING_DATA_MODE` | `sample` | 피싱 데이터 모드(현재 MVP는 sample) |
| `SPAM_URL_DATA_MODE` | `sample` | 스팸 URL 데이터 모드(현재 MVP는 sample) |
| `LOG_LEVEL` | `info` | 서버 구조 로그 수준 |
| `ALLOWED_ORIGINS` | 빈 값 | 쉼표로 구분한 허용 Origin. 비어 있으면 필터 미적용 |

API 키가 없거나 공식 API 호출이 실패해도 sample fallback으로 도구가 응답합니다. 이 경우 결과에 실시간 조회가 아니라는 경고가 포함됩니다.

## 테스트와 검증

```bash
npm test
npm run typecheck
npm run validate
npm run build
```

`validate`는 TypeScript strict 타입 검사, 테스트, 필수 파일 존재 여부, MCP 도구 8개 등록을 확인합니다. 테스트는 가족 사칭, 투자 리딩방, 택배 스미싱, 쇼핑 선입금, 정상 메시지, URL 정규화, 모든 도구의 안전 고지를 포함합니다.

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
4. 도구 탐색 결과에 위 8개 도구가 모두 나타나는지 확인하고, 데모 프롬프트로 호출 결과를 점검합니다.
5. 서비스 설명, 개인정보 처리 원칙, 이용 공공데이터와 안전 고지를 입력합니다.
6. 공모전 제출 시 공개 범위와 참가 상태를 공식 공모전 안내에 맞게 설정합니다.

공개 배포 전에는 `ALLOWED_ORIGINS`, 인증/인가, 요청 속도 제한, HTTPS, 비밀키 관리, 운영 모니터링을 배포 플랫폼에서 추가해야 합니다. 서버 로그에는 메시지 본문을 남기지 마세요.

## 안전 정책

- 개인, 전화번호, 계좌번호를 범죄자 또는 범죄 수단으로 단정하지 않습니다.
- “사기 가능성”, “위험 신호”, “공식 경로 확인 권장”으로 표현합니다.
- 정상 사업자·통신판매업 등록 여부는 거래 안전을 보장하지 않는다고 명시합니다.
- 이미 송금·설치·정보 제공을 했다면 해당 은행 고객센터, 경찰 112, 금융감독원 1332 등 공식 경로를 안내합니다.
- 분석 결과만으로 신고 필요성을 배제하거나 링크의 안전을 보장하지 않습니다.

## 개인정보 처리 원칙

- 사용자 메시지는 요청 처리 중 메모리의 호출 스택에서만 사용하며 파일, 데이터베이스, 캐시, 분석 로그에 저장하지 않습니다.
- 로거 인터페이스는 이벤트명과 위험 등급 같은 비식별 메타데이터만 허용하고, 메시지·URL·전화·계좌 원문을 전달하지 않습니다.
- `extract_risk_indicators`의 민감정보 후보는 현재 호출 응답에만 반환되고 서버에 잔존시키지 않습니다.
- 사업자 조회 API를 설정한 경우 입력된 사업자등록번호는 조회를 위해 해당 공공기관 API로 전송되지만 이 서버에는 저장하지 않습니다.
- HTTP 응답은 `Cache-Control: no-store`를 사용합니다.

## 데모

발표용 입력은 [demo-prompts.md](./demo-prompts.md), 공모전 요약은 [submission-summary.md](./submission-summary.md)를 참고하세요.
