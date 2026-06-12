/**
 * 아이언핏 GYM - 시스템 관리자 페이지 (admin.js)
 *
 * 4개 탭: 회원관리 / 결제관리 / 기구관리 / 트레이너매핑
 */

// ── 전역 상태 ────────────────────────────────────────────────
let allMembers     = [];
let allPayments    = [];
let allEquipment   = [];
let allTrainers    = [];
let allPTRequests  = [];
let equipFilter    = '전체';

// 기본값 — getTrainers 로드 후 덮어씀
let TRAINER_LIST = [
  { id: 'T001', name: '김코치' },
  { id: 'T002', name: '이지수' },
  { id: 'T003', name: '박강훈' },
  { id: 'T004', name: '최유리' },
];

// ── 초기화 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // 세션 검증
  const userId = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ID);
  const name   = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_NAME);
  const role   = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ROLE);

  if (!userId) { alert('로그인이 필요합니다.'); window.location.href = 'index.html'; return; }
  if (role !== '관리자') { alert('관리자 권한이 필요합니다.'); window.location.href = 'dashboard.html'; return; }

  // 프로필 UI
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileRole').textContent = role;
  document.getElementById('userAvatar').textContent  = name ? name[0] : 'A';
  document.querySelector('.role-admin').style.display = 'block';

  // 햄버거 메뉴
  const menuToggle     = document.getElementById('menuToggle');
  const appSidebar     = document.getElementById('appSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  menuToggle.addEventListener('click', () => { appSidebar.classList.add('open'); sidebarOverlay.classList.add('show'); });
  sidebarOverlay.addEventListener('click', () => { appSidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); });

  // 로그아웃
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('로그아웃 하시겠습니까?')) { sessionStorage.clear(); window.location.href = 'index.html'; }
  });

  // 데이터 로드
  await loadAllData();
});

async function loadAllData() {
  try {
    const [memberRows, payRows, equipRows, trainerRows, ptRequestRows] = await Promise.all([
      callGet('getMembers',  {}),
      callGet('getPayments', {}),
      callGet('getEquipment', {}),
      callGet('getTrainers', {}),
      callGet('getPTRequests', {}),
    ]);
    allMembers    = parseMemberRows(memberRows);
    allPayments   = parsePaymentRows(payRows);
    allEquipment  = parseEquipRows(equipRows);
    allTrainers   = parseTrainerRows(trainerRows);
    allPTRequests = Array.isArray(ptRequestRows) ? ptRequestRows : [];
    if (allTrainers.length > 0) TRAINER_LIST = allTrainers;
  } catch (e) {
    console.error('[ADMIN] 데이터 로드 실패:', e);
  }
  renderAll();
}

// ── 파싱 ─────────────────────────────────────────────────────
function parseMemberRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  return rows.slice(1).map(r => ({
    id:      String(r[0] || ''),
    name:    String(r[1] || ''),
    gender:  String(r[2] || ''),
    age:     Number(r[3]) || 0,
    grade:   String(r[4] || ''),
    regDate: String(r[5] || ''),
    expiry:  String(r[6] || ''),
    trainer: String(r[7] || ''),
    phone:   String(r[8] || ''),
    status:  String(r[9] || '활동중'),
  }));
}

function parsePaymentRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  return rows.slice(1).map(r => ({
    payId:   String(r[0] || ''),
    memberId:String(r[1] || ''),
    name:    String(r[2] || ''),
    product: String(r[3] || ''),
    amount:  Number(r[4]) || 0,
    payDate: String(r[5] || ''),
    expiry:  String(r[6] || ''),
    status:  String(r[7] || ''),
  }));
}

function parseEquipRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  return rows.slice(1).map(r => ({
    id:       String(r[0] || ''),
    category: String(r[1] || ''),
    name:     String(r[2] || ''),
    qty:      Number(r[3]) || 0,
    status:   String(r[4] || '정상'),
  }));
}

function parseTrainerRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  // getTrainers returns array of objects (not 2D array)
  if (typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
    return rows.map(r => ({ id: String(r.id || ''), name: String(r.name || '') }));
  }
  if (rows.length < 2) return [];
  return rows.slice(1).map(r => ({ id: String(r[0] || ''), name: String(r[1] || '') }));
}

// ── 탭 전환 ──────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.admin-tab-btn').forEach((btn, i) => {
    const tabs = ['members','payments','equipment','trainers'];
    btn.classList.toggle('active', tabs[i] === tab);
  });
  document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
}

// ── 전체 렌더 ────────────────────────────────────────────────
function renderAll() {
  renderPTRequests();
  renderStatCards();
  renderMemberTable();
  renderPayments();
  renderEquipTable();
  renderTrainerMapping();
  updateBadges();
}

// ── PT 신청 대기 알람 카드 ────────────────────────────────────
function renderPTRequests() {
  const listEl  = document.getElementById('ptRequestList');
  const badgeEl = document.getElementById('ptAlarmBadge');

  if (allPTRequests.length === 0) {
    badgeEl.style.display = 'none';
    listEl.innerHTML = '<div style="color:var(--color-text-muted); font-size:0.85rem; padding:0.5rem 0;">현재 대기 중인 PT 신청이 없습니다.</div>';
    return;
  }

  badgeEl.textContent = allPTRequests.length;
  badgeEl.style.display = '';

  listEl.innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:0.75rem;">
      ${allPTRequests.map(r => `
        <div class="pt-request-item" data-id="${escHtml(r.신청ID)}">
          <div class="pt-req-name">${escHtml(r.트레이너명)} 트레이너</div>
          <div class="pt-req-meta">
            신청일시: ${escHtml(r.신청일시)}<br>
            회원: ${escHtml(r.회원명)}
          </div>
          <div class="pt-request-actions">
            <button class="btn-approve" onclick="respondPTRequest('${escHtml(r.신청ID)}','승인',this)">승인</button>
            <button class="btn-reject" onclick="respondPTRequest('${escHtml(r.신청ID)}','거절',this)">거절</button>
          </div>
        </div>`).join('')}
    </div>`;
}

async function respondPTRequest(requestId, status, btn) {
  const item = btn.closest('.pt-request-item');
  item.style.opacity = '0.5';
  btn.parentElement.querySelectorAll('button').forEach(b => b.disabled = true);

  try {
    await callPost('updatePTRequest', { 신청ID: requestId, 상태: status });
    allPTRequests = allPTRequests.filter(r => r.신청ID !== requestId);
    showToast(status === '승인' ? '승인되었습니다' : '거절되었습니다');
    renderPTRequests();
  } catch (e) {
    item.style.opacity = '1';
    btn.parentElement.querySelectorAll('button').forEach(b => b.disabled = false);
    alert('처리 중 오류가 발생했습니다.');
  }
}

// ── 요약 통계 카드 ────────────────────────────────────────────
function renderStatCards() {
  const today = new Date(); today.setHours(0,0,0,0);
  const expirySoon = allMembers.filter(m => {
    if (!m.expiry) return false;
    const d = new Date(m.expiry);
    const diff = (d - today) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;
  const unpaid = allPayments.filter(p => p.status === '미수금').length;
  const broken = allEquipment.filter(e => e.status === '고장').length;

  const cards = [
    { label: '전체 회원', value: allMembers.length, icon: 'fa-users', bg: '#EEF2FF', color: '#4F46E5' },
    { label: '만료 임박 (7일)', value: expirySoon, icon: 'fa-calendar-xmark', bg: '#FEF3C7', color: '#D97706' },
    { label: '미수금 건수', value: unpaid, icon: 'fa-circle-exclamation', bg: '#FEE2E2', color: '#DC2626' },
    { label: '고장 기구', value: broken, icon: 'fa-wrench', bg: '#F1F5F9', color: '#64748B' },
  ];

  document.getElementById('adminStatRow').innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-icon" style="background:${c.bg}; color:${c.color};">
        <i class="fa-solid ${c.icon}"></i>
      </div>
      <div>
        <div class="stat-val">${c.value}</div>
        <div class="stat-lbl">${c.label}</div>
      </div>
    </div>`).join('');
}

// ── 배지 업데이트 ─────────────────────────────────────────────
function updateBadges() {
  const today = new Date(); today.setHours(0,0,0,0);
  const expirySoon = allMembers.filter(m => {
    if (!m.expiry) return false;
    const d = new Date(m.expiry);
    const diff = (d - today) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;
  const unpaid = allPayments.filter(p => p.status === '미수금').length;

  const eb = document.getElementById('expiryBadge');
  if (expirySoon > 0) { eb.textContent = expirySoon; eb.style.display = ''; }
  else eb.style.display = 'none';

  const ub = document.getElementById('unpaidBadge');
  if (unpaid > 0) { ub.textContent = unpaid; ub.style.display = ''; }
  else ub.style.display = 'none';

  const ab = document.getElementById('alertBadge');
  const total = expirySoon + unpaid;
  if (total > 0) { ab.textContent = `알림 ${total}건`; ab.style.display = ''; }
  else ab.style.display = 'none';
}

// ── 탭 1: 회원 목록 렌더 ────────────────────────────────────
function renderMemberTable() {
  const today = new Date(); today.setHours(0,0,0,0);
  const tbody = document.getElementById('memberTableBody');
  tbody.innerHTML = allMembers.map(m => {
    const expDate = m.expiry ? new Date(m.expiry) : null;
    const diff = expDate ? Math.ceil((expDate - today) / 86400000) : null;
    let expiryHtml = escHtml(m.expiry || '-');
    if (diff !== null && diff <= 7 && diff >= 0) {
      const cls = diff <= 3 ? 'expiry-warn expiry-danger' : 'expiry-warn';
      expiryHtml += ` <span class="${cls}"><i class="fa-solid fa-bell"></i>${diff}일 남음</span>`;
    } else if (diff !== null && diff < 0) {
      expiryHtml += ` <span class="expiry-warn expiry-danger">만료됨</span>`;
    }

    const gradeCls = m.grade === 'PT회원' ? 'status-ok' : 'status-pause';
    const statusCls = m.status === '활동중' ? 'status-ok' : m.status === '일시정지' ? 'status-pause' : 'status-danger';

    return `<tr>
      <td style="color:var(--color-text-muted); font-size:0.75rem;">${escHtml(m.id)}</td>
      <td style="font-weight:700;">${escHtml(m.name)}</td>
      <td>${escHtml(m.gender)}</td>
      <td>${m.age}세</td>
      <td><span class="status-badge ${gradeCls}">${escHtml(m.grade)}</span></td>
      <td style="font-size:0.78rem;">${escHtml(m.phone || '-')}</td>
      <td style="font-size:0.8rem;">${expiryHtml}</td>
      <td style="font-size:0.8rem;">${escHtml(m.trainer || '-')}</td>
      <td><span class="status-badge ${statusCls}">${escHtml(m.status)}</span></td>
    </tr>`;
  }).join('');
}

// ── 탭 1: 신규 회원 등록 ────────────────────────────────────
async function submitAddMember() {
  const name   = document.getElementById('newName').value.trim();
  const gender = document.getElementById('newGender').value;
  const age    = document.getElementById('newAge').value;
  const grade  = document.getElementById('newGrade').value;
  const phone  = document.getElementById('newPhone').value.trim();
  const expiry = document.getElementById('newExpiry').value;

  if (!name) { alert('이름을 입력해 주세요.'); return; }
  if (!expiry) { alert('이용권 만료일을 선택해 주세요.'); return; }

  try {
    await callPost('addMember', { name, gender, age, grade, phone, expiry });
    showToast(`${name} 회원이 등록되었습니다.`);
    // 폼 초기화
    ['newName','newAge','newPhone','newExpiry'].forEach(id => document.getElementById(id).value = '');
    // mock 모드: 로컬 배열에 직접 추가 (getMembers는 항상 원본 반환)
    allMembers.push({
      id: `M${Date.now()}`, name, gender, age: Number(age)||0,
      grade, phone, expiry, trainer: '', status: '활동중',
      regDate: new Date().toISOString().slice(0,10)
    });
    renderMemberTable();
    renderStatCards();
    updateBadges();
    renderTrainerMapping();
  } catch (e) {
    alert('등록 중 오류가 발생했습니다.');
    console.error(e);
  }
}

// ── 탭 2: 결제 내역 렌더 ────────────────────────────────────
function renderPayments() {
  const unpaid = allPayments.filter(p => p.status === '미수금');

  // 미수금 섹션
  const unpaidEl = document.getElementById('unpaidList');
  if (unpaid.length === 0) {
    unpaidEl.innerHTML = '<div style="color:var(--color-text-muted); font-size:0.85rem; padding:0.5rem 0;">미수금 회원이 없습니다.</div>';
  } else {
    unpaidEl.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; gap:0.75rem;">
        ${unpaid.map(p => `
          <div style="background:#1a0f0f; border:1.5px solid #EF4444; border-radius:10px; padding:0.75rem 1rem; min-width:220px;">
            <div style="font-weight:700; margin-bottom:0.25rem;">${escHtml(p.name)}</div>
            <div style="font-size:0.78rem; color:var(--color-text-muted);">${escHtml(p.product)} · ${(p.amount).toLocaleString()}원</div>
            <div style="margin-top:0.5rem; display:flex; justify-content:flex-end;">
              <button class="btn-pay" onclick="processPayment('${escHtml(p.payId)}','${escHtml(p.name)}',this)">
                <i class="fa-solid fa-check"></i> 수납 처리
              </button>
            </div>
          </div>`).join('')}
      </div>`;
  }

  // 전체 결제 내역 테이블
  const tbody = document.getElementById('paymentTableBody');
  tbody.innerHTML = allPayments.map(p => {
    const isUnpaid = p.status === '미수금';
    const stCls = isUnpaid ? 'status-danger' : 'status-ok';
    return `<tr class="${isUnpaid ? 'unpaid-row' : ''}">
      <td style="font-size:0.75rem; color:var(--color-text-muted);">${escHtml(p.payId)}</td>
      <td style="font-weight:700;">${escHtml(p.name)}</td>
      <td>${escHtml(p.product)}</td>
      <td style="font-weight:700; color:var(--color-primary);">${p.amount.toLocaleString()}원</td>
      <td style="font-size:0.8rem;">${escHtml(p.payDate)}</td>
      <td style="font-size:0.8rem;">${escHtml(p.expiry)}</td>
      <td><span class="status-badge ${stCls}">${escHtml(p.status)}</span></td>
      <td>
        ${isUnpaid
          ? `<button class="btn-pay" onclick="processPayment('${escHtml(p.payId)}','${escHtml(p.name)}',this)"><i class="fa-solid fa-check"></i> 수납</button>`
          : `<button class="btn-pay" disabled>완료</button>`}
      </td>
    </tr>`;
  }).join('');
}

async function processPayment(payId, memberName, btn) {
  if (!confirm(`${memberName} 회원의 미수금을 수납 처리하시겠습니까?`)) return;
  btn.disabled = true;
  try {
    await callPost('updatePayment', { payId });
    // 로컬 상태 업데이트
    const p = allPayments.find(x => x.payId === payId);
    if (p) p.status = '완료';
    showToast(`${memberName} 수납 처리 완료`);
    renderPayments();
    renderStatCards();
    updateBadges();
  } catch(e) {
    btn.disabled = false;
    alert('처리 중 오류가 발생했습니다.');
  }
}

// ── 탭 3: 기구 관리 렌더 ────────────────────────────────────
function filterEquip(status, el) {
  equipFilter = status;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderEquipTable();
}

function renderEquipTable() {
  const list = equipFilter === '전체' ? allEquipment : allEquipment.filter(e => e.status === equipFilter);
  const tbody = document.getElementById('equipTableBody');

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--color-text-muted);">해당 상태의 기구가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(e => {
    const stCls = e.status === '정상' ? 'status-ok' : e.status === '점검중' ? 'status-warn' : 'status-danger';
    const btnOk   = e.status === '정상'   ? 'active-ok'     : '';
    const btnWarn = e.status === '점검중' ? 'active-warn'   : '';
    const btnBad  = e.status === '고장'   ? 'active-danger' : '';
    return `<tr>
      <td style="font-size:0.75rem; color:var(--color-text-muted);">${escHtml(e.id)}</td>
      <td><span class="badge badge-etc" style="font-size:0.72rem;">${escHtml(e.category)}</span></td>
      <td style="font-weight:700;">${escHtml(e.name)}</td>
      <td>${e.qty > 0 ? e.qty + '대' : '-'}</td>
      <td><span class="status-badge ${stCls}">${escHtml(e.status)}</span></td>
      <td>
        <div class="status-btn-group">
          <button class="status-btn ${btnOk}"   onclick="changeEquipStatus('${escHtml(e.id)}','정상',this)">정상</button>
          <button class="status-btn ${btnWarn}"  onclick="changeEquipStatus('${escHtml(e.id)}','점검중',this)">점검중</button>
          <button class="status-btn ${btnBad}"   onclick="changeEquipStatus('${escHtml(e.id)}','고장',this)">고장</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function changeEquipStatus(equipId, status, btn) {
  const equip = allEquipment.find(e => e.id === equipId);
  if (!equip || equip.status === status) return;
  try {
    await callPost('updateEquipmentStatus', { equipId, status });
    equip.status = status;
    showToast(`${equip.name} 상태를 "${status}"으로 변경했습니다.`);
    renderEquipTable();
    renderStatCards();
  } catch (e) {
    alert('변경 중 오류가 발생했습니다.');
  }
}

// ── 탭 4: 트레이너 매핑 ─────────────────────────────────────
function renderTrainerMapping() {
  // 트레이너 카드: 담당 회원 수
  const trainerNames = TRAINER_LIST.map(t => t.name);
  const countMap = {};
  trainerNames.forEach(n => { countMap[n] = 0; });
  allMembers.forEach(m => { if (m.trainer && countMap[m.trainer] !== undefined) countMap[m.trainer]++; });

  document.getElementById('trainerAssignGrid').innerHTML = TRAINER_LIST.map(t => `
    <div class="trainer-assign-card">
      <div class="ta-avatar">${t.name[0]}</div>
      <div class="ta-name">${escHtml(t.name)}</div>
      <div class="ta-count">담당 <span>${countMap[t.name] || 0}</span>명</div>
    </div>`).join('');

  // 재배정 테이블 (PT회원만)
  const ptMembers = allMembers.filter(m => m.grade === 'PT회원');
  const trainerOptions = TRAINER_LIST.map(t =>
    `<option value="${escHtml(t.name)}">${escHtml(t.name)}</option>`
  ).join('');

  document.getElementById('assignTableBody').innerHTML = ptMembers.map(m => `
    <tr>
      <td style="font-size:0.75rem; color:var(--color-text-muted);">${escHtml(m.id)}</td>
      <td style="font-weight:700;">${escHtml(m.name)}</td>
      <td><span class="status-badge status-ok">${escHtml(m.grade)}</span></td>
      <td style="font-size:0.82rem;">${escHtml(m.trainer || '미배정')}</td>
      <td>
        <select class="assign-select" id="assign_${escHtml(m.id)}">
          <option value="">선택...</option>
          ${trainerOptions}
        </select>
      </td>
      <td>
        <button class="btn-pay" onclick="applyAssign('${escHtml(m.id)}','${escHtml(m.name)}')">
          <i class="fa-solid fa-check"></i> 적용
        </button>
        <button class="btn-remove" onclick="removePTMember('${escHtml(m.id)}','${escHtml(m.name)}')">
          <i class="fa-solid fa-user-minus"></i> 제거
        </button>
      </td>
    </tr>`).join('');
}

async function applyAssign(memberId, memberName) {
  const sel = document.getElementById(`assign_${memberId}`);
  const trainerName = sel ? sel.value : '';
  if (!trainerName) { alert('배정할 트레이너를 선택해 주세요.'); return; }
  if (!confirm(`${memberName} 회원을 ${trainerName}에게 배정하시겠습니까?`)) return;
  try {
    await callPost('assignTrainer', { memberId, trainerName });
    const m = allMembers.find(x => x.id === memberId);
    if (m) m.trainer = trainerName;
    showToast(`${memberName} → ${trainerName} 배정 완료`);
    renderTrainerMapping();
    renderMemberTable();
  } catch(e) {
    alert('배정 중 오류가 발생했습니다.');
  }
}

async function removePTMember(memberId, memberName) {
  if (!confirm(`${memberName} 회원을 PT 회원에서 제거하시겠습니까?\n(일반회원으로 전환되고 담당 트레이너 배정이 해제됩니다)`)) return;
  try {
    await callPost('removePTMember', { memberId });
    const m = allMembers.find(x => x.id === memberId);
    if (m) { m.grade = '일반회원'; m.trainer = ''; }
    showToast(`${memberName} 회원이 PT 회원에서 제거되었습니다.`);
    renderTrainerMapping();
    renderMemberTable();
    renderStatCards();
  } catch(e) {
    alert('제거 중 오류가 발생했습니다.');
  }
}

// ── 토스트 알림 ──────────────────────────────────────────────
function showToast(msg) {
  let toast = document.getElementById('adminToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.style.cssText = `
      position:fixed; bottom:1.5rem; right:1.5rem; z-index:20000;
      background:#1E293B; color:#F1F5F9; padding:0.75rem 1.25rem;
      border-radius:12px; font-size:0.88rem; font-weight:600;
      box-shadow:0 8px 24px rgba(0,0,0,0.4);
      display:flex; align-items:center; gap:0.5rem;
      transition:opacity 0.3s;
    `;
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#22C55E;"></i>${escHtml(msg)}`;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 2800);
}

// ── 유틸 ─────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
