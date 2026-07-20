# 수학 게임 아케이드 – 설치 안내

## 파일 구성
- `index.html` – 이름 입력 + 게임 선택 + 랭킹 미리보기 (첫 화면)
- `game1.html` – 파리 잡기 좌표게임
- `game2.html` – 별자리 원정대 (정비례/반비례)
- `game3.html` – 제로섬 스페이스 미션 (합이 0·10·-10)
- `firebase-shared.js` – 네 페이지가 공통으로 쓰는 Firebase 설정 + 점수 저장/랭킹 조회 함수
- `migrate.html` – (관리자용, 선택) 기존 전체 랭킹 기록을 주간/학기 랭킹에 반영하는 1회성 도구

6개 파일을 **같은 폴더**에 함께 두어야 합니다. (링크와 스크립트가 상대경로로 연결돼 있어요.)

## 동작 방식
1. `index.html`에서 이름을 입력하면 브라우저의 `localStorage`에 저장됩니다.
2. 게임 카드를 클릭하면 `game1.html` / `game2.html` / `game3.html`로 이동합니다.
3. 각 게임 화면 왼쪽 위 **"⬅ 게임 선택으로"** 버튼을 누르면 언제든 `index.html`로 돌아갑니다.
4. 게임이 끝나면 **주간 / 학기 / 전체** 세 랭킹이 동시에 저장/갱신됩니다 (아래 "랭킹 종류" 참고).
5. 이름이 저장돼 있지 않은 상태로 `game1.html`/`game2.html`/`game3.html`에 직접 들어오면 자동으로 `index.html`로 돌아갑니다.
6. 각 게임의 랭킹은 게임별 `gameId`(`fly`/`star`/`zero`)로 완전히 분리되어 저장되므로, 같은 이름이라도 게임끼리 점수가 섞이지 않습니다.

## 랭킹 종류 (주간 / 학기 / 전체)
너무 높은 전체 누적 점수만 보이면 의욕이 꺾이는 학생들이 있을 수 있어서, 랭킹을 세 단위로 나눴습니다.

| 구분 | 갱신 시점 | 비고 |
|---|---|---|
| 📅 주간 랭킹 | 매주 월요일 오전 9시 | 그 주에 세운 최고 점수만 반영 |
| 🏫 학기 랭킹 | 3월~7월(1학기), 8월~다음해 2월(2학기) | 매년 자동 계산, 별도 설정 불필요 |
| 🌟 전체 랭킹 | 갱신 없음 (누적) | 예전 버전과 동일한 역대 전체 기록 |

각 게임 화면과 허브(`index.html`) 화면 모두 세 랭킹을 탭으로 전환해서 볼 수 있고, **지난 주 / 지난 학기 기록도 드롭다운으로 조회**할 수 있습니다 (허브 화면 기준. 게임 화면에는 현재 진행 중인 기간만 탭으로 제공하고, 지난 기록은 허브에서 확인하도록 구성했습니다).

> 💡 처음에는 "월간 랭킹"도 고려했지만, 주간 랭킹과 성격이 겹치고 리셋 텀이 애매하다는 판단으로 **학기 단위 랭킹**으로 대체했습니다. 학기 구간은 `3월~7월 = 1학기`, `8월~다음해 2월 = 2학기` 규칙으로 매년 자동 계산되므로, 학기가 바뀔 때마다 설정을 수정할 필요가 없습니다. (1~2월은 전년도 2학기로 취급됩니다. 예: 2027년 1월 점수는 `2026학년도 2학기` 랭킹에 반영됩니다.)

### "매주 월요일 9시에 자동 갱신"이 실제로 동작하는 원리
서버에서 주기적으로 랭킹을 삭제/초기화하는 게 아닙니다 (그러려면 Cloud Functions 예약 실행 같은 유료 기능이 필요해요). 대신 점수를 저장/조회할 때마다 "지금이 몇 번째 주인지"를 브라우저에서 계산해서 그 주에 해당하는 문서에만 쓰고 읽습니다. 그래서 월요일 9시가 지나면 자연스럽게 새로운 주간 문서 세트가 쓰이기 시작하는 것뿐이고, 서버 비용이나 예약 작업이 전혀 필요 없습니다. 학기 랭킹도 같은 원리입니다.

## 데이터 구조 (읽기 사용량을 줄이기 위한 설계)
플레이할 때마다 새 문서를 쌓지 않고, "게임+기간+이름"당 문서 1개만 유지합니다. 컬렉션은 3개로 나뉩니다.

- `leaderboard` — 전체 랭킹. 문서 ID: `${game}__${이름}` (예: `fly__민준`, `zero__민준`)
- `leaderboard_weekly` — 주간 랭킹. 문서 ID: `${game}__${주시작일}__${이름}` (예: `fly__2026-07-06__민준`)
- `leaderboard_semester` — 학기 랭킹. 문서 ID: `${game}__${학기id}__${이름}` (예: `fly__2026-1__민준`)

각 문서는 그 범위 안에서의 `score`(최고 점수), `count`(그 최고 점수를 기록한 횟수), 그 외 부가 통계(연속 기록, 명중률, 난이도 등)를 담고 있습니다.
- 파리 잡기 (`game`: `fly`): 최고 점수(잡은 파리 수), 최고 연속 기록, 명중률
- 별자리 원정대 (`game`: `star`): 최고 총점, 그 기록을 세운 난이도
- 제로섬 스페이스 미션 (`game`: `zero`): 최고 점수(제한시간 동안 지운 크리스탈 수)

### 게임끼리 랭킹이 섞이지 않는 이유
`saveScore(gameId, ...)` / `fetchScores(gameId, ...)`의 첫 번째 인자인 `gameId`(`fly` / `star` / `zero`)가 문서 ID와 저장되는 데이터 모두에 포함됩니다. 그래서 같은 사람이 세 게임을 모두 플레이해도 게임마다 별도의 문서(예: `fly__민준`, `star__민준`, `zero__민준`)에 각각 저장되고, 랭킹을 조회할 때도 `game == 'zero'`처럼 해당 게임만 걸러서 가져오기 때문에 점수가 절대 섞이지 않습니다. 새 게임을 추가할 때도 이 규칙(고유한 `gameId` 사용)만 지키면 자동으로 분리됩니다.

### 왜 "게임+기간+이름당 문서 1개"인가요? (읽기 사용량 절감)
예전 버전은 플레이할 때마다 새 문서를 계속 추가했어요. 그러면 누군가 랭킹을 볼 때마다 "그동안 쌓인 모든 플레이 기록"을 전부 읽어와야 해서, 같은 사람이 여러 번 다시 할수록 읽기 사용량이 계속 늘어났습니다.
지금은 점수를 저장할 때 Firestore 트랜잭션으로 "그 사람의 문서 1개"만 갱신(최고 점수·기록 횟수 계산)해두기 때문에, 랭킹을 볼 때는 **실제 참여 인원 수만큼만** 문서를 읽으면 됩니다. 리플레이가 잦을수록 절감 효과가 커집니다. 주간/학기 랭킹도 같은 방식이라, 지난 기록을 조회해도 **그 기간에 실제로 참여한 인원 수만큼만** 읽습니다.

### Firebase 무료 요금제(Spark)로 충분한가요?
네, 학교 수업 규모(수십~수백 명)라면 충분합니다.
- **저장 용량**: 문서 1개가 200바이트 안팎이라, 학생 300명이 1년(주간 52개 + 학기 2개) 동안 쌓아도 수십 MB 수준 — 무료 한도 1GB에 비해 미미합니다.
- **읽기**: 참여 인원 수에 비례하며, 과거 기간을 조회해도 "그 기간 참여 인원 수"만큼만 읽습니다. 무료 한도(하루 5만 회)에 걸리려면 상당히 큰 규모가 필요합니다.
- **쓰기**: 점수 저장 시 이제 전체/주간/학기 세 문서를 한 트랜잭션으로 갱신하므로 예전보다 쓰기 횟수가 조금 늘었지만, 학교 규모 트래픽에서는 무료 한도(하루 2만 회)에 여유가 큽니다.
- 정리하면 별도 비용 걱정 없이 몇 년간 운영 가능한 수준입니다. 아주 오래된 주간 기록은 필요하면 Firebase 콘솔에서 가끔 수동으로 정리해도 됩니다.

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
                    && request.resource.data.game in ['fly', 'star', 'zero']
                    && request.resource.data.score is number
                    && request.resource.data.count is number;
    }
    match /leaderboard_weekly/{entryId} {
      allow read: if true;
      allow write: if request.resource.data.name is string
                    && request.resource.data.game in ['fly', 'star', 'zero']
                    && request.resource.data.period is string
                    && request.resource.data.score is number
                    && request.resource.data.count is number;
    }
    match /leaderboard_semester/{entryId} {
      allow read: if true;
      allow write: if request.resource.data.name is string
                    && request.resource.data.game in ['fly', 'star', 'zero']
                    && request.resource.data.period is string
                    && request.resource.data.score is number
                    && request.resource.data.count is number;
    }
  }
}
```

> ⚠️ **이미 Firebase 프로젝트를 운영 중이셨다면 (game1/game2만 있었을 때부터 쓰고 계셨다면)**
> Firestore 콘솔의 **규칙(Rules)** 탭에 저장된 보안 규칙에는 아직 `game in ['fly', 'star']`만 허용되어 있을 수 있습니다.
> 이 상태로는 `game3.html`(제로섬 스페이스 미션)의 점수 저장이 "권한 없음" 오류로 실패합니다.
> 위 예시처럼 규칙의 `game in [...]` 목록에 `'zero'`를 추가해서 다시 게시(Publish)해주셔야 game3의 랭킹이 정상 저장됩니다.

### 색인(인덱스) 관련 안내
주간/학기 랭킹 조회는 `game`, `period` 두 필드에 대한 동등(`==`) 조건만 사용하고 정렬은 브라우저에서 처리합니다. Firestore는 동등 조건만 여러 개 조합하는 쿼리는 별도의 복합 색인 없이도 자동으로 처리하므로, 이번에도 색인 설정이 필요 없습니다.

## 기존 기록을 주간/학기 랭킹에 반영하기 (`migrate.html`)
주간/학기 랭킹을 새로 도입하기 전부터 `leaderboard`(전체 랭킹) 컬렉션에 이미 쌓여있던 기록은, 그 자체로는 새로 만든 `leaderboard_weekly` / `leaderboard_semester` 컬렉션에 자동으로 나타나지 않습니다. `migrate.html`을 한 번 실행하면, 각 기록이 세워진 시각(`updatedAt`)을 기준으로 해당 주/학기 랭킹에도 반영해줍니다.

1. `migrate.html`을 다른 4개 파일과 같은 폴더에 두고 (로컬 서버로) 엽니다.
2. 화면의 안내를 읽고 "▶ 마이그레이션 시작"을 누릅니다.
3. 완료 메시지와 처리된 인원 수를 확인합니다.
4. `index.html`이나 각 게임의 주간/학기 랭킹을 새로고침해서 옛 기록이 잘 반영됐는지 확인합니다.
5. `migrate.html`은 배포용 사이트(GitHub Pages 등)에 올리지 않아도 되는 **관리자용 1회성 도구**입니다.

> 여러 번 눌러도 안전합니다 (이미 그 주/학기에 더 높은 점수가 있으면 덮어쓰지 않아요). 다만 불필요한 읽기/쓰기를 줄이려면 완료 메시지를 확인한 뒤에는 다시 실행하지 않아도 됩니다.

> 참고: 예전에 `scores`라는 별도 컬렉션을 쓰신 적이 있다면(아주 초기 버전), 그건 이미 이 앱에서 쓰이지 않으니 Firebase 콘솔에서 그대로 두거나 지우셔도 됩니다. 지금 안내하는 마이그레이션은 현재 사용 중인 `leaderboard` 컬렉션 → `leaderboard_weekly`/`leaderboard_semester` 로 옮기는 것입니다.

## 로컬에서 테스트하기
`file://`로 그냥 더블클릭해서 열면 브라우저 보안 정책 때문에 스크립트가 막힐 수 있습니다. 아래 중 하나로 간단한 로컬 서버를 띄운 뒤 `index.html`을 열어주세요.

- VSCode의 **Live Server** 확장 사용
- 터미널에서 폴더 이동 후: `python -m http.server 8000` 실행 → 브라우저에서 `http://localhost:8000` 접속

## Firebase를 아직 설정하지 않았다면?
`firebase-shared.js`의 `firebaseConfig`가 기본값(`YOUR_API_KEY` 등) 그대로면, 점수 저장/랭킹 조회 기능은 자동으로 비활성화되고 콘솔에 안내 메시지만 출력됩니다. 게임 자체(파리 잡기, 별자리 원정대)는 이름 입력 → 게임 선택 → 플레이 → 메인으로 돌아가기까지 Firebase 없이도 정상 동작합니다.
