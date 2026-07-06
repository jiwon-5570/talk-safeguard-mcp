# 톡세이프가드 MCP 데모 프롬프트

아래 문장을 그대로 사용해 `analyze_message_risk`를 시연할 수 있습니다.

## 1. 가족 사칭

> 엄마 나 폰 고장났어. 급하게 80만원만 이 계좌로 보내줘. 전화는 안 돼. 이거 위험한지 분석해줘.

예상 포인트: `FAMILY_IMPERSONATION`, `CRITICAL`, 송금 중단, 기존에 저장된 번호로 직접 통화.

## 2. 투자 리딩방

> 무료 VIP 주식 리딩방 입장 가능. 원금 보장, 매일 5% 수익. 해외거래소 가입 링크 보내줄게. 이 카톡 믿어도 돼?

예상 포인트: `INVESTMENT_ROOM`, 원금·고수익 보장 및 해외거래소 가입 유도, 추가 입금 중단.

## 3. 택배 스미싱

> 택배 주소 오류입니다. 아래 링크에서 주소를 다시 입력하세요. http://delivery-check-kr.example.com 이 링크 눌러도 돼?

예상 포인트: `DELIVERY_SMISHING`, 샘플 URL 매칭, 링크 클릭·개인정보 입력 중단.

## 4. 쇼핑 선입금

> 카톡 주문만 가능하고 개인계좌로 먼저 입금하면 배송해준대. 사업자번호도 보내줬어. 안전한지 확인해줘.

예상 포인트: `SHOPPING_PREPAYMENT`, 개인계좌 선입금 주의, 사업자등록·통신판매업 공식 조회 권장.

사업자번호가 있다면 이어서 `verify_business_info`와 `verify_online_seller`를 호출해도 됩니다. 등록 확인은 거래 안전 보증이 아니라 보조 정보임을 함께 보여주세요.

## 5. 기관 사칭과 앱 설치

> 서울중앙지검입니다. 귀하 명의 통장이 범죄에 사용되었습니다. 보안 앱 설치 후 본인인증하세요. 이거 진짜야?

예상 포인트: `AGENCY_IMPERSONATION`, `REMOTE_APP_INSTALL`, `CRITICAL`, 앱 설치·인증 중단 및 검찰 공식 대표번호 확인.

## 상황별 후속 시연

- 링크를 누른 경우: `userSituation: "clicked_link"`
- 송금한 경우: `userSituation: "sent_money"`
- 앱을 설치한 경우: `userSituation: "installed_app"`
- 개인정보를 입력한 경우: `userSituation: "shared_info"`

후속 상황에서는 은행 고객센터, 경찰 112, 금융감독원 1332 등 공식 대응 경로와 상담·신고용 요약문이 생성됩니다.
