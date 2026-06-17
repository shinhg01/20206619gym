/**
 * 아이언핏 GYM - Google Apps Script 메인 API 엔진 (Code.gs)
 *
 * Google Sheets를 데이터베이스 삼아 CRUD API를 제공하며,
 * PropertiesService를 활용하여 고밀도 JSON 데이터(운동, 신체측정, 식단)를 저장합니다.
 */

// [필독] 사용하시는 Google Spreadsheet의 ID를 아래에 입력하세요.
const SHEET_ID = '1rVrSUVreyf2K77sIJKHc--em36ifKdbCHCaSpCdWKcE';

// 7개 주요 시트명 설정
const SHEET_NAMES = {
  gym:        '0_헬스장정보',
  trainers:   '1_트레이너명단',
  members:    '2_회원명단',
  pt:         '3_PT일정',
  ptWeekly:   '3W_PT주간시간표',
  equipment:  '4_운동기구',
  payments:   '5_결제내역',
  ptRequests: '6_PT신청대기',
};

/**
 * GET 요청 라우터 (doGet)
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const userId = e.parameter.userId;
    const role   = e.parameter.role;

    if (!action) {
      return respond({ error: 'Action parameter is required' }, 400);
    }

    if (SHEET_ID === 'YOUR_GOOGLE_SHEET_ID_HERE') {
      return respond({ error: 'Spreadsheet ID가 설정되지 않았습니다. Code.gs 상단에 입력해 주세요.' }, 500);
    }

    switch(action) {
      case 'getDashboard':
        return respond(getDashboard(userId));
      case 'getWorkouts':
        return respond(getWorkouts(userId));
      case 'getBodyData':
        return respond(getBodyData(userId));
      case 'getDiet':
        return respond(getDiet(userId, e.parameter.date));
      case 'getMembers':
        return respond(getMembers());
      case 'getTrainers':
        return respond(getTrainers());
      case 'getPT':
        return respond(getPT(userId, role));
      case 'getPTSchedule':
        return respond(getPTSchedule(userId, role));
      case 'getEquipment':
        return respond(getEquipment(e.parameter.category));
      case 'getPayments':
        return respond(getPayments(userId, role));
      case 'getTrainerDashboard':
        return respond(getTrainerDashboard(e.parameter.trainerId));
      case 'getTrainerSchedule':
        return respond(getTrainerSchedule(e.parameter.trainerId));
      case 'getPTRequests':
        return respond(getPTRequests(e.parameter.trainerId));  // trainerId 파라미터 전달
      default:
        return respond({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    return respond({ error: error.toString(), stack: error.stack }, 500);
  }
}

/**
 * POST 요청 라우터 (doPost)
 */
function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      return respond({ error: 'No post data received' }, 400);
    }

    const body   = JSON.parse(e.postData.contents);
    const action = body.action;

    if (!action) {
      return respond({ error: 'Action is required in post body' }, 400);
    }

    if (SHEET_ID === 'YOUR_GOOGLE_SHEET_ID_HERE') {
      return respond({ error: 'Spreadsheet ID가 설정되지 않았습니다. Code.gs 상단에 입력해 주세요.' }, 500);
    }

    switch(action) {
      case 'login':
        return respond(login(body));
      case 'saveWorkout':
        return respond(saveWorkout(body));
      case 'updateWorkout':
        return respond(updateWorkout(body));
      case 'deleteWorkout':
        return respond(deleteWorkout(body));
      case 'saveBody':
        return respond(saveBodyData(body));
      case 'updateBody':
        return respond(updateBodyData(body));
      case 'deleteBody':
        return respond(deleteBodyData(body));
      case 'saveDiet':
        return respond(saveDiet(body));
      case 'updateDiet':
        return respond(updateDiet(body));
      case 'deleteDiet':
        return respond(deleteDiet(body));
      case 'registerPT':
        return respond(registerPT(body));
      case 'markAttendance':
        return respond(markAttendance(body));
      case 'addMember':
        return respond(addMember(body));
      case 'updatePayment':
        return respond(updatePayment(body));
      case 'updateEquipmentStatus':
        return respond(updateEquipmentStatus(body));
      case 'assignTrainer':
        return respond(assignTrainer(body));
      case 'removePTMember':
        return respond(removePTMember(body));
      case 'addPayment':
        return respond(addPayment(body));
      case 'updatePTRequest':
        return respond(updatePTRequest(body));
      case 'approvePTRequest':           // ← 추가
        return respond(approvePTRequest(body));
      default:
        return respond({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (error) {
    return respond({ error: error.toString(), stack: error.stack }, 500);
  }
}

/**
 * CORS 및 표준 JSON 출력 형식 응답 함수
 */
function respond(data, code = 200) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: code, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 통합 로그인 함수
 */
function login({ memberId, password }) {
  if (!memberId || !password) {
    return { success: false, message: '아이디와 비밀번호를 모두 입력해주세요.' };
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);

  if (memberId === 'admin' && (password === 'admin' || password === 'ironfit1234')) {
    return {
      success: true,
      userId: 'admin',
      name: '최고관리자',
      role: '관리자',
      assignedTrainer: '',
      status: '활동중'
    };
  }

  const memberSheet = ss.getSheetByName(SHEET_NAMES.members);
  if (memberSheet) {
    const memberRows = memberSheet.getDataRange().getValues();
    for (let i = 1; i < memberRows.length; i++) {
      const row = memberRows[i];
      const id     = String(row[0]).trim();
      const name   = row[1];
      const grade  = row[4];
      const trainer= row[7];
      const status = row[9];
      const pw     = (row[12] !== undefined && String(row[12]).trim() !== '') ? String(row[12]).trim() : '1234';

      if (id === String(memberId).trim() && pw === String(password).trim()) {
        return {
          success: true,
          userId: id,
          name: name,
          role: grade,
          assignedTrainer: grade === '일반회원' ? '' : trainer,
          status: status || '활동중'
        };
      }
    }
  }

  const trainerSheet = ss.getSheetByName(SHEET_NAMES.trainers);
  if (trainerSheet) {
    const trainerRows = trainerSheet.getDataRange().getValues();
    for (let i = 1; i < trainerRows.length; i++) {
      const row    = trainerRows[i];
      const id     = String(row[0]).trim();
      const name   = row[1];
      const status = row[8];
      const pw     = (row.length > 9 && String(row[9]).trim() !== '') ? String(row[9]).trim() : '1234';

      if (id === String(memberId).trim() && pw === String(password).trim()) {
        return {
          success: true,
          userId: id,
          name: name,
          role: '트레이너',
          assignedTrainer: '',
          status: status || '활동중'
        };
      }
    }
  }

  return { success: false, message: '아이디 또는 비밀번호 오류' };
}

/**
 * 대시보드 통계 데이터 집계 함수
 */
function getDashboard(userId) {
  if (!userId) return { error: 'userId is required' };

  const props = PropertiesService.getScriptProperties();

  const now          = new Date();
  const todayStr     = Utilities.formatDate(now, "GMT+9", "yyyy-MM-dd");
  const thisMonthStr = Utilities.formatDate(now, "GMT+9", "yyyy-MM");

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr  = Utilities.formatDate(lastMonthDate, "GMT+9", "yyyy-MM");

  let attendanceCount = 0;
  const attendanceGoal = 20;
  let workouts = [];
  try {
    const raw = props.getProperty(`workout_${userId}`);
    if (raw) workouts = JSON.parse(raw);
  } catch(e) {}

  if (workouts.length > 0) {
    const uniqueDates = {};
    workouts.forEach(item => {
      if (item.date && item.date.indexOf(thisMonthStr) === 0) {
        uniqueDates[item.date] = true;
      }
    });
    attendanceCount = Object.keys(uniqueDates).length;
  }

  let ptRemaining = 0;
  let ptTotal = 0;
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const ptSheet = ss.getSheetByName(SHEET_NAMES.pt);
    if (ptSheet) {
      const ptRows = ptSheet.getDataRange().getValues();
      for (let i = 1; i < ptRows.length; i++) {
        const row       = ptRows[i];
        const rowMemberId = String(row[3]).trim();
        const total     = Number(row[5]) || 0;
        const remaining = Number(row[6]) || 0;
        const status    = String(row[13]).trim();
        if (rowMemberId === String(userId).trim() && status === '진행중') {
          ptRemaining += remaining;
          ptTotal     += total;
        }
      }
    }
  } catch (e) {
    Logger.log("PT 일정 조회 실패: " + e.toString());
  }

  let todayCalories = 0;
  const calorieGoal = 2000;
  let diets = [];
  try {
    const raw = props.getProperty(`diet_${userId}`);
    if (raw) diets = JSON.parse(raw);
  } catch(e) {}

  if (diets.length > 0) {
    diets.forEach(item => {
      if (item.date === todayStr) todayCalories += (Number(item.kcal) || 0);
    });
  }

  let bodyData = [];
  try {
    const raw = props.getProperty(`body_${userId}`);
    if (raw) bodyData = JSON.parse(raw);
  } catch(e) {}

  if (bodyData.length > 1) {
    bodyData.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  const weightHistory = { labels: [], data: [] };
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

  if (bodyData.length > 0) {
    bodyData.forEach(item => {
      const itemDate = new Date(item.date);
      if (itemDate >= thirtyDaysAgo) {
        weightHistory.labels.push(Utilities.formatDate(itemDate, "GMT+9", "MM-dd"));
        weightHistory.data.push(Number(item.weight) || 0);
      }
    });
  }

  let weightChange = 0;
  let thisMonthWeights = [];
  let lastMonthWeights = [];

  if (bodyData.length > 0) {
    bodyData.forEach(item => {
      if (item.date.indexOf(thisMonthStr) === 0) thisMonthWeights.push(Number(item.weight) || 0);
      else if (item.date.indexOf(lastMonthStr) === 0) lastMonthWeights.push(Number(item.weight) || 0);
    });
  }

  if (thisMonthWeights.length > 0 && lastMonthWeights.length > 0) {
    const thisAvg = thisMonthWeights.reduce((a, b) => a + b, 0) / thisMonthWeights.length;
    const lastAvg = lastMonthWeights.reduce((a, b) => a + b, 0) / lastMonthWeights.length;
    weightChange  = Number((thisAvg - lastAvg).toFixed(1));
  } else if (bodyData.length >= 2) {
    const lastIdx   = bodyData.length - 1;
    const prevWeight = Number(bodyData[lastIdx - 1].weight) || 0;
    const currWeight = Number(bodyData[lastIdx].weight)     || 0;
    weightChange     = Number((currWeight - prevWeight).toFixed(1));
  }

  const weeklyCalories = { labels: ["월","화","수","목","금","토","일"], data: [0,0,0,0,0,0,0] };
  const dayOfWeek = now.getDay();
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now.getTime() + (distanceToMonday * 24 * 60 * 60 * 1000));
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + (i * 24 * 60 * 60 * 1000));
    weekDates.push(Utilities.formatDate(d, "GMT+9", "yyyy-MM-dd"));
  }

  if (diets.length > 0) {
    diets.forEach(item => {
      const idx = weekDates.indexOf(item.date);
      if (idx !== -1) weeklyCalories.data[idx] += (Number(item.kcal) || 0);
    });
  }

  return {
    attendanceCount, attendanceGoal,
    ptRemaining, ptTotal,
    todayCalories, calorieGoal,
    weightChange, weightHistory, weeklyCalories
  };
}

/* =========================================================================
   도우미 및 API 함수들
   ========================================================================= */

function getMembers() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.members);
  return sheet ? sheet.getDataRange().getValues() : [];
}

function getTrainers() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.trainers);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  return rows.slice(1).map(r => ({
    id: String(r[0]).trim(), name: r[1], gender: r[2], age: r[3],
    specialty: r[4], ptRate: Number(r[5]) || 0,
    certifications: r[6], assignedCount: Number(r[7]) || 0, status: r[8]
  }));
}

function getPTSchedule(userId, role) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.pt);
  if (!sheet) return [];
  return sheet.getDataRange().getValues();
}

function getEquipment(category) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.equipment);
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const rows  = range.getValues();
  const rich  = range.getRichTextValues();

  for (let i = 1; i < rows.length; i++) {
    [6, 12, 13].forEach(col => {
      if (rich[i] && rich[i][col]) {
        const link   = rich[i][col].getLinkUrl();
        const rawUrl = link || String(rows[i][col] || '');
        if (!rawUrl) return;

        if (col === 13) {
          const m = rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                    rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                    rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
          rows[i][col] = m ? "https://lh3.googleusercontent.com/d/" + m[1] : rawUrl;
        } else {
          if (link) rows[i][col] = link;
        }
      }
    });
  }
  return rows;
}

function getPayments(userId, role) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.payments);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  return rows.map(r =>
    r.map(cell =>
      cell instanceof Date
        ? Utilities.formatDate(cell, 'GMT+9', 'yyyy-MM-dd')
        : cell
    )
  );
}

// ── 운동 기록 CRUD ──────────────────────────────────────────

function getWorkouts(userId) {
  if (!userId) return { error: 'userId is required' };
  const props = PropertiesService.getScriptProperties();
  let workouts = [];
  try {
    const raw = props.getProperty(`workout_${userId}`);
    if (raw) workouts = JSON.parse(raw);
  } catch(e) {}
  workouts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return workouts;
}

function saveWorkout(body) {
  const key   = `workout_${body.userId}`;
  const props = PropertiesService.getScriptProperties();
  let workouts = [];
  try {
    const raw = props.getProperty(key);
    if (raw) workouts = JSON.parse(raw);
  } catch(e) {}
  body.id = `w_${new Date().getTime()}_${Math.random().toString(36).substr(2, 6)}`;
  workouts.push(body);
  props.setProperty(key, JSON.stringify(workouts));
  return { success: true, id: body.id };
}

function updateWorkout(body) {
  const key   = `workout_${body.userId}`;
  const props = PropertiesService.getScriptProperties();
  let workouts = [];
  try {
    const raw = props.getProperty(key);
    if (raw) workouts = JSON.parse(raw);
  } catch(e) {}
  const idx = workouts.findIndex(w => w.id === body.id);
  if (idx !== -1) workouts[idx] = body;
  props.setProperty(key, JSON.stringify(workouts));
  return { success: true };
}

function deleteWorkout(body) {
  const key   = `workout_${body.userId}`;
  const props = PropertiesService.getScriptProperties();
  let workouts = [];
  try {
    const raw = props.getProperty(key);
    if (raw) workouts = JSON.parse(raw);
  } catch(e) {}
  workouts = workouts.filter(w => w.id !== body.id);
  props.setProperty(key, JSON.stringify(workouts));
  return { success: true };
}

// ── 신체 측정 CRUD ─────────────────────────────────────────

function getBodyData(userId) {
  if (!userId) return { error: 'userId is required' };
  const props = PropertiesService.getScriptProperties();
  let bodyData = [];
  try {
    const raw = props.getProperty(`body_${userId}`);
    if (raw) bodyData = JSON.parse(raw);
  } catch(e) {}
  bodyData.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return bodyData;
}

function saveBodyData(body) {
  const key   = `body_${body.userId}`;
  const props = PropertiesService.getScriptProperties();
  let bodyData = [];
  try {
    const raw = props.getProperty(key);
    if (raw) bodyData = JSON.parse(raw);
  } catch(e) {}
  body.id = `b_${new Date().getTime()}_${Math.random().toString(36).substr(2, 6)}`;
  bodyData.push(body);
  props.setProperty(key, JSON.stringify(bodyData));
  return { success: true, id: body.id };
}

function updateBodyData(body) {
  const key   = `body_${body.userId}`;
  const props = PropertiesService.getScriptProperties();
  let bodyData = [];
  try {
    const raw = props.getProperty(key);
    if (raw) bodyData = JSON.parse(raw);
  } catch(e) {}
  const idx = bodyData.findIndex(d => d.id === body.id);
  if (idx !== -1) bodyData[idx] = body;
  props.setProperty(key, JSON.stringify(bodyData));
  return { success: true };
}

function deleteBodyData(body) {
  const key   = `body_${body.userId}`;
  const props = PropertiesService.getScriptProperties();
  let bodyData = [];
  try {
    const raw = props.getProperty(key);
    if (raw) bodyData = JSON.parse(raw);
  } catch(e) {}
  bodyData = bodyData.filter(d => d.id !== body.id);
  props.setProperty(key, JSON.stringify(bodyData));
  return { success: true };
}

// ── 식단 CRUD ──────────────────────────────────────────────

function getDiet(userId, date) {
  if (!userId) return { error: 'userId is required' };
  const props = PropertiesService.getScriptProperties();
  let dietData = [];
  try {
    const raw = props.getProperty(`diet_${userId}`);
    if (raw) dietData = JSON.parse(raw);
  } catch(e) {}
  return date ? dietData.filter(d => d.date === date) : dietData;
}

function saveDiet(body) {
  const key   = `diet_${body.userId}`;
  const props = PropertiesService.getScriptProperties();
  let dietData = [];
  try {
    const raw = props.getProperty(key);
    if (raw) dietData = JSON.parse(raw);
  } catch(e) {}
  body.id = `d_${new Date().getTime()}_${Math.random().toString(36).substr(2, 6)}`;
  dietData.push(body);
  props.setProperty(key, JSON.stringify(dietData));
  return { success: true, id: body.id };
}

function updateDiet(body) {
  const key   = `diet_${body.userId}`;
  const props = PropertiesService.getScriptProperties();
  let dietData = [];
  try {
    const raw = props.getProperty(key);
    if (raw) dietData = JSON.parse(raw);
  } catch(e) {}
  const idx = dietData.findIndex(d => d.id === body.id);
  if (idx !== -1) dietData[idx] = body;
  props.setProperty(key, JSON.stringify(dietData));
  return { success: true };
}

function deleteDiet(body) {
  const key   = `diet_${body.userId}`;
  const props = PropertiesService.getScriptProperties();
  let dietData = [];
  try {
    const raw = props.getProperty(key);
    if (raw) dietData = JSON.parse(raw);
  } catch(e) {}
  dietData = dietData.filter(d => d.id !== body.id);
  props.setProperty(key, JSON.stringify(dietData));
  return { success: true };
}

// ── PT 조회 및 계약 신청 ──────────────────────────────────────

function getPT(userId, role) {
  if (!userId) return { contracts: [], nextSchedule: null };
  const ss      = SpreadsheetApp.openById(SHEET_ID);
  const ptSheet = ss.getSheetByName(SHEET_NAMES.pt);
  if (!ptSheet) return { contracts: [], nextSchedule: null };

  // userId로 회원명 조회 (memberId가 비어있는 구 데이터 폴백용)
  let memberName = '';
  try {
    const memSheet = ss.getSheetByName(SHEET_NAMES.members);
    if (memSheet) {
      const memRows = memSheet.getDataRange().getValues();
      for (let i = 1; i < memRows.length; i++) {
        if (String(memRows[i][0]).trim() === String(userId).trim()) {
          memberName = String(memRows[i][1]).trim();
          break;
        }
      }
    }
  } catch(e) {}

  const rows      = ptSheet.getDataRange().getValues();
  const contracts = [];
  for (let i = 1; i < rows.length; i++) {
    const r        = rows[i];
    const rMemberId   = String(r[3]).trim();
    const rMemberName = String(r[4]).trim();
    const matches = rMemberId === String(userId).trim()
                 || (rMemberId === '' && memberName && rMemberName === memberName);
    if (!matches) continue;
    contracts.push({
      ptId: r[0], trainerId: r[1], trainerName: r[2],
      memberId: r[3], memberName: r[4],
      totalSessions:     Number(r[5])  || 0,
      remainingSessions: Number(r[6])  || 0,
      completedSessions: Number(r[7])  || 0,
      days: r[8], time: r[9],
      startDate: r[10] ? Utilities.formatDate(new Date(r[10]), 'GMT+9', 'yyyy-MM-dd') : '',
      endDate:   r[11] ? Utilities.formatDate(new Date(r[11]), 'GMT+9', 'yyyy-MM-dd') : '',
      attendanceRate: Number(r[12]) || 0,
      status: r[13]
    });
  }

  let nextSchedule = null;
  const active = contracts.find(c => c.status === '진행중');
  if (active) {
    const today  = new Date();
    const dayMap = { '일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6 };
    const ptDays = String(active.days || '').split(',').map(d => dayMap[d.trim()]).filter(n => n !== undefined);
    const todayDow = today.getDay();
    let minDiff = 8;
    ptDays.forEach(dow => {
      let diff = dow - todayDow;
      if (diff <= 0) diff += 7;
      if (diff < minDiff) minDiff = diff;
    });
    if (minDiff < 8) {
      const nextDate = new Date(today.getTime() + minDiff * 86400000);
      nextSchedule = {
        date: Utilities.formatDate(nextDate, 'GMT+9', 'yyyy-MM-dd'),
        time: active.time,
        trainerName: active.trainerName
      };
    }
  }

  return { contracts, nextSchedule };
}

// ── 트레이너 대시보드 ──────────────────────────────────────────

function getTrainerSchedule(trainerId) {
  if (!trainerId) return { slots: {}, workDays: [], workHours: [] };

  const allDays   = ['월','화','수','목','금','토','일'];
  const workDays  = ['월','화','수','목','금'];
  const workHours = ['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

  // trainerId로 trainerName 조회 (구 데이터 폴백용)
  let trainerName = '';
  try {
    const ss2     = SpreadsheetApp.openById(SHEET_ID);
    const trSheet = ss2.getSheetByName(SHEET_NAMES.trainers);
    if (trSheet) {
      const trRows = trSheet.getDataRange().getValues();
      for (let i = 1; i < trRows.length; i++) {
        if (String(trRows[i][0]).trim() === String(trainerId).trim()) {
          trainerName = String(trRows[i][1]).trim();
          break;
        }
      }
    }
  } catch(e) {}

  const booked = {};
  try {
    const ss      = SpreadsheetApp.openById(SHEET_ID);
    const ptSheet = ss.getSheetByName(SHEET_NAMES.pt);
    if (ptSheet) {
      const rows = ptSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        const r          = rows[i];
        const rTrainerId   = String(r[1]).trim();
        const rTrainerName = String(r[2]).trim();
        const matchTrainer = rTrainerId === String(trainerId).trim()
                          || (trainerName && rTrainerName === trainerName);
        if (!matchTrainer) continue;
        if (String(r[13]).trim() !== '진행중') continue;
        const days = String(r[8] || '').split(',').map(d => d.trim()).filter(d => d);
        const time = String(r[9] || '').trim();
        days.forEach(day => {
          if (!booked[day]) booked[day] = [];
          if (time && !booked[day].includes(time)) booked[day].push(time);
        });
      }
    }
  } catch(e) { Logger.log(e); }

  const slots = {};
  allDays.forEach(day => {
    slots[day] = {};
    workHours.forEach(time => {
      if (!workDays.includes(day)) {
        slots[day][time] = 'off';
      } else {
        slots[day][time] = (booked[day] || []).includes(time) ? 'booked' : 'available';
      }
    });
  });

  return { trainerId, slots, workDays, workHours };
}

function getTrainerDashboard(trainerId) {
  if (!trainerId) return { members: [], stats: {}, weeklySchedule: {} };
  const ss       = SpreadsheetApp.openById(SHEET_ID);
  const ptSheet  = ss.getSheetByName(SHEET_NAMES.pt);
  const memSheet = ss.getSheetByName(SHEET_NAMES.members);
  if (!ptSheet || !memSheet) return { members: [], stats: {}, weeklySchedule: {} };

  // trainerId로 trainerName 조회 (구 데이터 폴백용)
  let trainerName = '';
  try {
    const trSheet = ss.getSheetByName(SHEET_NAMES.trainers);
    if (trSheet) {
      const trRows = trSheet.getDataRange().getValues();
      for (let i = 1; i < trRows.length; i++) {
        if (String(trRows[i][0]).trim() === String(trainerId).trim()) {
          trainerName = String(trRows[i][1]).trim();
          break;
        }
      }
    }
  } catch(e) {}

  const ptRows  = ptSheet.getDataRange().getValues();
  const members = [];

  for (let i = 1; i < ptRows.length; i++) {
    const r = ptRows[i];
    const rTrainerId   = String(r[1]).trim();
    const rTrainerName = String(r[2]).trim();
    const matchTrainer = rTrainerId === String(trainerId).trim()
                      || (trainerName && rTrainerName === trainerName);
    if (!matchTrainer) continue;
    if (String(r[13]).trim() !== '진행중') continue;
    members.push({
      memberId: r[3], memberName: r[4], ptId: r[0],
      totalSessions:     Number(r[5])  || 0,
      remainingSessions: Number(r[6])  || 0,
      completedSessions: Number(r[7])  || 0,
      days: r[8], time: r[9],
      attendanceRate: Number(r[12]) || 0,
      status: r[13]
    });
  }

  const weeklySchedule = {};
  members.forEach(m => {
    String(m.days || '').split(',').map(d => d.trim()).forEach(day => {
      if (!day) return;
      if (!weeklySchedule[day]) weeklySchedule[day] = [];
      weeklySchedule[day].push({ ptId: m.ptId, memberId: m.memberId, memberName: m.memberName, time: m.time });
    });
    Object.keys(weeklySchedule).forEach(day => {
      weeklySchedule[day].sort((a, b) => a.time.localeCompare(b.time));
    });
  });

  const stats = {
    memberCount:        members.length,
    weeklySessionCount: Object.values(weeklySchedule).reduce((s, arr) => s + arr.length, 0),
    avgAttendance:      members.length ? Math.round(members.reduce((s, m) => s + m.attendanceRate, 0) / members.length) : 0,
    totalRemaining:     members.reduce((s, m) => s + m.remainingSessions, 0)
  };

  return { members, stats, weeklySchedule };
}

function markAttendance(body) {
  const ss      = SpreadsheetApp.openById(SHEET_ID);
  const ptSheet = ss.getSheetByName(SHEET_NAMES.pt);
  if (!ptSheet) return { success: false, message: 'PT 시트 없음' };

  const rows = ptSheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() !== String(body.ptId).trim()) continue;
    const remaining  = Math.max(0, (Number(rows[i][6]) || 0) - 1);
    const completed  = (Number(rows[i][7]) || 0) + 1;
    const total      = Number(rows[i][5]) || 0;
    const attendance = total > 0 ? Math.round((completed / total) * 100) : 0;
    ptSheet.getRange(i + 1, 7).setValue(remaining);
    ptSheet.getRange(i + 1, 8).setValue(completed);
    ptSheet.getRange(i + 1, 13).setValue(attendance);
    if (remaining === 0) ptSheet.getRange(i + 1, 14).setValue('완료');
    return { success: true };
  }
  return { success: false, message: 'PT 계약을 찾을 수 없습니다.' };
}

function addMember(body) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.members);
  if (!sheet) return { success: false, message: '회원명단 시트 없음' };
  const memberId = `M${new Date().getTime()}`;
  const today    = Utilities.formatDate(new Date(), 'GMT+9', 'yyyy-MM-dd');
  sheet.appendRow([
    memberId, body.name, body.gender || '', body.age || '',
    body.grade || '일반회원', today, body.expiry || '',
    body.trainer || '', body.phone || '', '활동중'
  ]);
  return { success: true, memberId };
}

function addPayment(body) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.payments);
  if (!sheet) return { success: false, message: '결제내역 시트 없음' };

  const payId = `PAY_${new Date().getTime()}`;
  const today = Utilities.formatDate(new Date(), 'GMT+9', 'yyyy-MM-dd');
  // 실제 시트 컬럼 순서: A=결제ID, B=회원ID, C=회원명, D=결제일, E=항목, F=금액, G=결제수단, H=미수금, I=처리상태, J=담당자, K=비고
  sheet.appendRow([
    payId,
    body.memberId   || '',
    body.memberName || '',
    body.payDate    || today,
    body.product    || '',
    Number(body.amount) || 0,
    body.payMethod  || '',
    0,
    body.status     || '완료',
    '관리자',
    ''
  ]);
  return { success: true, payId };
}

function updatePayment(body) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.payments);
  if (!sheet) return { success: false, message: '결제내역 시트 없음' };
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(body.payId).trim()) {
      sheet.getRange(i + 1, 9).setValue('완료');
      return { success: true };
    }
  }
  return { success: false, message: '결제 내역을 찾을 수 없습니다.' };
}

function updateEquipmentStatus(body) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.equipment);
  if (!sheet) return { success: false, message: '기구 시트 없음' };
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(body.equipId).trim()) {
      sheet.getRange(i + 1, 5).setValue(body.status);
      return { success: true };
    }
  }
  return { success: false, message: '기구를 찾을 수 없습니다.' };
}

function assignTrainer(body) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.members);
  if (!sheet) return { success: false, message: '회원명단 시트 없음' };
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(body.memberId).trim()) {
      sheet.getRange(i + 1, 8).setValue(body.trainerName || '');
      return { success: true };
    }
  }
  return { success: false, message: '회원을 찾을 수 없습니다.' };
}

function registerPT(body) {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // 회원명 조회
  let memberName = body.memberName || '';
  if (!memberName) {
    const memSheet = ss.getSheetByName(SHEET_NAMES.members);
    if (memSheet) {
      const rows = memSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === String(body.userId).trim()) {
          memberName = rows[i][1];
          break;
        }
      }
    }
  }

  // 6_PT신청대기에 신청 행 추가 (트레이너가 승인하기 전까지 대기)
  // 컬럼: 신청ID(A), 회원명(B), 트레이너ID(C), 트레이너명(D), 신청일시(E), 상태(F), 회원ID(G), 선호요일(H), 선호시간(I), 선호세션수(J)
  const reqSheet = ss.getSheetByName(SHEET_NAMES.ptRequests);
  if (!reqSheet) return { success: false, message: 'PT신청 시트 없음' };

  const reqId = `PTREQ_${new Date().getTime()}`;
  const now   = Utilities.formatDate(new Date(), 'GMT+9', 'yyyy-MM-dd HH:mm');
  reqSheet.appendRow([
    reqId,
    memberName,
    body.trainerId   || '',
    body.trainerName || '',
    now,
    '대기중',
    body.userId      || '',
    body.days        || '',
    body.time        || '',
    Number(body.sessions) || 0
  ]);
  // 선호시간 셀을 텍스트 형식으로 강제 지정 (Google Sheets 자동 날짜 변환 방지)
  const lastRow = reqSheet.getLastRow();
  reqSheet.getRange(lastRow, 9).setNumberFormat('@STRING@');
  reqSheet.getRange(lastRow, 9).setValue(String(body.time || ''));

  return { success: true };
}

// ── PT 신청 관련 함수 ──────────────────────────────────────────

/**
 * 6_PT신청대기 시트에서 상태가 "대기중"인 신청 목록 반환
 * trainerId 지정 시 해당 트레이너 신청만 반환 (트레이너 화면용)
 * trainerId 미지정 시 전체 반환 (관리자 화면용)
 */
function getPTRequests(trainerId) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.ptRequests);
  if (!sheet) return [];
  const rows  = sheet.getDataRange().getValues();

  return rows.slice(1)
    .filter(r => {
      if (String(r[5]).trim() !== '대기중') return false;
      if (trainerId && String(r[2]).trim() !== String(trainerId).trim()) return false;
      return true;
    })
    .map(r => {
      const applyDate = r[4];
      const formatted = (applyDate instanceof Date)
        ? Utilities.formatDate(applyDate, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
        : String(applyDate);
      return {
        신청ID:    r[0],
        회원명:    r[1],
        트레이너ID: r[2],
        트레이너명: r[3],
        신청일시:  formatted,
        상태:      r[5],
        회원ID:    r[6] || '',
        선호요일:  r[7] || '',
        선호시간:  r[8] instanceof Date
          ? Utilities.formatDate(r[8], 'GMT', 'HH:mm')
          : String(r[8] || ''),
        선호세션수: Number(r[9]) || 0
      };
    });
}

/**
 * 6_PT신청대기 시트의 신청 상태를 업데이트 (승인 / 거절)
 */
function updatePTRequest(body) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAMES.ptRequests);
  if (!sheet) return { success: false, message: 'PT신청 시트 없음' };
  const rows  = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(body.신청ID).trim()) {
      sheet.getRange(i + 1, 6).setValue(body.상태);
      return { success: true };
    }
  }
  return { success: false, message: '신청 내역을 찾을 수 없습니다.' };
}

/**
 * PT 회원을 일반회원으로 전환하고 담당 트레이너 배정을 해제
 */
function removePTMember(body) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);

  // 1) 2_회원명단: 등급 → 일반회원, 배정 트레이너 해제
  const sheet = ss.getSheetByName(SHEET_NAMES.members);
  if (!sheet) return { success: false, message: '회원 시트 없음' };
  const rows  = sheet.getDataRange().getValues();
  let memberName = '';

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(body.memberId).trim()) {
      memberName = rows[i][1];
      sheet.getRange(i + 1, 5).setValue('일반회원'); // E열 = 등급
      sheet.getRange(i + 1, 8).setValue('');          // H열 = 배정 트레이너
      break;
    }
  }

  // 2) 3_PT일정: 해당 회원의 진행중 계약 → '취소' 상태로 변경
  const ptSheet = ss.getSheetByName(SHEET_NAMES.pt);
  if (ptSheet) {
    const ptRows = ptSheet.getDataRange().getValues();
    for (let i = 1; i < ptRows.length; i++) {
      const isMember = String(ptRows[i][3]).trim() === String(body.memberId).trim()
                    || (memberName && String(ptRows[i][4]).trim() === String(memberName).trim());
      if (isMember && String(ptRows[i][13]).trim() === '진행중') {
        ptSheet.getRange(i + 1, 14).setValue('취소'); // N열 = status
      }
    }
  }

  return { success: true };
}

/**
 * PT 신청을 승인하고 PT 계약을 등록합니다.
 * 1) 6_PT신청대기 시트의 상태(F열)를 '승인'으로 변경
 * 2) 3_PT일정 시트에 새 PT 계약 행을 추가
 * 3) 2_회원명단 시트의 회원 등급을 'PT회원'으로 변경
 *
 * body: { 신청ID, 트레이너ID, 트레이너명, 회원명, 세션수, 요일, 시간, 시작일, 금액, 메모 }
 */
function approvePTRequest(body) {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // 1) 신청 상태 → '승인'
  const reqSheet = ss.getSheetByName(SHEET_NAMES.ptRequests);
  if (!reqSheet) return { success: false, message: 'PT신청 시트 없음' };

  const reqRows = reqSheet.getDataRange().getValues();
  let memberNameFromSheet = body.회원명;
  let memberIdFromSheet   = '';
  let found = false;

  for (let i = 1; i < reqRows.length; i++) {
    if (String(reqRows[i][0]).trim() === String(body.신청ID).trim()) {
      reqSheet.getRange(i + 1, 6).setValue('승인');
      memberNameFromSheet = reqRows[i][1] || body.회원명;
      memberIdFromSheet   = reqRows[i][6] || '';   // G열 = 회원ID
      found = true;
      break;
    }
  }
  if (!found) return { success: false, message: '신청ID를 찾을 수 없습니다: ' + body.신청ID };

  // 2) 3_PT일정 시트에 새 계약 행 추가
  // 컬럼: ptId(A), trainerId(B), trainerName(C), memberId(D), memberName(E),
  //       totalSessions(F), remainingSessions(G), completedSessions(H),
  //       days(I), time(J), startDate(K), endDate(L), attendanceRate(M), status(N)
  const ptSheet = ss.getSheetByName(SHEET_NAMES.pt);
  if (!ptSheet) return { success: false, message: 'PT일정 시트 없음' };

  const ptId    = `PT_${new Date().getTime()}`;
  const sessions = Number(body.세션수) || 0;
  ptSheet.appendRow([
    ptId,
    body.트레이너ID   || '',
    body.트레이너명   || '',
    memberIdFromSheet,           // memberId: 신청 데이터의 G열에서 조회
    memberNameFromSheet,
    sessions,
    sessions,
    0,
    body.요일    || '',
    body.시간    || '',
    body.시작일  || '',
    '',                          // endDate: 미정
    0,
    '진행중'
  ]);

  // 3) 회원명단에서 해당 회원 등급 → 'PT회원', 배정트레이너 업데이트
  const memSheet = ss.getSheetByName(SHEET_NAMES.members);
  if (memSheet) {
    const memRows = memSheet.getDataRange().getValues();
    for (let i = 1; i < memRows.length; i++) {
      if (String(memRows[i][1]).trim() === String(memberNameFromSheet).trim()) {
        memSheet.getRange(i + 1, 5).setValue('PT회원');           // E열 = 등급
        memSheet.getRange(i + 1, 8).setValue(body.트레이너명 || ''); // H열 = 배정 트레이너
        break;
      }
    }
  }

  return { success: true, ptId: ptId };
}

// ── 기타 유틸 ──────────────────────────────────────────────────

function fixImageUrls() {
  const ws = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("4_운동기구");
  for (let i = 2; i <= 25; i++) {
    const cell = ws.getRange(i, 14);
    const rich = cell.getRichTextValue();
    let url    = rich.getLinkUrl() || rich.getText();
    let fileId = null;
    const m1   = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m1) fileId = m1[1];
    const m2   = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) fileId = m2[1];
    if (fileId) cell.setValue("https://lh3.googleusercontent.com/d/" + fileId);
  }
  SpreadsheetApp.getUi().alert("완료!");
}
