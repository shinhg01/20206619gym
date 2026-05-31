/**
 * 아이언핏 GYM - 식단 기록 페이지 (diet.js)
 *
 * 날짜별 식단 CRUD, 식사 탭 필터, 영양소 요약 카드, 도넛 차트, 사진 업로드를 제어합니다.
 */

// ── 전역 상태 ────────────────────────────────────────────────
let allDietData       = [];       // 선택된 날짜의 식단 기록 전체
let currentMealTab    = '전체';   // 현재 활성 식사 탭
let selectedDate      = null;     // 'yyyy-MM-dd'
let donutChart        = null;     // Chart.js 도넛 인스턴스
let editingId         = null;
let targetUserId      = null;
let targetUserName    = null;
let pendingPhotoBase64 = null;
let removePhotoFlag    = false;

// 일일 영양소 목표값 (추후 사용자 설정으로 확장 가능)
const GOALS = { kcal: 2000, carb: 250, protein: 60, fat: 65 };

// 식사별 도넛 색상
const MEAL_COLORS = {
  '아침': '#F59E0B',
  '점심': '#3B82F6',
  '저녁': '#8B5CF6',
  '간식': '#10B981',
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
    ['USER_ID','USER_NAME','USER_ROLE','STATUS'].forEach(k => {});
    sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_ID, userId);
    sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_NAME, name);
    sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_ROLE, role);
    sessionStorage.setItem(CONFIG.SESSION_KEYS.STATUS, status);
  }

  if (!userId) {
    alert('로그인 세션이 만료되었습니다. 로그인 페이지로 이동합니다.');
    window.location.href = 'index.html'; return;
  }
  if (status === '정지' || status === '만료') {
    alert('이용 기간이 만료되었거나 정지된 계정입니다.');
    sessionStorage.clear(); window.location.href = 'index.html'; return;
  }

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

  targetUserId   = userId;
  targetUserName = name;
  selectedDate   = toDateStr(new Date());

  // 5. 날짜 네비게이션
  updateDateNav();
  document.getElementById('prevDay').addEventListener('click', () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    selectedDate = toDateStr(d);
    updateDateNav(); resetForm(); loadDietData();
  });
  document.getElementById('nextDay').addEventListener('click', () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    selectedDate = toDateStr(d);
    updateDateNav(); resetForm(); loadDietData();
  });
  document.getElementById('todayBtn').addEventListener('click', () => {
    selectedDate = toDateStr(new Date());
    updateDateNav(); resetForm(); loadDietData();
  });

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
      resetForm(); loadDietData();
    });
  }

  // 7. 사진 업로드
  initPhotoUpload();

  // 8. 폼 이벤트
  document.getElementById('dietForm').addEventListener('submit', handleFormSubmit);
  document.getElementById('resetFormBtn').addEventListener('click', resetForm);

  // 9. 초기 데이터 로드
  await loadDietData();
});

// ── 날짜 네비게이션 표시 ────────────────────────────────────
function updateDateNav() {
  const d   = new Date(selectedDate + 'T00:00:00');
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  const today = toDateStr(new Date());
  document.getElementById('dateNavLabel').textContent =
    selectedDate === today ? `${selectedDate} (오늘)` : selectedDate;
  document.getElementById('dateNavSub').textContent = `${dow}요일`;
}

// ── 회원 드롭다운 ────────────────────────────────────────────
function populateMemberDropdown(members) {
  const sel = document.getElementById('memberSelect');
  sel.innerHTML = '<option value="">내 기록 보기 (트레이너)</option>';
  if (!members || !Array.isArray(members)) return;
  const rows = Array.isArray(members[0]) ? members.slice(1) : members;
  rows.forEach(row => {
    const id   = Array.isArray(row) ? String(row[0]).trim() : row.id;
    const nm   = Array.isArray(row) ? row[1] : row.name;
    if (!id || id === 'ID') return;
    const opt = document.createElement('option');
    opt.value = `${id}||${nm}`;
    opt.textContent = `${nm} (${id})`;
    sel.appendChild(opt);
  });
}

// ── 데이터 로드 ──────────────────────────────────────────────
async function loadDietData() {
  try {
    const data = await callGet('getDiet', { userId: targetUserId, date: selectedDate });
    allDietData = Array.isArray(data) ? data : [];
  } catch(e) {
    console.error('[DIET] 데이터 로드 실패:', e); allDietData = [];
  }
  renderNutritionSummary();
  renderDonutChart();
  renderFoodList();
}

// ── 영양소 요약 카드 ─────────────────────────────────────────
function renderNutritionSummary() {
  const totals = allDietData.reduce(
    (acc, d) => {
      acc.kcal    += Number(d.kcal    || 0);
      acc.carb    += Number(d.carb    || 0);
      acc.protein += Number(d.protein || 0);
      acc.fat     += Number(d.fat     || 0);
      return acc;
    },
    { kcal: 0, carb: 0, protein: 0, fat: 0 }
  );

  // 칼로리
  const kcalPct = Math.min(200, Math.round((totals.kcal / GOALS.kcal) * 100));
  document.getElementById('totalKcal').textContent = totals.kcal.toLocaleString();
  document.getElementById('kcalBar').style.width   = `${Math.min(100, kcalPct)}%`;
  const kcalBadge = document.getElementById('kcalBadge');
  kcalBadge.textContent = `${kcalPct}% 달성`;
  if (kcalPct > 110) {
    kcalBadge.className = 'badge badge-danger';
    kcalBadge.textContent += ' (초과)';
    document.getElementById('kcalBar').style.background = 'var(--color-danger)';
  } else if (kcalPct >= 80) {
    kcalBadge.className = 'badge badge-success';
    document.getElementById('kcalBar').style.background = 'var(--color-primary)';
  } else {
    kcalBadge.className = 'badge badge-warning';
    document.getElementById('kcalBar').style.background = 'var(--color-primary)';
  }

  // 탄단지
  const setMacro = (id, barId, val, goal) => {
    const pct = Math.min(100, Math.round((val / goal) * 100));
    document.getElementById(id).innerHTML = `${val.toFixed(1)}<span style="font-size:1rem;"> g</span>`;
    document.getElementById(barId).style.width = `${pct}%`;
  };
  setMacro('totalCarb',    'carbBar',    totals.carb,    GOALS.carb);
  setMacro('totalProtein', 'proteinBar', totals.protein, GOALS.protein);
  setMacro('totalFat',     'fatBar',     totals.fat,     GOALS.fat);
}

// ── 도넛 차트 ────────────────────────────────────────────────
function renderDonutChart() {
  const canvas   = document.getElementById('mealDonut');
  const emptyEl  = document.getElementById('donutEmpty');
  const legendEl = document.getElementById('donutLegend');

  // 식사별 칼로리 집계
  const mealKcal = { '아침': 0, '점심': 0, '저녁': 0, '간식': 0 };
  allDietData.forEach(d => { if (mealKcal[d.meal] !== undefined) mealKcal[d.meal] += Number(d.kcal || 0); });
  const hasData = Object.values(mealKcal).some(v => v > 0);

  if (donutChart) { donutChart.destroy(); donutChart = null; }

  if (!hasData) {
    canvas.style.display = 'none';
    emptyEl.style.display = 'flex';
    legendEl.innerHTML = '';
    return;
  }

  canvas.style.display = 'block';
  emptyEl.style.display = 'none';

  Chart.defaults.color       = '#8E8EA8';
  Chart.defaults.font.family = "'Outfit', 'Noto Sans KR', sans-serif";

  donutChart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(mealKcal),
      datasets: [{
        data: Object.values(mealKcal),
        backgroundColor: Object.keys(mealKcal).map(m => MEAL_COLORS[m]),
        borderWidth: 2,
        borderColor: '#FFFFFF',
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} kcal` } }
      }
    }
  });

  // 커스텀 범례
  legendEl.innerHTML = Object.entries(mealKcal)
    .filter(([, v]) => v > 0)
    .map(([m, v]) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${MEAL_COLORS[m]};"></div>
        <span style="color:var(--color-text-muted);">${m}</span>
        <span style="font-weight:700; color:var(--bg-primary); margin-left:auto;">${v} kcal</span>
      </div>`)
    .join('');
}

// ── 식사 탭 전환 (전역) ─────────────────────────────────────
function switchMealTab(el) {
  document.querySelectorAll('.meal-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  currentMealTab = el.dataset.meal;
  renderFoodList();
  // 탭과 폼의 식사 라디오 동기화
  if (currentMealTab !== '전체') setMealRadio(currentMealTab);
}

// ── 음식 목록 렌더링 ─────────────────────────────────────────
function renderFoodList() {
  const MEAL_ORDER = ['아침', '점심', '저녁', '간식'];

  // 탭 카운트 업데이트
  const counts = { '아침': 0, '점심': 0, '저녁': 0, '간식': 0 };
  allDietData.forEach(d => { if (counts[d.meal] !== undefined) counts[d.meal]++; });
  document.getElementById('cnt-전체').textContent = allDietData.length;
  MEAL_ORDER.forEach(m => { document.getElementById(`cnt-${m}`).textContent = counts[m]; });
  document.getElementById('totalFoodCount').textContent = `${allDietData.length}가지`;

  const filtered = currentMealTab === '전체'
    ? [...allDietData].sort((a, b) => MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal))
    : allDietData.filter(d => d.meal === currentMealTab);

  const container = document.getElementById('foodList');

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-bowl-food"></i>
        <p>${currentMealTab === '전체' ? '오늘 식단 기록이 없습니다.' : `${currentMealTab} 기록이 없습니다.`}</p>
        <p style="font-size:0.8rem; margin-top:0.4rem;">오른쪽 폼에서 음식을 추가해 보세요!</p>
      </div>`;
    return;
  }

  // 전체 탭: 식사별 그룹화 / 개별 탭: 소계 바 + 카드
  let html = '';

  if (currentMealTab === '전체') {
    MEAL_ORDER.forEach(meal => {
      const group = filtered.filter(d => d.meal === meal);
      if (group.length === 0) return;
      const groupKcal = group.reduce((s, d) => s + Number(d.kcal || 0), 0);
      html += `
        <div style="margin-bottom:1.25rem;">
          <div class="meal-subtotal">
            <span><span style="color:${MEAL_COLORS[meal]}; font-size:0.9rem;">●</span> <strong>${meal}</strong> ${group.length}가지</span>
            <strong>${groupKcal} kcal</strong>
          </div>
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            ${group.map(d => foodCardHTML(d)).join('')}
          </div>
        </div>`;
    });
  } else {
    const total = filtered.reduce((s, d) => s + Number(d.kcal || 0), 0);
    html += `
      <div class="meal-subtotal" style="margin-bottom:0.75rem;">
        <span>${currentMealTab} ${filtered.length}가지</span>
        <strong>${total} kcal</strong>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        ${filtered.map(d => foodCardHTML(d)).join('')}
      </div>`;
  }

  container.innerHTML = html;
}

function foodCardHTML(d) {
  const photoEl = d.photo
    ? `<img class="food-photo-thumb" src="${d.photo}" alt="식사 사진"
           onclick="openPhotoModal(${JSON.stringify(d.photo)}, ${JSON.stringify(d.meal + ' · ' + d.food)})">`
    : `<div class="food-no-photo"><i class="fa-solid fa-utensils"></i></div>`;

  const macros = [
    d.carb    != null ? `<span class="food-macro-item"><div class="food-macro-dot" style="background:#F59E0B;"></div>${d.carb}g 탄</span>` : '',
    d.protein != null ? `<span class="food-macro-item"><div class="food-macro-dot" style="background:var(--color-success);"></div>${d.protein}g 단</span>` : '',
    d.fat     != null ? `<span class="food-macro-item"><div class="food-macro-dot" style="background:var(--color-info);"></div>${d.fat}g 지</span>` : '',
  ].filter(Boolean).join('');

  const memoEl = d.memo ? `<div class="food-memo">${escHtml(d.memo)}</div>` : '';

  return `
    <div class="food-card">
      ${photoEl}
      <div class="food-body">
        <div class="food-name">${escHtml(d.food)}</div>
        <div class="food-macros">${macros || '<span style="color:#D1D5DB;">영양소 정보 없음</span>'}</div>
        ${memoEl}
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.4rem; flex-shrink:0;">
        <span class="food-kcal">${Number(d.kcal).toLocaleString()} kcal</span>
        <div class="food-actions">
          <button class="btn btn-outline btn-sm" onclick="startEdit(${JSON.stringify(d.id)})">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteFood(${JSON.stringify(d.id)})">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>`;
}

// ── 폼 제출 ─────────────────────────────────────────────────
async function handleFormSubmit(e) {
  e.preventDefault();

  const meal    = document.querySelector('input[name="dMeal"]:checked')?.value;
  const food    = document.getElementById('dFood').value.trim();
  const kcal    = document.getElementById('dKcal').value;
  const carb    = document.getElementById('dCarb').value;
  const protein = document.getElementById('dProtein').value;
  const fat     = document.getElementById('dFat').value;
  const memo    = document.getElementById('dMemo').value.trim();
  const curEditId = document.getElementById('editId').value;

  if (!meal)  { alert('식사 구분을 선택해 주세요.'); return; }
  if (!food)  { alert('음식명을 입력해 주세요.'); return; }
  if (!kcal)  { alert('칼로리(kcal)를 입력해 주세요.'); return; }

  // 사진 처리
  let photoValue;
  if (pendingPhotoBase64) {
    photoValue = pendingPhotoBase64;
  } else if (removePhotoFlag) {
    photoValue = null;
  } else if (curEditId) {
    const existing = allDietData.find(d => d.id === curEditId);
    photoValue = existing ? existing.photo : null;
  } else {
    photoValue = null;
  }

  const payload = {
    userId:  targetUserId,
    date:    selectedDate,
    meal,
    food,
    kcal:    Number(kcal),
    carb:    carb    ? Number(carb)    : null,
    protein: protein ? Number(protein) : null,
    fat:     fat     ? Number(fat)     : null,
    memo,
    photo:   photoValue,
  };

  try {
    if (curEditId) {
      payload.id = curEditId;
      await callPost('updateDiet', payload);
      showToast('식단 기록이 수정되었습니다.');
    } else {
      await callPost('saveDiet', payload);
      showToast('식단이 저장되었습니다.');
    }
    resetForm();
    await loadDietData();
  } catch(err) {
    console.error('[DIET] 저장 실패:', err);
  }
}

// ── 수정 모드 ────────────────────────────────────────────────
function startEdit(id) {
  const d = allDietData.find(x => x.id === id);
  if (!d) return;

  editingId = id;
  document.getElementById('editId').value  = id;
  document.getElementById('dFood').value    = d.food    || '';
  document.getElementById('dKcal').value    = d.kcal    !== null ? d.kcal    : '';
  document.getElementById('dCarb').value    = d.carb    !== null ? d.carb    : '';
  document.getElementById('dProtein').value = d.protein !== null ? d.protein : '';
  document.getElementById('dFat').value     = d.fat     !== null ? d.fat     : '';
  document.getElementById('dMemo').value    = d.memo    || '';

  setMealRadio(d.meal);

  // 사진 복원
  pendingPhotoBase64 = null; removePhotoFlag = false;
  const removeBtn = document.getElementById('removePhotoBtn');
  if (d.photo) { showPhotoPreview(d.photo); removeBtn.style.display = 'inline-flex'; }
  else          { clearPhotoPreview();       removeBtn.style.display = 'none'; }
  document.getElementById('dPhoto').value = '';

  document.getElementById('formTitle').innerHTML =
    `<i class="fa-solid fa-pen" style="color:var(--color-primary);"></i> 식단 수정`;
  document.getElementById('submitBtnText').textContent = '수정 내용 저장';
  document.getElementById('submitBtn').style.backgroundColor = 'var(--color-info)';

  document.getElementById('dietForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── 삭제 ─────────────────────────────────────────────────────
async function deleteFood(id) {
  const d = allDietData.find(x => x.id === id);
  if (!d || !confirm(`'${d.food}' 기록을 삭제하시겠습니까?`)) return;
  try {
    await callPost('deleteDiet', { userId: targetUserId, id });
    showToast('식단 기록이 삭제되었습니다.', 'danger');
    await loadDietData();
  } catch(err) {
    console.error('[DIET] 삭제 실패:', err);
  }
}

// ── 폼 초기화 ────────────────────────────────────────────────
function resetForm() {
  editingId = null;
  pendingPhotoBase64 = null; removePhotoFlag = false;
  document.getElementById('editId').value = '';
  document.getElementById('dietForm').reset();
  clearPhotoPreview();
  document.getElementById('removePhotoBtn').style.display = 'none';
  document.getElementById('dPhoto').value = '';
  document.getElementById('formTitle').innerHTML =
    `<i class="fa-solid fa-plus-circle" style="color:var(--color-primary);"></i> 음식 추가`;
  document.getElementById('submitBtnText').textContent = '식단 저장';
  document.getElementById('submitBtn').style.backgroundColor = '';
  // 현재 활성 탭과 식사 구분 동기화
  if (currentMealTab !== '전체') setMealRadio(currentMealTab);
}

function setMealRadio(meal) {
  const radio = document.getElementById(`meal-${meal}`);
  if (radio) radio.checked = true;
}

// ── 사진 업로드 ──────────────────────────────────────────────
function initPhotoUpload() {
  const area      = document.getElementById('photoUploadArea');
  const fileInput = document.getElementById('dPhoto');
  const removeBtn = document.getElementById('removePhotoBtn');

  area.addEventListener('click', (e) => {
    if (e.target.closest('#removePhotoBtn')) return;
    fileInput.click();
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert('3MB 이하 파일을 선택해 주세요.'); fileInput.value = ''; return; }
    pendingPhotoBase64 = await readFileAsBase64(file);
    removePhotoFlag = false;
    showPhotoPreview(pendingPhotoBase64);
    removeBtn.style.display = 'inline-flex';
  });
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', async (e) => {
    e.preventDefault(); area.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) { alert('이미지 파일만 가능합니다.'); return; }
    if (file.size > 3 * 1024 * 1024) { alert('3MB 이하 파일을 선택해 주세요.'); return; }
    pendingPhotoBase64 = await readFileAsBase64(file);
    removePhotoFlag = false;
    showPhotoPreview(pendingPhotoBase64);
    removeBtn.style.display = 'inline-flex';
  });
  removeBtn.addEventListener('click', () => {
    pendingPhotoBase64 = null; removePhotoFlag = true;
    clearPhotoPreview(); removeBtn.style.display = 'none'; fileInput.value = '';
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
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── 라이트박스 ───────────────────────────────────────────────
function openPhotoModal(base64, caption) {
  const modal = document.getElementById('photoModal');
  document.getElementById('photoModalImg').src             = base64;
  document.getElementById('photoModalCaption').textContent = caption || '';
  modal.style.display = 'flex';
  modal.className = 'photo-modal-backdrop';
  document.body.style.overflow = 'hidden';
}
function closePhotoModal(e) {
  if (e && e.target !== document.getElementById('photoModal')) return;
  document.getElementById('photoModal').style.display = 'none';
  document.body.style.overflow = '';
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
  setTimeout(() => toast.remove(), 3000);
}
