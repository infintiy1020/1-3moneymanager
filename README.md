# 1학년 3반 학급비 사이트 (계정 없이 접속 + 자동 충전)

## 1. Firebase 만들기 (무료, 약 10분)
1. https://console.firebase.google.com 에서 프로젝트 만들기
2. 빌드 > Authentication > 시작하기 > "익명" 로그인 사용 설정 (친구들이 가입 없이 투표하게 해줘요)
3. 빌드 > Firestore Database > 데이터베이스 만들기 > 규칙 탭에 `firestore.rules` 내용 붙여넣고 게시
4. 프로젝트 설정 > 일반 > 웹 앱 추가 > 나온 설정값을 `index.html`의 `firebaseConfig`에 붙여넣기
5. 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 (JSON 파일, 절대 공개 금지)

## 2. Vercel에 올리기 (무료)
1. 이 폴더를 GitHub에 올리고 https://vercel.com 에서 Import
2. Environment Variables 추가
   - `FIREBASE_SERVICE_ACCOUNT` : 위 JSON 파일 내용 전체
   - `DEPOSIT_SECRET` : 아무 긴 비밀 문자열 (예: 무작위 20자)
3. 배포하면 `https://내사이트.vercel.app` 주소를 누구나 계정 없이 열 수 있어요.

## 3. 입금 자동 확인 (방식 2: 입금 알림 연동)
토스뱅크는 개인 계좌 입금을 알려주는 공개 API가 없어서, 기부 계좌 주인의 안드로이드 폰에 온 입금 알림을 서버로 전달해요.
1. 계좌 주인 폰(안드로이드)에 MacroDroid 설치, 알림 접근 권한 허용
2. 매크로 만들기
   - 트리거: 알림 수신 > 앱 "토스뱅크" > 내용에 "입금" 또는 "보냈" 포함
   - 동작: HTTP 요청(POST) `https://내사이트.vercel.app/api/deposit`
   - 헤더: `x-secret: (DEPOSIT_SECRET 값)` , `Content-Type: application/json`
   - 본문: `{"text":"{notification}"}`  (알림 전체 내용 변수)
3. 소액(예: 1,000원)을 보내 테스트하세요. 알림 문구가 달라서 이름·금액이 안 잡히면 `api/deposit.js`의 `parse` 정규식만 맞추면 돼요.

주의: 폰이 꺼져 있거나 알림이 막히면 충전이 안 돼요. 그래서 폰 배터리 최적화에서 MacroDroid를 제외해 주세요.
참고: 알림 내용은 위조될 수 있으니 DEPOSIT_SECRET은 꼭 비밀로 하고, 가끔 실제 통장 내역과 대조하세요.

## 4. 처음 금액
금액 문서가 없으면 화면은 50,000원으로 보이고, 첫 입금이 오면 50,000원에서 이어서 올라가요.
