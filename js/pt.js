/**
 * 아이언핏 GYM - PT 신청·일정 페이지 (pt.js)
 *
 * 트레이너 카드 목록, 나의 PT 현황, PT 계약 신청 폼을 제어합니다.
 */

// ── 전역 상태 ────────────────────────────────────────────────
let trainers        = [];   // 전체 트레이너 목록
let myPTContracts   = [];   // 내 PT 계약 목록
let nextSchedule    = null; // 다음 PT 예약 정보
let selectedTrainer         = null; // PT 신청 폼에서 선택된 트레이너 객체
let selectedSessions        = 0;    // 선택된 세션 수
let selectedTrainerSchedule = null; // 선택된 트레이너의 시간표
let currentRole             = '';
let currentUserId           = '';

// 시간표 모달 상태
let scheduleData      = null; // 현재 모달에 표시 중인 시간표 데이터
let preSelectedDay    = '';   // 모달에서 선택한 요일
let preSelectedTime   = '';   // 모달에서 선택한 시간

// 트레이너 아바타 배경 색상 (순환)
const AVATAR_COLORS = [
  { bg: '#FDF0EE', color: 'var(--color-primary)' },
  { bg: '#E8F0FE', color: 'var(--color-info)'    },
  { bg: '#E6F4EA', color: 'var(--color-success)'  },
  { bg: '#FFF8E6', color: 'var(--color-warning)'  },
];

// 예약 가능 여부로 취급할 트레이너 상태 값
const ACTIVE_TRAINER_STATUSES = ['활동중', '재직'];
function isTrainerActive(t) {
  return ACTIVE_TRAINER_STATUSES.includes(t.status);
}

// ── 초기화 ───────────────────────────────────────────────────
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

  if (!userId) { alert('로그인 세션이 만료되었습니다.'); window.location.href = 'index.html'; return; }
  if (status === '정지' || status === '만료') {
    alert('이용 기간이 만료되었거나 정지된 계정입니다.');
    sessionStorage.clear(); window.location.href = 'index.html'; return;
  }

  currentUserId = userId;
  currentRole   = role;

  // 2. 프로필 UI
  document.getElementById('profileName').textContent    = name;
  document.getElementById('profileRole').textContent    = role;
  document.getElementById('userAvatar').textContent     = name ? name[0] : 'U';
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
  const menuToggle     = document.getElementById('menuToggle');
  const appSidebar     = document.getElementById('appSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => { appSidebar.classList.add('open'); sidebarOverlay.classList.add('show'); });
    sidebarOverlay.addEventListener('click', () => { appSidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); });
  }

  // 4. 로그아웃
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('로그아웃 하시겠습니까?')) { sessionStorage.clear(); window.location.href = 'index.html'; }
  });

  // 5. PT 신청 폼 제출
  document.getElementById('ptForm').addEventListener('submit', handleApplySubmit);

  // 6. 데이터 로드 (병렬)
  try {
    const [trainerData, ptData] = await Promise.all([
      callGet('getTrainers', {}),
      callGet('getPT', { userId }),
    ]);
    trainers      = Array.isArray(trainerData) ? trainerData : [];
    myPTContracts = ptData?.contracts || [];
    nextSchedule  = ptData?.nextSchedule || null;
  } catch(e) {
    console.error('[PT] 데이터 로드 실패:', e);
  }

  // 7. 렌더링
  renderPTStatus();
  renderTrainerGrid();
});

// ── 나의 PT 현황 렌더링 ──────────────────────────────────────
function renderPTStatus() {
  const section = document.getElementById('ptStatusSection');

  // 트레이너/관리자는 안내 배너
  if (currentRole === '트레이너' || currentRole === '관리자') {
    section.innerHTML = `
      <div class="trainer-notice" style="margin-bottom:1.75rem;">
        <i class="fa-solid fa-user-gear"></i>
        <div style="font-size:1.1rem; font-weight:700; color:var(--color-text-light); margin-bottom:0.4rem;">
          트레이너 / 관리자 모드
        </div>
        <div>PT 계약 신청은 회원 계정에서 이용할 수 있습니다.<br>
          트레이너 세부 관리는 <a href="trainer.html" style="color:var(--color-primary); font-weight:700;">트레이너 관리</a> 페이지를 이용해 주세요.</div>
      </div>`;
    return;
  }

  // 진행중인 PT 계약 추출
  const active = myPTContracts.filter(c => c.status === '진행중');

  if (active.length === 0) {
    section.innerHTML = `
      <div class="no-pt-banner">
        <i class="fa-solid fa-dumbbell"></i>
        <div style="font-weight:700; font-size:1rem; margin-bottom:0.3rem;">진행 중인 PT 계약이 없습니다</div>
        <div style="font-size:0.85rem;">아래 트레이너 목록에서 나에게 맞는 트레이너를 선택해 PT를 신청해 보세요!</div>
      </div>`;
    return;
  }

  const html = active.map(c => {
    const done    = Number(c.completedSessions) || 0;
    const total   = Number(c.totalSessions)     || 1;
    const remain  = Number(c.remainingSessions)  || 0;
    const pct     = Math.round((done / total) * 100);
    const atRate  = Number(c.attendanceRate)    || 0;

    const days    = String(c.days || '').split(',').map(d => d.trim());
    const allDays = ['월','화','수','목','금','토','일'];

    const dayChips = allDays.map(d =>
      `<span class="pt-day-chip ${days.includes(d) ? 'active' : ''}">${d}</span>`
    ).join('');

    const nextHtml = nextSchedule
      ? `<div>
           <div class="pt-stat-label">다음 수업</div>
           <div class="pt-stat-value" style="font-size:1.1rem;">${nextSchedule.date}</div>
           <div class="pt-stat-sub">${nextSchedule.time} · ${nextSchedule.trainerName} 트레이너</div>
         </div>`
      : `<div>
           <div class="pt-stat-label">다음 수업</div>
           <div class="pt-stat-value" style="font-size:1rem; opacity:0.5;">미정</div>
         </div>`;

    return `
      <div class="pt-status-card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem;">
          <div style="font-size:1.1rem; font-weight:800; color:#FFF;">
            <i class="fa-solid fa-dumbbell" style="color:var(--color-primary); margin-right:0.4rem;"></i>
            나의 PT 현황
          </div>
          <span class="badge" style="background:var(--color-primary); color:#FFF;">진행중</span>
        </div>

        <div class="pt-status-grid">
          <!-- 트레이너 & 진행도 -->
          <div style="grid-column:1/3;">
            <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1rem;">
              <div class="trainer-avatar" style="width:50px;height:50px;font-size:1.2rem; background:rgba(232,89,60,0.2); color:var(--color-primary);">
                ${c.trainerName ? c.trainerName[0] : 'T'}
              </div>
              <div>
                <div style="font-size:1.1rem; font-weight:800; color:#FFF;">${escHtml(c.trainerName)} 트레이너</div>
                <div style="font-size:0.8rem; color:var(--color-text-light-muted);">${escHtml(c.days || '')} · ${escHtml(c.time || '')}</div>
              </div>
            </div>
            <div class="pt-progress-wrap">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                <span style="font-size:0.78rem; color:var(--color-text-light-muted);">PT 진행도</span>
                <span style="font-size:0.9rem; font-weight:700; color:#FFF; font-family:var(--font-en);">${done} / ${total}회 <span style="font-size:0.75rem; opacity:0.6;">(${pct}%)</span></span>
              </div>
              <div class="pt-progress-bar">
                <div class="pt-progress-fill" style="width:${pct}%;"></div>
              </div>
            </div>
          </div>

          <!-- 잔여 횟수 -->
          <div class="pt-stat-block">
            <div class="pt-stat-label">잔여 횟수</div>
            <div class="pt-stat-value">${remain}<span style="font-size:0.9rem; opacity:0.7;"> 회</span></div>
            <div class="pt-stat-sub">총 ${total}회 계약</div>
          </div>

          <!-- 출석률 -->
          <div class="pt-stat-block">
            <div class="pt-stat-label">출석률</div>
            <div class="pt-stat-value">${atRate}<span style="font-size:0.9rem; opacity:0.7;"> %</span></div>
            <div class="pt-stat-sub">완료 ${done}회</div>
          </div>

          <!-- 다음 수업 -->
          ${nextHtml}
        </div>

        <!-- 요일 칩 -->
        <div style="display:flex; gap:0.4rem; margin-top:1.25rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.08);">
          <span style="font-size:0.75rem; color:var(--color-text-light-muted); margin-right:0.25rem; line-height:28px;">수업 요일</span>
          ${dayChips}
        </div>
      </div>`;
  }).join('');

  section.innerHTML = html;
}

// ── 트레이너 카드 그리드 렌더링 ─────────────────────────────
function renderTrainerGrid() {
  const grid = document.getElementById('trainerGrid');
  document.getElementById('trainerCountBadge').textContent = `${trainers.length}명`;

  if (trainers.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--color-text-muted);">
      <i class="fa-solid fa-user-slash" style="font-size:2rem; margin-bottom:0.5rem; display:block;"></i>등록된 트레이너가 없습니다.</div>`;
    return;
  }

  grid.innerHTML = trainers.map((t, i) => {
    const col = AVATAR_COLORS[i % AVATAR_COLORS.length];
    const isSelected = selectedTrainer && selectedTrainer.id === t.id;
    const certs = (t.certifications || '').split(',').map(c => `<span class="badge badge-etc" style="font-size:0.7rem;">${escHtml(c.trim())}</span>`).join(' ');
    const canApply = (currentRole === '일반회원' || currentRole === 'PT회원');

    return `
      <div class="trainer-card ${isSelected ? 'selected' : ''}"
           id="tcard-${escHtml(t.id)}"
           onclick="openScheduleModal('${escHtml(t.id)}')">
        <div class="trainer-header">
          <div class="trainer-avatar" style="background:${col.bg}; color:${col.color};">
            ${(t.name || '?')[0]}
          </div>
          <div style="flex:1; min-width:0;">
            <div class="trainer-name">${escHtml(t.name)}</div>
            <span class="badge badge-primary" style="font-size:0.72rem; margin-top:0.2rem;">
              ${escHtml(t.specialty || '')}
            </span>
          </div>
        </div>

        <div style="display:flex; align-items:baseline; gap:0.25rem;">
          <span class="trainer-rate">${Number(t.ptRate || 0).toLocaleString()}</span>
          <span style="font-size:0.8rem; color:var(--color-text-muted);">원 / 회</span>
        </div>

        <div class="trainer-certs">
          <i class="fa-solid fa-certificate" style="color:var(--color-warning); font-size:0.75rem;"></i>
          ${escHtml(t.certifications || '-')}
        </div>

        <div class="trainer-foot">
          <span class="trainer-count">
            <i class="fa-solid fa-users" style="font-size:0.75rem;"></i>
            담당 ${t.assignedCount || 0}명
          </span>
          ${isTrainerActive(t)
            ? `<span class="badge badge-success">예약 가능</span>`
            : `<span class="badge badge-danger">예약 불가</span>`}
        </div>

        ${isTrainerActive(t)
          ? `<div style="text-align:center; padding-top:0.25rem;">
               <div class="btn btn-outline btn-sm w-full" style="pointer-events:none;">
                 <i class="fa-solid fa-calendar-week"></i> 시간표 보기
               </div>
             </div>`
          : ''}
      </div>`;
  }).join('');
}

// ── 시간표 모달 열기 ─────────────────────────────────────────
async function openScheduleModal(id) {
  const t = trainers.find(x => x.id === id);
  if (!t) return;

  // 모달 헤더 채우기
  const col = AVATAR_COLORS[trainers.indexOf(t) % AVATAR_COLORS.length];
  const avatarEl = document.getElementById('sModalAvatar');
  avatarEl.textContent   = (t.name || '?')[0];
  avatarEl.style.background = col.bg;
  avatarEl.style.color      = col.color;
  document.getElementById('sModalName').textContent = `${t.name} 트레이너`;
  document.getElementById('sModalSpec').textContent =
    `${t.specialty || ''} · ${Number(t.ptRate || 0).toLocaleString()}원/회`;

  // PT 신청 버튼 visibility (트레이너/관리자는 숨김)
  const canApply = (currentRole === '일반회원' || currentRole === 'PT회원');
  document.getElementById('sModalApplyBtn').style.display = canApply ? '' : 'none';

  // 선택 초기화
  preSelectedDay  = '';
  preSelectedTime = '';
  document.getElementById('sModalSlotInfo').textContent = '시간을 선택하면 PT 신청 시 자동 입력됩니다';
  document.getElementById('sModalSlotInfo').className   = 'selected-slot-info';

  // 모달 먼저 표시 (로딩 표시용)
  document.getElementById('timetableGrid').innerHTML =
    `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);">
       <i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;"></i>
     </div>`;
  document.getElementById('scheduleModalBackdrop').style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // 시간표 데이터 로드
  try {
    scheduleData = await callGet('getTrainerSchedule', { trainerId: id });
    renderTimetableGrid(scheduleData);
  } catch(e) {
    document.getElementById('timetableGrid').innerHTML =
      `<div style="text-align:center; padding:2rem; color:var(--color-danger);">시간표를 불러오지 못했습니다.</div>`;
  }
}

function closeScheduleModal() {
  document.getElementById('scheduleModalBackdrop').style.display = 'none';
  document.body.style.overflow = '';
  scheduleData    = null;
  preSelectedDay  = '';
  preSelectedTime = '';
}

function handleBackdropClick(e) {
  if (e.target === document.getElementById('scheduleModalBackdrop')) {
    closeScheduleModal();
  }
}

// ── 시간표 그리드 렌더링 ─────────────────────────────────────
function renderTimetableGrid(data) {
  if (!data) return;
  const days = ['월','화','수','목','금','토','일'];
  const { slots, workHours } = data;

  let html = `<div class="timetable-header-row">
    <div class="time-label-cell" style="border-right:1px solid var(--border-color); height:auto; padding:0.55rem 0.5rem;"></div>`;
  days.forEach(day => {
    const isWork = (data.workDays || []).includes(day);
    const dayClass = day === '토' ? 'is-sat' : day === '일' ? 'is-sun' : isWork ? 'is-workday' : '';
    html += `<div class="timetable-day-head ${dayClass}">${day}${isWork ? '' : '<br><span style="font-size:0.6rem;opacity:0.5;">휴무</span>'}</div>`;
  });
  html += `</div>`;

  workHours.forEach(time => {
    html += `<div class="timetable-row"><div class="time-label-cell">${time}</div>`;
    days.forEach(day => {
      const status = (slots[day] && slots[day][time]) || 'off';
      const isSelectable = status === 'available';
      const isSelected = preSelectedDay === day && preSelectedTime === time;
      const extraClass = isSelected ? 'selected' : '';
      if (isSelectable) {
        html += `<div class="time-slot-cell available ${extraClass}"
                      data-day="${day}" data-time="${time}"
                      onclick="selectScheduleSlot(this, '${day}', '${time}')"></div>`;
      } else if (status === 'booked') {
        html += `<div class="time-slot-cell booked"><i class="fa-solid fa-lock"></i></div>`;
      } else {
        html += `<div class="time-slot-cell off"></div>`;
      }
    });
    html += `</div>`;
  });

  document.getElementById('timetableGrid').innerHTML = html;
}

// ── 시간 슬롯 선택 (전역 onclick) ────────────────────────────
function selectScheduleSlot(el, day, time) {
  // 이전 선택 해제
  document.querySelectorAll('.time-slot-cell.selected').forEach(c => c.classList.remove('selected'));

  if (preSelectedDay === day && preSelectedTime === time) {
    // 같은 슬롯 재클릭 → 선택 해제
    preSelectedDay  = '';
    preSelectedTime = '';
    document.getElementById('sModalSlotInfo').textContent = '시간을 선택하면 PT 신청 시 자동 입력됩니다';
    document.getElementById('sModalSlotInfo').className   = 'selected-slot-info';
  } else {
    preSelectedDay  = day;
    preSelectedTime = time;
    el.classList.add('selected');
    document.getElementById('sModalSlotInfo').textContent = `선택: ${day}요일 ${time}`;
    document.getElementById('sModalSlotInfo').className   = 'selected-slot-info has-selection';
  }
}

// ── 모달에서 PT 신청 진행 ────────────────────────────────────
async function proceedToApply() {
  const trainerNameEl = document.getElementById('sModalName');
  const trainerName = trainerNameEl.textContent.replace(' 트레이너', '');
  const t = trainers.find(x => x.name === trainerName);
  if (!t) return;

  // closeScheduleModal이 preSelected를 초기화하므로 먼저 저장
  const savedDay  = preSelectedDay;
  const savedTime = preSelectedTime;

  closeScheduleModal();

  // selectTrainer를 await: 스케줄 로드 완료 후에 요일/시간 설정
  await selectTrainer(t.id);

  // 모달에서 선택한 요일 체크 후 updateTimeOptions 명시 호출
  // (checkbox.checked = true는 onchange를 발생시키지 않으므로 직접 호출)
  if (savedDay) {
    const dayCheckbox = document.querySelector(`input[name="pDay"][value="${savedDay}"]`);
    if (dayCheckbox) dayCheckbox.checked = true;
    updateTimeOptions(); // 스케줄 로드 완료 + 요일 체크 후 갱신

    // 선택한 시간이 여전히 활성 상태일 때만 설정
    const timeSelect = document.getElementById('pTime');
    if (timeSelect && savedTime) {
      const opt = Array.from(timeSelect.options).find(o => o.value === savedTime);
      if (opt && !opt.disabled) timeSelect.value = savedTime;
    }
  }
}

// ── 트레이너 선택 (PT 신청 폼 열기) ─────────────────────────
async function selectTrainer(id) {
  const t = trainers.find(x => x.id === id);
  if (!t || !isTrainerActive(t)) return;

  selectedTrainer         = t;
  selectedSessions        = 0;
  selectedTrainerSchedule = null;

  renderTrainerGrid();

  const panel = document.getElementById('applyPanelWrap');
  panel.style.display = 'block';

  document.getElementById('selectedTrainerId').value      = t.id;
  document.getElementById('selectedTrainerRate').value    = t.ptRate || 0;
  document.getElementById('applyAvatar').textContent      = (t.name || '?')[0];
  document.getElementById('applyTrainerName').textContent = t.name || '';
  document.getElementById('applyTrainerSpec').textContent = `${t.specialty || ''} · ${Number(t.ptRate || 0).toLocaleString()}원/회`;

  updateSessionButtons(t.ptRate || 0);

  document.getElementById('paymentAmount').textContent = '-';
  document.getElementById('paymentCalc').textContent   = '세션 수를 선택해 주세요';

  // 요일 체크박스에 변경 이벤트 등록 (중복 방지: onchange 사용)
  document.querySelectorAll('input[name="pDay"]').forEach(cb => {
    cb.onchange = updateTimeOptions;
  });

  // 트레이너 시간표 로드 후 시간 드롭다운 갱신
  try {
    selectedTrainerSchedule = await callGet('getTrainerSchedule', { trainerId: id });
    updateTimeOptions();
  } catch(e) {
    console.warn('[PT] 시간표 로드 실패:', e);
  }

  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 선택된 요일 기준으로 시간 드롭다운의 예약됨/휴무 항목을 비활성화
 */
function updateTimeOptions() {
  const selectedDays = [...document.querySelectorAll('input[name="pDay"]:checked')].map(cb => cb.value);
  const timeSelect   = document.getElementById('pTime');
  const slots        = selectedTrainerSchedule?.slots;
  const workDays     = selectedTrainerSchedule?.workDays || ['월','화','수','목','금'];

  Array.from(timeSelect.options).forEach(opt => {
    if (!opt.value) return;

    opt.textContent = opt.textContent.replace(/\s*\(예약됨\)|\s*\(휴무\)/g, '');
    opt.disabled    = false;

    if (!slots || selectedDays.length === 0) return;

    let hasBooked    = false;
    let allUnavailable = true; // 선택 요일 전체가 사용 불가이면 true

    selectedDays.forEach(day => {
      const status    = slots[day] ? slots[day][opt.value] : undefined;
      const isWorkDay = workDays.includes(day);

      if (status === 'booked') {
        hasBooked = true;
      }

      // 해당 요일에 이 시간이 '예약 가능'한 경우:
      // - 근무일이고 status가 'available'이거나 workHours에 없는 시간(undefined)인 경우
      const isAvailable = isWorkDay && (status === 'available' || status === undefined);
      if (isAvailable) allUnavailable = false;
    });

    if (hasBooked) {
      opt.disabled    = true;
      opt.textContent += ' (예약됨)';
    } else if (allUnavailable) {
      opt.disabled    = true;
      opt.textContent += ' (휴무)';
    }
  });

  if (timeSelect.value && timeSelect.options[timeSelect.selectedIndex]?.disabled) {
    timeSelect.value = '';
  }
}

function cancelTrainerSelect() {
  selectedTrainer         = null;
  selectedSessions        = 0;
  selectedTrainerSchedule = null;
  preSelectedDay          = '';
  preSelectedTime         = '';
  // 요일 이벤트 해제
  document.querySelectorAll('input[name="pDay"]').forEach(cb => { cb.onchange = null; });
  document.getElementById('applyPanelWrap').style.display = 'none';
  document.getElementById('ptForm').reset();
  renderTrainerGrid();
}

// ── 세션 버튼 레이블 업데이트 (금액 표시) ────────────────────
function updateSessionButtons(rate) {
  document.querySelectorAll('.session-btn').forEach(btn => {
    const sessions = Number(btn.dataset.sessions);
    const label    = btn.querySelector('.session-btn-label');
    const pop      = sessions === 20 ? '<span style="font-size:0.6rem; opacity:0.7;">(인기)</span>' : '';
    label.innerHTML = `회 ${pop}<br><span style="font-size:0.7rem;">${(sessions * rate).toLocaleString()}원</span>`;
    if (btn.classList.contains('active')) label.style.color = 'rgba(255,255,255,0.9)';
  });
}

// ── 세션 선택 (전역 onclick) ─────────────────────────────────
function selectSessions(el) {
  document.querySelectorAll('.session-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedSessions = Number(el.dataset.sessions);

  const rate   = Number(document.getElementById('selectedTrainerRate').value) || 0;
  const total  = selectedSessions * rate;

  document.getElementById('paymentAmount').textContent = `${total.toLocaleString()}원`;
  document.getElementById('paymentCalc').textContent   =
    `${selectedSessions}회 × ${rate.toLocaleString()}원`;
}

// ── PT 신청 폼 제출 ──────────────────────────────────────────
async function handleApplySubmit(e) {
  e.preventDefault();

  if (!selectedTrainer) { alert('트레이너를 선택해 주세요.'); return; }
  if (selectedSessions === 0) { alert('계약 세션 수를 선택해 주세요.'); return; }

  const days = [...document.querySelectorAll('input[name="pDay"]:checked')].map(i => i.value);
  if (days.length === 0) { alert('선호 요일을 1개 이상 선택해 주세요.'); return; }

  const time = document.getElementById('pTime').value;
  if (!time) { alert('선호 시간대를 선택해 주세요.'); return; }

  // 선택한 요일·시간이 이미 예약된 슬롯인지 재확인
  if (selectedTrainerSchedule?.slots) {
    const slots      = selectedTrainerSchedule.slots;
    const blockedDay = days.find(day => slots[day] && slots[day][time] === 'booked');
    if (blockedDay) {
      alert(`${blockedDay}요일 ${time}은(는) 이미 다른 회원이 예약한 시간입니다.\n다른 시간을 선택해 주세요.`);
      return;
    }
  }

  const memo  = document.getElementById('pMemo').value.trim();
  const rate  = Number(document.getElementById('selectedTrainerRate').value) || 0;
  const total = selectedSessions * rate;

  const confirmed = confirm(
    `PT 계약을 신청하시겠습니까?\n\n` +
    `트레이너: ${selectedTrainer.name}\n` +
    `세션 수: ${selectedSessions}회\n` +
    `선호 요일: ${days.join('·')}\n` +
    `선호 시간: ${time}\n` +
    `예상 금액: ${total.toLocaleString()}원`
  );
  if (!confirmed) return;

  const payload = {
    userId:    currentUserId,
    trainerId: selectedTrainer.id,
    trainerName: selectedTrainer.name,
    sessions:  selectedSessions,
    days:      days.join(','),
    time,
    memo,
    totalAmount: total,
  };

  try {
    await callPost('registerPT', payload);
    showToast(`${selectedTrainer.name} 트레이너에게 PT 신청이 완료되었습니다!`);
    cancelTrainerSelect();
    // PT 현황 재로드
    const ptData = await callGet('getPT', { userId: currentUserId });
    myPTContracts = ptData?.contracts || [];
    nextSchedule  = ptData?.nextSchedule || null;
    renderPTStatus();
  } catch(err) {
    console.error('[PT] 신청 실패:', err);
  }
}

// ── 유틸 ─────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg, type = 'success') {
  const old = document.getElementById('ironfit-toast');
  if (old) old.remove();
  const c = type === 'danger'
    ? { bg: '#FCE8E6', color: 'var(--color-danger)',  icon: 'fa-circle-xmark' }
    : { bg: '#E6F4EA', color: 'var(--color-success)', icon: 'fa-circle-check' };
  const toast = document.createElement('div');
  toast.id = 'ironfit-toast';
  toast.style.cssText = `
    position:fixed; bottom:2rem; right:2rem; z-index:99999;
    background:${c.bg}; color:${c.color};
    border:1.5px solid ${c.color}; border-radius:10px;
    padding:0.85rem 1.25rem; font-weight:600; font-size:0.9rem;
    display:flex; align-items:center; gap:0.6rem;
    box-shadow:0 8px 24px rgba(0,0,0,0.12);`;
  toast.innerHTML = `<i class="fa-solid ${c.icon}"></i> ${escHtml(msg)}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
