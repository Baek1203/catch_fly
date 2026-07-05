/* =========================================================
   firebase-shared.js
   세 페이지(index.html, game1.html, game2.html)가 공통으로
   사용하는 Firebase 설정 + 점수 저장/랭킹 불러오기 헬퍼입니다.

   ▶ 사용 전 꼭 해야 할 일
   1) https://console.firebase.google.com 에서 프로젝트를 만드세요.
   2) 왼쪽 메뉴 [빌드 > Firestore Database] 에서 데이터베이스를 만드세요.
      (테스트 모드로 시작해도 되고, 아래 "보안 규칙 예시"를 참고해 규칙을 설정하세요.)
   3) [프로젝트 설정(톱니바퀴) > 일반] 탭에서 "웹 앱 추가"를 하면
      firebaseConfig 값이 나옵니다. 그 값을 아래 firebaseConfig 자리에
      그대로 붙여넣으세요.
   4) 저장 후 index.html을 웹서버(또는 로컬 서버)로 열면 동작합니다.
      (file:// 로 그냥 더블클릭하면 브라우저 보안 정책상 오류가 날 수 있어요.
       VSCode의 Live Server 확장, 또는 `python -m http.server` 등을 이용하세요.)

   ▶ Firestore 보안 규칙 예시 (콘솔 > Firestore Database > 규칙)
   -----------------------------------------------------------
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /scores/{scoreId} {
         allow read: if true;                 // 누구나 랭킹 조회 가능
         allow create: if request.resource.data.name is string
                        && request.resource.data.game in ['fly', 'star']
                        && request.resource.data.score is number;
         allow update, delete: if false;      // 점수 수정/삭제는 막음
       }
     }
   }
   -----------------------------------------------------------

   ▶ 인덱스 안내
   랭킹 조회는 색인(인덱스) 없이도 바로 동작하도록 구현했습니다.
   (game 필드로만 필터링한 뒤, 점수 정렬은 브라우저에서 처리합니다.)
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAcQmT4f8zP1L153PojICdiuZ-d-N2aL6U",
  authDomain: "math-fly-catch.firebaseapp.com",
  projectId: "math-fly-catch",
  storageBucket: "math-fly-catch.firebasestorage.app",
  messagingSenderId: "748954569516",
  appId: "1:748954569516:web:c474da7f087530f39b7a89"
};

let db = null;
let firebaseReady = false;

try {
  if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    firebaseReady = true;
  } else {
    console.warn('[firebase-shared.js] firebaseConfig가 아직 설정되지 않았습니다. 랭킹 저장/조회 기능이 비활성화됩니다.');
  }
} catch (e) {
  console.error('[firebase-shared.js] Firebase 초기화 실패:', e);
}

/* ---------------- 플레이어 이름 (localStorage 공유) ---------------- */
const PLAYER_NAME_KEY = 'arcade_playerName';

function getPlayerName() {
  return (localStorage.getItem(PLAYER_NAME_KEY) || '').trim();
}

function setPlayerName(name) {
  localStorage.setItem(PLAYER_NAME_KEY, (name || '').trim());
}

/* ---------------- 점수 저장 ---------------- */
// gameId: 'fly' (파리 잡기) | 'star' (별자리 원정대)
async function saveScore(gameId, name, score, extra = {}) {
  if (!firebaseReady) {
    console.warn('[firebase-shared.js] Firebase 미설정으로 점수를 저장하지 않았습니다.');
    return { ok: false, reason: 'firebase-not-configured' };
  }
  try {
    await db.collection('scores').add({
      game: gameId,
      name: (name || '익명').slice(0, 12),
      score: Math.max(0, Math.round(Number(score) || 0)),
      ...extra,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { ok: true };
  } catch (e) {
    console.error('[firebase-shared.js] 점수 저장 실패:', e);
    return { ok: false, reason: e.message };
  }
}

/* ---------------- 랭킹(top N) 조회 ----------------
   where(game==...) + orderBy(score desc) 조합은 Firestore에서
   "복합 색인"을 요구할 수 있어, 색인을 미리 만들어두지 않으면
   조회가 조용히 실패해서 랭킹이 안 보이는 문제가 생길 수 있습니다.
   이를 피하기 위해 orderBy 없이 game으로만 필터링해서 가져온 뒤
   점수 정렬은 브라우저(클라이언트)에서 처리합니다.
   -> 이 방식은 별도의 색인 생성 없이 바로 동작합니다.
   반환값: { ok: boolean, rows: 배열, reason?: 실패 사유 }
---------------------------------------------------- */
async function fetchTopScores(gameId, limitN = 20) {
  if (!firebaseReady) {
    return { ok: false, rows: [], reason: 'firebase-not-configured' };
  }
  try {
    const snap = await db.collection('scores')
      .where('game', '==', gameId)
      .get();
    const rows = snap.docs.map(d => d.data());
    rows.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    return { ok: true, rows: rows.slice(0, limitN) };
  } catch (e) {
    console.error('[firebase-shared.js] 랭킹 조회 실패:', e);
    return { ok: false, rows: [], reason: e.message };
  }
}
