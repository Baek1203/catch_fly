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
4. 게임이 끝나면 점수가 Firebase Firestore의 `scores` 컬렉션에 자동 저장되고, 각 게임/허브 페이지의 랭킹(TOP 5)이 갱신됩니다.
   - 파리 잡기: 잡은 파리 수(점수), 최고 연속 기록, 명중률 저장
   - 별자리 원정대: 총점(누적 점수), 선택한 난이도 저장
5. 이름이 저장돼 있지 않은 상태로 `game1.html`/`game2.html`에 직접 들어오면 자동으로 `index.html`로 돌아갑니다.

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
누구나 랭킹을 읽을 수 있지만, 정해진 형식의 점수만 새로 추가할 수 있고 수정/삭제는 막는 규칙 예시입니다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /scores/{scoreId} {
      allow read: if true;
      allow create: if request.resource.data.name is string
                     && request.resource.data.game in ['fly', 'star']
                     && request.resource.data.score is number;
      allow update, delete: if false;
    }
  }
}
```

### 색인(인덱스) 관련 안내
랭킹 조회 시 `where(game == ...)` + `orderBy(score desc)`를 함께 사용하기 때문에, 처음 실행하면 브라우저 콘솔에 Firestore가 "복합 색인이 필요합니다"라는 에러와 함께 색인 생성 링크를 보여줄 수 있어요. 그 링크를 한 번 클릭해서 색인을 만들어주면 이후부터는 정상적으로 랭킹이 표시됩니다. (색인 생성에는 몇 분 정도 걸릴 수 있어요.)

## 로컬에서 테스트하기
`file://`로 그냥 더블클릭해서 열면 브라우저 보안 정책 때문에 스크립트가 막힐 수 있습니다. 아래 중 하나로 간단한 로컬 서버를 띄운 뒤 `index.html`을 열어주세요.

- VSCode의 **Live Server** 확장 사용
- 터미널에서 폴더 이동 후: `python -m http.server 8000` 실행 → 브라우저에서 `http://localhost:8000` 접속

## Firebase를 아직 설정하지 않았다면?
`firebase-shared.js`의 `firebaseConfig`가 기본값(`YOUR_API_KEY` 등) 그대로면, 점수 저장/랭킹 조회 기능은 자동으로 비활성화되고 콘솔에 안내 메시지만 출력됩니다. 게임 자체(파리 잡기, 별자리 원정대)는 이름 입력 → 게임 선택 → 플레이 → 메인으로 돌아가기까지 Firebase 없이도 정상 동작합니다.
