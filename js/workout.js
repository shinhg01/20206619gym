/**
 * 아이언핏 GYM - 운동 기록 페이지 (workout.js)
 *
 * 달력 뷰, 운동 추가/수정/삭제 CRUD, 트레이너 담당 회원 조회 우회를 제어합니다.
 */

// ── 전역 상태 ──────────────────────────────────────────────
let allWorkouts = [];          // 현재 로드된 운동 기록 전체
let selectedDate = null;       // 달력에서 선택된 날짜 문자열 'yyyy-MM-dd'
let calYear, calMonth;         // 달력 표시 연/월 (0-indexed month)
let targetUserId = null;       // 실제 조회 대상 userId (트레이너가 대리 조회 시 다를 수 있음)
let targetUserName = null;     // 조회 대상 이름 (뱃지 표시용)
let editingId = null;          // 현재 수정 중인 운동 기록 id
let exerciseByPart = {};       // { 부위명: ['운동1', '운동2', ...] } 형태로 전처리된 기구 데이터

// 부위별 배지 CSS 클래스 매핑
const PART_BADGE = {
  '가슴': 'badge-chest',
  '등':   'badge-back',
  '하체': 'badge-leg',
  '어깨': 'badge-shoulder',
};
function getPartBadge(part) {
  return PART_BADGE[part] || 'badge-etc';
}

// 부위별 아이콘
const PART_ICON = {
  '가슴': 'fa-solid fa-arrow-up',
  '등':   'fa-solid fa-arrow-down',
  '하체': 'fa-solid fa-person-walking',
  '어깨': 'fa-solid fa-arrows-up-down',
  '이두': 'fa-solid fa-hand-fist',
  '삼두': 'fa-solid fa-hand-back-fist',
  '복근': 'fa-solid fa-circle',
  '유산소': 'fa-solid fa-heart-pulse',
  '전신': 'fa-solid fa-dumbbell',
};
function getPartIcon(part) {
  return PART_ICON[part] || 'fa-solid fa-dumbbell';
}

// ── 초기화 ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // 1. 세션 검증
  let userId = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ID);
  let name   = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_NAME);
  let role   = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ROLE);
  let status = sessionStorage.getItem(CONFIG.SESSION_KEYS.STATUS);

  const IS_DEV_MODE = false;
  if (IS_DEV_MODE && !userId) {
    userId = 'user'; name = '홍길동'; role = 'PT회원'; status = '활동중';
    sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_ID, userId);
    sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_NAME, name);
    sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_ROLE, role);
    sessionStorage.setItem(CONFIG.SESSION_KEYS.STATUS, status);
  }

  if (!userId) {
    alert('로그인 세션이 만료되었습니다. 로그인 페이지로 이동합니다.');
    window.location.href = 'index.html';
    return;
  }
  if (status === '정지' || status === '만료') {
    alert('이용 기간이 만료되었거나 정지된 계정입니다. 안내데스크에 문의해 주세요.');
    sessionStorage.clear();
    window.location.href = 'index.html';
    return;
  }

  // 2. 프로필 UI 세팅
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileRole').textContent = role;
  document.getElementById('userAvatar').textContent = name ? name[0] : 'U';
  document.getElementById('userGradeBadge').textContent = role;

  if (role === '트레이너') {
    document.querySelector('.role-trainer').style.display = 'block';
    document.getElementById('userGradeBadge').className = 'badge badge-primary';
  } else if (role === '관리자') {
    document.querySelector('.role-admin').style.display = 'block';
    document.getElementById('userGradeBadge').className = 'badge badge-danger';
  } else if (role === 'PT회원') {
    document.getElementById('userGradeBadge').className = 'badge badge-info';
  }

  // 3. 햄버거 메뉴
  const menuToggle    = document.getElementById('menuToggle');
  const appSidebar    = document.getElementById('appSidebar');
  const sidebarOverlay= document.getElementById('sidebarOverlay');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      appSidebar.classList.add('open');
      sidebarOverlay.classList.add('show');
    });
    sidebarOverlay.addEventListener('click', () => {
      appSidebar.classList.remove('open');
      sidebarOverlay.classList.remove('show');
    });
  }

  // 4. 로그아웃
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      sessionStorage.clear();
      window.location.href = 'index.html';
    }
  });

  // 5. 달력 초기화 (현재 월)
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  targetUserId   = userId;
  targetUserName = name;

  // 날짜 입력란 기본값: 오늘
  document.getElementById('wDate').value = toDateStr(now);

  // 6-0. 운동 기구 데이터 로드 및 종목 드롭다운 초기화
  try {
    const equipRows = await callGet('getEquipment', {});
    buildExerciseMap(equipRows);
  } catch(e) {
    console.warn('[WORKOUT] 기구 데이터 로드 실패, 직접 입력 모드로 폴백:', e);
  }

  // 타겟 부위 변경 → 운동 종목 드롭다운 자동 갱신
  document.getElementById('wPart').addEventListener('change', (e) => {
    populateExerciseOptions(e.target.value);
  });
  // 운동 종목에서 "직접 입력" 선택 → 텍스트 입력창 토글
  document.getElementById('wExercise').addEventListener('change', (e) => {
    const customInput = document.getElementById('wExerciseCustom');
    if (e.target.value === '__custom__') {
      customInput.style.display = 'block';
      customInput.required = true;
      customInput.focus();
    } else {
      customInput.style.display = 'none';
      customInput.required = false;
      customInput.value = '';
    }
  });

  // 7. 트레이너 모드: 회원 목록 드롭다운 세팅
  if (role === '트레이너' || role === '관리자') {
    document.getElementById('trainerBar').style.display = 'flex';
    try {
      const members = await callGet('getMembers', {});
      populateMemberDropdown(members);
    } catch(e) {
      console.warn('[WORKOUT] 회원 목록 조회 실패:', e);
    }

    document.getElementById('memberSelect').addEventListener('change', async (e) => {
      const val = e.target.value;
      if (!val) {
        // 본인(트레이너 자신) 기록으로 복귀
        targetUserId   = userId;
        targetUserName = name;
        document.getElementById('viewingBadge').style.display = 'none';
      } else {
        const [selId, selName] = val.split('||');
        targetUserId   = selId;
        targetUserName = selName;
        const badge = document.getElementById('viewingBadge');
        badge.textContent = `${selName} 님 조회 중`;
        badge.style.display = 'inline-flex';
      }
      resetForm();
      await loadWorkouts();
    });
  }

  // 8. 폼 이벤트 바인딩
  document.getElementById('workoutForm').addEventListener('submit', handleFormSubmit);
  document.getElementById('resetFormBtn').addEventListener('click', resetForm);

  // 9. 달력 네비게이션
  document.getElementById('prevMonth').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    const t = new Date();
    calYear = t.getFullYear(); calMonth = t.getMonth();
    selectedDate = toDateStr(t);
    renderCalendar();
    renderWorkoutList();
  });
  document.getElementById('showAllBtn').addEventListener('click', () => {
    selectedDate = null;
    renderCalendar();
    renderWorkoutList();
  });
  document.getElementById('clearFilterBtn').addEventListener('click', () => {
    selectedDate = null;
    renderCalendar();
    renderWorkoutList();
  });

  // 10. 초기 데이터 로드
  await loadWorkouts();
});

// ── 운동 기구 데이터 전처리 ────────────────────────────────
/**
 * getEquipment 응답(시트 행 배열)을 { 부위: [운동명, ...] } 객체로 변환
 * 첫 번째 행이 헤더(문자열 배열)인 경우 자동으로 건너뜁니다.
 */
function buildExerciseMap(rows) {
  exerciseByPart = {};
  if (!rows || !Array.isArray(rows)) return;

  const dataRows = Array.isArray(rows[0]) && isNaN(rows[0][0]) ? rows.slice(1) : rows;
  dataRows.forEach(row => {
    if (!Array.isArray(row)) return;
    const part = String(row[1] || '').trim();
    const name = String(row[2] || '').trim();
    if (!part || !name) return;
    if (!exerciseByPart[part]) exerciseByPart[part] = [];
    if (!exerciseByPart[part].includes(name)) {
      exerciseByPart[part].push(name);
    }
  });
}

/**
 * 부위 선택 시 운동 종목 <select>를 해당 부위의 운동 목록으로 재구성
 */
function populateExerciseOptions(part) {
  const sel = document.getElementById('wExercise');
  const customInput = document.getElementById('wExerciseCustom');

  // 직접 입력 입력창 숨기기
  customInput.style.display = 'none';
  customInput.required = false;
  customInput.value = '';

  if (!part) {
    sel.innerHTML = '<option value="">← 먼저 타겟 부위를 선택하세요</option>';
    sel.disabled = true;
    return;
  }

  const exercises = exerciseByPart[part] || [];
  sel.disabled = false;

  let html = `<option value="">-- ${part} 운동 선택 --</option>`;
  exercises.forEach(ex => {
    html += `<option value="${escHtml(ex)}">${escHtml(ex)}</option>`;
  });
  html += `<option value="__custom__" style="color: var(--color-primary); font-weight: 700;">✏️ 직접 입력...</option>`;
  sel.innerHTML = html;
}

// ── 회원 드롭다운 구성 ──────────────────────────────────────
function populateMemberDropdown(members) {
  const sel = document.getElementById('memberSelect');
  sel.innerHTML = '<option value="">내 기록 보기 (트레이너)</option>';

  if (!members || !Array.isArray(members) || members.length === 0) return;

  // 헤더 행 제외: members[0]이 배열이면 시트 데이터 (첫 행 헤더 스킵)
  const rows = Array.isArray(members[0]) ? members.slice(1) : members;
  rows.forEach(row => {
    const id   = Array.isArray(row) ? String(row[0]).trim() : row.id;
    const name = Array.isArray(row) ? row[1] : row.name;
    if (!id || id === 'ID' || id === '') return;
    const opt = document.createElement('option');
    opt.value = `${id}||${name}`;
    opt.textContent = `${name} (${id})`;
    sel.appendChild(opt);
  });
}

// ── 운동 기록 로드 ─────────────────────────────────────────
async function loadWorkouts() {
  try {
    const data = await callGet('getWorkouts', { userId: targetUserId });
    allWorkouts = Array.isArray(data) ? data : [];
  } catch(e) {
    console.error('[WORKOUT] 데이터 로드 실패:', e);
    allWorkouts = [];
  }
  renderCalendar();
  renderWorkoutList();
}

// ── 달력 렌더링 ────────────────────────────────────────────
function renderCalendar() {
  document.getElementById('calendarTitle').textContent =
    `${calYear}년 ${calMonth + 1}월`;

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  // 요일 헤더
  const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];
  dayHeaders.forEach((d, i) => {
    const el = document.createElement('div');
    el.className = 'cal-day-header';
    if (i === 0) el.style.color = 'var(--color-danger)';
    if (i === 6) el.style.color = 'var(--color-info)';
    el.textContent = d;
    grid.appendChild(el);
  });

  // 운동 기록이 있는 날짜 셋
  const workoutDays = new Set(
    allWorkouts.map(w => w.date ? w.date.substring(0, 10) : '')
  );

  const today     = toDateStr(new Date());
  const firstDay  = new Date(calYear, calMonth, 1).getDay(); // 0=일
  const lastDate  = new Date(calYear, calMonth + 1, 0).getDate();

  // 빈 셀 (첫날 앞)
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day cal-empty';
    grid.appendChild(el);
  }

  // 날짜 셀
  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${calYear}-${pad2(calMonth + 1)}-${pad2(d)}`;
    const dow     = new Date(calYear, calMonth, d).getDay();
    const el      = document.createElement('div');

    let cls = 'cal-day';
    if (dow === 0) cls += ' cal-sun';
    if (dow === 6) cls += ' cal-sat';
    if (dateStr === today)        cls += ' cal-today';
    if (dateStr === selectedDate) cls += ' cal-selected';
    el.className = cls;

    const numEl = document.createElement('span');
    numEl.textContent = d;
    el.appendChild(numEl);

    if (workoutDays.has(dateStr)) {
      const dot = document.createElement('div');
      dot.className = 'cal-dot';
      el.appendChild(dot);
    }

    el.addEventListener('click', () => {
      selectedDate = dateStr;
      // 폼의 날짜도 선택한 날로 변경
      document.getElementById('wDate').value = dateStr;
      renderCalendar();
      renderWorkoutList();
    });

    grid.appendChild(el);
  }
}

// ── 운동 목록 렌더링 ───────────────────────────────────────
function renderWorkoutList() {
  const container = document.getElementById('workoutList');
  const filterBar = document.getElementById('filterBar');
  const filterInfo= document.getElementById('filterInfo');
  const totalBadge= document.getElementById('totalCountBadge');

  // 필터 적용
  const filtered = selectedDate
    ? allWorkouts.filter(w => w.date && w.date.substring(0, 10) === selectedDate)
    : [...allWorkouts];

  // 날짜 내림차순 정렬
  filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  totalBadge.textContent = `${filtered.length}건`;

  // 필터 바 표시
  if (selectedDate) {
    filterBar.style.display = 'flex';
    filterInfo.innerHTML = `<strong>${selectedDate}</strong> 기록만 표시 중`;
  } else {
    filterBar.style.display = 'none';
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-clipboard-list"></i>
        <p>${selectedDate ? `${selectedDate}에 등록된 운동 기록이 없습니다.` : '아직 운동 기록이 없습니다.'}</p>
        <p style="margin-top: 0.5rem; font-size: 0.82rem;">위 폼에서 첫 번째 운동을 기록해 보세요!</p>
      </div>`;
    return;
  }

  // 날짜별 그룹핑
  const groups = {};
  filtered.forEach(w => {
    const day = w.date ? w.date.substring(0, 10) : '날짜 미상';
    if (!groups[day]) groups[day] = [];
    groups[day].push(w);
  });

  let html = '';
  Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(day => {
    const dayWorkouts = groups[day];
    html += `
      <div class="date-divider">
        <span class="date-divider-label">
          <i class="fa-solid fa-calendar-day" style="color: var(--color-primary);"></i>
          ${formatDateLabel(day)}
        </span>
        <div class="date-divider-line"></div>
        <span class="badge badge-etc" style="font-size:0.72rem;">${dayWorkouts.length}개</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.6rem;">`;

    dayWorkouts.forEach(w => {
      const weightText = Number(w.weight) === 0 ? '맨몸' : `${w.weight} kg`;
      const partBadge  = getPartBadge(w.part);
      const partIcon   = getPartIcon(w.part);
      const memoHtml   = w.memo
        ? `<div class="workout-memo"><i class="fa-solid fa-quote-left" style="font-size:0.7rem; margin-right:0.3rem; opacity:0.5;"></i>${escHtml(w.memo)}</div>`
        : '';

      html += `
        <div class="workout-card" id="wcard-${escHtml(w.id)}">
          <div class="workout-icon">
            <i class="${partIcon}"></i>
          </div>
          <div class="workout-body">
            <div class="workout-title-row">
              <span class="workout-name">${escHtml(w.exercise)}</span>
              <span class="badge ${partBadge}">${escHtml(w.part)}</span>
            </div>
            <div class="workout-stats">
              <span class="workout-stat-item">
                <i class="fa-solid fa-layer-group"></i> ${w.sets}세트
              </span>
              <span class="workout-stat-item">
                <i class="fa-solid fa-weight-hanging"></i> ${weightText}
              </span>
              <span class="workout-stat-item">
                <i class="fa-solid fa-repeat"></i> ${w.reps}회
              </span>
            </div>
            ${memoHtml}
          </div>
          <div class="workout-actions">
            <button class="btn btn-outline btn-sm" onclick="startEdit(${JSON.stringify(w.id)})">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteWorkout(${JSON.stringify(w.id)})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>`;
    });

    html += `</div>`;
  });

  container.innerHTML = html;
}

// ── 폼 제출 (추가 / 수정) ─────────────────────────────────
async function handleFormSubmit(e) {
  e.preventDefault();

  const date          = document.getElementById('wDate').value;
  const part          = document.getElementById('wPart').value;
  const exerciseSel   = document.getElementById('wExercise').value;
  const exerciseCustom= document.getElementById('wExerciseCustom').value.trim();
  const exercise      = exerciseSel === '__custom__' ? exerciseCustom : exerciseSel;
  const sets          = parseInt(document.getElementById('wSets').value);
  const weight        = parseFloat(document.getElementById('wWeight').value);
  const reps          = parseInt(document.getElementById('wReps').value);
  const memo          = document.getElementById('wMemo').value.trim();
  const currentEditId = document.getElementById('editId').value;

  if (!date || !part) {
    alert('날짜와 타겟 부위를 선택해 주세요.');
    return;
  }
  if (!exercise) {
    alert('운동 종목을 선택하거나 직접 입력해 주세요.');
    return;
  }
  if (isNaN(sets) || isNaN(weight) || isNaN(reps)) {
    alert('세트 수, 중량, 횟수를 모두 입력해 주세요.');
    return;
  }

  const payload = {
    userId: targetUserId,
    date, part, exercise, sets, weight, reps, memo
  };

  try {
    if (currentEditId) {
      // 수정 모드
      payload.id = currentEditId;
      await callPost('updateWorkout', payload);
      showToast('운동 기록이 수정되었습니다.');
    } else {
      // 신규 추가
      await callPost('saveWorkout', payload);
      showToast('운동 기록이 저장되었습니다.');
    }
    resetForm();
    await loadWorkouts();
  } catch(err) {
    console.error('[WORKOUT] 저장 실패:', err);
  }
}

// ── 수정 모드 진입 ─────────────────────────────────────────
function startEdit(id) {
  const w = allWorkouts.find(x => x.id === id);
  if (!w) return;

  editingId = id;
  document.getElementById('editId').value    = id;
  document.getElementById('wDate').value     = w.date   || '';
  document.getElementById('wSets').value     = w.sets   || '';
  document.getElementById('wWeight').value   = w.weight !== undefined ? w.weight : '';
  document.getElementById('wReps').value     = w.reps   || '';
  document.getElementById('wMemo').value     = w.memo   || '';

  // 부위 먼저 세팅 → 드롭다운 재구성 → 종목 선택
  const partSel = document.getElementById('wPart');
  partSel.value = w.part || '';
  populateExerciseOptions(w.part || '');

  const exerciseSel   = document.getElementById('wExercise');
  const customInput   = document.getElementById('wExerciseCustom');
  const optionExists  = [...exerciseSel.options].some(o => o.value === w.exercise);

  if (optionExists) {
    exerciseSel.value = w.exercise;
    customInput.style.display = 'none';
  } else if (w.exercise) {
    // 목록에 없는 운동 → 직접 입력 모드로 폴백
    exerciseSel.value = '__custom__';
    customInput.style.display = 'block';
    customInput.required = true;
    customInput.value = w.exercise;
  }

  document.getElementById('formTitle').innerHTML =
    `<i class="fa-solid fa-pen" style="color: var(--color-primary);"></i> 운동 수정`;
  document.getElementById('submitBtnText').textContent = '수정 내용 저장';
  document.getElementById('submitBtn').style.backgroundColor = 'var(--color-info)';

  // 폼으로 부드럽게 스크롤
  document.getElementById('workoutForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── 삭제 ───────────────────────────────────────────────────
async function deleteWorkout(id) {
  const w = allWorkouts.find(x => x.id === id);
  if (!w) return;
  if (!confirm(`'${w.exercise}' 기록을 삭제하시겠습니까?`)) return;

  try {
    await callPost('deleteWorkout', { userId: targetUserId, id });
    showToast('운동 기록이 삭제되었습니다.', 'danger');
    await loadWorkouts();
  } catch(err) {
    console.error('[WORKOUT] 삭제 실패:', err);
  }
}

// ── 폼 초기화 ──────────────────────────────────────────────
function resetForm() {
  editingId = null;
  document.getElementById('editId').value = '';
  document.getElementById('workoutForm').reset();
  document.getElementById('wDate').value = toDateStr(new Date());

  // 운동 종목 드롭다운 초기화
  populateExerciseOptions('');
  document.getElementById('wExerciseCustom').style.display = 'none';
  document.getElementById('wExerciseCustom').required = false;

  document.getElementById('formTitle').innerHTML =
    `<i class="fa-solid fa-plus-circle" style="color: var(--color-primary);"></i> 운동 추가`;
  document.getElementById('submitBtnText').textContent = '운동 기록 저장';
  document.getElementById('submitBtn').style.backgroundColor = '';
}

// ── 유틸 헬퍼 ──────────────────────────────────────────────
function toDateStr(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${dateStr} (${dow})`;
}

// ── 토스트 알림 ────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const existing = document.getElementById('ironfit-toast');
  if (existing) existing.remove();

  const colors = {
    success: { bg: '#E6F4EA', color: 'var(--color-success)', icon: 'fa-circle-check' },
    danger:  { bg: '#FCE8E6', color: 'var(--color-danger)',  icon: 'fa-circle-xmark' },
  };
  const c = colors[type] || colors.success;

  const toast = document.createElement('div');
  toast.id = 'ironfit-toast';
  toast.style.cssText = `
    position: fixed; bottom: 2rem; right: 2rem; z-index: 99999;
    background: ${c.bg}; color: ${c.color};
    border: 1.5px solid ${c.color}; border-radius: 10px;
    padding: 0.85rem 1.25rem; font-weight: 600; font-size: 0.9rem;
    display: flex; align-items: center; gap: 0.6rem;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    animation: slideUp 0.25s ease-out;
  `;
  toast.innerHTML = `<i class="fa-solid ${c.icon}"></i> ${escHtml(msg)}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
