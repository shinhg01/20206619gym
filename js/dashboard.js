/**
 * 아이언핏 GYM - 대시보드 연동 스크립트 (dashboard.js)
 * 
 * 세션 상태 확인 및 대시보드 통계 API 호출,
 * Chart.js를 이용한 신체 변화 및 칼로리 시각화 렌더링을 제어합니다.
 */

document.addEventListener('DOMContentLoaded', async () => {
  
  // ==========================================================================
  // 1. 세션 기반 로그인 상태 검증 및 보호막 (Security Guard)
  // ==========================================================================
  let userId = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ID);
  let name = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_NAME);
  let role = sessionStorage.getItem(CONFIG.SESSION_KEYS.USER_ROLE);
  let status = sessionStorage.getItem(CONFIG.SESSION_KEYS.STATUS);

  // [로컬 개발 및 디자인 시안 확인용 꿀팁]
  // 로그인 없이 화면 레이아웃과 차트 디자인을 확인하고 싶으시다면 
  // 아래 IS_DEV_MODE를 true로 설정하시면 임시 테스트 세션이 자동 주입됩니다.
  const IS_DEV_MODE = false; 

  if (IS_DEV_MODE && !userId) {
    userId = 'admin';
    name = '테스트회원';
    role = 'PT회원';
    status = '활동중';
    sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_ID, userId);
    sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_NAME, name);
    sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_ROLE, role);
    sessionStorage.setItem(CONFIG.SESSION_KEYS.STATUS, status);
  }

  if (!userId) {
    // 세션 정보가 없음을 안내하고 안전하게 로그인 페이지로 튕김
    alert('로그인 세션이 만료되었거나 비정상적인 접근입니다. 로그인 페이지로 이동합니다.');
    window.location.href = 'index.html';
    return;
  }

  // 활동 정지 상태 회원 처리
  if (status === '정지' || status === '만료') {
    alert('이용 기간이 만료되었거나 정지된 계정입니다. 안내데스크에 문의해 주세요.');
    sessionStorage.clear();
    window.location.href = 'index.html';
    return;
  }

  // ==========================================================================
  // 2. 역할(Role)별 사이드바 탭 및 UI 동적 변환
  // ==========================================================================
  // 사이드바 하단 미니 프로필 매핑
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileRole').textContent = role;
  document.getElementById('userAvatar').textContent = name ? name.substring(0, 1) : 'U';
  
  // 상단 헤더 매핑
  document.getElementById('welcomeMessage').textContent = `안녕하세요, ${name}님! 👋`;
  document.getElementById('userGradeBadge').textContent = role;

  // 역할 맞춤형 클래스 제어
  if (role === '트레이너') {
    document.querySelector('.role-trainer').style.display = 'block';
    document.getElementById('userGradeBadge').className = 'badge badge-primary';
  } else if (role === '관리자') {
    document.querySelector('.role-admin').style.display = 'block';
    document.getElementById('userGradeBadge').className = 'badge badge-danger';
  } else if (role === 'PT회원') {
    document.getElementById('userGradeBadge').className = 'badge badge-info';
  }

  // ==========================================================================
  // 3. 모바일 레이아웃 햄버거 메뉴 및 오버레이 처리
  // ==========================================================================
  const menuToggle = document.getElementById('menuToggle');
  const appSidebar = document.getElementById('appSidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  if (menuToggle && appSidebar && sidebarOverlay) {
    menuToggle.addEventListener('click', () => {
      appSidebar.classList.add('open');
      sidebarOverlay.classList.add('show');
    });

    sidebarOverlay.addEventListener('click', () => {
      appSidebar.classList.remove('open');
      sidebarOverlay.classList.remove('show');
    });
  }

  // ==========================================================================
  // 4. 로그아웃 기능 바인딩
  // ==========================================================================
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('로그아웃 하시겠습니까?')) {
        sessionStorage.clear();
        window.location.href = 'index.html';
      }
    });
  }

  // ==========================================================================
  // 5. 대시보드 API 데이터 조회 및 바인딩
  // ==========================================================================
  try {
    // api.js의 callGet() 함수 사용
    const data = await callGet('getDashboard', { userId: userId });
    
    if (data) {
      renderSummaryCards(data, role);
      renderCharts(data);
    }
  } catch (error) {
    console.error('[DASHBOARD DATA FETCH ERROR]', error);
    // API 연결 오류 시 빈 UI 가드 처리
    renderSummaryCards({
      attendanceCount: 0, attendanceGoal: 20,
      ptRemaining: 0, ptTotal: 0,
      todayCalories: 0, calorieGoal: 2000,
      weightChange: 0
    }, role);
  }
});

/**
 * 4개 상단 통계 요약 카드 렌더링
 */
function renderSummaryCards(data, role) {
  // 1. 이번 달 출석일수
  const attCount = data.attendanceCount || 0;
  const attGoal = data.attendanceGoal || 20;
  const attRate = attGoal > 0 ? Math.min(100, Math.round((attCount / attGoal) * 100)) : 0;
  
  document.getElementById('valAttendance').textContent = `${attCount} / ${attGoal} 일`;
  document.getElementById('attendanceRate').textContent = `${attRate}% 달성`;
  
  // 2. PT 잔여 횟수
  const ptRem = data.ptRemaining || 0;
  const ptTot = data.ptTotal || 0;
  const valPT = document.getElementById('valPT');
  const ptProgress = document.getElementById('ptProgress');
  
  if (role === '일반회원' && ptTot === 0) {
    valPT.textContent = '일반 이용회원';
    ptProgress.textContent = 'PT 이용권 없음';
    ptProgress.className = 'badge badge-primary';
  } else {
    valPT.textContent = `${ptRem} / ${ptTot} 회`;
    const ptUsed = ptTot - ptRem;
    const ptRate = ptTot > 0 ? Math.min(100, Math.round((ptUsed / ptTot) * 100)) : 0;
    ptProgress.textContent = ptTot > 0 ? `${ptRate}% 진행됨` : '이용 대기 중';
    ptProgress.className = 'badge badge-info';
  }

  // 3. 오늘 섭취 칼로리
  const kcalToday = data.todayCalories || 0;
  const kcalGoal = data.calorieGoal || 2000;
  const kcalRate = kcalGoal > 0 ? Math.min(200, Math.round((kcalToday / kcalGoal) * 100)) : 0;
  
  document.getElementById('valCalories').textContent = `${kcalToday.toLocaleString()} / ${kcalGoal.toLocaleString()} kcal`;
  const caloriesRateBadge = document.getElementById('caloriesRate');
  caloriesRateBadge.textContent = `${kcalRate}% 섭취`;
  
  if (kcalRate > 100) {
    caloriesRateBadge.className = 'badge badge-danger';
    caloriesRateBadge.textContent += ' (초과)';
  } else {
    caloriesRateBadge.className = 'badge badge-warning';
  }

  // 4. 최근 체중 변화
  const weightChg = Number(data.weightChange) || 0;
  const valWeightChange = document.getElementById('valWeightChange');
  const weightChangeBadge = document.getElementById('weightChangeBadge');
  const weightIconWrapper = document.getElementById('weightIconWrapper');
  
  if (weightChg < 0) {
    valWeightChange.textContent = `${weightChg} kg`;
    weightChangeBadge.textContent = `▼ 지난달 대비 감량`;
    weightChangeBadge.className = 'badge badge-success';
    weightIconWrapper.style.backgroundColor = '#E6F4EA';
    weightIconWrapper.style.color = 'var(--color-success)';
  } else if (weightChg > 0) {
    valWeightChange.textContent = `+${weightChg} kg`;
    weightChangeBadge.textContent = `▲ 지난달 대비 증량`;
    weightChangeBadge.className = 'badge badge-danger';
    weightIconWrapper.style.backgroundColor = '#FCE8E6';
    weightIconWrapper.style.color = 'var(--color-danger)';
  } else {
    valWeightChange.textContent = `0.0 kg`;
    weightChangeBadge.textContent = `변화 없음`;
    weightChangeBadge.className = 'badge badge-secondary';
    weightIconWrapper.style.backgroundColor = '#F3F4F6';
    weightIconWrapper.style.color = 'var(--color-text-muted)';
  }
}

/**
 * Chart.js 시각화 렌더링 (체중 선그래프 & 칼로리 바그래프)
 */
function renderCharts(data) {
  // Chart.js 폰트 및 공통 다크 네이비 테마 최적화 설정
  Chart.defaults.color = '#8E8EA8';
  Chart.defaults.font.family = "'Outfit', 'Noto Sans KR', sans-serif";
  Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.04)';

  // 1. 체중 시계열 라인 그래프 (weightHistory)
  const weightCtx = document.getElementById('weightChart').getContext('2d');
  const weightHistory = data.weightHistory || { labels: [], data: [] };
  
  // 데이터가 한 개도 없거나 비어있는 경우를 위한 프렌들리 플레이스홀더 데이터 대응
  if (weightHistory.labels.length === 0) {
    weightHistory.labels = ["측정 정보 없음"];
    weightHistory.data = [0];
  }

  // 체중 선 아래 그라데이션 채우기 효과 생성
  const weightGradient = weightCtx.createLinearGradient(0, 0, 0, 300);
  weightGradient.addColorStop(0, 'rgba(232, 89, 60, 0.35)');
  weightGradient.addColorStop(1, 'rgba(232, 89, 60, 0)');

  new Chart(weightCtx, {
    type: 'line',
    data: {
      labels: weightHistory.labels,
      datasets: [{
        label: '체중 (kg)',
        data: weightHistory.data,
        borderColor: '#E8593C',
        borderWidth: 3,
        backgroundColor: weightGradient,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#FFFFFF',
        pointBorderColor: '#E8593C',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            stepSize: 2
          }
        }
      }
    }
  });

  // 2. 주간 칼로리 섭취량 바 그래프 (weeklyCalories)
  const calorieCtx = document.getElementById('calorieChart').getContext('2d');
  const weeklyCalories = data.weeklyCalories || { labels: ["월", "화", "수", "목", "금", "토", "일"], data: [0, 0, 0, 0, 0, 0, 0] };

  new Chart(calorieCtx, {
    type: 'bar',
    data: {
      labels: weeklyCalories.labels,
      datasets: [{
        label: '섭취 칼로리 (kcal)',
        data: weeklyCalories.data,
        backgroundColor: 'rgba(245, 158, 11, 0.85)',
        hoverBackgroundColor: 'rgba(245, 158, 11, 1)',
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 500
          }
        }
      }
    }
  });
}
