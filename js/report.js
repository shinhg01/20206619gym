/**
 * 아이언핏 GYM - 신체 변화 보고서 생성기 (report.js)
 * 회원/트레이너 공용 PDF(인쇄) 보고서 생성 모듈
 * body.html, trainer.html 양쪽에서 사용됩니다.
 */

function generateBodyReport(memberName, bodyData, trainerName) {
  if (!bodyData || bodyData.length === 0) {
    alert('출력할 신체 측정 데이터가 없습니다.');
    return;
  }

  const sorted  = [...bodyData].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const latest  = sorted[sorted.length - 1];
  const first   = sorted[0];
  const today   = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  function fmt(val, unit = '') {
    const n = Number(val);
    return (!val && val !== 0) || isNaN(n) ? '-' : `${n.toFixed(1)}${unit}`;
  }

  function delta(a, b) {
    const va = Number(a), vb = Number(b);
    if (isNaN(va) || isNaN(vb) || !a || !b) return null;
    const d = vb - va;
    return { val: Math.abs(d).toFixed(1), dir: d > 0 ? '▲' : (d < 0 ? '▼' : '→'), up: d > 0 };
  }

  const wD = delta(first.weight, latest.weight);
  const fD = delta(first.fat,    latest.fat);
  const mD = delta(first.muscle, latest.muscle);
  const hD = delta(first.waist,  latest.waist);

  function dHtml(d, goodWhenDown = true) {
    if (!d || d.val === '0.0') return '<span style="color:#999;">변화 없음</span>';
    const good  = goodWhenDown ? !d.up : d.up;
    const color = good ? '#16A34A' : '#DC2626';
    return `<span style="color:${color}; font-weight:800;">${d.dir} ${d.val}</span>`;
  }

  // ── SVG 체중 라인 차트 ──────────────────────────────────────
  const weights = sorted.map(d => Number(d.weight) || 0).filter(w => w > 0);
  const dates   = sorted.map(d => (d.date || '').slice(5));
  const cW = 520, cH = 110;
  const minW = Math.min(...weights) - 2;
  const maxW = Math.max(...weights) + 2;
  const range = maxW - minW || 1;

  const pts = weights.map((w, i) => {
    const x = 40 + (i / Math.max(weights.length - 1, 1)) * (cW - 60);
    const y = cH - 22 - ((w - minW) / range) * (cH - 38);
    return { x, y, w, d: dates[i] };
  });
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area     = pts.map(p => `${p.x},${p.y}`).join(' ') +
                   ` ${pts[pts.length-1].x},${cH-22} ${pts[0].x},${cH-22}`;

  const labelIdxs = weights.length <= 6
    ? pts.map((_, i) => i)
    : [0, Math.floor(pts.length / 4), Math.floor(pts.length / 2), Math.floor(pts.length * 3 / 4), pts.length - 1];

  const weightChart = weights.length < 2
    ? '<p style="text-align:center;color:#BBB;font-size:12px;padding:20px 0;">데이터 2건 이상 필요합니다</p>'
    : `<svg viewBox="0 0 ${cW} ${cH}" style="width:100%;height:${cH}px;">
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#E8593C" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#E8593C" stop-opacity="0.02"/>
          </linearGradient>
        </defs>
        ${[0.25,0.5,0.75,1].map(f => {
          const y = cH - 22 - f * (cH - 38);
          const val = (minW + f * range).toFixed(1);
          return `<line x1="40" y1="${y}" x2="${cW-20}" y2="${y}" stroke="#EFEFEF" stroke-width="1"/>
                  <text x="36" y="${y+4}" text-anchor="end" font-size="9" fill="#CCC">${val}</text>`;
        }).join('')}
        <line x1="40" y1="5" x2="40" y2="${cH-22}" stroke="#E5E7EB" stroke-width="1"/>
        <line x1="40" y1="${cH-22}" x2="${cW-20}" y2="${cH-22}" stroke="#E5E7EB" stroke-width="1"/>
        <polygon points="${area}" fill="url(#wg)"/>
        <polyline points="${polyline}" fill="none" stroke="#E8593C" stroke-width="2.5"
                  stroke-linejoin="round" stroke-linecap="round"/>
        ${pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#E8593C" stroke="#FFF" stroke-width="2"/>`).join('')}
        ${labelIdxs.map(i => {
          const p = pts[i];
          return `<text x="${p.x}" y="${cH-6}" text-anchor="middle" font-size="9" fill="#BBB">${p.d}</text>
                  <text x="${p.x}" y="${p.y-9}" text-anchor="middle" font-size="9.5" fill="#E8593C" font-weight="700">${p.w}</text>`;
        }).join('')}
      </svg>`;

  // ── 인체 실루엣 SVG ─────────────────────────────────────────
  const figureSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 400" width="120" height="266">
  <defs>
    <linearGradient id="fg1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F2EDE6"/>
      <stop offset="100%" stop-color="#E0D6CA"/>
    </linearGradient>
    <filter id="fs"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#C9B99A" flood-opacity="0.25"/></filter>
  </defs>
  <!-- Shadow -->
  <ellipse cx="90" cy="396" rx="46" ry="5" fill="#DDD4C8" opacity="0.5"/>
  <!-- Head -->
  <ellipse cx="90" cy="30" rx="24" ry="28" fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1.5" filter="url(#fs)"/>
  <!-- Hair hint -->
  <path d="M66,15 Q90,3 114,15 Q110,5 90,4 Q70,5 66,15Z" fill="#C5B5A0" opacity="0.4"/>
  <!-- Eyes -->
  <ellipse cx="81" cy="26" rx="3.5" ry="4.5" fill="#C5B5A0" opacity="0.35"/>
  <ellipse cx="99" cy="26" rx="3.5" ry="4.5" fill="#C5B5A0" opacity="0.35"/>
  <!-- Smile -->
  <path d="M82,40 Q90,46 98,40" fill="none" stroke="#C5B5A0" stroke-width="1.5" stroke-linecap="round"/>
  <!-- Neck -->
  <path d="M80,56 L80,70 Q90,75 100,70 L100,56 Q90,62 80,56Z" fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1"/>
  <!-- Collar bone hint -->
  <path d="M55,82 Q73,75 90,78 Q107,75 125,82" fill="none" stroke="#C5B5A0" stroke-width="1" stroke-dasharray="3,2" opacity="0.5"/>
  <!-- Upper torso -->
  <path d="M35,88 Q47,76 80,70 L100,70 Q133,76 145,88 L141,158 Q118,168 90,170 Q62,168 39,158Z"
        fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1.5" filter="url(#fs)"/>
  <!-- Chest center line -->
  <line x1="90" y1="85" x2="90" y2="138" stroke="#C5B5A0" stroke-width="0.8" stroke-dasharray="4,3" opacity="0.4"/>
  <!-- Pec lines -->
  <path d="M58,104 Q74,112 90,109 Q106,112 122,104" fill="none" stroke="#C5B5A0" stroke-width="0.9" opacity="0.3"/>
  <!-- Abs -->
  <rect x="79" y="128" width="22" height="8" rx="4" fill="#C5B5A0" opacity="0.12"/>
  <rect x="79" y="140" width="22" height="8" rx="4" fill="#C5B5A0" opacity="0.10"/>
  <!-- Left arm -->
  <path d="M37,92 Q18,126 20,196 Q27,204 38,200 Q42,162 48,128 Q46,108 37,92Z"
        fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1.5"/>
  <!-- Left hand -->
  <ellipse cx="29" cy="202" rx="9" ry="12" fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1.5"/>
  <!-- Right arm -->
  <path d="M143,92 Q162,126 160,196 Q153,204 142,200 Q138,162 132,128 Q134,108 143,92Z"
        fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1.5"/>
  <!-- Right hand -->
  <ellipse cx="151" cy="202" rx="9" ry="12" fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1.5"/>
  <!-- Waist / abdomen -->
  <path d="M39,158 Q62,168 90,170 Q118,168 141,158 L138,208 Q115,220 90,222 Q65,220 42,208Z"
        fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1.5" filter="url(#fs)"/>
  <!-- Waist marker line -->
  <line x1="32" y1="183" x2="148" y2="183" stroke="#E8593C" stroke-width="0.9" stroke-dasharray="4,3" opacity="0.5"/>
  <!-- Hip -->
  <path d="M42,208 Q65,220 90,222 Q115,220 138,208 L134,248 Q112,262 90,264 Q68,262 46,248Z"
        fill="#EDE5DB" stroke="#C5B5A0" stroke-width="1.5"/>
  <!-- Left leg -->
  <path d="M46,248 Q37,286 39,352 Q48,360 60,356 Q63,314 66,268 Q57,258 46,248Z"
        fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1.5"/>
  <!-- Left foot -->
  <path d="M39,355 Q32,368 30,376 Q48,382 62,376 L60,355Z"
        fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1.5"/>
  <!-- Right leg -->
  <path d="M134,248 Q143,286 141,352 Q132,360 120,356 Q117,314 114,268 Q123,258 134,248Z"
        fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1.5"/>
  <!-- Right foot -->
  <path d="M141,355 Q148,368 150,376 Q132,382 118,376 L120,355Z"
        fill="url(#fg1)" stroke="#C5B5A0" stroke-width="1.5"/>
  <!-- Knee caps -->
  <ellipse cx="53" cy="306" rx="9" ry="7" fill="#C5B5A0" opacity="0.18"/>
  <ellipse cx="127" cy="306" rx="9" ry="7" fill="#C5B5A0" opacity="0.18"/>
</svg>`;

  // ── 측정 기록 테이블 행 ─────────────────────────────────────
  const tableRows = sorted.map((r, i) => `
    <tr${i === sorted.length - 1 ? ' class="latest-row"' : ''}>
      <td>${r.date || '-'}</td>
      <td>${fmt(r.weight, '')}</td>
      <td>${fmt(r.fat, '')}</td>
      <td>${fmt(r.muscle, '')}</td>
      <td>${fmt(r.waist, '')}</td>
      <td>${fmt(r.bmi, '')}</td>
    </tr>`).join('');

  // ── BMI 섹션 ────────────────────────────────────────────────
  const bmi = Number(latest.bmi) || 0;
  const bmiPct   = bmi ? Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100)) : 0;
  const bmiColor = bmi < 18.5 ? '#3B82F6' : bmi < 23 ? '#16A34A' : bmi < 25 ? '#F59E0B' : '#DC2626';
  const bmiLabel = bmi < 18.5 ? '저체중' : bmi < 23 ? '정상 범위' : bmi < 25 ? '과체중' : '비만';

  // ── 최종 HTML ───────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>신체 변화 보고서 — ${memberName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;900&display=swap');
    *  { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif;
      background: #F5F3EF;
      color: #1A1A2E;
      font-size: 12.5px;
      line-height: 1.55;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #FFF;
      padding: 13mm 14mm 10mm;
      display: flex;
      flex-direction: column;
    }
    /* ── Header ── */
    .rpt-header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 11px; border-bottom: 3px solid #E8593C; margin-bottom: 16px;
    }
    .gym-brand { display:flex; align-items:center; gap:10px; }
    .brand-icon {
      width:44px; height:44px; border-radius:11px;
      background: linear-gradient(135deg,#E8593C,#C0381F);
      display:flex; align-items:center; justify-content:center;
      font-size:22px; font-weight:900; color:#FFF; letter-spacing:-1px;
    }
    .brand-name { font-size:19px; font-weight:900; color:#1A1A2E; }
    .brand-sub  { font-size:10.5px; color:#AAA; margin-top:1px; }
    .rpt-meta   { text-align:right; }
    .rpt-title  { font-size:15px; font-weight:900; color:#E8593C; }
    .rpt-date   { font-size:10.5px; color:#AAA; margin-top:3px; }

    /* ── Member banner ── */
    .member-banner {
      background: linear-gradient(135deg,#1A1A2E 0%,#2E2E50 100%);
      border-radius:13px; color:#FFF;
      padding:14px 20px; margin-bottom:16px;
      display:flex; align-items:center; gap:14px;
    }
    .m-avatar {
      width:50px; height:50px; border-radius:50%; flex-shrink:0;
      background:rgba(232,89,60,0.85);
      display:flex; align-items:center; justify-content:center;
      font-size:22px; font-weight:900;
    }
    .m-name { font-size:17px; font-weight:900; }
    .m-sub  { font-size:10.5px; color:rgba(255,255,255,0.6); margin-top:2px; }
    .m-stats { margin-left:auto; display:flex; gap:22px; text-align:center; }
    .m-stat-v { font-size:19px; font-weight:900; color:#E8593C; }
    .m-stat-l { font-size:10px; color:rgba(255,255,255,0.55); }

    /* ── Section title ── */
    .sec-title {
      font-size:12.5px; font-weight:800; color:#1A1A2E;
      padding-left:8px; border-left:3px solid #E8593C;
      margin-bottom:10px;
    }

    /* ── Main grid (figure + cards) ── */
    .main-grid { display:flex; gap:14px; margin-bottom:16px; align-items:flex-start; }

    /* body figure box */
    .fig-box {
      width:160px; flex-shrink:0;
      background:#FAF8F5; border:1px solid #EDE5DB; border-radius:13px;
      padding:14px 10px 10px; text-align:center;
    }
    .fig-box-title {
      font-size:10px; font-weight:700; color:#AAA;
      letter-spacing:.5px; text-transform:uppercase; margin-bottom:10px;
    }
    .meas-table { width:100%; font-size:10.5px; border-collapse:collapse; margin-bottom:10px; }
    .meas-table td { padding:3px 4px; border:none; }
    .meas-lbl { text-align:right; color:#E8593C; font-weight:700; width:52%; }
    .meas-sep { text-align:center; color:#CCC; width:8%; }
    .meas-val { color:#444; }
    .fig-note { font-size:9px; color:#CCC; line-height:1.45; margin-top:6px; }

    /* metric cards */
    .cards-box { flex:1; }
    .metric-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
    .metric-card {
      background:#FAFAFA; border:1px solid #F0EEEB; border-radius:11px; padding:11px 13px;
    }
    .mc-label { font-size:10px; color:#AAA; font-weight:600; margin-bottom:4px; }
    .mc-value { font-size:22px; font-weight:900; line-height:1; color:#1A1A2E; }
    .mc-unit  { font-size:11px; color:#CCC; font-weight:400; }
    .mc-delta { margin-top:6px; font-size:11px; }
    .mc-base  { font-size:10px; color:#DDD; margin-top:2px; }

    /* BMI */
    .bmi-box {
      background:#FAF8F5; border:1px solid #EDE5DB; border-radius:11px;
      padding:10px 14px; margin-bottom:12px;
    }
    .bmi-row { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:6px; }
    .bmi-val { font-size:24px; font-weight:900; }
    .bmi-badge {
      font-size:11px; font-weight:700; padding:2px 10px; border-radius:20px;
    }
    .bmi-track {
      background:#EFEFEF; border-radius:20px; height:9px;
      position:relative; overflow:hidden; margin-bottom:5px;
    }
    .bmi-fill { height:100%; border-radius:20px; }
    .bmi-marks {
      display:flex; justify-content:space-between;
      font-size:9px; color:#CCC;
    }

    /* Chart */
    .chart-sec { margin-bottom:16px; }
    .chart-box {
      background:#FAFAFA; border:1px solid #F0EEEB; border-radius:12px;
      padding:12px 14px 6px;
    }

    /* Table */
    .table-sec { margin-bottom:14px; flex:1; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    thead th {
      background:#1A1A2E; color:#FFF;
      padding:7px 9px; text-align:center; font-weight:700; font-size:10.5px;
    }
    thead th:first-child { border-radius:6px 0 0 6px; text-align:left; }
    thead th:last-child  { border-radius:0 6px 6px 0; }
    tbody tr.latest-row td { font-weight:800; color:#E8593C; }
    tbody tr:nth-child(even) { background:#FAF9F7; }
    tbody td { padding:6px 9px; text-align:center; border-bottom:1px solid #F0EEEB; }
    tbody td:first-child { text-align:left; color:#555; }

    /* Notice */
    .notice {
      background:#FFF8F6; border:1px solid #FFD5CC; border-radius:8px;
      padding:9px 13px; font-size:10.5px; color:#AAA; margin-bottom:14px;
    }

    /* Footer */
    .rpt-footer {
      margin-top:auto; border-top:1px solid #EFEFEF; padding-top:9px;
      display:flex; justify-content:space-between; align-items:center;
      font-size:10px; color:#CCC;
    }
    .footer-brand { font-weight:800; color:#E8593C; }

    @media print {
      html, body { background:#FFF !important; }
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .page { margin:0; padding:10mm 12mm 8mm; box-shadow:none; }
      @page { size:A4; margin:0; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- ── 헤더 ── -->
  <div class="rpt-header">
    <div class="gym-brand">
      <div class="brand-icon">F</div>
      <div>
        <div class="brand-name">아이언핏 GYM</div>
        <div class="brand-sub">IronFit Health &amp; Fitness Center</div>
      </div>
    </div>
    <div class="rpt-meta">
      <div class="rpt-title">신체 변화 측정 보고서</div>
      <div class="rpt-date">발급일: ${today}${trainerName ? `&nbsp;·&nbsp;담당 트레이너: ${trainerName}` : ''}</div>
    </div>
  </div>

  <!-- ── 회원 배너 ── -->
  <div class="member-banner">
    <div class="m-avatar">${(memberName || '?')[0]}</div>
    <div>
      <div class="m-name">${memberName} 회원</div>
      <div class="m-sub">측정 기간: ${first.date || '-'} ~ ${latest.date || '-'} &nbsp;·&nbsp; 총 ${sorted.length}회 측정</div>
    </div>
    <div class="m-stats">
      <div>
        <div class="m-stat-v">${sorted.length}</div>
        <div class="m-stat-l">측정 횟수</div>
      </div>
      <div>
        <div class="m-stat-v">${fmt(latest.weight, '')}</div>
        <div class="m-stat-l">현재 체중(kg)</div>
      </div>
      <div>
        <div class="m-stat-v">${fmt(latest.fat, '')}</div>
        <div class="m-stat-l">체지방률(%)</div>
      </div>
    </div>
  </div>

  <!-- ── 본문 (인체 + 지표 카드) ── -->
  <div class="main-grid">

    <!-- 인체 실루엣 + 측정 포인트 -->
    <div class="fig-box">
      <div class="fig-box-title">Body Measurement</div>
      <table class="meas-table">
        <tr><td class="meas-lbl">체중</td><td class="meas-sep">—</td><td class="meas-val">${fmt(latest.weight,'kg')}</td></tr>
        <tr><td class="meas-lbl">체지방률</td><td class="meas-sep">—</td><td class="meas-val">${fmt(latest.fat,'%')}</td></tr>
        <tr><td class="meas-lbl">근육량</td><td class="meas-sep">—</td><td class="meas-val">${fmt(latest.muscle,'kg')}</td></tr>
        <tr><td class="meas-lbl">허리둘레</td><td class="meas-sep">—</td><td class="meas-val">${fmt(latest.waist,'cm')}</td></tr>
        <tr><td class="meas-lbl">BMI</td><td class="meas-sep">—</td><td class="meas-val">${fmt(latest.bmi,'')}</td></tr>
      </table>
      ${figureSvg}
      <div class="fig-note">※ 전문 의료기기 측정값과<br>다를 수 있습니다</div>
    </div>

    <!-- 지표 카드 -->
    <div class="cards-box">
      <div class="sec-title">최신 측정 지표 (${latest.date || '-'} 기준)</div>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="mc-label">⚖️ 체중</div>
          <div class="mc-value">${fmt(latest.weight,'')}<span class="mc-unit"> kg</span></div>
          <div class="mc-delta">${dHtml(wD, true)} 변화</div>
          <div class="mc-base">최초: ${fmt(first.weight,'kg')}</div>
        </div>
        <div class="metric-card">
          <div class="mc-label">🔥 체지방률</div>
          <div class="mc-value">${fmt(latest.fat,'')}<span class="mc-unit"> %</span></div>
          <div class="mc-delta">${dHtml(fD, true)} 변화</div>
          <div class="mc-base">최초: ${fmt(first.fat,'%')}</div>
        </div>
        <div class="metric-card">
          <div class="mc-label">💪 근육량</div>
          <div class="mc-value">${fmt(latest.muscle,'')}<span class="mc-unit"> kg</span></div>
          <div class="mc-delta">${dHtml(mD, false)} 변화</div>
          <div class="mc-base">최초: ${fmt(first.muscle,'kg')}</div>
        </div>
        <div class="metric-card">
          <div class="mc-label">📏 허리 둘레</div>
          <div class="mc-value">${fmt(latest.waist,'')}<span class="mc-unit"> cm</span></div>
          <div class="mc-delta">${dHtml(hD, true)} 변화</div>
          <div class="mc-base">최초: ${fmt(first.waist,'cm')}</div>
        </div>
      </div>

      <!-- BMI -->
      <div class="sec-title">BMI 체질량 지수</div>
      <div class="bmi-box">
        <div class="bmi-row">
          <span class="bmi-val" style="color:${bmiColor};">${bmi ? bmi.toFixed(1) : '—'}</span>
          <span class="bmi-badge" style="color:${bmiColor}; background:${bmiColor}22;">${bmiLabel}</span>
        </div>
        <div class="bmi-track">
          <div class="bmi-fill" style="width:${bmiPct}%; background:${bmiColor};"></div>
        </div>
        <div class="bmi-marks">
          <span>저체중 (&lt;18.5)</span>
          <span>정상 (18.5–23)</span>
          <span>과체중 (23–25)</span>
          <span>비만 (25+)</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ── 체중 변화 추이 ── -->
  <div class="chart-sec">
    <div class="sec-title">체중 변화 추이</div>
    <div class="chart-box">${weightChart}</div>
  </div>

  <!-- ── 전체 측정 기록 ── -->
  <div class="table-sec">
    <div class="sec-title">전체 측정 기록</div>
    <table>
      <thead>
        <tr>
          <th>측정일</th>
          <th>체중 (kg)</th>
          <th>체지방률 (%)</th>
          <th>근육량 (kg)</th>
          <th>허리 (cm)</th>
          <th>BMI</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <!-- ── 안내 문구 ── -->
  <div class="notice">
    ※ 본 보고서는 아이언핏 GYM에서 기록된 신체 측정 데이터를 기반으로 자동 생성되었습니다.
    의학적 진단 또는 치료 자료로 활용할 수 없으며, 정밀 분석은 전문 의료기관에서 받으시기 바랍니다.
  </div>

  <!-- ── 푸터 ── -->
  <div class="rpt-footer">
    <div><span class="footer-brand">아이언핏 GYM</span> · IronFit Health &amp; Fitness Center</div>
    <div>본 보고서는 개인 건강 관리 목적으로만 사용 가능합니다</div>
    <div>1 / 1</div>
  </div>

</div>
<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 600);
  });
</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=960,height=860,scrollbars=yes,resizable=yes');
  if (!win) {
    alert('팝업이 차단되었습니다.\n브라우저 주소 표시줄 오른쪽의 팝업 차단 아이콘을 클릭하여 허용해 주세요.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
