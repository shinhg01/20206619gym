/**
 * 아이언핏 GYM - Google Apps Script 백엔드 (Code.gs)
 *
 * [병합 안내]
 * 이 파일은 기존 Google Apps Script 프로젝트의 Code.gs가 로컬에 없어
 * "PT 신청 대기" 기능에 필요한 부분만 새로 작성한 파일입니다.
 * 기존 GAS 프로젝트의 Code.gs 에디터에서 아래 내용을 다음 위치에 병합하세요.
 *
 * 1) SHEET_NAMES 객체   → ptRequests: '6_PT신청대기' 항목 추가
 *    (기존 SHEET_NAMES에 회원 시트가 members: '...' 형태로 이미 정의되어
 *     있어야 합니다. removePTMember 함수가 이를 사용합니다.)
 * 2) doGet 의 switch문  → case 'getPTRequests' 추가
 * 3) doPost 의 switch문 → case 'updatePTRequest', case 'removePTMember' 추가
 * 4) getPTRequests, updatePTRequest, addPTRequestToQueue, removePTMember 함수 추가
 * 5) 기존 registerPT 함수 마지막(성공 처리 부분)에 아래 한 줄을 추가하여
 *    PT 신청 시 "6_PT신청대기" 시트에도 알림용 행이 쌓이도록 합니다.
 *
 *      addPTRequestToQueue({
 *        trainerId: <PT 신청에 사용된 트레이너 ID>,
 *        trainerName: <트레이너명>,
 *        memberName: <신청 회원명>
 *      });
 *
 *    (registerPT의 실제 매개변수/변수명에 맞게 위 3개 값을 채워서 호출하세요.)
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
      return respond(getPTRequests(e.parameter.trainerId));

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

    case 'removePTMember':
      return respond(removePTMember(body));

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
 *
 * @param {string} [trainerId] 지정 시 해당 트레이너(C열)의 신청만 반환 (트레이너 화면용).
 *                              생략 시 전체 트레이너의 대기중 신청 반환 (관리자 화면용).
 */
function getPTRequests(trainerId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ptRequests);
  const rows = sheet.getDataRange().getValues();

  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const status = row[5];
    if (status !== '대기중') continue;
    if (trainerId && String(row[2]) !== String(trainerId)) continue;

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
 * 6_PT신청대기 시트에 새 PT 신청 행을 추가하고 신청ID를 반환
 * (registerPT 함수 내부에서 PT 계약 등록 로직과 함께 호출하세요)
 *
 * @param {{trainerId:string, trainerName:string, memberName:string}} info
 * @return {string} 생성된 신청ID
 */
function addPTRequestToQueue(info) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ptRequests);
  const id  = 'PTREQ' + new Date().getTime();
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  sheet.appendRow([id, info.memberName, info.trainerId, info.trainerName, now, '대기중']);
  return id;
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

/**
 * PT 회원을 일반회원으로 전환하고 담당 트레이너 배정을 해제합니다.
 * (회원 시트의 행을 삭제하지 않고 등급/배정 트레이너 값만 초기화합니다)
 *
 * 회원 시트 컬럼: ID(A), 이름(B), 성별(C), 나이(D), 등급(E),
 *                 등록일(F), 만료일(G), 배정트레이너(H), 연락처(I), 상태(J)
 *
 * body: { memberId }
 */
function removePTMember(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.members);
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(body.memberId)) {
      sheet.getRange(i + 1, 5).setValue('일반회원'); // E열 = 등급
      sheet.getRange(i + 1, 8).setValue('');         // H열 = 배정 트레이너
      return { success: true };
    }
  }
  return { success: false, message: '회원ID를 찾을 수 없습니다: ' + body.memberId };
}
