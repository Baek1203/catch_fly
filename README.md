# 수학 게임 아케이드 – 설치 안내

## 파일 구성
- `index.html` – 이름 입력 + 게임 선택 + 랭킹 미리보기 (첫 화면)
- `game1.html` – 파리 잡기 좌표게임
- `game2.html` – 별자리 원정대 (정비례/반비례)
- `firebase-shared.js` – 세 페이지가 공통으로 쓰는 Firebase 설정 + 점수 저장/랭킹 조회 함수

4개 파일을 **같은 폴더**에 함께 두어야 합니다. (링크와 스크립트가 상대경로로 연결돼 있어요.)

## 동작 방식
1. `index.html`에서 이름을 입력하면 브라우저의 `localStorage`에 저장됩니다.
2. 게임 카드를 클릭하면 `game1.html` / `game2.html`로 이동합니다.
3. 각 게임 화면 왼쪽 위 **"⬅ 게임 선택으로"** 버튼을 누르면 언제든 `index.html`로 돌아갑니다.
4. 게임이 끝나면 `leaderboard` 컬렉션에 **"게임+이름"당 문서 1개**로 점수가 저장/갱신되고, 각 게임/허브 페이지의 랭킹이 갱신됩니다.
   - 새 문서 ID: `게임아이디__이름` (예: `fly__민준`)
   - 저장 필드: `score`(최고 점수), `count`(총 플레이 횟수), 그 외 부가 통계
   - 파리 잡기: 최고 점수(잡은 파리 수), 최고 연속 기록, 명중률
   - 별자리 원정대: 최고 총점, 그 기록을 세운 난이도
5. 이름이 저장돼 있지 않은 상태로 `game1.html`/`game2.html`에 직접 들어오면 자동으로 `index.html`로 돌아갑니다.

### 왜 "게임+이름당 문서 1개"인가요? (읽기 사용량 절감)
예전 버전은 플레이할 때마다 새 문서를 계속 추가했어요. 그러면 누군가 랭킹을 볼 때마다 "그동안 쌓인 모든 플레이 기록"을 전부 읽어와야 해서, 같은 사람이 여러 번 다시 할수록 읽기 사용량이 계속 늘어났습니다.
지금은 점수를 저장할 때 Firestore 트랜잭션으로 "그 사람의 문서 1개"만 갱신(최고 점수·총 횟수 계산)해두기 때문에, 랭킹을 볼 때는 **실제 참여 인원 수만큼만** 문서를 읽으면 됩니다. 리플레이가 잦을수록 절감 효과가 커집니다.

> 기존에 `scores` 컬렉션을 쓰고 계셨다면 더 이상 이 앱에서 사용하지 않아요. Firebase 콘솔에서 그대로 두거나 지워도 됩니다.

## Firebase 설정 방법 (최초 1회)
1. https://console.firebase.google.com 접속 → **프로젝트 추가**로 새 프로젝트를 만듭니다.
2. 왼쪽 메뉴 **빌드 > Firestore Database** → **데이터베이스 만들기** (테스트 모드로 시작해도 됩니다).
3. 왼쪽 위 **⚙️ 프로젝트 설정 > 일반** 탭 → 아래로 스크롤 → **웹 앱 추가**(</> 아이콘) 클릭.
4. 앱 이름을 아무거나 입력 후 등록하면 아래와 같은 `firebaseConfig` 객체가 나옵니다.
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "my-project.firebaseapp.com",
     projectId: "my-project",
     storageBucket: "my-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
5. 이 값을 그대로 복사해서 `firebase-shared.js` 맨 위쪽 `firebaseConfig` 자리에 붙여넣고 저장합니다.

### 보안 규칙 (Firestore Database > 규칙 탭)
누구나 랭킹을 읽을 수 있고, 정해진 형식의 문서만 쓸 수 있도록 하는 규칙 예시입니다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{entryId} {
      allow read: if true;
      allow write: if request.resource.data.name is string
                    && request.resource.data.game in ['fly', 'star']
                    && request.resource.data.score is number
                    && request.resource.data.count is number;
    }
  }
}
```

### 색인(인덱스) 관련 안내
랭킹 조회는 `game` 필드 단일 조건(where)만 사용하고 정렬은 브라우저에서 처리하도록 만들어서, 별도의 복합 색인 없이 바로 동작합니다.

## 기존 데이터(scores 컬렉션) 정리해서 옮기기
예전 버전으로 플레이하며 쌓인 `scores` 컬렉션의 기록이 있다면, `migrate.html`을 열어 버튼 한 번으로
이름별 최고 점수 + 총 플레이 횟수로 정리해서 새 `leaderboard` 컬렉션으로 옮길 수 있습니다.

1. `migrate.html`을 같은 폴더에 두고 (로컬 서버로) 엽니다.
2. 화면의 안내를 읽고 **딱 한 번만** "▶ 마이그레이션 시작"을 누릅니다.
3. 완료 메시지와 처리된 인원 수를 확인합니다.
4. `index.html`이나 각 게임의 랭킹을 새로고침해서 옛 기록이 잘 반영됐는지 확인합니다.
5. 문제없다면 `scores` 컬렉션은 Firebase 콘솔에서 삭제하거나 그냥 두어도 됩니다(더 이상 앱에서 쓰지 않음).
6. `migrate.html`은 배포용 사이트(GitHub Pages 등)에 올리지 않아도 되는 **관리자용 1회성 도구**입니다.

> 주의: 보안 규칙을 이미 `leaderboard`만 허용하도록 바꾸셨다면, 마이그레이션 동안 `scores`에 대한
> 읽기 권한이 잠깐 필요합니다. `migrate.html` 안내 문구에 임시로 추가할 규칙 예시가 있어요.

## 로컬에서 테스트하기
`file://`로 그냥 더블클릭해서 열면 브라우저 보안 정책 때문에 스크립트가 막힐 수 있습니다. 아래 중 하나로 간단한 로컬 서버를 띄운 뒤 `index.html`을 열어주세요.

- VSCode의 **Live Server** 확장 사용
- 터미널에서 폴더 이동 후: `python -m http.server 8000` 실행 → 브라우저에서 `http://localhost:8000` 접속

## Firebase를 아직 설정하지 않았다면?
`firebase-shared.js`의 `firebaseConfig`가 기본값(`YOUR_API_KEY` 등) 그대로면, 점수 저장/랭킹 조회 기능은 자동으로 비활성화되고 콘솔에 안내 메시지만 출력됩니다. 게임 자체(파리 잡기, 별자리 원정대)는 이름 입력 → 게임 선택 → 플레이 → 메인으로 돌아가기까지 Firebase 없이도 정상 동작합니다.
