/**
 * 아이언핏 GYM - 기구 사용법 페이지 (equipment.js)
 *
 * 카테고리 필터 탭, 실시간 검색, 기구 카드 그리드,
 * 상세 모달(유튜브 임베드 + 운동방법 + 주의사항) 제어
 */

// ── 전역 상태 ────────────────────────────────────────────────
let allEquipment     = [];   // 전체 파싱된 기구 목록
let filteredList     = [];   // 현재 필터+검색 적용된 목록
let currentCategory  = '전체';
let currentSearch    = '';

// ── 카테고리 설정 ────────────────────────────────────────────
const CATEGORIES = ['전체', '가슴', '등', '어깨', '이두', '삼두', '하체', '복근', '유산소', '전신'];

const CAT_META = {
  '전체':  { icon: 'fa-grip',            bg: '#F1F5F9', color: '#64748B' },
  '가슴':  { icon: 'fa-heart',           bg: '#EEF2FF', color: '#4F46E5' },
  '등':    { icon: 'fa-angles-up',       bg: '#ECFDF5', color: '#059669' },
  '어깨':  { icon: 'fa-person',          bg: '#F5F3FF', color: '#7C3AED' },
  '이두':  { icon: 'fa-hand-back-fist',  bg: '#FFF7ED', color: '#EA580C' },
  '삼두':  { icon: 'fa-hand-back-fist',  bg: '#FEFCE8', color: '#CA8A04' },
  '하체':  { icon: 'fa-person-walking',  bg: '#F0FDF4', color: '#16A34A' },
  '복근':  { icon: 'fa-circle-dot',      bg: '#FFF1F2', color: '#E11D48' },
  '유산소':{ icon: 'fa-person-running',  bg: '#F0F9FF', color: '#0284C7' },
  '전신':  { icon: 'fa-dumbbell',        bg: '#F8FAFC', color: '#475569' },
};

// ── 초기화 ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // 1. 세션 검증
  const userId = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ID);
  const name   = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_NAME);
  const role   = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ROLE);

  if (!userId) { alert('로그인이 필요합니다.'); window.location.href = 'index.html'; return; }

  // 2. 프로필 UI
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileRole').textContent = role;
  document.getElementById('userAvatar').textContent  = name ? name[0] : 'U';
  if (role === '트레이너') document.querySelector('.role-trainer').style.display = 'block';
  if (role === '관리자')   document.querySelector('.role-admin').style.display   = 'block';

  // 3. 햄버거 메뉴
  const menuToggle     = document.getElementById('menuToggle');
  const appSidebar     = document.getElementById('appSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  menuToggle.addEventListener('click', () => { appSidebar.classList.add('open'); sidebarOverlay.classList.add('show'); });
  sidebarOverlay.addEventListener('click', () => { appSidebar.classList.remove('open'); sidebarOverlay.classList.remove('show'); });

  // 4. 로그아웃
  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('로그아웃 하시겠습니까?')) { sessionStorage.clear(); window.location.href = 'index.html'; }
  });

  // 5. 데이터 로드
  try {
    const rows = await callGet('getEquipment', {});
    allEquipment = parseEquipmentRows(rows);
  } catch(e) {
    console.error('[EQUIPMENT] 데이터 로드 실패:', e);
    allEquipment = [];
  }

  // 6. 렌더링
  renderCategoryTabs();
  applyFilters();
});

// ── 데이터 파싱 ──────────────────────────────────────────────
function parseEquipmentRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  return rows.slice(1).map(r => ({
    id:       String(r[0] || ''),
    category: String(r[1] || ''),
    name:     String(r[2] || ''),
    qty:      Number(r[3]) || 0,
    status:   String(r[4] || '정상'),
    muscles:  String(r[8] || ''),
    level:    String(r[9] || ''),
    method:   String(r[10] || ''),
    caution:  String(r[11] || ''),
    youtube:  String(r[12] || ''),
    imageUrl: String(r[13] || ''),
  }));
}

// ── 필터 적용 ────────────────────────────────────────────────
function applyFilters() {
  const q = currentSearch.trim().toLowerCase();
  filteredList = allEquipment.filter(e => {
    const catOk = currentCategory === '전체' || e.category === currentCategory;
    const searchOk = !q
      || e.name.toLowerCase().includes(q)
      || e.muscles.toLowerCase().includes(q)
      || e.category.toLowerCase().includes(q);
    return catOk && searchOk;
  });
  document.getElementById('resultCountBadge').textContent = `${filteredList.length}개`;
  renderCards();
}

// ── 검색 핸들러 (전역 oninput) ────────────────────────────────
function handleSearch(val) {
  currentSearch = val;
  applyFilters();
}

// ── 카테고리 탭 렌더링 ───────────────────────────────────────
function renderCategoryTabs() {
  const tabWrap = document.getElementById('catTabs');

  // 카테고리별 개수 계산
  const counts = {};
  CATEGORIES.forEach(c => {
    counts[c] = c === '전체' ? allEquipment.length
      : allEquipment.filter(e => e.category === c).length;
  });

  tabWrap.innerHTML = CATEGORIES.map(cat => {
    const meta    = CAT_META[cat] || CAT_META['전체'];
    const isActive = currentCategory === cat;
    return `
      <button class="cat-btn ${isActive ? 'active' : ''}" onclick="selectCategory('${cat}')">
        <i class="fa-solid ${meta.icon}"></i>
        ${cat}
        <span class="cat-count">${counts[cat]}</span>
      </button>`;
  }).join('');
}

// ── 카테고리 선택 (전역 onclick) ─────────────────────────────
function selectCategory(cat) {
  currentCategory = cat;
  // 탭 버튼 active 상태 전환
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim().startsWith(cat));
  });
  applyFilters();
}

// ── 기구 카드 그리드 렌더링 ──────────────────────────────────
function renderCards() {
  const grid = document.getElementById('equipGrid');

  if (filteredList.length === 0) {
    grid.innerHTML = `
      <div class="no-result">
        <i class="fa-solid fa-magnifying-glass"></i>
        <div style="font-size:1rem; font-weight:600; margin-bottom:0.3rem;">검색 결과가 없습니다</div>
        <div style="font-size:0.85rem;">다른 검색어나 카테고리를 선택해 보세요.</div>
      </div>`;
    return;
  }

  grid.innerHTML = filteredList.map(e => {
    const meta  = CAT_META[e.category] || CAT_META['전체'];
    const dots  = difficultyDots(e.level);
    const stDot = statusDot(e.status);

    return `
      <div class="equip-card" onclick="openEquipModal('${escHtml(e.id)}')">
        <div class="equip-card-top" style="background:${meta.bg};">
          ${e.imageUrl
            ? `<img src="${escHtml(toDriveImgUrl(e.imageUrl))}" alt="${escHtml(e.name)}"
                    style="width:100%; height:100%; object-fit:cover;" loading="lazy"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
               <i class="fa-solid ${meta.icon}" style="color:${meta.color}; opacity:0.7; display:none;"></i>`
            : `<i class="fa-solid ${meta.icon}" style="color:${meta.color}; opacity:0.7;"></i>`}
          <span class="badge" style="position:absolute; top:8px; right:8px; background:${meta.bg}; color:${meta.color}; border:1px solid ${meta.color}30; font-size:0.68rem;">
            ${escHtml(e.category)}
          </span>
        </div>
        <div class="equip-card-body">
          <div class="equip-name">${escHtml(e.name)}</div>
          <div class="equip-muscle">
            <i class="fa-solid fa-bullseye" style="font-size:0.65rem; color:var(--color-text-muted); margin-right:3px;"></i>
            ${escHtml(e.muscles || '-')}
          </div>
          <div class="equip-card-foot">
            <div class="diff-dots" title="${escHtml(e.level)}">${dots}</div>
            <div style="font-size:0.72rem; color:var(--color-text-muted); display:flex; align-items:center; gap:3px;">
              ${stDot}<span>${escHtml(e.status)}</span>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── 난이도 점 HTML ───────────────────────────────────────────
function difficultyDots(level) {
  const n = level === '초급' ? 1 : level === '중급' ? 2 : level === '고급' ? 3 : 0;
  return [1, 2, 3].map(i => {
    const on  = i <= n;
    const cls = on ? (i === 3 ? 'on lv3' : i === 2 ? 'on lv2' : 'on') : '';
    return `<span class="ddot ${cls}"></span>`;
  }).join('');
}

// ── 상태 색점 HTML ───────────────────────────────────────────
function statusDot(status) {
  const color = status === '정상' ? '#22C55E' : status === '점검중' ? '#F59E0B' : '#EF4444';
  return `<span class="status-dot" style="background:${color};"></span>`;
}

// ── 기구 상세 모달 열기 ──────────────────────────────────────
function openEquipModal(id) {
  const e = allEquipment.find(x => x.id === id);
  if (!e) return;

  const meta = CAT_META[e.category] || CAT_META['전체'];

  // 헤더
  const iconEl = document.getElementById('modalIcon');
  iconEl.style.background = meta.bg;
  iconEl.style.color      = meta.color;
  iconEl.innerHTML        = `<i class="fa-solid ${meta.icon}"></i>`;

  document.getElementById('modalName').textContent = e.name;
  document.getElementById('modalMeta').innerHTML   =
    `<span class="badge" style="background:${meta.bg}; color:${meta.color}; margin-right:0.4rem;">${escHtml(e.category)}</span>` +
    `<span style="margin-right:0.6rem;">${difficultyDots(e.level)} <span style="vertical-align:middle; font-size:0.78rem;">${escHtml(e.level)}</span></span>` +
    `${statusDot(e.status)}<span style="font-size:0.78rem;">${escHtml(e.status)}</span>` +
    (e.qty > 0 ? ` · <span style="font-size:0.78rem;">${e.qty}대 보유</span>` : '');

  // 바디 구성
  const embedUrl = toEmbedUrl(e.youtube);
  let bodyHtml = '';

  // 유튜브
  if (embedUrl) {
    bodyHtml += `
      <div class="youtube-wrap">
        <iframe src="${embedUrl}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
      </div>`;
  } else {
    bodyHtml += `
      <div class="youtube-placeholder">
        <div>
          <i class="fa-brands fa-youtube" style="font-size:2.5rem; color:#EF4444; opacity:0.4;"></i>
          <div style="font-size:0.85rem;">동영상 가이드 미등록</div>
        </div>
      </div>`;
  }

  // 타겟 근육 태그
  if (e.muscles) {
    const tags = e.muscles.split('/').map(m =>
      `<span class="badge badge-etc" style="font-size:0.78rem;">${escHtml(m.trim())}</span>`
    ).join('');
    bodyHtml += `
      <div>
        <div style="font-size:0.82rem; font-weight:700; color:var(--color-text-muted); margin-bottom:0.5rem;">
          <i class="fa-solid fa-bullseye" style="color:var(--color-primary); margin-right:0.3rem;"></i>타겟 근육
        </div>
        <div class="info-tags">${tags}</div>
      </div>`;
  }

  // 운동방법
  if (e.method) {
    const steps = e.method.split(/[.。\n]/).map(s => s.trim()).filter(s => s.length > 0);
    bodyHtml += `
      <div>
        <div style="font-size:0.82rem; font-weight:700; color:var(--color-text-muted); margin-bottom:0.5rem;">
          <i class="fa-solid fa-list-ol" style="color:var(--color-primary); margin-right:0.3rem;"></i>운동 방법
        </div>
        <div>
          ${steps.map((s, i) => `
            <div class="method-step">
              <div class="step-num">${i + 1}</div>
              <div style="padding-top:2px;">${escHtml(s)}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  // 주의사항
  if (e.caution) {
    bodyHtml += `
      <div class="caution-box">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div>
          <div style="font-weight:700; margin-bottom:0.25rem;">주의사항</div>
          <div>${escHtml(e.caution)}</div>
        </div>
      </div>`;
  }

  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('equipModalBackdrop').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeEquipModal() {
  document.getElementById('equipModalBackdrop').style.display = 'none';
  document.body.style.overflow = '';
  // 유튜브 재생 중지 (iframe src 초기화)
  const iframe = document.querySelector('#modalBody iframe');
  if (iframe) iframe.src = iframe.src;
}

function handleModalBackdrop(e) {
  if (e.target === document.getElementById('equipModalBackdrop')) closeEquipModal();
}

// ── 구글 드라이브 URL → 직접 표시 URL ───────────────────────
function toDriveImgUrl(url) {
  if (!url || !url.trim()) return '';
  // https://drive.google.com/file/d/FILE_ID/view...
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://lh3.googleusercontent.com/d/${m1[1]}`;
  // https://drive.google.com/open?id=FILE_ID
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://lh3.googleusercontent.com/d/${m2[1]}`;
  // 이미 변환된 URL이거나 외부 URL이면 그대로 반환
  return url;
}

// ── 유튜브 URL → 임베드 URL ──────────────────────────────────
function toEmbedUrl(url) {
  if (!url || !url.trim()) return null;
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  const full  = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (full)  return `https://www.youtube.com/embed/${full[1]}`;
  return null;
}

// ── 유틸 ─────────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
