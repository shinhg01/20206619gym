/**
 * 아이언핏 GYM - 트레이너 관리 페이지 (trainer.js)
 *
 * 담당 회원 목록, 주간 PT 일정 그리드, 출석 체크,
 * 회원 상세 모달(운동기록/신체변화/식단/코멘트 탭) 제어
 */

// ── 전역 상태 ────────────────────────────────────────────────
let dashMembers      = [];
let weeklySchedule   = {};
let dashStats        = {};
let currentTrainerId = '';
let currentUserId    = '';
let currentRole      = '';
let myPTRequests          = [];
let pendingApprovalRequest = null;

// 회원 상세 모달 상태
let detailMemberId   = null;
let detailMemberName = '';
let activeDetailTab  = 'workout';
let detailCache      = {};     // memberId → { workout, body, diet }
let detailBodyChart  = null;

// 오늘 기준
const TODAY_STR = new Date().toISOString().slice(0, 10);
const TODAY_DOW = ['일','월','화','수','목','금','토'][new Date().getDay()];
const DAYS = ['월','화','수','목','금','토','일'];

// 회원 아바타 색상
const AVATAR_PALETTE = [
  { bg: '#EEF2FF', color: '#4F46E5' },
  { bg: '#FDF0EE', color: '#E8593C' },
  { bg: '#E6F4EA', color: '#16A34A' },
  { bg: '#FFF8E6', color: '#D97706' },
  { bg: '#F0F9FF', color: '#0284C7' },
];

// 목 코멘트 저장소 (인메모리)
const MOCK_COMMENTS = {
  'user': [
    { date: '2026-05-28', text: '오늘 스쿼트 폼이 많이 개선되었습니다! 무게 점진적으로 올려도 좋을 것 같아요.' },
    { date: '2026-05-22', text: '어깨 충돌 증후군 주의. 오버헤드 운동 시 무게를 조금 줄이고 레인지 신경 쓰세요.' },
  ]
};

// ── 이번 주 날짜 계산 ────────────────────────────────────────
function getThisWeekDates() {
  const today   = new Date();
  const dow     = today.getDay(); // 0=일
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday  = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// ── 초기화 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const userId = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ID);
  const name   = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_NAME);
  const role   = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ROLE);
  const status = sessionStorage.getItem(CONFIG.SESSION_KEYS.STATUS);

  if (!userId) { window.location.href = 'index.html'; return; }
  if (role !== '트레이너' && role !== '관리자') {
    window.location.href = 'dashboard.html'; return;
  }

  currentUserId    = userId;
  currentRole      = role;
  currentTrainerId = userId; // 트레이너 userId가 trainerId로 사용됨

  // 프로필 UI
  document.getElementById('profileName').textContent    = name;
  document.getElementById('profileRole').textContent    = role;
  document.getElementById('userAvatar').textContent     = name ? name[0] : 'T';
  document.getElementById('trainerBadge').textContent   = role;
  if (role === '관리자') {
    document.querySelector('.role-admin').style.display = 'block';
    document.getElementById('trainerBadge').className   = 'badge badge-danger';
    document.querySelector('.role-trainer').classList.remove('active');
  }

  // 햄버거 메뉴
  const menuToggle     = document.getElementById('menuToggle');
  const appSidebar     = document.getElementById('appSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => { appSidebar.classList.add('open'); sidebarOverlay.classList.add('show'); });
    sidebarOverlay.addEventListener('click', () => { appSidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); });
  }

  // 로그아웃
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('로그아웃 하시겠습니까?')) { sessionStorage.clear(); window.location.href = 'index.html'; }
  });

  // 데이터 로드
  try {
    const data       = await callGet('getTrainerDashboard', { trainerId: currentTrainerId });
    dashMembers      = data.members      || [];
    weeklySchedule   = data.weeklySchedule || {};
    dashStats        = data.stats        || {};
  } catch(e) {
    console.error('[TRAINER] 데이터 로드 실패:', e);
  }

  // PT 신청 대기 알람 (관리자는 전체, 트레이너는 본인 담당 신청만)
  try {
    const ptParams = role === '관리자' ? {} : { trainerId: currentTrainerId };
    const ptData   = await callGet('getPTRequests', ptParams);
    myPTRequests   = Array.isArray(ptData) ? ptData : [];
  } catch(e) {
    console.error('[TRAINER] PT 신청 목록 로드 실패:', e);
  }

  // 렌더링
  renderPTRequests();
  renderStatCards();
  renderTodaySessions();
  renderWeeklyGrid();
  renderMemberTable();
});

// ── PT 신청 대기 알람 카드 ───────────────────────────────────
function renderPTRequests() {
  const listEl  = document.getElementById('ptRequestList');
  const badgeEl = document.getElementById('ptAlarmBadge');

  if (myPTRequests.length === 0) {
    badgeEl.style.display = 'none';
    listEl.innerHTML = '<div style="color:var(--color-text-muted); font-size:0.85rem; padding:0.5rem 0;">현재 대기 중인 PT 신청이 없습니다.</div>';
    return;
  }

  badgeEl.textContent = myPTRequests.length;
  badgeEl.style.display = '';

  listEl.innerHTML = myPTRequests.map(r => `
    <div class="pt-request-item" data-id="${escHtml(r.신청ID)}">
      <div class="pt-req-name">${escHtml(r.회원명)} 회원</div>
      <div class="pt-req-meta">
        신청일시: ${escHtml(r.신청일시)}${r.선호요일 ? `<br>선호 요일: ${escHtml(r.선호요일)}` : ''}${r.선호시간 ? ` · ${escHtml(r.선호시간)}` : ''}${r.선호세션수 ? ` · ${escHtml(String(r.선호세션수))}회` : ''}
      </div>
      <div class="pt-request-actions">
        <button class="btn-approve" onclick="openApprovalModal('${escHtml(r.신청ID)}')">승인</button>
        <button class="btn-reject" onclick="respondPTRequest('${escHtml(r.신청ID)}','거절',this)">거절</button>
      </div>
    </div>`).join('');
}

async function respondPTRequest(requestId, status, btn) {
  const item = btn.closest('.pt-request-item');
  item.style.opacity = '0.5';
  btn.parentElement.querySelectorAll('button').forEach(b => b.disabled = true);

  try {
    await callPost('updatePTRequest', { 신청ID: requestId, 상태: status });
    myPTRequests = myPTRequests.filter(r => r.신청ID !== requestId);
    showToast(status === '승인' ? '승인되었습니다' : '거절되었습니다');
    renderPTRequests();
  } catch(e) {
    item.style.opacity = '1';
    btn.parentElement.querySelectorAll('button').forEach(b => b.disabled = false);
    showToast('처리 중 오류가 발생했습니다.', 'danger');
  }
}

// ── PT 승인 모달 ─────────────────────────────────────────────
function openApprovalModal(requestId) {
  pendingApprovalRequest = myPTRequests.find(r => r.신청ID === requestId);
  if (!pendingApprovalRequest) return;

  document.getElementById('approvalMemberName').textContent  = pendingApprovalRequest.회원명  || '—';
  document.getElementById('approvalTrainerName').textContent = pendingApprovalRequest.트레이너명 || '—';

  // 폼 초기화 후 회원 선호 정보 자동 채우기
  const prefSessions = pendingApprovalRequest.선호세션수 || 0;
  const prefDays     = String(pendingApprovalRequest.선호요일 || '').split(',').map(d => d.trim()).filter(Boolean);
  const prefTime     = pendingApprovalRequest.선호시간 || '';

  document.getElementById('approvalSessions').value  = prefSessions || '';
  document.getElementById('approvalTime').value      = prefTime;
  document.getElementById('approvalStartDate').value = TODAY_STR;
  document.getElementById('approvalAmount').value    = '';
  document.getElementById('approvalMemo').value      = '';

  // 선호 요일 체크박스 자동 선택
  document.querySelectorAll('input[name="approvalDay"]').forEach(cb => {
    cb.checked = prefDays.includes(cb.value);
  });

  // 세션 프리셋 버튼 활성화 (텍스트에서 숫자만 추출: "10회" → 10)
  document.querySelectorAll('.session-preset-btn').forEach(b => {
    const btnCount = parseInt(b.textContent, 10);
    b.classList.toggle('active', prefSessions > 0 && btnCount === prefSessions);
  });

  document.getElementById('trainerApprovalBackdrop').style.display = 'flex';
}

function closeApprovalModal() {
  document.getElementById('trainerApprovalBackdrop').style.display = 'none';
  pendingApprovalRequest = null;
}

function handleApprovalBackdrop(e) {
  if (e.target === document.getElementById('trainerApprovalBackdrop')) closeApprovalModal();
}

function setApprovalSessions(btn, count) {
  document.getElementById('approvalSessions').value = count;
  document.querySelectorAll('.session-preset-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function clearSessionPreset() {
  document.querySelectorAll('.session-preset-btn').forEach(b => b.classList.remove('active'));
}

async function submitApproval() {
  if (!pendingApprovalRequest) return;

  const sessions = parseInt(document.getElementById('approvalSessions').value, 10);
  const days     = [...document.querySelectorAll('input[name="approvalDay"]:checked')].map(cb => cb.value);
  const time     = document.getElementById('approvalTime').value;
  const startDate= document.getElementById('approvalStartDate').value;
  const amount   = document.getElementById('approvalAmount').value;
  const memo     = document.getElementById('approvalMemo').value.trim();

  if (!sessions || sessions < 1) { alert('총 세션 수를 입력해 주세요.'); return; }
  if (days.length === 0)          { alert('PT 요일을 하나 이상 선택해 주세요.'); return; }
  if (!time)                      { alert('PT 시간을 선택해 주세요.'); return; }
  if (!startDate)                 { alert('시작일을 입력해 주세요.'); return; }

  const submitBtn = document.getElementById('approvalSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 처리 중...';

  try {
    const res = await callPost('approvePTRequest', {
      신청ID:  pendingApprovalRequest.신청ID,
      트레이너ID: pendingApprovalRequest.트레이너ID,
      트레이너명: pendingApprovalRequest.트레이너명,
      회원명:  pendingApprovalRequest.회원명,
      세션수:  sessions,
      요일:    days.join(','),
      시간:    time,
      시작일:  startDate,
      금액:    amount || '0',
      메모:    memo,
    });

    if (res && res.success === false) {
      alert(res.message || '승인 처리에 실패했습니다.');
      return;
    }

    const approvedId = pendingApprovalRequest.신청ID;
    myPTRequests = myPTRequests.filter(r => r.신청ID !== approvedId);
    closeApprovalModal();
    showToast(`${pendingApprovalRequest ? '' : ''}PT 계약이 등록되었습니다.`);
    renderPTRequests();

    // 대시보드 데이터 새로고침
    try {
      const data = await callGet('getTrainerDashboard', { trainerId: currentTrainerId });
      dashMembers    = data.members       || [];
      weeklySchedule = data.weeklySchedule || {};
      dashStats      = data.stats         || {};
      renderStatCards();
      renderTodaySessions();
      renderWeeklyGrid();
      renderMemberTable();
    } catch(e) { /* 새로고침 실패는 무시 */ }

  } catch(e) {
    alert('PT 등록 중 오류가 발생했습니다.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span>✓</span> PT 등록 승인';
  }
}

// ── 통계 카드 ────────────────────────────────────────────────
function renderStatCards() {
  const todayCount = (weeklySchedule[TODAY_DOW] || []).length;
  const cards = [
    { icon: 'fa-users',         bg: '#EEF2FF', color: '#4F46E5', label: '담당 회원', value: dashStats.memberCount || 0, sub: '명' },
    { icon: 'fa-calendar-day',  bg: '#FFF7ED', color: '#EA580C', label: '오늘 수업',  value: todayCount,                  sub: `건 (${TODAY_DOW}요일)` },
    { icon: 'fa-chart-line',    bg: '#E6F4EA', color: '#16A34A', label: '평균 출석률', value: `${dashStats.avgAttendance || 0}`, sub: '%' },
    { icon: 'fa-layer-group',   bg: '#F0F9FF', color: '#0284C7', label: '잔여 세션',  value: dashStats.totalRemaining || 0, sub: '회 (전체)' },
  ];

  document.getElementById('statGrid').innerHTML = cards.map(c => `
    <div class="t-stat-card">
      <div class="t-stat-icon" style="background:${c.bg}; color:${c.color};">
        <i class="fa-solid ${c.icon}"></i>
      </div>
      <div>
        <div class="t-stat-label">${c.label}</div>
        <div class="t-stat-value" style="color:${c.color};">${c.value}<span style="font-size:1rem; opacity:0.7;"> ${c.sub}</span></div>
      </div>
    </div>`).join('');
}

// ── 오늘의 수업 ──────────────────────────────────────────────
function renderTodaySessions() {
  const todaySessions = weeklySchedule[TODAY_DOW] || [];
  const badge = document.getElementById('todayCountBadge');
  const wrap  = document.getElementById('todaySessionsWrap');

  badge.textContent = `${todaySessions.length}건`;

  if (todaySessions.length === 0) {
    wrap.innerHTML = `<div class="no-today-msg"><i class="fa-regular fa-calendar-xmark" style="margin-right:0.4rem;"></i>오늘(${TODAY_DOW}요일)은 예약된 수업이 없습니다.</div>`;
    return;
  }

  wrap.innerHTML = todaySessions.map(s => {
    const member = dashMembers.find(m => m.memberId === s.memberId);
    const pal    = AVATAR_PALETTE[dashMembers.indexOf(member) % AVATAR_PALETTE.length];
    const isDone = false; // 실제 구현 시 출석 완료 여부 체크
    return `
      <div class="today-session-card ${isDone ? 'done' : ''}" id="today-card-${escHtml(s.ptId)}">
        <div class="session-avatar" style="${isDone ? '' : `background:${pal.color};`}">${(s.memberName || '?')[0]}</div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:700; font-size:0.9rem;">${escHtml(s.memberName)}</div>
          <div style="font-size:0.78rem; color:var(--color-text-muted);">${escHtml(s.time)} · ${TODAY_DOW}요일</div>
        </div>
        ${isDone
          ? `<div class="attend-btn done"><i class="fa-solid fa-check"></i> 완료</div>`
          : `<button class="attend-btn" onclick="markAttendance('${escHtml(s.ptId)}','${escHtml(s.memberName)}',this)">
               <i class="fa-solid fa-check"></i> 출석 체크
             </button>`}
      </div>`;
  }).join('');
}

// ── 출석 체크 ────────────────────────────────────────────────
async function markAttendance(ptId, memberName, btn) {
  if (!confirm(`${memberName} 회원의 수업을 완료 처리하시겠습니까?`)) return;

  try {
    await callPost('markAttendance', { ptId, date: TODAY_STR });

    // 로컬 상태 즉시 업데이트
    const m = dashMembers.find(x => x.ptId === ptId);
    if (m) {
      m.remainingSessions  = Math.max(0, m.remainingSessions - 1);
      m.completedSessions  = m.completedSessions + 1;
      m.attendanceRate     = m.totalSessions > 0
        ? Math.round((m.completedSessions / m.totalSessions) * 100) : 0;
    }

    // 버튼을 "완료" 상태로 전환
    const card = document.getElementById(`today-card-${ptId}`);
    if (card) {
      card.classList.add('done');
      const b = card.querySelector('.attend-btn');
      if (b) { b.innerHTML = '<i class="fa-solid fa-check"></i> 완료'; b.classList.add('done'); }
    }

    // 회원 테이블 새로고침
    renderMemberTable();
    renderStatCards();
    showToast(`${memberName} 회원 출석 처리 완료`);
  } catch(e) {
    console.error('[ATTEND]', e);
    showToast('출석 처리 중 오류가 발생했습니다.', 'danger');
  }
}

// ── 주간 PT 일정 그리드 ──────────────────────────────────────
function renderWeeklyGrid() {
  const weekDates = getThisWeekDates();
  const table     = document.getElementById('weeklyGrid');

  // 이번 주에 세션이 있는 시간대 추출 (정렬)
  const allTimes = [...new Set(
    Object.values(weeklySchedule).flat().map(s => s.time)
  )].sort();

  const totalSessions = Object.values(weeklySchedule).reduce((s, arr) => s + arr.length, 0);
  document.getElementById('weeklyCountBadge').textContent = `주 ${totalSessions}회`;

  if (allTimes.length === 0) {
    table.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:var(--color-text-muted);">등록된 PT 일정이 없습니다.</td></tr>`;
    return;
  }

  // 헤더 행
  let html = `<thead><tr>
    <th class="wg-time-head">시간대</th>`;
  DAYS.forEach((day, i) => {
    const dateObj  = weekDates[i];
    const mmdd     = `${dateObj.getMonth()+1}/${dateObj.getDate()}`;
    const isToday  = dateObj.toISOString().slice(0,10) === TODAY_STR;
    html += `<th class="wg-day-head ${isToday ? 'is-today' : ''}">
      ${day}${isToday ? ' <span style="font-size:0.65rem; background:var(--color-primary); color:#FFF; border-radius:4px; padding:1px 4px;">오늘</span>' : ''}
      <span class="day-date">${mmdd}</span>
    </th>`;
  });
  html += `</tr></thead><tbody>`;

  // 데이터 행
  allTimes.forEach(time => {
    html += `<tr>`;
    html += `<td class="wg-time-label">${time}</td>`;
    DAYS.forEach(day => {
      const sessions = (weeklySchedule[day] || []).filter(s => s.time === time);
      const isToday  = day === TODAY_DOW;
      if (sessions.length === 0) {
        html += `<td class="wg-cell ${isToday ? 'today-col' : ''} empty"></td>`;
      } else {
        html += `<td class="wg-cell ${isToday ? 'today-col' : ''}">`;
        sessions.forEach(s => {
          html += `<div class="wg-session ${isToday ? 'today-session' : ''}"
                        onclick="openMemberModal('${escHtml(s.memberId)}','${escHtml(s.memberName)}')"
                        title="${escHtml(s.memberName)} · ${escHtml(s.time)} 클릭하여 상세 보기">
                     <span class="s-name">${escHtml(s.memberName)}</span>
                     <span class="s-time">${escHtml(s.time)}</span>
                   </div>`;
        });
        html += `</td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody>`;
  table.innerHTML = html;
}

// ── 담당 회원 테이블 ─────────────────────────────────────────
function renderMemberTable() {
  const tbody = document.getElementById('memberTableBody');
  document.getElementById('memberCountBadge').textContent = `${dashMembers.length}명`;

  if (dashMembers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--color-text-muted);">담당 회원이 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = dashMembers.map((m, i) => {
    const pal   = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
    const done  = m.completedSessions || 0;
    const total = m.totalSessions     || 1;
    const pct   = Math.round((done / total) * 100);
    const atColor = m.attendanceRate >= 90
      ? 'var(--color-success)' : m.attendanceRate >= 70
      ? 'var(--color-warning)' : 'var(--color-danger)';

    return `
      <tr>
        <td>
          <button class="member-name-btn" onclick="openMemberModal('${escHtml(m.memberId)}','${escHtml(m.memberName)}')">
            <div class="member-avatar-sm" style="background:${pal.bg}; color:${pal.color};">${(m.memberName||'?')[0]}</div>
            <div>
              <div style="font-weight:700; font-size:0.9rem;">${escHtml(m.memberName)}</div>
              <div style="font-size:0.72rem; color:var(--color-text-muted);">${escHtml(m.grade || 'PT회원')}</div>
            </div>
          </button>
        </td>
        <td style="font-size:0.85rem;">
          <span class="badge badge-primary" style="font-size:0.72rem;">${escHtml(m.days || '-')}</span>
          <span style="margin-left:0.3rem; color:var(--color-text-muted);">${escHtml(m.time || '')}</span>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <div class="member-progress-bar">
              <div class="member-progress-fill" style="width:${pct}%;"></div>
            </div>
            <span style="font-size:0.8rem; font-weight:600; font-family:var(--font-en);">${done}/${total}</span>
            <span style="font-size:0.72rem; color:var(--color-text-muted);">회</span>
          </div>
        </td>
        <td>
          <span style="font-weight:700; color:${atColor}; font-family:var(--font-en);">${m.attendanceRate}%</span>
        </td>
        <td style="font-size:0.83rem; color:var(--color-text-muted);">${escHtml(m.lastWorkoutDate || '-')}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="openMemberModal('${escHtml(m.memberId)}','${escHtml(m.memberName)}')">
            <i class="fa-solid fa-magnifying-glass"></i> 상세 조회
          </button>
          <button class="btn btn-danger btn-sm" style="margin-left:0.4rem;" onclick="removePTMember('${escHtml(m.memberId)}','${escHtml(m.memberName)}')">
            <i class="fa-solid fa-user-minus"></i> 제거
          </button>
        </td>
      </tr>`;
  }).join('');
}

// ── PT 회원 제거 ─────────────────────────────────────────────
async function removePTMember(memberId, memberName) {
  if (!confirm(`${memberName} 회원을 담당 PT 회원에서 제거하시겠습니까?\n(일반회원으로 전환되고 트레이너 배정이 해제됩니다)`)) return;

  try {
    const res = await callPost('removePTMember', { memberId });
    if (res && res.success === false) {
      showToast(res.message || '제거에 실패했습니다.', 'danger');
      return;
    }
    dashMembers = dashMembers.filter(m => m.memberId !== memberId);
    Object.keys(weeklySchedule).forEach(day => {
      weeklySchedule[day] = weeklySchedule[day].filter(s => s.memberId !== memberId);
    });

    // 통계 재계산
    dashStats.memberCount = dashMembers.length;
    dashStats.totalRemaining = dashMembers.reduce((s, m) => s + (m.remainingSessions || 0), 0);
    dashStats.avgAttendance = dashMembers.length > 0
      ? Math.round(dashMembers.reduce((s, m) => s + (m.attendanceRate || 0), 0) / dashMembers.length)
      : 0;

    renderStatCards();
    renderTodaySessions();
    renderWeeklyGrid();
    renderMemberTable();
    showToast(`${memberName} 회원이 담당 PT 회원에서 제거되었습니다.`);
  } catch(e) {
    showToast('제거 중 오류가 발생했습니다.', 'danger');
  }
}

// ── 회원 상세 모달 ───────────────────────────────────────────
function openMemberModal(memberId, memberName) {
  detailMemberId   = memberId;
  detailMemberName = memberName;
  activeDetailTab  = 'workout';

  const member = dashMembers.find(m => m.memberId === memberId);
  const idx    = dashMembers.indexOf(member);
  const pal    = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];

  document.getElementById('detailAvatar').textContent      = (memberName || '?')[0];
  document.getElementById('detailAvatar').style.background = pal.bg;
  document.getElementById('detailAvatar').style.color      = pal.color;
  document.getElementById('detailName').textContent = `${memberName} 회원`;
  document.getElementById('detailInfo').textContent =
    member ? `${member.days} · ${member.time} · 잔여 ${member.remainingSessions}회` : '';

  // 탭 버튼 초기화
  document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.detail-tab-btn')[0].classList.add('active');

  document.getElementById('memberModalBackdrop').style.display = 'flex';
  document.body.style.overflow = 'hidden';

  loadDetailTab('workout');
}

function closeMemberModal() {
  document.getElementById('memberModalBackdrop').style.display = 'none';
  document.body.style.overflow = '';
  if (detailBodyChart) { detailBodyChart.destroy(); detailBodyChart = null; }
}

function handleMemberModalBackdrop(e) {
  if (e.target === document.getElementById('memberModalBackdrop')) closeMemberModal();
}

function switchDetailTab(btn, tab) {
  document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeDetailTab = tab;
  loadDetailTab(tab);
}

async function loadDetailTab(tab) {
  const content = document.getElementById('detailTabContent');
  const memberId = detailMemberId;

  if (!detailCache[memberId]) detailCache[memberId] = {};

  // 로딩 표시
  content.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> 불러오는 중...</div>`;

  try {
    if (tab === 'workout') {
      if (!detailCache[memberId].workout) {
        const data = await callGet('getWorkouts', { userId: memberId });
        detailCache[memberId].workout = Array.isArray(data) ? data : [];
      }
      renderWorkoutTab(detailCache[memberId].workout);

    } else if (tab === 'body') {
      if (detailBodyChart) { detailBodyChart.destroy(); detailBodyChart = null; }
      if (!detailCache[memberId].body) {
        const data = await callGet('getBodyData', { userId: memberId });
        detailCache[memberId].body = Array.isArray(data) ? data : [];
      }
      renderBodyTab(detailCache[memberId].body);

    } else if (tab === 'diet') {
      if (!detailCache[memberId].diet) {
        const data = await callGet('getDiet', { userId: memberId, date: TODAY_STR });
        detailCache[memberId].diet = Array.isArray(data) ? data : [];
      }
      renderDietTab(detailCache[memberId].diet);

    } else if (tab === 'comment') {
      renderCommentTab();
    }
  } catch(e) {
    content.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-danger);">데이터를 불러오지 못했습니다.</div>`;
  }
}

// ── 운동기록 탭 ──────────────────────────────────────────────
function renderWorkoutTab(workouts) {
  const content = document.getElementById('detailTabContent');
  if (!workouts || workouts.length === 0) {
    content.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);"><i class="fa-solid fa-dumbbell" style="font-size:2rem; opacity:0.3; display:block; margin-bottom:0.5rem;"></i>운동 기록이 없습니다.</div>`;
    return;
  }

  const recent = [...workouts].sort((a,b) => (b.date||'').localeCompare(a.date||'')).slice(0, 15);
  content.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>날짜</th><th>부위</th><th>운동</th><th>세트</th><th>중량</th><th>횟수</th><th>메모</th>
        </tr></thead>
        <tbody>
          ${recent.map(w => `
            <tr>
              <td style="font-size:0.82rem; white-space:nowrap;">${escHtml(w.date||'-')}</td>
              <td><span class="badge badge-etc" style="font-size:0.7rem;">${escHtml(w.part||'-')}</span></td>
              <td style="font-weight:600; font-size:0.88rem;">${escHtml(w.exercise||'-')}</td>
              <td style="text-align:center;">${escHtml(String(w.sets||0))}</td>
              <td style="text-align:center;">${w.weight ? escHtml(String(w.weight))+'kg' : '-'}</td>
              <td style="text-align:center;">${escHtml(String(w.reps||0))}회</td>
              <td style="font-size:0.78rem; color:var(--color-text-muted); max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(w.memo||'')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── 신체변화 탭 ──────────────────────────────────────────────
function renderBodyTab(bodyData) {
  const content = document.getElementById('detailTabContent');
  if (!bodyData || bodyData.length === 0) {
    content.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);"><i class="fa-solid fa-weight-scale" style="font-size:2rem; opacity:0.3; display:block; margin-bottom:0.5rem;"></i>신체 측정 기록이 없습니다.</div>`;
    return;
  }

  const sorted  = [...bodyData].sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const first   = sorted[0];
  const last    = sorted[sorted.length - 1];

  function diff(a, b, field) {
    const va = Number(a[field]) || 0;
    const vb = Number(b[field]) || 0;
    const d  = (vb - va).toFixed(1);
    return { val: d, isUp: d > 0 };
  }

  const wDiff  = diff(first, last, 'weight');
  const fDiff  = diff(first, last, 'fat');
  const mDiff  = diff(first, last, 'muscle');
  const hDiff  = diff(first, last, 'waist');

  function deltaHtml(d, field) {
    const isPositive = d.isUp;
    const isGood = field === 'muscle' ? isPositive : !isPositive;
    const color  = isGood ? 'var(--color-success)' : 'var(--color-danger)';
    const arrow  = isPositive ? '▲' : '▼';
    return `<span style="color:${color}; font-size:0.78rem; font-weight:700;">${arrow} ${Math.abs(d.val)}</span>`;
  }

  content.innerHTML = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:0.75rem;">
      <button class="btn btn-outline btn-sm"
              onclick="downloadMemberBodyReport('${escHtml(detailMemberName)}')"
              style="font-size:0.8rem; display:flex; align-items:center; gap:0.35rem;">
        <i class="fa-solid fa-file-pdf" style="color:var(--color-danger);"></i> PDF 보고서
      </button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:0.75rem; margin-bottom:1.25rem;">
      ${[
        { label:'체중', val: last.weight, unit:'kg', d: wDiff, field:'weight' },
        { label:'체지방률', val: last.fat, unit:'%', d: fDiff, field:'fat' },
        { label:'근육량', val: last.muscle, unit:'kg', d: mDiff, field:'muscle' },
        { label:'허리', val: last.waist, unit:'cm', d: hDiff, field:'waist' },
      ].map(c => `
        <div style="background:#F9FAFB; border-radius:10px; padding:0.85rem; text-align:center; border:1px solid var(--border-color);">
          <div style="font-size:0.72rem; color:var(--color-text-muted); margin-bottom:0.3rem;">${c.label}</div>
          <div style="font-size:1.3rem; font-weight:800; font-family:var(--font-en);">${c.val || '-'}<span style="font-size:0.75rem; opacity:0.6;">${c.unit}</span></div>
          <div style="margin-top:0.2rem;">${c.d ? deltaHtml(c.d, c.field) : ''}</div>
        </div>`).join('')}
    </div>
    <div style="position:relative; height:200px;">
      <canvas id="detailBodyCanvas"></canvas>
    </div>`;

  // Chart.js 체중 추이
  const labels = sorted.map(d => d.date ? d.date.slice(5) : '');
  const values = sorted.map(d => Number(d.weight) || null);

  if (detailBodyChart) detailBodyChart.destroy();
  const ctx = document.getElementById('detailBodyCanvas');
  if (ctx && typeof Chart !== 'undefined') {
    detailBodyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '체중 (kg)',
          data: values,
          borderColor: '#E8593C',
          backgroundColor: 'rgba(232,89,60,0.08)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#E8593C',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { font: { size: 11 } } },
          x: { ticks: { font: { size: 10 } } }
        }
      }
    });
  }
}

// ── 식단 탭 ──────────────────────────────────────────────────
function renderDietTab(dietData) {
  const content = document.getElementById('detailTabContent');
  if (!dietData || dietData.length === 0) {
    content.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--color-text-muted);"><i class="fa-solid fa-utensils" style="font-size:2rem; opacity:0.3; display:block; margin-bottom:0.5rem;"></i>오늘(${TODAY_STR}) 식단 기록이 없습니다.</div>`;
    return;
  }

  const total = { kcal: 0, carb: 0, protein: 0, fat: 0 };
  dietData.forEach(d => {
    total.kcal    += Number(d.kcal)    || 0;
    total.carb    += Number(d.carb)    || 0;
    total.protein += Number(d.protein) || 0;
    total.fat     += Number(d.fat)     || 0;
  });

  const MEAL_COLORS = { '아침':'#F59E0B', '점심':'#3B82F6', '저녁':'#8B5CF6', '간식':'#10B981' };

  content.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:0.75rem; margin-bottom:1.25rem;">
      ${[
        { label:'칼로리', val: total.kcal, unit:'kcal', color:'var(--color-primary)' },
        { label:'탄수화물', val: total.carb, unit:'g', color:'#3B82F6' },
        { label:'단백질', val: total.protein, unit:'g', color:'#10B981' },
        { label:'지방', val: total.fat, unit:'g', color:'#F59E0B' },
      ].map(c => `
        <div style="background:#F9FAFB; border-radius:10px; padding:0.85rem; text-align:center; border:1px solid var(--border-color);">
          <div style="font-size:0.72rem; color:var(--color-text-muted); margin-bottom:0.3rem;">${c.label}</div>
          <div style="font-size:1.2rem; font-weight:800; font-family:var(--font-en); color:${c.color};">${c.val}<span style="font-size:0.72rem; opacity:0.7;"> ${c.unit}</span></div>
        </div>`).join('')}
    </div>
    <div style="display:flex; flex-direction:column; gap:0.6rem;">
      ${dietData.map(d => `
        <div style="display:flex; align-items:center; gap:0.75rem; padding:0.7rem 0.9rem; background:#F9FAFB; border-radius:10px; border-left:3px solid ${MEAL_COLORS[d.meal]||'#9CA3AF'};">
          <span class="badge" style="background:${MEAL_COLORS[d.meal]||'#9CA3AF'}; color:#FFF; font-size:0.72rem; flex-shrink:0;">${escHtml(d.meal)}</span>
          <span style="flex:1; font-weight:600; font-size:0.88rem;">${escHtml(d.food)}</span>
          <span style="font-size:0.82rem; color:var(--color-primary); font-weight:700;">${d.kcal||0}kcal</span>
        </div>`).join('')}
    </div>`;
}

// ── 코멘트 탭 ────────────────────────────────────────────────
function renderCommentTab() {
  const content  = document.getElementById('detailTabContent');
  const comments = MOCK_COMMENTS[detailMemberId] || [];

  content.innerHTML = `
    <div id="commentList" style="margin-bottom:1.25rem;">
      ${comments.length === 0
        ? `<div style="text-align:center; padding:1.5rem; color:var(--color-text-muted);">작성된 코멘트가 없습니다.</div>`
        : comments.map(c => `
            <div class="comment-item">
              <div class="comment-date"><i class="fa-regular fa-calendar" style="margin-right:0.3rem;"></i>${escHtml(c.date)}</div>
              <div>${escHtml(c.text)}</div>
            </div>`).join('')}
    </div>
    <div style="border-top:1px solid var(--border-color); padding-top:1rem;">
      <label class="form-label">새 코멘트 작성</label>
      <textarea class="form-textarea" id="commentInput" rows="3" placeholder="회원에게 남길 코멘트, 지도 메모, 주의사항 등을 입력하세요..." style="min-height:80px;"></textarea>
      <button class="btn btn-primary btn-sm" style="margin-top:0.6rem;" onclick="submitComment()">
        <i class="fa-solid fa-paper-plane"></i> 코멘트 저장
      </button>
    </div>`;
}

function submitComment() {
  const input = document.getElementById('commentInput');
  const text  = input ? input.value.trim() : '';
  if (!text) { alert('코멘트를 입력해 주세요.'); return; }

  if (!MOCK_COMMENTS[detailMemberId]) MOCK_COMMENTS[detailMemberId] = [];
  MOCK_COMMENTS[detailMemberId].unshift({ date: TODAY_STR, text });
  input.value = '';
  renderCommentTab();
  showToast('코멘트가 저장되었습니다.');
}

// ── 유틸 ─────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── PT 회원 신체 기록 PDF 다운로드 ──────────────────────────
function downloadMemberBodyReport(memberName) {
  const trainerName = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_NAME) || '';
  const bodyData    = detailCache[detailMemberId]?.body || [];
  generateBodyReport(memberName, bodyData, trainerName);
}

function showToast(msg, type = 'success') {
  const old = document.getElementById('ironfit-toast');
  if (old) old.remove();
  const c = type === 'danger'
    ? { bg:'#FCE8E6', color:'var(--color-danger)',  icon:'fa-circle-xmark'  }
    : { bg:'#E6F4EA', color:'var(--color-success)', icon:'fa-circle-check' };
  const t = document.createElement('div');
  t.id = 'ironfit-toast';
  t.style.cssText = `position:fixed;bottom:2rem;right:2rem;z-index:99999;background:${c.bg};color:${c.color};border:1.5px solid ${c.color};border-radius:10px;padding:0.85rem 1.25rem;font-weight:600;font-size:0.9rem;display:flex;align-items:center;gap:0.6rem;box-shadow:0 8px 24px rgba(0,0,0,0.12);`;
  t.innerHTML = `<i class="fa-solid ${c.icon}"></i> ${escHtml(msg)}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
