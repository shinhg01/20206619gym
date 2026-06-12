/**
 * 아이언핏 GYM - 프론트엔드 환경 설정
 * 
 * [주의] Netlify 배포 및 로컬 실행 시, 
 * Google Apps Script에서 "새 배포"를 실행하여 획득한 Web App URL을 아래 GAS_URL에 입력해야 합니다.
 */
const CONFIG = {
  // TODO: 여기에 Google Apps Script 배포 URL을 입력하세요.
  // 예: 'https://script.google.com/macros/s/AKfycb.../exec'
  GAS_URL: 'https://script.google.com/macros/s/AKfycbzfiVrRzSHFAeYOGsFdSrcMNUthmFEXsUw-XLjK35O525-mCzRIFSEVuNb2vPM8opjQMg/exec',
  
  // 세션 스토리지용 키 정의
  SESSION_KEYS: {
    USER_ID: 'ironfit_userId',
    USER_NAME: 'ironfit_name',
    USER_ROLE: 'ironfit_role', // 일반회원 | PT회원 | 트레이너 | 관리자
    TRAINER_ID: 'ironfit_trainerId', // 배정된 트레이너 ID (회원의 경우)
    STATUS: 'ironfit_status' // 활동중 | 만료 | 대기 등
  }
};
