/**
 * 아이언핏 GYM - Google Apps Script 백엔드 (Code.gs)
 *
 * [병합 안내]
 * 이 파일은 기존 Google Apps Script 프로젝트의 Code.gs가 로컬에 없어
 * "PT 신청 대기" 기능에 필요한 부분만 새로 작성한 파일입니다.
 * 기존 GAS 프로젝트의 Code.gs 에디터에서 아래 내용을 다음 위치에 병합하세요.
 *
 * 1) SHEET_NAMES 객체   → ptRequests: '6_PT신청대기' 항목 추가
 * 2) doGet 의 switch문  → case 'getPTRequests' 추가
 * 3) doPost 의 switch문 → case 'updatePTRequest' 추가
 * 4) getPTRequests, updatePTRequest 함수 추가
 *
 * 기존에 존재하는 다른 함수(getMembers, getPayments, getEquipment,
 * getTrainers, login, addMember 등)는 변경 없이 그대로 유지합니다.
 */

const SHEET_NAMES = {
  // ... 기존 시트 매핑은 그대로 유지 ...
  ptRequests: '6_PT신청대기'
};

function doGet(e) {
  const action = e.parameter.action;

  switch (action) {
    // ... 기존 case들은 그대로 유지 ...

    case 'getPTRequests':
      return respond(getPTRequests());

    default:
      return respond({ error: '알 수 없는 action: ' + action });
  }
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;

  switch (action) {
    // ... 기존 case들은 그대로 유지 ...

    case 'updatePTRequest':
      return respond(updatePTRequest(body));

    default:
      return respond({ error: '알 수 없는 action: ' + action });
  }
}

/**
 * 공통 응답 헬퍼
 */
function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 200, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 6_PT신청대기 시트에서 상태가 "대기중"인 PT 신청 목록만 반환
 * 컬럼: 신청ID(A), 회원명(B), 트레이너ID(C), 트레이너명(D), 신청일시(E), 상태(F)
 */
function getPTRequests() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ptRequests);
  const rows = sheet.getDataRange().getValues();

  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const status = row[5];
    if (status !== '대기중') continue;

    const applyDate = row[4];
    const formattedDate = (applyDate instanceof Date)
      ? Utilities.formatDate(applyDate, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
      : applyDate;

    result.push({
      신청ID: row[0],
      회원명: row[1],
      트레이너ID: row[2],
      트레이너명: row[3],
      신청일시: formattedDate,
      상태: row[5]
    });
  }
  return result;
}

/**
 * 6_PT신청대기 시트에서 신청ID에 해당하는 행의 상태(F열)를 업데이트
 * body: { 신청ID, 상태 } - 상태는 "승인" 또는 "거절"
 */
function updatePTRequest(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ptRequests);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(body.신청ID)) {
      sheet.getRange(i + 1, 6).setValue(body.상태); // F열 = 상태
      return { success: true };
    }
  }
  return { success: false, message: '신청ID를 찾을 수 없습니다: ' + body.신청ID };
}
