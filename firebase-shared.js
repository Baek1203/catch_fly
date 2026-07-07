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

   ▶ 데이터 구조 (읽기 사용량을 줄이기 위한 설계)
   플레이할 때마다 새 문서를 쌓지 않고, "게임+이름"당 문서 1개만 유지하는
   `leaderboard` 컬렉션을 사용합니다. 문서 안에는 순위에 필요한 값
   (최고 점수 score, 총 플레이 횟수 count)이 이미 계산되어 저장돼 있어요.
     - 문서 ID: `${game}__${이름}` (예: "fly__민준")
     - 필드: game, name, score(최고 점수), count(총 플레이 횟수), updatedAt, (선택) 부가 통계
   점수를 저장할 때는 Firestore 트랜잭션으로 기존 문서를 읽어
   "최고 점수"와 "총 횟수"를 갱신합니다(문서 1개 읽기 + 쓰기).
   랭킹을 불러올 때는 이 컬렉션만 조회하면 되므로, 한 사람이 게임을
   몇 번을 다시 하든 랭킹 조회 시 읽는 문서 수는 "실제 참여 인원 수"만큼만
   늘어납니다 (예전처럼 "총 플레이 횟수"만큼 늘어나지 않음).

   ▶ Firestore 보안 규칙 예시 (콘솔 > Firestore Database > 규칙)
   -----------------------------------------------------------
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /leaderboard/{entryId} {
         allow read: if true;                 // 누구나 랭킹 조회 가능
         allow write: if request.resource.data.name is string
                       && request.resource.data.game in ['fly', 'star']
                       && request.resource.data.score is number
                       && request.resource.data.count is number;
       }
     }
   }
   -----------------------------------------------------------
   (기존에 `scores` 컬렉션을 이미 쓰고 계셨다면, 그 컬렉션은 더 이상
    사용하지 않으니 콘솔에서 그냥 두거나 삭제하셔도 됩니다.)

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

/* ---------------- 문서 ID로 안전하게 쓸 수 있게 이름 정리 ---------------- */
function sanitizeNameForDocId(name) {
  const clean = (name || '익명').trim().slice(0, 12) || '익명';
  // Firestore 문서 ID에 쓸 수 없는 문자(/)만 치환
  return clean.replace(/\//g, '_');
}

/* ---------------- 점수 저장 (게임+이름당 문서 1개로 집계) ----------------
   기존처럼 플레이마다 새 문서를 추가하지 않고, 같은 사람(name)의 문서
   1개를 트랜잭션으로 갱신합니다: 최고 점수(score)와 총 플레이 횟수(count)만
   저장해두면, 랭킹을 불러올 때 사람 수만큼만 읽으면 되어 읽기 사용량이
   크게 줄어듭니다.
   extra는 "최고 기록을 세운 판"의 부가 통계(예: 연속기록, 명중률, 난이도)만
   갱신됩니다.
------------------------------------------------------------------ */
async function saveScore(gameId, name, score, extra = {}) {
  if (!firebaseReady) {
    console.warn('[firebase-shared.js] Firebase 미설정으로 점수를 저장하지 않았습니다.');
    return { ok: false, reason: 'firebase-not-configured' };
  }
  const cleanName = sanitizeNameForDocId(name);
  const newScore = Math.max(0, Math.round(Number(score) || 0));
  const ref = db.collection('leaderboard').doc(`${gameId}__${cleanName}`);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        tx.set(ref, {
          game: gameId,
          name: cleanName,
          score: newScore,
          count: 1,
          ...extra,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        const data = snap.data();
        const prevScore = Number(data.score) || 0;
        const prevCount = Number(data.count) || 0;
        const isNewBest = newScore >= prevScore;
        tx.update(ref, {
          score: Math.max(prevScore, newScore),
          count: prevCount + 1,
          ...(isNewBest ? extra : {}), // 부가 통계는 최고 기록 판 기준으로만 갱신
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    return { ok: true };
  } catch (e) {
    console.error('[firebase-shared.js] 점수 저장 실패:', e);
    return { ok: false, reason: e.message };
  }
}

/* ---------------- 동점자 처리된 순위 매기기 ----------------
   점수와 count(기록 횟수)가 모두 같은 사람들은 공동 순위로 처리하고,
   그다음 순위는 공동 순위 인원 수만큼 건너뜁니다.
   예: 1,2,3위가 모두 점수·기록횟수 동일 -> 셋 다 1위, 그다음은 4위.
   fetchTopScores로 이미 정렬된 배열을 넣어주세요.
   반환값: [{ row, rank }, ...] 형태의 배열
------------------------------------------------------------------ */
function assignRanks(rows){
  let lastRank = 0;
  let lastKey = null;
  return (rows || []).map((r, i)=>{
    const key = (Number(r.score) || 0) + '|' + (Number(r.count) || 0);
    if(key !== lastKey){
      lastRank = i + 1;
      lastKey = key;
    }
    return { row: r, rank: lastRank };
  });
}

/* ---------------- 랭킹 조회 ----------------
   leaderboard 컬렉션은 "게임+이름"당 문서가 1개뿐이라, 총 플레이 횟수가
   아무리 많아도 실제 참여 인원 수만큼만 문서를 읽습니다.
   where(game==...) 단일 필드 필터만 사용해 별도 색인 없이 바로 동작하고,
   정렬(점수 desc -> 기록횟수 desc)은 브라우저에서 처리합니다.
   반환값: { ok: boolean, rows: 배열(정렬 완료, 최대 limitN개), reason?: 실패 사유 }
---------------------------------------------------- */
async function fetchTopScores(gameId, limitN = 20) {
  if (!firebaseReady) {
    return { ok: false, rows: [], reason: 'firebase-not-configured' };
  }
  try {
    const snap = await db.collection('leaderboard')
      .where('game', '==', gameId)
      .get();
    const rows = snap.docs.map(d => d.data());
    rows.sort((a, b) => {
      const sb = Number(b.score) || 0, sa = Number(a.score) || 0;
      if (sb !== sa) return sb - sa;
      return (Number(b.count) || 0) - (Number(a.count) || 0);
    });
    return { ok: true, rows: rows.slice(0, limitN) };
  } catch (e) {
    console.error('[firebase-shared.js] 랭킹 조회 실패:', e);
    return { ok: false, rows: [], reason: e.message };
  }
}
