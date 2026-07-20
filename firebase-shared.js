/* =========================================================
   firebase-shared.js
   네 페이지(index.html, game1.html, game2.html, game3.html)가 공통으로
   사용하는 Firebase 설정 + 점수 저장/랭킹 불러오기 헬퍼입니다.

   ▶ 게임별 데이터 구분 (gameId)
   saveScore()/fetchScores()의 첫 번째 인자인 gameId로 게임마다 랭킹이
   완전히 분리됩니다. 문서 ID에도 gameId가 포함되기 때문에(예:
   `fly__민준`, `star__민준`, `zero__민준`) 같은 이름이어도 게임끼리
   점수가 섞이지 않습니다.
     - fly  : game1.html (파리 잡기 좌표게임)
     - star : game2.html (별자리 원정대)
     - zero : game3.html (제로섬 스페이스 미션)
   새 게임을 추가할 때는 여기 목록과, 아래 Firestore 보안 규칙의
   `game in [...]` 허용 목록에도 새 gameId를 추가해야 저장이 됩니다.

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
   플레이할 때마다 새 문서를 쌓지 않고, "게임+기간+이름"당 문서 1개만
   유지하는 방식입니다. 랭킹은 세 종류의 컬렉션으로 나뉘어 저장됩니다.

     - leaderboard          (전체 랭킹, 기간 구분 없음 - 예전과 동일)
         문서 ID: `${game}__${이름}`
     - leaderboard_weekly   (주간 랭킹 - 월요일 오전 9시 기준으로 주가 바뀜)
         문서 ID: `${game}__${weekId}__${이름}`   예) fly__2026-W29__민준
     - leaderboard_semester (학기 랭킹 - 3월~7월 1학기 / 8월~다음해 2월 2학기, 자동 계산)
         문서 ID: `${game}__${semesterId}__${이름}` 예) fly__2026-1__민준

   각 문서는 그 범위 안에서의 "최고 점수"와 "그 최고 점수를 기록한 횟수"를
   담고 있습니다 (예전 leaderboard 컬렉션과 동일한 방식).

   ▶ "매주 월요일 9시에 갱신" / "학기 시작일에 갱신"이 실제로 동작하는 원리
   서버에서 주기적으로 무언가를 삭제하거나 초기화하는 방식이 아닙니다
   (그러려면 Cloud Functions 예약 실행 등 유료 요금제가 필요해요).
   대신 점수를 저장/조회할 때마다 "지금이 몇 번째 주(week)인지",
   "지금이 어느 학기인지"를 브라우저에서 계산해서, 그 기간에 해당하는
   문서에만 쓰고 읽습니다. 그래서 월요일 9시가 지나면 자연스럽게 새로운
   weekId로 문서가 나뉘기 시작하는 것뿐이고, 서버 비용이나 예약 작업이
   전혀 필요 없습니다.

   ▶ Firestore 보안 규칙 예시 (콘솔 > Firestore Database > 규칙)
   -----------------------------------------------------------
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
   -----------------------------------------------------------

   ▶ 인덱스 안내
   주간/학기 랭킹 조회는 game, period 두 필드에 대한 동등(==) 조건만
   사용합니다. Firestore는 동등 조건만 여러 개 조합하는 쿼리는 별도의
   복합 색인 없이도 자동으로 처리하므로, 이번에도 색인 설정이 필요 없습니다.
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
  return clean.replace(/\//g, '_');
}

/* =========================================================
   ⭐ 학기 계산 - 3월~7월 = 1학기, 8월~다음해 2월 = 2학기 ⭐
   매년 자동으로 계산되므로 별도 설정 없이 동작합니다 (한국 시간 기준).
   학기 ID는 'OO학년도-학기' 형식입니다. 예) 2학기(8~12월)는 그 해 연도를,
   1·2월은 "전년도 2학기"로 취급하므로 2027-2 로 표기됩니다.
   ========================================================= */
function _semesterInfo(date = new Date()) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS); // UTC getter로 읽으면 KST 달력 값이 나옴
  const month = kst.getUTCMonth() + 1; // 1~12
  const year = kst.getUTCFullYear();
  if (month >= 3 && month <= 7) return { year, term: 1 };   // 3월~7월
  if (month >= 8) return { year, term: 2 };                  // 8월~12월
  return { year: year - 1, term: 2 };                        // 1월~2월 (전년도 2학기)
}

function getSemesterId(date = new Date()) {
  const { year, term } = _semesterInfo(date);
  return `${year}-${term}`;
}

function getSemesterLabel(semesterId) {
  const [year, term] = semesterId.split('-');
  return `${year}학년도 ${term}학기`;
}

// 현재 학기 기준 바로 이전 n개 학기 목록, 최신순. "지난 학기 기록 보기" 드롭다운에 사용.
function listPastSemesters(date = new Date(), n = 4) {
  let { year, term } = _semesterInfo(date);
  const result = [];
  for (let i = 0; i < n; i++) {
    if (term === 1) { year -= 1; term = 2; } else { term = 1; }
    const id = `${year}-${term}`;
    result.push({ id, label: getSemesterLabel(id) });
  }
  return result;
}

/* =========================================================
   ⭐ 주간(week) ID 계산 - 매주 월요일 오전 9시 기준으로 바뀜 ⭐
   별도 설정 없이 자동으로 동작합니다 (한국 시간 기준).

   구현 방식: "이 순간이 몇 번째 ISO 주차인가"를 복잡하게 계산하는 대신,
   기준이 되는 월요일(2018-01-01, 실제 월요일입니다) 오전 9시(KST)로부터
   몇 번째 7일 구간에 속하는지를 순수 시간 계산(밀리초 나눗셈)으로 구해서,
   그 구간이 시작하는 "월요일 날짜(KST, YYYY-MM-DD)" 자체를 주간 ID로
   사용합니다. 요일별 자정 경계나 연도 경계 같은 예외 케이스가 없어
   실수할 여지가 없는 방식입니다.
   ========================================================= */
const KST_OFFSET_MS = 9 * 3600 * 1000;
// 2018-01-01은 실제 월요일이며, 이 날짜 00:00 UTC = 2018-01-01 09:00 KST 입니다.
const WEEK_ANCHOR_MS = Date.UTC(2018, 0, 1, 0, 0, 0);
const WEEK_MS = 7 * 24 * 3600 * 1000;

function _weekMondayEpoch(date) {
  const weeksSince = Math.floor((date.getTime() - WEEK_ANCHOR_MS) / WEEK_MS);
  return WEEK_ANCHOR_MS + weeksSince * WEEK_MS; // 이 구간이 시작하는 월요일 09:00 KST의 UTC epoch(ms)
}

function _pad2(n) { return String(n).padStart(2, '0'); }

// weekId = 그 주가 시작하는 월요일의 한국 날짜, 'YYYY-MM-DD' 형식
function getWeekId(date = new Date()) {
  const kstMonday = new Date(_weekMondayEpoch(date) + KST_OFFSET_MS); // UTC getter로 읽으면 KST 달력 날짜가 나옴
  return `${kstMonday.getUTCFullYear()}-${_pad2(kstMonday.getUTCMonth() + 1)}-${_pad2(kstMonday.getUTCDate())}`;
}

// weekId('YYYY-MM-DD') -> 그 월요일을 나타내는 Date (UTC getter로 Y/M/D를 읽으면 됨)
function weekIdToMonday(weekId) {
  const [y, m, d] = weekId.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// weekId -> "7월 6일 ~ 7월 12일" 형식 라벨
function getWeekLabel(weekId) {
  const monday = weekIdToMonday(weekId);
  const sunday = new Date(monday.getTime() + 6 * 24 * 3600 * 1000);
  const fmt = (d) => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  return `${fmt(monday)} ~ ${fmt(sunday)}`;
}

// 이번 주를 제외한, 최근 n개의 지난 주 목록 (최신순).
function listPastWeeks(n = 8, date = new Date()) {
  const result = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(date.getTime() - i * WEEK_MS);
    const id = getWeekId(d);
    result.push({ id, label: getWeekLabel(id) });
  }
  return result;
}

/* ---------------- 점수 저장 (전체/주간/학기 세 문서를 한 번에 갱신) ----------------
   각 범위(전체/이번 주/이번 학기)마다 "최고 점수"를 독립적으로 관리합니다.
   예를 들어 오늘 세운 점수가 전체 역대 최고는 아니어도 이번 주 최고는
   될 수 있습니다. extra는 "그 범위의 최고 기록을 세운 판"의 부가 통계만
   갱신됩니다.
------------------------------------------------------------------ */
async function saveScore(gameId, name, score, extra = {}) {
  if (!firebaseReady) {
    console.warn('[firebase-shared.js] Firebase 미설정으로 점수를 저장하지 않았습니다.');
    return { ok: false, reason: 'firebase-not-configured' };
  }
  const cleanName = sanitizeNameForDocId(name);
  const newScore = Math.max(0, Math.round(Number(score) || 0));
  const now = new Date();
  const weekId = getWeekId(now);
  const semesterId = getSemesterId(now);

  const targets = [
    { ref: db.collection('leaderboard').doc(`${gameId}__${cleanName}`), period: null },
    { ref: db.collection('leaderboard_weekly').doc(`${gameId}__${weekId}__${cleanName}`), period: weekId }
  ];
  if (semesterId) {
    targets.push({ ref: db.collection('leaderboard_semester').doc(`${gameId}__${semesterId}__${cleanName}`), period: semesterId });
  }

  try {
    await db.runTransaction(async (tx) => {
      const snaps = [];
      for (const t of targets) snaps.push(await tx.get(t.ref));

      targets.forEach((t, i) => {
        const snap = snaps[i];
        const baseData = { game: gameId, name: cleanName, ...extra, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (t.period) baseData.period = t.period;

        if (!snap.exists) {
          tx.set(t.ref, { ...baseData, score: newScore, count: 1 });
        } else {
          const data = snap.data();
          const prevScore = Number(data.score) || 0;
          const prevCount = Number(data.count) || 0;
          if (newScore > prevScore) {
            tx.update(t.ref, { ...baseData, score: newScore, count: 1 });
          } else if (newScore === prevScore) {
            tx.update(t.ref, { count: prevCount + 1, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
          }
        }
      });
    });
    return { ok: true };
  } catch (e) {
    console.error('[firebase-shared.js] 점수 저장 실패:', e);
    return { ok: false, reason: e.message };
  }
}

/* ---------------- 동점자 처리된 순위 매기기 ---------------- */
function assignRanks(rows) {
  let lastRank = 0;
  let lastKey = null;
  return (rows || []).map((r, i) => {
    const key = (Number(r.score) || 0) + '|' + (Number(r.count) || 0);
    if (key !== lastKey) {
      lastRank = i + 1;
      lastKey = key;
    }
    return { row: r, rank: lastRank };
  });
}

/* ---------------- 랭킹 조회 (통합 함수) ----------------
   scope: 'all' | 'weekly' | 'semester'
   periodId: 생략하면 '지금' 기준 기간(이번 주 / 이번 학기)을 사용.
             과거 기록을 보려면 listPastWeeks()/listPastSemesters()로 얻은
             id를 넘기면 됩니다.
   반환값: { ok, rows, scope, periodId, reason? }
---------------------------------------------------- */
async function fetchScores(gameId, options = {}) {
  const scope = options.scope || 'all';
  const limitN = options.limit || 500;
  if (!firebaseReady) {
    return { ok: false, rows: [], scope, periodId: null, reason: 'firebase-not-configured' };
  }

  let collectionName = 'leaderboard';
  let periodId = null;
  if (scope === 'weekly') {
    collectionName = 'leaderboard_weekly';
    periodId = options.periodId || getWeekId();
  } else if (scope === 'semester') {
    collectionName = 'leaderboard_semester';
    periodId = options.periodId || getSemesterId();
    if (!periodId) {
      return { ok: true, rows: [], scope, periodId: null, reason: 'no-active-semester' };
    }
  }

  try {
    let q = db.collection(collectionName).where('game', '==', gameId);
    if (periodId) q = q.where('period', '==', periodId);
    const snap = await q.get();
    const rows = snap.docs.map(d => d.data());
    rows.sort((a, b) => {
      const sb = Number(b.score) || 0, sa = Number(a.score) || 0;
      if (sb !== sa) return sb - sa;
      return (Number(b.count) || 0) - (Number(a.count) || 0);
    });
    return { ok: true, rows: rows.slice(0, limitN), scope, periodId };
  } catch (e) {
    console.error('[firebase-shared.js] 랭킹 조회 실패:', e);
    return { ok: false, rows: [], scope, periodId, reason: e.message };
  }
}

// 예전 코드와의 호환을 위해 남겨둠 (전체 랭킹 조회)
async function fetchTopScores(gameId, limitN = 20) {
  return fetchScores(gameId, { scope: 'all', limit: limitN });
}
