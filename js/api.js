/**
 * 아이언핏 GYM - API 통신 모듈 (api.js)
 * 
 * Google Apps Script Web App과 연동하여 데이터를 읽고(GET) 씁니다(POST).
 * Apps Script API 통신 시 발생하는 CORS 및 Redirect(302)를 원활하게 처리합니다.
 */

/**
 * 로딩 인디케이터 표시 제어
 * @param {boolean} show 
 */
function toggleLoading(show) {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

/**
 * API 호출 공통 GET 함수
 */
async function callGet(action, params = {}) {
  // [CORS & 개발 편의성 보완] GAS_URL이 설정되지 않은 상태(플레이스홀더)라면
  // 에러 팝업으로 차단하지 않고, 로컬 테스트가 가능하도록 "MOCK 데이터 모드"로 자동 전환 작동합니다.
  if (!CONFIG || CONFIG.GAS_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
    console.warn(`[IRONFIT MOCK GET] Action: ${action}. GAS_URL이 비어있어 로컬 모의 데이터를 반환합니다.`);
    return new Promise((resolve) => {
      toggleLoading(true);
      setTimeout(() => {
        toggleLoading(false);
        resolve(handleMockGet(action, params));
      }, 500); // 실제 API 통신 느낌을 주기 위해 0.5초의 마이크로 딜레이 부여
    });
  }

  toggleLoading(true);

  try {
    const queryParams = new URLSearchParams({
      action: action,
      ...params
    });

    const url = `${CONFIG.GAS_URL}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.status === 200) {
      return result.data;
    } else {
      throw new Error(result.data?.error || result.data?.message || '알 수 없는 서버 오류');
    }

  } catch (error) {
    console.error(`[API GET ERROR] Action: ${action}`, error);
    alert(`서버 통신 실패: ${error.message}`);
    throw error;
  } finally {
    toggleLoading(false);
  }
}

/**
 * API 호출 공통 POST 함수
 */
async function callPost(action, body = {}) {
  // [CORS & 개발 편의성 보완] GAS_URL이 설정되지 않은 상태(플레이스홀더)라면
  // 에러 팝업으로 차단하지 않고, 로컬 테스트가 가능하도록 "MOCK 데이터 모드"로 자동 전환 작동합니다.
  if (!CONFIG || CONFIG.GAS_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE') {
    console.warn(`[IRONFIT MOCK POST] Action: ${action}. GAS_URL이 비어있어 로컬 모의 처리를 실행합니다.`);
    return new Promise((resolve) => {
      toggleLoading(true);
      setTimeout(() => {
        toggleLoading(false);
        resolve(handleMockPost(action, body));
      }, 600); // 0.6초 딜레이
    });
  }

  toggleLoading(true);

  try {
    const requestBody = {
      action: action,
      ...body
    };

    const response = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.status === 200) {
      return result.data;
    } else {
      throw new Error(result.data?.error || result.data?.message || '알 수 없는 서버 오류');
    }

  } catch (error) {
    console.error(`[API POST ERROR] Action: ${action}`, error);
    alert(`서버 데이터 전송 실패: ${error.message}`);
    throw error;
  } finally {
    toggleLoading(false);
  }
}

/**
 * ==========================================================================
 * 로컬 테스트 전용 모의(Mock) 데이터 처리 로직
 * (배포 이전에도 퍼블리싱 시안 및 프론트엔드 연동을 원활히 테스트하도록 도움을 줍니다.)
 * ==========================================================================
 */

// 세션 중 추가/수정/삭제가 반영되는 인메모리 신체 측정 저장소
const MOCK_BODY = {
  user: [
    { id: 'b_seed_1', userId: 'user', date: '2026-01-10', weight: 76.2, fat: 22.5, muscle: 30.1, waist: 84, memo: '측정 시작일' },
    { id: 'b_seed_2', userId: 'user', date: '2026-02-08', weight: 75.0, fat: 21.8, muscle: 30.5, waist: 83, memo: '' },
    { id: 'b_seed_3', userId: 'user', date: '2026-03-05', weight: 74.1, fat: 21.0, muscle: 31.0, waist: 81, memo: '스쿼트 늘린 효과' },
    { id: 'b_seed_4', userId: 'user', date: '2026-04-02', weight: 73.5, fat: 20.2, muscle: 31.8, waist: 80, memo: '' },
    { id: 'b_seed_5', userId: 'user', date: '2026-05-01', weight: 72.8, fat: 19.5, muscle: 32.3, waist: 78, memo: '목표 체중 근접!' },
    { id: 'b_seed_6', userId: 'user', date: '2026-05-28', weight: 72.3, fat: 18.9, muscle: 32.8, waist: 77, memo: '' },
  ]
};

function getMockBodyData(userId) {
  if (!MOCK_BODY[userId]) MOCK_BODY[userId] = [];
  return MOCK_BODY[userId];
}

// 세션 중 추가/수정/삭제가 반영되는 인메모리 식단 기록 저장소
const MOCK_DIET = {
  user: [
    { id: 'd_seed_1', userId: 'user', date: '2026-05-30', meal: '아침', food: '오트밀',         kcal: 350, carb: 55,  protein: 12, fat: 8,  memo: '바나나 슬라이스 추가', photo: null },
    { id: 'd_seed_2', userId: 'user', date: '2026-05-30', meal: '아침', food: '삶은 달걀 2개',  kcal: 155, carb: 1,   protein: 13, fat: 11, memo: '', photo: null },
    { id: 'd_seed_3', userId: 'user', date: '2026-05-30', meal: '점심', food: '닭가슴살 샐러드', kcal: 420, carb: 25,  protein: 45, fat: 12, memo: '', photo: null },
    { id: 'd_seed_4', userId: 'user', date: '2026-05-30', meal: '점심', food: '현미밥',          kcal: 320, carb: 68,  protein: 6,  fat: 2,  memo: '', photo: null },
    { id: 'd_seed_5', userId: 'user', date: '2026-05-30', meal: '간식', food: '프로틴 쉐이크',   kcal: 180, carb: 8,   protein: 30, fat: 3,  memo: 'ON Gold Standard', photo: null },
    { id: 'd_seed_6', userId: 'user', date: '2026-05-29', meal: '아침', food: '그릭 요거트',     kcal: 150, carb: 10,  protein: 20, fat: 2,  memo: '', photo: null },
    { id: 'd_seed_7', userId: 'user', date: '2026-05-29', meal: '점심', food: '비빔밥',          kcal: 650, carb: 95,  protein: 25, fat: 15, memo: '고추장 조금만', photo: null },
    { id: 'd_seed_8', userId: 'user', date: '2026-05-29', meal: '저녁', food: '연어 스테이크',   kcal: 480, carb: 5,   protein: 42, fat: 28, memo: '', photo: null },
    { id: 'd_seed_9', userId: 'user', date: '2026-05-29', meal: '저녁', food: '찐 브로콜리',     kcal: 55,  carb: 10,  protein: 4,  fat: 1,  memo: '', photo: null },
  ]
};

function getMockDiet(userId, date) {
  if (!MOCK_DIET[userId]) MOCK_DIET[userId] = [];
  return date
    ? MOCK_DIET[userId].filter(d => d.date === date)
    : MOCK_DIET[userId];
}

// 세션 중 추가/수정/삭제가 반영되는 인메모리 운동 기록 저장소
const MOCK_WORKOUTS = {
  user: [
    { id: 'w_seed_1', userId: 'user', date: '2026-05-28', exercise: '벤치프레스',       part: '가슴', sets: 4, weight: 80,  reps: 10, memo: '폼 개선 중, 어깨 안 쓰려고 집중' },
    { id: 'w_seed_2', userId: 'user', date: '2026-05-28', exercise: '인클라인 덤벨프레스', part: '가슴', sets: 3, weight: 22,  reps: 12, memo: '' },
    { id: 'w_seed_3', userId: 'user', date: '2026-05-26', exercise: '스쿼트',           part: '하체', sets: 5, weight: 100, reps: 8,  memo: '100kg 돌파! 무게 증량 성공' },
    { id: 'w_seed_4', userId: 'user', date: '2026-05-26', exercise: '레그프레스',        part: '하체', sets: 4, weight: 180, reps: 12, memo: '' },
    { id: 'w_seed_5', userId: 'user', date: '2026-05-24', exercise: '데드리프트',        part: '등',  sets: 4, weight: 120, reps: 5,  memo: '' },
    { id: 'w_seed_6', userId: 'user', date: '2026-05-24', exercise: '풀업',             part: '등',  sets: 3, weight: 0,   reps: 10, memo: '보조 없이 성공!' },
    { id: 'w_seed_7', userId: 'user', date: '2026-05-22', exercise: '오버헤드프레스',    part: '어깨', sets: 4, weight: 50,  reps: 10, memo: '' },
    { id: 'w_seed_8', userId: 'user', date: '2026-05-20', exercise: '런닝머신',          part: '유산소', sets: 1, weight: 0, reps: 30, memo: '30분 7.5km/h 유지' },
  ]
};

function getMockWorkouts(userId) {
  if (!MOCK_WORKOUTS[userId]) MOCK_WORKOUTS[userId] = [];
  return MOCK_WORKOUTS[userId];
}

// 세션 중 승인/거절이 반영되는 인메모리 PT 신청 대기 저장소
const MOCK_PT_REQUESTS = [
  { 신청ID: 'PTREQ001', 회원명: '홍길동', 트레이너ID: 'T001', 트레이너명: '김코치', 신청일시: '2026-06-10 14:30', 상태: '대기중' },
  { 신청ID: 'PTREQ002', 회원명: '김영희', 트레이너ID: 'T002', 트레이너명: '이지수', 신청일시: '2026-06-11 10:00', 상태: '대기중' },
];

function handleMockGet(action, params) {
  switch (action) {
    case 'getDashboard':
      return {
        attendanceCount: 14,
        attendanceGoal: 20,
        ptRemaining: 8,
        ptTotal: 20,
        todayCalories: 1650,
        calorieGoal: 2000,
        weightChange: -1.4,
        weightHistory: {
          labels: ["05-01", "05-05", "05-10", "05-15", "05-20", "05-25", "05-28"],
          data: [74.2, 73.8, 73.9, 73.1, 73.2, 72.9, 72.8]
        },
        weeklyCalories: {
          labels: ["월", "화", "수", "목", "금", "토", "일"],
          data: [1950, 2100, 1850, 1650, 2200, 2400, 0]
        }
      };

    case 'getWorkouts': {
      const uid = params.userId || 'user';
      const workouts = getMockWorkouts(uid);
      return [...workouts].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    case 'getBodyData': {
      const uid = params.userId || 'user';
      const body = getMockBodyData(uid);
      return [...body].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }

    case 'getDiet': {
      const uid  = params.userId || 'user';
      const date = params.date   || null;
      return getMockDiet(uid, date);
    }

    case 'getTrainers':
      return [
        { id: 'T001', name: '김코치',  gender: '남', age: 32, specialty: '근력 트레이닝',    ptRate: 50000, certifications: 'NSCA-CPT, 생활스포츠지도사 2급', assignedCount: 4, status: '활동중' },
        { id: 'T002', name: '이지수',  gender: '여', age: 28, specialty: '다이어트·체형관리', ptRate: 45000, certifications: 'ACSM-CPT, 필라테스 지도사 1급',  assignedCount: 3, status: '활동중' },
        { id: 'T003', name: '박강훈',  gender: '남', age: 35, specialty: '재활·기능성 운동',  ptRate: 60000, certifications: 'NSCA-CSCS, 물리치료사 면허',      assignedCount: 2, status: '활동중' },
        { id: 'T004', name: '최유리',  gender: '여', age: 26, specialty: '유산소·크로스핏',   ptRate: 40000, certifications: 'CrossFit Level 2, 건강운동관리사', assignedCount: 5, status: '활동중' },
      ];

    case 'getPT': {
      const uid = params.userId || 'user';
      // user 계정은 시드 PT 계약 반환
      if (uid === 'user') {
        return {
          contracts: [
            {
              ptId: 'PT001', trainerId: 'T001', trainerName: '김코치',
              memberId: 'user', memberName: '홍길동',
              totalSessions: 20, remainingSessions: 8, completedSessions: 12,
              days: '월,수,금', time: '18:00',
              startDate: '2026-03-01', endDate: '2026-06-30',
              attendanceRate: 92, status: '진행중'
            }
          ],
          nextSchedule: { date: '2026-06-02', time: '18:00', trainerName: '김코치' }
        };
      }
      return { contracts: [], nextSchedule: null };
    }

    case 'getEquipment': {
      // 컬럼: ID, 분류(부위), 기구명(운동명), 수량, 상태, 유튜브링크, 타겟근육, 난이도, 운동방법, 주의사항, 이미지URL
      const equipRows = [
        ['ID','분류','기구명','수량','상태','유튜브링크','타겟근육','난이도','운동방법','주의사항','이미지URL'],
        // ── 가슴 ──
        ['E001','가슴','벤치프레스',2,'정상','https://youtu.be/rT7DgCr-3pg','대흉근/전삼각근/삼두','중급',
          '벤치에 누워 등 전체를 밀착시키고 발은 바닥에 고정한다. 바를 어깨 너비보다 약간 넓게 잡는다. 바를 천천히 가슴(유두선) 높이까지 내린다. 가슴 근육을 쥐어짜듯 밀어올리며 팔꿈치를 펴준다. 최상단에서 가슴을 한 번 더 수축시키고 반복한다.',
          '등이 과도하게 아치되지 않게 주의한다. 바를 내릴 때 반동을 주지 않는다. 처음엔 반드시 스팟 파트너와 함께 수행한다.',''],
        ['E002','가슴','인클라인 벤치프레스',1,'정상','https://youtu.be/DbFgADa2PL8','상부 대흉근/전삼각근','중급',
          '벤치를 30~45도로 기울인다. 바를 어깨 너비보다 약간 넓게 잡고 쇄골 아래쪽으로 내린다. 가슴 윗부분에 자극을 느끼며 밀어올린다. 밀어올릴 때 팔꿈치가 완전히 펴지지 않게 살짝 구부린다.',
          '각도가 너무 높으면 어깨 운동이 되므로 45도 이하를 유지한다. 경추에 부담이 없도록 머리를 벤치에 붙인다.',''],
        ['E003','가슴','디클라인 벤치프레스',1,'정상','','하부 대흉근/삼두','중급',
          '벤치를 15~30도 하향 경사로 맞추고 발을 고정대에 건다. 바를 하부 가슴(흉골 하단) 쪽으로 내린다. 하부 대흉근을 수축시키며 밀어올린다. 동작 내내 어깨를 벤치 쪽으로 눌러 안정시킨다.',
          '거꾸로 누운 자세이므로 혈압이 높은 경우 주의한다. 반드시 스팟 파트너와 함께 수행한다.',''],
        ['E004','가슴','덤벨 플라이',4,'정상','https://youtu.be/eozdVDA78K0','대흉근','초급',
          '벤치에 누워 덤벨을 가슴 위에서 마주 보게 들어올린다. 팔꿈치를 약 15~20도 구부린 상태로 고정한다. 호흡을 들이쉬며 덤벨을 옆으로 천천히 내린다. 가슴이 충분히 늘어난 것을 느낀 뒤 가슴을 조이며 덤벨을 다시 모은다.',
          '팔꿈치를 완전히 펴면 어깨와 팔꿈치 관절에 과부하가 걸린다. 무게보다 가슴 스트레칭 느낌에 집중한다.',''],
        ['E005','가슴','케이블 크로스오버',1,'정상','','대흉근','초급',
          '케이블 머신 중앙에 서서 양쪽 손잡이를 잡는다. 한 발을 약간 앞에 두어 균형을 잡는다. 팔을 앞으로 모아 가슴을 수축시킨다. 잠깐 멈추며 가슴을 쥐어짜고 천천히 원래 위치로 돌아간다.',
          '케이블 높이를 조절해 상·중·하부 가슴을 다양하게 자극할 수 있다. 반동을 이용하지 않는다.',''],
        ['E006','가슴','딥스',1,'정상','https://youtu.be/2z8JmcrW-As','하부 대흉근/삼두','중급',
          '딥스 바를 잡고 팔을 완전히 펴 몸을 들어올린다. 가슴 운동 시 상체를 약 30도 앞으로 숙인다. 팔꿈치를 구부리며 몸을 내리되 어깨가 팔꿈치 아래로 가지 않게 한다. 가슴 하부를 조이며 다시 밀어올린다.',
          '어깨 충돌증후군이 있는 경우 금지. 내려갈 때 어깨가 앞으로 말리지 않도록 주의한다.',''],
        ['E007','가슴','푸시업',0,'정상','','대흉근/삼두/코어','초급',
          '손을 어깨 너비보다 약간 넓게 바닥에 짚는다. 머리부터 발끝까지 일직선이 되게 자세를 잡는다. 팔꿈치를 구부려 가슴이 바닥에 거의 닿을 때까지 내린다. 가슴과 삼두 힘으로 밀어올린다.',
          '허리가 처지거나 엉덩이가 올라가지 않도록 코어를 단단히 유지한다.',''],
        ['E008','가슴','펙덱 머신',1,'정상','','대흉근','초급',
          '시트에 앉아 등을 패드에 밀착시킨다. 양팔을 패드에 올리고 팔꿈치를 90도로 구부린다. 팔을 앞으로 모아 가슴을 최대한 수축시킨다. 가슴을 쥐어짜는 느낌을 유지하며 천천히 벌린다.',
          '어깨가 앞으로 말리지 않게 등을 패드에 붙인다. 무게가 너무 무거우면 어깨 회전근개가 다칠 수 있다.',''],
        // ── 등 ──
        ['E011','등','풀업',1,'정상','https://youtu.be/eGo4IYlbE5g','광배근/이두근/코어','중급',
          '바를 어깨 너비보다 약간 넓게 오버그립으로 잡는다. 가슴을 내밀고 등을 약간 아치시킨다. 팔꿈치를 구부리며 가슴을 바에 가까이 당긴다. 광배근이 수축되는 느낌으로 몸을 끌어올린다. 천천히 내리며 팔꿈치를 완전히 펴준다.',
          '반동을 이용해 올라가지 않는다. 처음엔 어시스트 밴드를 이용해 점진적으로 부하를 늘린다.',''],
        ['E012','등','랫풀다운',1,'정상','https://youtu.be/CAwf7n6Luuc','광배근/이두근','초급',
          '시트에 앉아 허벅지 패드로 다리를 고정한다. 바를 어깨 너비보다 넓게 오버그립으로 잡는다. 상체를 약간 뒤로 젖히고 가슴을 내밀며 바를 쇄골 쪽으로 당긴다. 광배근이 수축되는 느낌을 1초 유지한 뒤 천천히 올린다.',
          '바를 머리 뒤로 당기면 경추 부상 위험이 있다. 반드시 가슴 앞으로 당긴다.',''],
        ['E013','등','바벨 로우',2,'정상','https://youtu.be/FWJR5Ve8bnQ','광배근/승모근/이두근','중급',
          '바를 어깨 너비로 잡고 무릎을 살짝 구부린다. 상체를 45~60도 앞으로 숙이고 허리를 중립 자세로 유지한다. 팔꿈치를 몸 옆으로 붙이며 바를 배꼽 쪽으로 당긴다. 등 근육이 최대로 수축될 때 1초 멈추고 천천히 내린다.',
          '허리가 굽으면 디스크 부상 위험이 있다. 허리는 항상 중립(자연스러운 아치)을 유지한다.',''],
        ['E014','등','덤벨 로우',4,'정상','','광배근','초급',
          '벤치에 한쪽 무릎과 손을 짚어 안정적인 자세를 만든다. 반대 손으로 덤벨을 잡고 팔을 아래로 늘어뜨린다. 팔꿈치를 몸 옆으로 끌어올리며 덤벨을 옆구리 쪽으로 당긴다. 광배근 수축을 느끼며 천천히 내린다.',
          '상체가 회전하지 않도록 코어를 잡는다. 팔꿈치가 너무 벌어지지 않게 몸에 붙여서 당긴다.',''],
        ['E015','등','시티드 케이블 로우',1,'정상','','광배근/승모근','초급',
          '로우 케이블에 앉아 발판에 발을 올리고 무릎을 살짝 구부린다. 상체를 곧게 세우고 손잡이를 잡는다. 팔꿈치를 뒤로 당기며 손잡이를 복부 쪽으로 가져온다. 날개뼈를 모아 등 중앙을 수축시킨 뒤 천천히 뻗는다.',
          '뻗을 때 상체가 너무 앞으로 기울어지지 않도록 한다. 허리 힘이 아닌 등 근육으로 당긴다.',''],
        ['E016','등','티바 로우',1,'정상','','광배근/대원근','중급',
          'T바 앞에 서서 핸들을 언더그립 또는 오버그립으로 잡는다. 무릎을 살짝 구부리고 상체를 45도 기울인다. 등을 곧게 유지하며 바를 복부 쪽으로 당긴다. 날개뼈를 조이며 정점에서 1초 유지한 뒤 내린다.',
          '허리 중립을 반드시 유지한다. 무거운 무게일수록 허리 부상 위험이 높으므로 벨트 착용을 권장한다.',''],
        ['E017','등','페이스 풀',1,'정상','','후삼각근/승모근/회전근개','초급',
          '케이블을 눈높이로 맞추고 로프 손잡이를 잡는다. 한 발을 앞에 두고 몸을 약간 뒤로 기울인다. 로프를 얼굴 쪽으로 당기며 손을 귀 옆으로 가져온다. 어깨 외회전을 느끼며 천천히 원위치한다.',
          '회전근개 강화와 어깨 건강에 좋은 운동이다. 무게보다는 동작의 정확성을 우선시한다.',''],
        ['E018','등','데드리프트',2,'정상','https://youtu.be/op9kVnSso6Q','전신/척추기립근/둔근/햄스트링','고급',
          '바를 발 위로 정강이에 붙여 세운다. 어깨 너비로 서고 발끝을 약 30도 바깥으로 향한다. 등을 곧게 펴고 힙을 뒤로 밀며 바를 잡는다. 바닥을 밀어낸다는 느낌으로 다리와 등을 동시에 편다. 바가 무릎을 지나면서 엉덩이를 앞으로 밀어 자세를 완성한다.',
          '허리가 굽으면 절대 안 된다. 허리 벨트 착용을 강력히 권장한다. 처음에는 반드시 트레이너 지도하에 배운다.',''],
        // ── 어깨 ──
        ['E021','어깨','오버헤드 프레스',2,'정상','https://youtu.be/2yjwXTZQDDI','전삼각근/측삼각근/삼두','중급',
          '바를 어깨 너비로 잡고 쇄골 위에 올린다. 코어를 단단히 조이고 허리를 중립으로 유지한다. 바를 머리 위로 수직으로 밀어올린다. 팔이 완전히 펴질 때 어깨를 으쓱하며 승모근까지 수축시킨다. 천천히 쇄골 위치로 내린다.',
          '허리를 뒤로 꺾으면 요추 부상 위험이 있다. 바 경로가 일직선이 되도록 머리를 약간 뒤로 뺀다.',''],
        ['E022','어깨','덤벨 숄더프레스',4,'정상','','삼각근','초급',
          '벤치에 앉거나 서서 덤벨을 귀 옆 높이로 들어올린다. 코어를 고정하고 덤벨을 머리 위로 밀어올린다. 두 덤벨이 정점에서 약간 안쪽으로 모이게 한다. 천천히 귀 옆 높이로 내린다.',
          '등받이가 있는 벤치를 사용하면 허리 부담이 줄어든다. 덤벨이 너무 뒤로 가지 않도록 주의한다.',''],
        ['E023','어깨','사이드 레터럴 레이즈',4,'정상','','측삼각근','초급',
          '덤벨을 양옆에 들고 바르게 선다. 팔꿈치를 약 10~15도 구부린 상태를 유지한다. 팔을 어깨 높이(수평)까지 옆으로 천천히 들어올린다. 새끼손가락이 엄지손가락보다 약간 높도록 손목을 돌린다. 정점에서 측삼각근을 조이며 1초 유지한 뒤 내린다.',
          '반동을 이용하면 효과가 줄어든다. 어깨 높이 이상으로 올리면 오히려 승모근이 개입된다.',''],
        ['E024','어깨','프론트 레이즈',4,'정상','','전삼각근','초급',
          '덤벨을 허벅지 앞에 들고 바르게 선다. 팔을 거의 편 상태로 앞으로 들어올린다. 어깨 높이에서 잠시 멈춘 뒤 천천히 내린다. 양팔 교대 또는 동시에 수행할 수 있다.',
          '상체가 뒤로 기울거나 반동을 이용하지 않는다. 무게보다 정확한 자세와 수축감을 우선시한다.',''],
        ['E025','어깨','리어 델트 플라이',4,'정상','','후삼각근/승모근','초급',
          '상체를 90도 앞으로 숙이거나 인클라인 벤치에 엎드린다. 덤벨을 아래로 늘어뜨린 상태에서 시작한다. 팔꿈치를 약간 구부린 채 팔을 옆으로 들어올린다. 후삼각근이 수축되는 느낌을 유지하며 정점에서 1초 멈춘다. 천천히 내린다.',
          '허리가 과하게 굽지 않도록 복압을 유지한다. 상체가 흔들리지 않게 고정한다.',''],
        ['E026','어깨','업라이트 로우',2,'정상','','삼각근/승모근','중급',
          '바를 어깨 너비보다 좁게 오버그립으로 잡는다. 팔꿈치가 손목보다 높게 유지되도록 바를 턱 방향으로 끌어올린다. 바가 가슴 중간 높이에 도달할 때까지 올린다. 천천히 내리며 어깨를 안정시킨다.',
          '손의 간격이 너무 좁으면 어깨 충돌이 발생하기 쉽다. 팔꿈치가 바보다 반드시 위에 있어야 한다.',''],
        ['E027','어깨','아놀드 프레스',4,'정상','','삼각근 전체','중급',
          '덤벨을 어깨 앞에 들어올리고 손바닥이 얼굴 쪽을 향하게 한다. 덤벨을 올리면서 손목을 외회전시켜 손바닥이 앞을 향하게 한다. 머리 위에서 덤벨이 만나도록 밀어올린다. 내릴 때는 반대로 회전하며 시작 자세로 돌아온다.',
          '회전 동작이 어깨 관절에 부담을 줄 수 있으므로 가벼운 무게로 시작한다.',''],
        // ── 이두 ──
        ['E031','이두','바벨 컬',2,'정상','https://youtu.be/kwG2ipFRgfo','상완이두근','초급',
          '바를 어깨 너비로 언더그립(손바닥 위)으로 잡는다. 팔꿈치를 몸통 옆에 고정하고 위팔이 움직이지 않게 한다. 손목을 약간 안쪽으로 향하며 바를 어깨 쪽으로 들어올린다. 정점에서 이두근을 쥐어짜고 천천히 내린다.',
          '팔꿈치가 앞으로 나오면 삼각근이 개입되어 이두 자극이 줄어든다. 반동 없이 순수한 이두 힘으로 수행한다.',''],
        ['E032','이두','덤벨 컬',4,'정상','','상완이두근','초급',
          '덤벨을 양손에 들고 손바닥이 앞을 향하게 선다. 한 팔씩 교대로 또는 동시에 덤벨을 어깨 쪽으로 들어올린다. 정점에서 잠시 멈추며 이두를 수축한다. 천천히 내리며 이두를 완전히 늘린다.',
          '상체가 흔들리지 않도록 유지한다. 무게를 내릴 때 그냥 떨어뜨리지 않고 근육으로 버티며 내린다.',''],
        ['E033','이두','해머 컬',4,'정상','','상완이두근/상완근/전완근','초급',
          '덤벨을 양옆에 들고 손등이 바깥쪽을 향하게 한다(중립 그립). 팔꿈치를 몸 옆에 고정한 채 덤벨을 어깨 쪽으로 들어올린다. 정점에서 잠시 멈추고 천천히 내린다.',
          '그립이 다르므로 일반 컬보다 전완근과 상완근에 더 많이 자극이 간다. 과부하가 되지 않게 적당한 무게로 시작한다.',''],
        ['E034','이두','케이블 컬',1,'정상','','상완이두근','초급',
          '케이블 하단 풀리에 바 또는 로프를 연결한다. 언더그립으로 잡고 팔꿈치를 몸 옆에 고정한다. 케이블을 어깨 쪽으로 당기며 이두를 수축시킨다. 케이블의 지속적인 장력을 느끼며 천천히 내린다.',
          '덤벨보다 일정한 장력이 유지되어 근육 발달에 효과적이다. 반동을 최소화한다.',''],
        ['E035','이두','프리처 컬',1,'정상','','상완이두근 하부','초급',
          '프리처 컬 패드에 팔꿈치를 올려 고정한다. 언더그립으로 EZ바 또는 덤벨을 잡는다. 팔꿈치를 구부리며 바를 어깨 쪽으로 당긴다. 천천히 팔꿈치를 완전히 펴며 내린다.',
          '팔꿈치를 완전히 펼 때 관절에 무리가 가지 않도록 주의한다. 상완이두근 하부를 집중 자극하는 운동이다.',''],
        ['E036','이두','인클라인 덤벨 컬',1,'정상','','상완이두근 전체(스트레칭 강조)','중급',
          '인클라인 벤치(60도)에 등을 대고 앉는다. 덤벨을 손바닥이 앞을 향하도록 들고 팔을 완전히 늘어뜨린다. 팔꿈치를 고정하고 덤벨을 어깨 쪽으로 당긴다. 내릴 때 이두가 완전히 늘어나는 것을 느낀다.',
          '어깨 관절이 과하게 뒤로 당겨지지 않게 주의한다. 이두 스트레칭 구간에서 효과가 크므로 천천히 내린다.',''],
        // ── 삼두 ──
        ['E041','삼두','트라이셉 푸시다운',1,'정상','https://youtu.be/2-LAMcpzODU','상완삼두근','초급',
          '케이블 상단 풀리에 일자바 또는 V바를 연결한다. 팔꿈치를 몸통 옆에 고정하고 위팔이 움직이지 않게 한다. 바를 아래로 밀어내리며 팔꿈치를 완전히 편다. 삼두가 수축되는 것을 느끼며 천천히 원위치한다.',
          '팔꿈치가 앞뒤로 움직이면 효과가 줄어든다. 상체가 구부러지지 않게 곧게 선다.',''],
        ['E042','삼두','스컬 크러셔',2,'정상','','상완삼두근','중급',
          '벤치에 누워 EZ바 또는 바벨을 어깨 너비로 잡는다. 팔꿈치를 천장을 향해 세우고 위팔을 수직으로 고정한다. 팔꿈치만 구부리며 바를 이마 쪽(또는 이마 위)으로 천천히 내린다. 삼두 힘으로 다시 밀어올린다.',
          '바를 이마에 떨어뜨리지 않도록 집중한다. 처음에는 가벼운 무게로 시작하고 파트너와 함께 수행한다.',''],
        ['E043','삼두','오버헤드 익스텐션',4,'정상','','상완삼두근 장두','초급',
          '서거나 앉아서 덤벨을 양손으로 잡아 머리 위로 든다. 위팔을 귀 옆에 고정하고 팔꿈치만 구부린다. 덤벨을 머리 뒤로 천천히 내린다. 삼두 장두를 조이며 다시 밀어올린다.',
          '위팔이 앞뒤로 흔들리지 않도록 고정한다. 어깨 유연성이 부족하면 케이블 버전으로 대체한다.',''],
        ['E044','삼두','킥백',4,'정상','','상완삼두근','초급',
          '한 손과 한 무릎을 벤치에 짚어 상체를 수평으로 만든다. 반대 손으로 덤벨을 잡고 위팔을 몸통과 수평으로 든다. 팔꿈치를 펴며 덤벨을 뒤로 뻗는다. 삼두가 수축되는 것을 느끼며 천천히 구부린다.',
          '위팔이 내려가지 않게 수평으로 유지한다. 가벼운 무게로도 충분히 삼두에 자극이 온다.',''],
        ['E045','삼두','클로즈그립 벤치프레스',2,'정상','','상완삼두근/대흉근 내측','중급',
          '벤치에 누워 바를 어깨 너비 또는 그보다 좁게(18~20cm) 잡는다. 팔꿈치를 몸통 옆에 붙이며 바를 가슴으로 내린다. 삼두와 가슴 내측 힘으로 밀어올린다. 팔꿈치가 완전히 펴질 때 삼두를 조인다.',
          '손 간격이 너무 좁으면 손목에 부담이 간다. 팔꿈치가 너무 벌어지면 가슴 운동이 된다.',''],
        // ── 하체 ──
        ['E051','하체','스쿼트',2,'정상','https://youtu.be/ultWZbUMPL8','대퇴사두근/둔근/햄스트링','중급',
          '바를 승모근 위에 얹고 발을 어깨 너비로 벌린다. 발끝을 30도 바깥으로 향하고 가슴을 편다. 엉덩이를 뒤로 빼며 무릎이 발끝 방향으로 나가게 앉는다. 허벅지가 바닥과 수평이 될 때까지 내린다. 발뒤꿈치를 바닥에 밀며 다시 일어선다.',
          '무릎이 안쪽으로 모이지 않도록 항상 발끝과 일치시킨다. 허리가 굽으면 절대 안 된다. 안전바를 반드시 설정한다.',''],
        ['E052','하체','레그프레스',1,'정상','https://youtu.be/IZxyjW7MPJQ','대퇴사두근/둔근/햄스트링','초급',
          '시트에 앉아 등과 엉덩이를 완전히 밀착시킨다. 발을 어깨 너비로 발판 중앙에 올린다. 안전 잠금장치를 해제하고 무릎을 구부리며 천천히 내린다. 허벅지가 가슴 쪽으로 올 때까지 내린 뒤 발판을 밀어낸다.',
          '허리가 시트에서 떨어지면 요추 부상 위험이 있다. 무릎을 완전히 펴면 관절에 충격이 가므로 살짝 구부린 상태를 유지한다.',''],
        ['E053','하체','런지',0,'정상','','대퇴사두근/둔근/햄스트링','초급',
          '바르게 선 후 한 발을 크게 앞으로 내딛는다. 앞 무릎이 90도가 되도록 몸을 내린다. 뒷 무릎이 바닥에 거의 닿을 때까지 내린다. 앞 발뒤꿈치를 밀며 다시 일어서서 발을 모은다. 반대 발로 반복한다.',
          '앞 무릎이 발끝보다 너무 앞으로 나오지 않도록 주의한다. 보폭이 너무 좁으면 무릎에 부담이 가므로 충분히 크게 내딛는다.',''],
        ['E054','하체','레그 익스텐션',1,'정상','','대퇴사두근','초급',
          '시트에 앉아 발목 패드를 발등 위에 올린다. 등을 등받이에 밀착하고 허벅지를 패드에 붙인다. 무릎을 펴며 다리를 수평으로 들어올린다. 대퇴사두근을 쥐어짜는 느낌으로 1초 유지한 뒤 천천히 내린다.',
          '무릎 관절에 단독 부하가 걸리므로 무릎이 약한 경우 주의한다. 반동 없이 근육 힘으로만 수행한다.',''],
        ['E055','하체','레그 컬',1,'정상','','햄스트링','초급',
          '기구에 엎드리거나 앉아서 발목 패드를 발꿈치 위에 건다. 허벅지를 패드에 고정하고 무릎을 구부리며 발꿈치를 엉덩이 쪽으로 당긴다. 햄스트링이 최대 수축될 때 1초 유지한다. 천천히 내리며 햄스트링을 늘린다.',
          '골반이 들리지 않도록 허벅지를 패드에 고정한다. 빠른 동작보다 천천히 수행해야 햄스트링에 자극이 잘 온다.',''],
        ['E056','하체','카프 레이즈',1,'정상','','비복근/가자미근','초급',
          '발볼을 발판 끝에 올리고 뒤꿈치가 내려갈 수 있게 한다. 뒤꿈치를 최대한 아래로 내려 종아리를 늘린다. 발끝으로 일어서듯 뒤꿈치를 최대한 높이 들어올린다. 정점에서 종아리를 조이며 1~2초 유지한다.',
          '동작 범위를 최대로 활용해야 효과적이다. 무릎을 약간 구부리면 가자미근이 더 활성화된다.',''],
        ['E057','하체','힙 쓰러스트',1,'정상','https://youtu.be/SEdqd1n0cvg','둔근/햄스트링','중급',
          '벤치에 어깨 날개뼈를 올리고 무릎을 90도로 구부려 앉는다. 바벨을 고관절 위에 올리고 패드를 댄다. 발뒤꿈치로 바닥을 밀며 엉덩이를 위로 들어올린다. 몸이 무릎부터 어깨까지 일직선이 될 때 둔근을 최대로 조인다. 천천히 내린다.',
          '허리를 꺾지 않고 골반을 말아올리는 느낌으로 수행한다. 바벨 패드를 반드시 사용한다.',''],
        ['E058','하체','불가리안 스플릿 스쿼트',0,'정상','','대퇴사두근/둔근/햄스트링','고급',
          '발 두 개 길이 앞에 벤치를 두고 뒷발을 벤치 위에 올린다. 앞발에 체중을 싣고 몸을 곧게 세운다. 앞 무릎을 구부리며 천천히 내려간다. 앞 무릎이 90도가 될 때까지 내린 뒤 앞 발뒤꿈치를 밀며 올라온다.',
          '균형 잡기가 어려우므로 처음에는 맨몸으로 충분히 연습한다. 앞 무릎이 안쪽으로 무너지지 않도록 주의한다.',''],
        ['E059','하체','핵 스쿼트',1,'정상','','대퇴사두근/둔근','중급',
          '핵 스쿼트 머신에 등과 어깨를 밀착시키고 발판에 발을 올린다. 안전 손잡이를 해제하고 무릎을 구부리며 내려간다. 허벅지가 수평이 될 때까지 내린 뒤 발판을 밀어 올라온다. 무릎이 발끝 방향으로 나가게 유지한다.',
          '허리가 패드에서 떨어지지 않도록 한다. 바벨 스쿼트보다 허리 부담이 적어 초보자 친화적이다.',''],
        // ── 복근 ──
        ['E061','복근','크런치',0,'정상','','복직근','초급',
          '바닥에 누워 무릎을 90도로 구부리고 발바닥을 바닥에 댄다. 손을 머리 뒤에 가볍게 올리거나 가슴에 교차한다. 허리를 바닥에 붙인 채 상체만 말아 올린다. 배꼽을 척추 쪽으로 당기는 느낌으로 수축한다. 천천히 내리되 머리가 바닥에 완전히 닿지 않게 한다.',
          '목으로 당기지 말고 복근의 수축력으로 올라온다. 윗몸일으키기처럼 완전히 올라오면 허리 부담이 생긴다.',''],
        ['E062','복근','플랭크',0,'정상','https://youtu.be/pSHjTRCQxIw','복근 전체/코어/등','초급',
          '팔꿈치를 어깨 아래에 두고 바닥을 짚는다. 발끝을 세우고 머리부터 발끝까지 일직선을 만든다. 배꼽을 척추 쪽으로 당기고 엉덩이를 조인다. 이 자세를 30초~1분 이상 유지한다.',
          '허리가 처지거나 엉덩이가 올라가지 않도록 주의한다. 호흡을 멈추지 말고 일정하게 내쉰다.',''],
        ['E063','복근','레그 레이즈',0,'정상','','하복부','초급',
          '바닥에 누워 손을 엉덩이 아래에 받쳐 허리를 지지한다. 다리를 모아 곧게 펴고 바닥에서 약 30도 들어올린다. 복근 힘으로 다리를 천장 방향으로 들어올린다. 90도 또는 그 이상까지 올린 뒤 천천히 내린다.',
          '내릴 때 허리가 바닥에서 뜨지 않게 한다. 다리가 바닥에 완전히 닿기 전에 다시 올려 복근의 긴장을 유지한다.',''],
        ['E064','복근','케이블 크런치',1,'정상','','복직근','초급',
          '케이블 상단 풀리에 로프를 연결하고 무릎을 꿇는다. 로프를 귀 옆에 잡고 상체를 곧게 세운다. 배꼽을 무릎 쪽으로 말아내리듯 상체를 구부린다. 복근이 최대로 수축될 때 잠시 멈추고 천천히 올라온다.',
          '엉덩이를 발꿈치에서 들어올리지 않는다. 케이블을 당기는 것이 아니라 복근의 수축으로 움직인다.',''],
        ['E065','복근','러시안 트위스트',0,'정상','','복사근/복직근','초급',
          '무릎을 구부리고 발을 바닥에 살짝 들어올려 균형을 잡는다. 상체를 45도 뒤로 기울인다. 양손을 모아 좌우로 교대로 상체를 회전한다. 메디신볼이나 덤벨을 들면 강도를 높일 수 있다.',
          '허리로 회전하지 말고 복사근의 수축으로 회전한다. 허리 질환이 있으면 주의한다.',''],
        ['E066','복근','행잉 레그 레이즈',1,'정상','','하복부/고관절 굴근','중급',
          '풀업 바에 매달려 팔을 완전히 편다. 하복부 힘으로 무릎을 가슴 쪽으로 당기거나 다리를 수평까지 들어올린다. 반동 없이 복근으로 천천히 내린다.',
          '처음에는 무릎을 구부려 수행하고 익숙해지면 다리를 편 채로 진행한다. 그립이 약하면 스트랩을 사용한다.',''],
        // ── 유산소 ──
        ['E071','유산소','런닝머신',3,'정상','','전신/심폐','초급',
          '속도와 경사를 목적에 맞게 설정한다. 발이 벨트 중앙에 착지하도록 자연스럽게 걷거나 뛴다. 팔을 앞뒤로 리드미컬하게 흔든다. 5분 워밍업 → 메인 운동 → 5분 쿨다운 순서로 진행한다.',
          '손잡이를 잡고 뛰면 운동 효과가 줄어든다. 착지 시 무릎 충격이 크므로 쿠션이 좋은 운동화를 착용한다.',''],
        ['E072','유산소','사이클',2,'정상','','하체/심폐','초급',
          '안장 높이를 무릎이 거의 펴지는 높이로 맞춘다. 발을 페달에 올리고 일정한 리듬으로 페달을 밟는다. 저항을 조절해 강도를 설정한다. 상체를 곧게 세우거나 핸들에 가볍게 기댄다.',
          '안장이 너무 낮으면 무릎 관절에 부담이 간다. 발을 페달에 고정하는 스트랩을 활용하면 효율이 높아진다.',''],
        ['E073','유산소','일립티컬',2,'정상','','전신/심폐','초급',
          '페달에 발을 올리고 핸들을 잡는다. 발이 타원형 궤도를 그리도록 자연스럽게 밟는다. 팔 핸들을 앞뒤로 밀고 당기며 상체도 함께 운동한다. 저항과 경사를 조절해 강도를 높인다.',
          '무릎과 발목에 충격이 거의 없어 관절 부담이 적다. 발가락 끝으로만 밟지 않고 발 전체로 페달을 밟는다.',''],
        ['E074','유산소','로잉머신',1,'정상','https://youtu.be/zAoPAXqFxWI','전신/등/심폐','중급',
          '시트에 앉아 발판에 발을 고정하고 핸들을 잡는다. 무릎을 구부리고 상체를 약간 앞으로 기울인다(캐치 자세). 다리를 밀어내며 상체를 뒤로 젖히고 핸들을 복부 쪽으로 당긴다(드라이브 자세). 팔을 앞으로 뻗으며 다시 앞으로 돌아간다.',
          '허리를 과하게 굽히거나 젖히지 않는다. 팔보다 다리 힘이 먼저 사용되어야 올바른 자세다.',''],
        ['E075','유산소','스테어클라이머',1,'정상','','하체/심폐','초급',
          '안전 손잡이를 가볍게 잡고 페달 위에 선다. 한 발씩 번갈아가며 페달을 밟아 계단을 오르는 동작을 반복한다. 속도와 저항을 조절해 강도를 설정한다. 상체를 곧게 세우고 허리를 구부리지 않는다.',
          '손잡이에 너무 의존하면 운동 효과가 줄어든다. 허벅지와 둔근을 의식하며 수행한다.',''],
        ['E076','유산소','줄넘기',2,'정상','','전신/심폐','초급',
          '줄의 길이를 발 아래 밟았을 때 손잡이가 가슴에 오도록 조절한다. 손목으로 줄을 돌리며 발을 가볍게 모아 뛴다. 착지 시 무릎을 살짝 구부려 충격을 흡수한다. 30초 운동 → 30초 휴식 인터벌로 시작한다.',
          '딱딱한 바닥에서 장시간 수행하면 무릎과 발목에 부담이 간다. 쿠션이 있는 운동화와 적절한 바닥에서 실시한다.',''],
        // ── 전신 ──
        ['E081','전신','케틀벨 스윙',4,'정상','https://youtu.be/YSxHifyI6s8','전신/둔근/햄스트링','중급',
          '발을 어깨 너비로 벌리고 케틀벨을 두 손으로 잡는다. 무릎을 살짝 구부리고 엉덩이를 뒤로 빼며 케틀벨을 다리 사이로 내린다. 엉덩이를 앞으로 밀며 케틀벨을 가슴 높이까지 올린다. 자연스러운 호 운동으로 반복한다.',
          '케틀벨을 팔로 들어올리지 않는다. 엉덩이의 추진력이 핵심이며 허리로 들어올리면 부상 위험이 있다.',''],
        ['E082','전신','버피',0,'정상','','전신/심폐','고급',
          '바르게 서서 시작한다. 쪼그려 앉아 손을 바닥에 짚는다. 발을 뒤로 뻗어 플랭크 자세를 만든다. 푸시업을 1회 수행한다. 발을 앞으로 당겨 쪼그려 앉은 자세로 돌아온다. 점프하며 양손을 머리 위로 뻗는다.',
          '처음에는 푸시업과 점프를 생략한 변형 버피로 시작한다. 무릎과 발목 관절에 충격이 크므로 과도하게 반복하지 않는다.',''],
        ['E083','전신','배틀로프',1,'정상','','전신/어깨/심폐','고급',
          '로프 고정점에서 충분한 거리를 두고 선다. 무릎을 살짝 구부리고 코어를 단단히 조인다. 양팔을 번갈아 또는 동시에 위아래로 흔들어 파도를 만든다. 20~30초 최대 강도로 수행 후 휴식한다.',
          '어깨와 팔꿈치 관절에 부담이 크므로 워밍업을 충분히 한다. 허리가 구부러지지 않도록 자세를 유지한다.',''],
        ['E084','전신','클린 앤 저크',2,'정상','','전신','고급',
          '바벨을 어깨 너비로 잡고 발 앞에 세운다. 폭발적으로 바벨을 당겨 어깨 위(랙 자세)로 올린다(클린). 무릎을 살짝 구부렸다가 폭발적으로 바벨을 머리 위로 밀어올린다(저크). 양발을 나란히 모으고 자세를 완성한다. 바벨을 내리며 반복한다.',
          '역도 기술이므로 반드시 전문 트레이너에게 기술을 배운 후 수행한다. 충분한 유연성과 파워 베이스가 필요하다.',''],
      ];
      const cat = params && params.category;
      return cat ? equipRows.filter((r, i) => i === 0 || r[1] === cat) : equipRows;
    }

    case 'getMembers':
      return [
        ['ID', '이름', '성별', '나이', '등급', '등록일', '만료일', '배정트레이너', '연락처', '상태'],
        ['M001', '홍길동', '남', 28, 'PT회원',  '2026-01-10', '2026-07-10', '김코치',  '010-1234-5678', '활동중'],
        ['M002', '김영희', '여', 33, 'PT회원',  '2026-02-15', '2026-08-15', '김코치',  '010-2345-6789', '활동중'],
        ['M003', '이철수', '남', 25, '일반회원', '2026-03-01', '2026-06-03', '',        '010-3456-7890', '활동중'],
        ['M004', '박민지', '여', 30, 'PT회원',  '2026-04-20', '2026-10-20', '김코치',  '010-4567-8901', '활동중'],
        ['M005', '최수진', '여', 27, '일반회원', '2026-05-01', '2026-06-01', '',        '010-5678-9012', '활동중'],
        ['M006', '정민호', '남', 35, 'PT회원',  '2026-03-15', '2026-09-15', '이지수',  '010-6789-0123', '활동중'],
        ['M007', '오지영', '여', 22, '일반회원', '2026-04-10', '2026-07-10', '',        '010-7890-1234', '활동중'],
        ['M008', '윤성훈', '남', 40, 'PT회원',  '2026-02-01', '2026-06-02', '박강훈',  '010-8901-2345', '활동중'],
        ['M009', '한예진', '여', 29, '일반회원', '2026-05-20', '2026-11-20', '',        '010-9012-3456', '활동중'],
        ['M010', '강현우', '남', 31, 'PT회원',  '2026-01-25', '2026-07-25', '최유리',  '010-0123-4567', '일시정지'],
      ];

    case 'getPayments':
      return [
        ['결제ID', '회원ID', '회원명', '상품', '금액', '결제일', '만료일', '상태'],
        ['PAY001', 'M001', '홍길동',  'PT 20회권',    350000, '2026-01-10', '2026-07-10', '완료'],
        ['PAY002', 'M002', '김영희',  'PT 20회권',    350000, '2026-02-15', '2026-08-15', '완료'],
        ['PAY003', 'M003', '이철수',  '3개월 일반',   150000, '2026-03-01', '2026-06-03', '완료'],
        ['PAY004', 'M004', '박민지',  'PT 10회권',    200000, '2026-04-20', '2026-10-20', '완료'],
        ['PAY005', 'M005', '최수진',  '1개월 일반',    60000, '2026-05-01', '2026-06-01', '미수금'],
        ['PAY006', 'M006', '정민호',  'PT 20회권',    350000, '2026-03-15', '2026-09-15', '완료'],
        ['PAY007', 'M007', '오지영',  '3개월 일반',   150000, '2026-04-10', '2026-07-10', '미수금'],
        ['PAY008', 'M008', '윤성훈',  'PT 20회권',    350000, '2026-02-01', '2026-06-02', '완료'],
        ['PAY009', 'M009', '한예진',  '6개월 일반',   270000, '2026-05-20', '2026-11-20', '완료'],
        ['PAY010', 'M010', '강현우',  'PT 20회권',    350000, '2026-01-25', '2026-07-25', '미수금'],
      ];

    case 'getTrainerDashboard': {
      const tId = params.trainerId || 'trainer';
      const isKimCoach = (tId === 'trainer' || tId === 'T001');
      if (!isKimCoach) return { members: [], stats: {}, weeklySchedule: {} };

      const members = [
        {
          memberId: 'user',  memberName: '홍길동', gender: '남', age: 28,
          grade: 'PT회원', ptId: 'PT001',
          totalSessions: 20, remainingSessions: 8, completedSessions: 12,
          attendanceRate: 92, days: '월,수,금', time: '18:00',
          status: '진행중', lastWorkoutDate: '2026-05-28'
        },
        {
          memberId: 'M002', memberName: '김영희', gender: '여', age: 33,
          grade: 'PT회원', ptId: 'PT002',
          totalSessions: 20, remainingSessions: 14, completedSessions: 6,
          attendanceRate: 85, days: '화,목', time: '10:00',
          status: '진행중', lastWorkoutDate: '2026-05-29'
        },
        {
          memberId: 'M004', memberName: '박민지', gender: '여', age: 30,
          grade: 'PT회원', ptId: 'PT003',
          totalSessions: 10, remainingSessions: 4, completedSessions: 6,
          attendanceRate: 100, days: '월,수', time: '11:00',
          status: '진행중', lastWorkoutDate: '2026-05-27'
        }
      ];

      const weeklySchedule = {};
      members.forEach(m => {
        m.days.split(',').map(d => d.trim()).forEach(day => {
          if (!weeklySchedule[day]) weeklySchedule[day] = [];
          weeklySchedule[day].push({ ptId: m.ptId, memberId: m.memberId, memberName: m.memberName, time: m.time });
        });
      });
      Object.keys(weeklySchedule).forEach(day => {
        weeklySchedule[day].sort((a, b) => a.time.localeCompare(b.time));
      });

      const stats = {
        memberCount: members.length,
        weeklySessionCount: Object.values(weeklySchedule).reduce((s, arr) => s + arr.length, 0),
        avgAttendance: Math.round(members.reduce((s, m) => s + m.attendanceRate, 0) / members.length),
        totalRemaining: members.reduce((s, m) => s + m.remainingSessions, 0)
      };

      return { members, stats, weeklySchedule };
    }

    case 'getPTRequests': {
      let list = MOCK_PT_REQUESTS.filter(r => r.상태 === '대기중');
      if (params.trainerId) {
        list = list.filter(r => r.트레이너ID === params.trainerId);
      }
      return list;
    }

    case 'getTrainerSchedule': {
      const tid = params.trainerId;
      const allDays = ['월','화','수','목','금','토','일'];

      // 트레이너별 근무 패턴 정의
      const patterns = {
        'T001': {
          workDays: ['월','화','수','목','금'],
          workHours: ['07:00','08:00','09:00','10:00','11:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'],
          booked: { '월':['09:00','10:00','17:00'], '화':['07:00','14:00'], '수':['10:00','11:00','19:00'], '목':['08:00','18:00'], '금':['15:00','16:00','18:00'] }
        },
        'T002': {
          workDays: ['화','수','목','금','토'],
          workHours: ['09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'],
          booked: { '화':['10:00','11:00','14:00'], '수':['14:00','15:00','16:00'], '목':['09:00','20:00'], '금':['12:00','17:00'], '토':['10:00','11:00','14:00','15:00'] }
        },
        'T003': {
          workDays: ['월','화','수','목'],
          workHours: ['07:00','08:00','09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00'],
          booked: { '월':['07:00','08:00','10:00'], '화':['09:00','10:00'], '수':['09:00','14:00','15:00'], '목':['11:00','14:00','16:00'] }
        },
        'T004': {
          workDays: ['수','목','금','토','일'],
          workHours: ['10:00','11:00','12:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'],
          booked: { '수':['14:00','15:00','19:00'], '목':['11:00','12:00'], '금':['16:00','17:00','18:00'], '토':['10:00','11:00','14:00'], '일':['15:00','16:00'] }
        }
      };

      const p = patterns[tid] || patterns['T001'];
      const slots = {};
      allDays.forEach(day => {
        slots[day] = {};
        p.workHours.forEach(time => {
          if (!p.workDays.includes(day)) {
            slots[day][time] = 'off';
          } else {
            slots[day][time] = (p.booked[day] || []).includes(time) ? 'booked' : 'available';
          }
        });
      });
      return { trainerId: tid, slots, workDays: p.workDays, workHours: p.workHours };
    }

    default:
      return [];
  }
}

function handleMockPost(action, body) {
  switch (action) {
    case 'login': {
      const id = String(body.memberId).trim();
      const pw = String(body.password).trim();

      if (id === 'admin' && pw === 'admin') {
        return { success: true, userId: 'admin', name: '최고관리자', role: '관리자', assignedTrainer: '', status: '활동중' };
      }
      if (id === 'trainer' && pw === '1234') {
        return { success: true, userId: 'trainer', name: '김코치', role: '트레이너', assignedTrainer: '', status: '활동중' };
      }
      if (id === 'user' && pw === '1234') {
        return { success: true, userId: 'user', name: '홍길동', role: 'PT회원', assignedTrainer: '김코치', status: '활동중' };
      }
      return { success: false, message: '아이디 또는 비밀번호 오류 (테스트 아이디: admin/admin, user/1234, trainer/1234)' };
    }

    case 'saveWorkout': {
      const workouts = getMockWorkouts(body.userId);
      const newEntry = {
        ...body,
        id: `w_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
      };
      workouts.push(newEntry);
      return { success: true, id: newEntry.id };
    }

    case 'updateWorkout': {
      const workouts = getMockWorkouts(body.userId);
      const idx = workouts.findIndex(w => w.id === body.id);
      if (idx !== -1) workouts[idx] = { ...body };
      return { success: true };
    }

    case 'deleteWorkout': {
      const uid = body.userId;
      if (MOCK_WORKOUTS[uid]) {
        MOCK_WORKOUTS[uid] = MOCK_WORKOUTS[uid].filter(w => w.id !== body.id);
      }
      return { success: true };
    }

    case 'saveBody': {
      const bodyArr = getMockBodyData(body.userId);
      const newEntry = { ...body, id: `b_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` };
      bodyArr.push(newEntry);
      return { success: true, id: newEntry.id };
    }

    case 'updateBody': {
      const bodyArr = getMockBodyData(body.userId);
      const idx = bodyArr.findIndex(d => d.id === body.id);
      if (idx !== -1) bodyArr[idx] = { ...body };
      return { success: true };
    }

    case 'deleteBody': {
      const uid = body.userId;
      if (MOCK_BODY[uid]) {
        MOCK_BODY[uid] = MOCK_BODY[uid].filter(d => d.id !== body.id);
      }
      return { success: true };
    }

    case 'saveDiet': {
      const arr = getMockDiet(body.userId);
      const newEntry = { ...body, id: `d_${Date.now()}_${Math.random().toString(36).substr(2,6)}` };
      if (!MOCK_DIET[body.userId]) MOCK_DIET[body.userId] = [];
      MOCK_DIET[body.userId].push(newEntry);
      return { success: true, id: newEntry.id };
    }

    case 'updateDiet': {
      const uid = body.userId;
      if (MOCK_DIET[uid]) {
        const idx = MOCK_DIET[uid].findIndex(d => d.id === body.id);
        if (idx !== -1) MOCK_DIET[uid][idx] = { ...body };
      }
      return { success: true };
    }

    case 'deleteDiet': {
      const uid = body.userId;
      if (MOCK_DIET[uid]) {
        MOCK_DIET[uid] = MOCK_DIET[uid].filter(d => d.id !== body.id);
      }
      return { success: true };
    }

    case 'registerPT': {
      const memberName = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_NAME) || body.userId;
      MOCK_PT_REQUESTS.push({
        신청ID: `PTREQ${Date.now()}`,
        회원명: memberName,
        트레이너ID: body.trainerId,
        트레이너명: body.trainerName,
        신청일시: new Date().toISOString().slice(0,16).replace('T',' '),
        상태: '대기중'
      });
      return { success: true, ptId: `PT_${Date.now()}` };
    }

    case 'markAttendance':
      return { success: true };

    case 'addMember':
      return { success: true, memberId: `M${Date.now().toString().slice(-3)}` };

    case 'updatePayment':
      return { success: true };

    case 'updateEquipmentStatus':
      return { success: true };

    case 'assignTrainer':
      return { success: true };

    case 'removePTMember':
      return { success: true };

    case 'updatePTRequest': {
      const req = MOCK_PT_REQUESTS.find(r => r.신청ID === body.신청ID);
      if (req) req.상태 = body.상태;
      return { success: true };
    }

    default:
      return { success: true };
  }
}

