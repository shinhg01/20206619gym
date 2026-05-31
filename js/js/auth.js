/**
 * 아이언핏 GYM - 인증 제어 스크립트 (auth.js)
 * 
 * 로그인 요청 처리, 유효성 검증, 세션 상태 저장 및
 * 사용자 권한(회원/트레이너/관리자)에 맞는 페이지 리다이렉션을 관장합니다.
 */

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const errorAlert = document.getElementById('errorAlert');
  const errorMessage = document.getElementById('errorMessage');
  const memberIdInput = document.getElementById('memberId');
  const passwordInput = document.getElementById('password');
  const rememberMeCheckbox = document.getElementById('rememberMe');

  // 1. LocalStorage에서 '저장된 아이디' 불러오기 (UX 개선)
  const savedId = localStorage.getItem('ironfit_saved_id');
  if (savedId) {
    memberIdInput.value = savedId;
    rememberMeCheckbox.checked = true;
  }

  // 2. 에러 뷰 초기화 헬퍼
  function hideError() {
    errorAlert.style.display = 'none';
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorAlert.style.display = 'flex';
    
    // 포커스 이동 및 진동 효과 대용(UX)
    errorAlert.style.animation = 'none';
    void errorAlert.offsetWidth; // trigger reflow
    errorAlert.style.animation = 'shake 0.3s ease-in-out';
  }

  // 3. 입력 필드 타이핑 시 에러 메시지 자동 숨김
  memberIdInput.addEventListener('input', hideError);
  passwordInput.addEventListener('input', hideError);

  // 4. 폼 전송(Submit) 이벤트 리스너
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const memberId = memberIdInput.value.trim();
    const password = passwordInput.value.trim();

    // 5. 프론트엔드 유효성 검사
    if (!memberId) {
      showError('사용자 ID를 입력해 주세요.');
      memberIdInput.focus();
      return;
    }

    if (!password) {
      showError('비밀번호를 입력해 주세요.');
      passwordInput.focus();
      return;
    }

    try {
      // 6. GAS Web App POST API 호출
      // api.js에 정의된 callPost 함수 사용
      const result = await callPost('login', {
        memberId: memberId,
        password: password
      });

      // 7. API 응답 결과 분석
      if (result && result.success) {
        
        // 7-1. 아이디 저장 여부 처리
        if (rememberMeCheckbox.checked) {
          localStorage.setItem('ironfit_saved_id', memberId);
        } else {
          localStorage.removeItem('ironfit_saved_id');
        }

        // 7-2. 세션 스토리지 정보 저장
        sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_ID, result.userId);
        sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_NAME, result.name);
        sessionStorage.setItem(CONFIG.SESSION_KEYS.USER_ROLE, result.role); // 일반회원 / PT회원 / 트레이너 / 관리자
        sessionStorage.setItem(CONFIG.SESSION_KEYS.TRAINER_ID, result.assignedTrainer || '');
        sessionStorage.setItem(CONFIG.SESSION_KEYS.STATUS, result.status || '활동중');

        // 7-3. 역할(Role)별 다이내믹 리다이렉트
        const role = result.role;
        if (role === '관리자') {
          window.location.href = 'admin.html';
        } else if (role === '트레이너') {
          window.location.href = 'trainer.html';
        } else if (role === '일반회원' || role === 'PT회원') {
          window.location.href = 'dashboard.html';
        } else {
          showError('지정되지 않은 회원 등급입니다. 관리자에게 문의하세요.');
        }

      } else {
        // 백엔드 인증 실패 응답 메시지 노출
        showError(result.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
      }

    } catch (error) {
      console.error('[LOGIN SUBMIT ERROR]', error);
      showError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  });
});

// 시범 로그인: 자격증명 자동 입력 후 폼 제출
function demoLogin(id, pw) {
  document.getElementById('memberId').value = id;
  document.getElementById('password').value = pw;
  document.getElementById('loginForm').dispatchEvent(new Event('submit'));
}

// 흔들림 애니메이션 CSS 동적 주입 (Shake Effect)
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    75% { transform: translateX(6px); }
  }
`;
document.head.appendChild(styleSheet);
