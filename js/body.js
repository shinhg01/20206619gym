/**
 * 아이언핏 GYM - 신체 변화 분석 페이지 (body.js)
 *
 * 신체 측정값 CRUD, Chart.js 탭별 시계열 그래프, 누적 증감 요약 카드를 제어합니다.
 */

// ── 전역 상태 ────────────────────────────────────────────────
let allBodyData   = [];       // 날짜 오름차순 정렬된 측정 기록 전체
let currentMetric = 'weight'; // 현재 그래프에 표시 중인 지표
let bodyChart     = null;     // Chart.js 인스턴스
let editingId     = null;
let targetUserId  = null;
let targetUserName= null;
let pendingPhotoBase64 = null; // 폼에서 선택된 사진의 Base64 (저장 전 임시 보관)
let removePhotoFlag    = false; // 수정 모드에서 기존 사진 삭제 여부

// 지표별 메타 정보
const METRIC_META = {
  weight: { label: '체중 (kg)',    color: '#E8593C', fieldId: 'bWeight', unit: 'kg' },
  fat:    { label: '체지방률 (%)', color: '#3B82F6', fieldId: 'bFat',    unit: '%'  },
  muscle: { label: '근육량 (kg)',  color: '#10B981', fieldId: 'bMuscle', unit: 'kg' },
  waist:  { label: '허리둘레 (cm)',color: '#F59E0B', fieldId: 'bWaist',  unit: 'cm' },
};

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

  // 2. 프로필 UI
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileRole').textContent = role;
  document.getElementById('userAvatar').textContent  = name ? name[0] : 'U';
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
    menuToggle.addEventListener('click', () => { appSidebar.classList.add('open'); sidebarOverlay.classList.add('show'); });
    sidebarOverlay.addEventListener('click', () => { appSidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); });
  }

  // 4. 로그아웃
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('로그아웃 하시겠습니까?')) { sessionStorage.clear(); window.location.href = 'index.html'; }
  });

  // 5. 날짜 기본값
  document.getElementById('bDate').value = toDateStr(new Date());
  targetUserId   = userId;
  targetUserName = name;

  // 6. 트레이너/관리자 모드
  if (role === '트레이너' || role === '관리자') {
    document.getElementById('trainerBar').style.display = 'flex';
    try {
      const members = await callGet('getMembers', {});
      populateMemberDropdown(members);
    } catch(e) {}

    document.getElementById('memberSelect').addEventListener('change', async (e) => {
      const val = e.target.value;
      if (!val) {
        targetUserId = userId; targetUserName = name;
        document.getElementById('viewingBadge').style.display = 'none';
      } else {
        const [selId, selName] = val.split('||');
        targetUserId = selId; targetUserName = selName;
        const badge = document.getElementById('viewingBadge');
        badge.textContent = `${selName} 님 조회 중`;
        badge.style.display = 'inline-flex';
      }
      resetForm();
      await loadBodyData();
    });
  }

  // 7. 사진 업로드 이벤트 바인딩
  initPhotoUpload();

  // 8. 폼 이벤트
  document.getElementById('bodyForm').addEventListener('submit', handleFormSubmit);
  document.getElementById('resetFormBtn').addEventListener('click', resetForm);

  // 9. 초기 데이터 로드
  await loadBodyData();
});

// ── 사진 업로드 초기화 ──────────────────────────────────────
function initPhotoUpload() {
  const area        = document.getElementById('photoUploadArea');
  const fileInput   = document.getElementById('bPhoto');
  const removeBtn   = document.getElementById('removePhotoBtn');

  // 클릭으로 파일 선택
  area.addEventListener('click', (e) => {
    // "교체" 버튼 클릭은 자체 onclick 있으므로 중복 방지
    if (e.target.closest('#removePhotoBtn')) return;
    fileInput.click();
  });

  // 파일 선택 시 미리보기
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('사진 파일 크기가 너무 큽니다. 3MB 이하의 파일을 선택해 주세요.');
      fileInput.value = '';
      return;
    }
    const base64 = await readFileAsBase64(file);
    pendingPhotoBase64 = base64;
    removePhotoFlag = false;
    showPhotoPreview(base64);
    removeBtn.style.display = 'inline-flex';
  });

  // 드래그 앤 드롭
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', async (e) => {
    e.preventDefault();
    area.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) { alert('이미지 파일만 업로드할 수 있습니다.'); return; }
    if (file.size > 3 * 1024 * 1024) { alert('3MB 이하의 파일을 선택해 주세요.'); return; }
    const base64 = await readFileAsBase64(file);
    pendingPhotoBase64 = base64;
    removePhotoFlag = false;
    showPhotoPreview(base64);
    removeBtn.style.display = 'inline-flex';
  });

  // 사진 삭제 버튼
  removeBtn.addEventListener('click', () => {
    pendingPhotoBase64 = null;
    removePhotoFlag = true;
    clearPhotoPreview();
    removeBtn.style.display = 'none';
    fileInput.value = '';
  });
}

function showPhotoPreview(base64) {
  document.getElementById('photoPlaceholder').style.display  = 'none';
  document.getElementById('photoPreviewWrap').style.display  = 'block';
  document.getElementById('photoPreviewImg').src             = base64;
}

function clearPhotoPreview() {
  document.getElementById('photoPlaceholder').style.display  = 'flex';
  document.getElementById('photoPreviewWrap').style.display  = 'none';
  document.getElementById('photoPreviewImg').src             = '';
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── 사진 라이트박스 ──────────────────────────────────────────
function openPhotoModal(base64, caption) {
  const modal = document.getElementById('photoModal');
  document.getElementById('photoModalImg').src             = base64;
  document.getElementById('photoModalCaption').textContent = caption || '';
  modal.style.display = 'flex';
  modal.className = 'photo-modal-backdrop';
  document.body.style.overflow = 'hidden';
}

function closePhotoModal(e) {
  // 배경 클릭 시 닫기 (모달 내부 클릭은 무시)
  if (e && e.target !== document.getElementById('photoModal')) return;
  const modal = document.getElementById('photoModal');
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// ── 회원 드롭다운 ────────────────────────────────────────────
function populateMemberDropdown(members) {
  const sel = document.getElementById('memberSelect');
  sel.innerHTML = '<option value="">내 기록 보기 (트레이너)</option>';
  if (!members || !Array.isArray(members)) return;
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

// ── 데이터 로드 ──────────────────────────────────────────────
async function loadBodyData() {
  try {
    const data = await callGet('getBodyData', { userId: targetUserId });
    allBodyData = Array.isArray(data) ? data : [];
    // 날짜 오름차순 정렬
    allBodyData.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  } catch(e) {
    console.error('[BODY] 데이터 로드 실패:', e);
    allBodyData = [];
  }
  renderSummaryCards();
  renderChart(currentMetric);
  renderTable();
}

// ── 누적 증감 요약 카드 ──────────────────────────────────────
function renderSummaryCards() {
  if (allBodyData.length === 0) {
    ['Weight','Fat','Muscle','Waist'].forEach(k => {
      document.getElementById(`cur${k}`).textContent = '-- ';
      document.getElementById(`delta${k}`).textContent = '아직 측정 기록 없음';
    });
    return;
  }

  const first = allBodyData[0];
  const last  = allBodyData[allBodyData.length - 1];

  const metrics = [
    { key: 'Weight', cur: 'weight', unit: 'kg',  label: '체중' },
    { key: 'Fat',    cur: 'fat',    unit: '%',   label: '체지방률' },
    { key: 'Muscle', cur: 'muscle', unit: 'kg',  label: '근육량' },
    { key: 'Waist',  cur: 'waist',  unit: 'cm',  label: '허리둘레' },
  ];

  metrics.forEach(({ key, cur, unit }) => {
    const curVal   = Number(last[cur]);
    const firstVal = Number(first[cur]);

    const curEl   = document.getElementById(`cur${key}`);
    const deltaEl = document.getElementById(`delta${key}`);

    if (!curVal) {
      curEl.textContent   = '--';
      deltaEl.textContent = '측정값 없음';
      return;
    }

    curEl.textContent = `${curVal} ${unit}`;

    if (!firstVal || first === last) {
      deltaEl.textContent = '초기 측정값 기준';
      return;
    }

    const diff = Number((curVal - firstVal).toFixed(1));
    const sign = diff > 0 ? '+' : '';
    // 체중·체지방·허리는 감소가 좋음, 근육량은 증가가 좋음
    const isGood = cur === 'muscle' ? diff > 0 : diff < 0;
    const color  = diff === 0 ? 'var(--color-text-muted)' : isGood ? 'var(--color-success)' : 'var(--color-danger)';
    const arrow  = diff > 0 ? '▲' : diff < 0 ? '▼' : '━';

    deltaEl.innerHTML = `<span style="color:${color}; font-weight:700;">${arrow} ${sign}${diff} ${unit}</span> <span>초기 대비</span>`;
  });
}

// ── Chart.js 그래프 ──────────────────────────────────────────
function renderChart(metric) {
  const meta    = METRIC_META[metric];
  const canvas  = document.getElementById('bodyChart');
  const emptyEl = document.getElementById('chartEmpty');

  const validData = allBodyData.filter(d => d[metric] !== undefined && d[metric] !== null && d[metric] !== '');

  if (validData.length === 0) {
    canvas.style.display = 'none';
    emptyEl.style.display = 'block';
    if (bodyChart) { bodyChart.destroy(); bodyChart = null; }
    return;
  }

  canvas.style.display = 'block';
  emptyEl.style.display = 'none';

  const labels = validData.map(d => formatDateShort(d.date));
  const values = validData.map(d => Number(d[metric]));

  Chart.defaults.color      = '#8E8EA8';
  Chart.defaults.font.family = "'Outfit', 'Noto Sans KR', sans-serif";
  Chart.defaults.scale.grid.color = 'rgba(0,0,0,0.05)';

  if (bodyChart) bodyChart.destroy();

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, meta.color + '33');
  gradient.addColorStop(1, meta.color + '00');

  bodyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: meta.label,
        data: values,
        borderColor: meta.color,
        borderWidth: 3,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: meta.color,
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} ${meta.unit}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: { callback: v => `${v} ${meta.unit}` }
        }
      }
    }
  });
}

// 탭 전환 (전역 함수 — HTML onclick에서 호출)
function switchMetric(btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentMetric = btn.dataset.metric;
  renderChart(currentMetric);
}

// ── 전체 측정 기록 테이블 ────────────────────────────────────
function renderTable() {
  const wrap = document.getElementById('bodyTableWrap');
  document.getElementById('totalCountBadge').textContent = `${allBodyData.length}건`;

  if (allBodyData.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-clipboard-list"></i><p>아직 측정 기록이 없습니다.</p></div>`;
    return;
  }

  // 최신 날짜 순 내림차순으로 표시
  const sorted = [...allBodyData].reverse();

  let rows = '';
  sorted.forEach(d => {
    const photoCell = d.photo
      ? `<img class="photo-thumb" src="${d.photo}" alt="측정 사진"
             onclick="openPhotoModal(${JSON.stringify(d.photo)}, ${JSON.stringify(d.date + ' 측정 사진')})">`
      : `<i class="fa-solid fa-camera no-photo-icon" title="사진 없음"></i>`;

    rows += `
      <tr class="record-row">
        <td>${escHtml(d.date)}</td>
        <td>${d.weight ? `<strong>${d.weight}</strong> kg` : '-'}</td>
        <td>${d.fat    ? `${d.fat} %`    : '-'}</td>
        <td>${d.muscle ? `${d.muscle} kg`: '-'}</td>
        <td>${d.waist  ? `${d.waist} cm` : '-'}</td>
        <td>${photoCell}</td>
        <td style="color:var(--color-text-muted); font-size:0.82rem; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(d.memo || '')}</td>
        <td>
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-outline btn-sm" onclick="startEdit(${JSON.stringify(d.id)})">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteRecord(${JSON.stringify(d.id)})">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  });

  wrap.innerHTML = `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>측정일</th>
            <th>체중</th>
            <th>체지방률</th>
            <th>근육량</th>
            <th>허리둘레</th>
            <th>사진</th>
            <th>메모</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ── 폼 제출 ─────────────────────────────────────────────────
async function handleFormSubmit(e) {
  e.preventDefault();

  const date   = document.getElementById('bDate').value;
  const weight = document.getElementById('bWeight').value;
  const fat    = document.getElementById('bFat').value;
  const muscle = document.getElementById('bMuscle').value;
  const waist  = document.getElementById('bWaist').value;
  const memo   = document.getElementById('bMemo').value.trim();
  const curEditId = document.getElementById('editId').value;

  if (!date || !weight) {
    alert('측정 일자와 체중은 필수 입력 항목입니다.');
    return;
  }

  // 사진 처리: pendingPhotoBase64(신규/교체), removePhotoFlag(삭제), 둘 다 없으면 기존 유지
  let photoValue;
  if (pendingPhotoBase64) {
    photoValue = pendingPhotoBase64;
  } else if (removePhotoFlag) {
    photoValue = null;
  } else if (editingId) {
    // 수정 모드에서 변경 없으면 기존 사진 유지
    const existing = allBodyData.find(d => d.id === editingId);
    photoValue = existing ? existing.photo : null;
  } else {
    photoValue = null;
  }

  const payload = {
    userId: targetUserId,
    date,
    weight:  weight  ? Number(weight)  : null,
    fat:     fat     ? Number(fat)     : null,
    muscle:  muscle  ? Number(muscle)  : null,
    waist:   waist   ? Number(waist)   : null,
    memo,
    photo: photoValue,
  };

  try {
    if (curEditId) {
      payload.id = curEditId;
      await callPost('updateBody', payload);
      showToast('측정 기록이 수정되었습니다.');
    } else {
      await callPost('saveBody', payload);
      showToast('측정 기록이 저장되었습니다.');
    }
    resetForm();
    await loadBodyData();
  } catch(err) {
    console.error('[BODY] 저장 실패:', err);
  }
}

// ── 수정 모드 ────────────────────────────────────────────────
function startEdit(id) {
  const d = allBodyData.find(x => x.id === id);
  if (!d) return;

  editingId = id;
  document.getElementById('editId').value  = id;
  document.getElementById('bDate').value   = d.date   || '';
  document.getElementById('bWeight').value = d.weight !== null ? d.weight : '';
  document.getElementById('bFat').value    = d.fat    !== null ? d.fat    : '';
  document.getElementById('bMuscle').value = d.muscle !== null ? d.muscle : '';
  document.getElementById('bWaist').value  = d.waist  !== null ? d.waist  : '';
  document.getElementById('bMemo').value   = d.memo   || '';

  // 기존 사진 복원
  pendingPhotoBase64 = null;
  removePhotoFlag    = false;
  const removeBtn = document.getElementById('removePhotoBtn');
  if (d.photo) {
    showPhotoPreview(d.photo);
    removeBtn.style.display = 'inline-flex';
  } else {
    clearPhotoPreview();
    removeBtn.style.display = 'none';
  }
  document.getElementById('bPhoto').value = '';

  document.getElementById('formTitle').innerHTML =
    `<i class="fa-solid fa-pen" style="color:var(--color-primary);"></i> 측정값 수정`;
  document.getElementById('submitBtnText').textContent = '수정 내용 저장';
  document.getElementById('submitBtn').style.backgroundColor = 'var(--color-info)';

  document.getElementById('bodyForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── 삭제 ─────────────────────────────────────────────────────
async function deleteRecord(id) {
  const d = allBodyData.find(x => x.id === id);
  if (!d || !confirm(`${d.date} 측정 기록을 삭제하시겠습니까?`)) return;

  try {
    await callPost('deleteBody', { userId: targetUserId, id });
    showToast('측정 기록이 삭제되었습니다.', 'danger');
    await loadBodyData();
  } catch(err) {
    console.error('[BODY] 삭제 실패:', err);
  }
}

// ── 폼 초기화 ────────────────────────────────────────────────
function resetForm() {
  editingId = null;
  pendingPhotoBase64 = null;
  removePhotoFlag    = false;
  document.getElementById('editId').value = '';
  document.getElementById('bodyForm').reset();
  document.getElementById('bDate').value = toDateStr(new Date());

  clearPhotoPreview();
  document.getElementById('removePhotoBtn').style.display = 'none';
  document.getElementById('bPhoto').value = '';

  document.getElementById('formTitle').innerHTML =
    `<i class="fa-solid fa-plus-circle" style="color:var(--color-primary);"></i> 측정값 입력`;
  document.getElementById('submitBtnText').textContent = '측정값 저장';
  document.getElementById('submitBtn').style.backgroundColor = '';
}

// ── 유틸 ─────────────────────────────────────────────────────
function toDateStr(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatDateShort(dateStr) {
  if (!dateStr || dateStr.length < 10) return dateStr;
  return dateStr.substring(5); // 'MM-DD'
}

function showToast(msg, type = 'success') {
  const existing = document.getElementById('ironfit-toast');
  if (existing) existing.remove();
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
    box-shadow:0 8px 24px rgba(0,0,0,0.12);
    animation:slideUp 0.25s ease-out;
  `;
  toast.innerHTML = `<i class="fa-solid ${c.icon}"></i> ${escHtml(msg)}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
