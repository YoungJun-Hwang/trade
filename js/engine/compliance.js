/*
 * 법규·요건 사전 검증 엔진
 * 대외무역법(전략물자·수출입공고), 외국환거래법, 관세법(세관장확인), 제재국가, CITES·바젤협약 등
 * 결과는 '확인이 필요한 항목' 목록이며 법률 자문이 아닙니다.
 */
(function (root) {
  'use strict';
  const TP = root.TP;

  const LINKS = {
    yestrade: 'https://www.yestrade.go.kr/',
    clip: 'https://unipass.customs.go.kr/clip/index.do',
    tradenavi: 'https://www.tradenavi.or.kr/',
    cites: 'https://www.me.go.kr/',
    fx: 'https://www.law.go.kr/법령/외국환거래규정',
    fta: 'https://www.customs.go.kr/ftaportalkor/main.do',
  };

  const KEYWORD_RULES = [
    { re: /(상아|ivory|악어|crocodile|python|비단뱀|산호|coral|침향|agarwood|로즈우드|rosewood|자단|거북|tortoise|모피|\bfur\b)/i, level: 'warn', title: 'CITES(멸종위기종) 해당 가능', detail: '야생동식물 유래 원료가 포함되면 환경부(유역환경청) 수출입 허가 필요', link: LINKS.cites },
    { re: /(폐기물|scrap|스크랩|waste|폐배터리|폐플라스틱|e-waste)/i, level: 'warn', title: '바젤협약 폐기물 해당 가능', detail: '폐기물 국가간 이동은 환경부 수출입 허가·신고 대상', link: LINKS.tradenavi },
    { re: /(마약|대마|cbd|hemp|양귀비|ephedrine|에페드린|pseudoephedrine)/i, level: 'block', title: '마약류·원료물질 의심', detail: '마약류관리법 — 식약처 승인 없이는 수출입 불가. CBD 제품은 국내 반입 금지 품목', link: LINKS.tradenavi },
    { re: /(총기|총포|firearm|\bguns?\b|탄약|ammunition|도검|석궁|화약|explosive)/i, level: 'warn', title: '총포·도검·화약류 해당 가능', detail: '총포화약법 — 경찰청 수출입 허가, 방산물자는 방위사업청 허가', link: LINKS.tradenavi },
    { re: /(골동|antique|문화재|고미술|antiquities)/i, level: 'warn', title: '문화재 반출 제한 가능', detail: '문화유산법 — 일반동산문화유산은 국외 반출 시 비문화재 확인 필요', link: LINKS.tradenavi },
    { re: /(중고|\bused\b|refurbished|리퍼)/i, level: 'info', title: '중고품 거래', detail: '중고 차량·기계·전자제품은 수입국별 반입 제한(연식·PSI 검사)이 많습니다', link: LINKS.tradenavi },
    { re: /(배터리|battery|lithium|리튬|보조배터리|power bank)/i, level: 'warn', title: '위험물(리튬배터리) 운송', detail: 'UN38.3 시험성적서·MSDS 필요, 항공 운송 시 IATA DGR(PI965~970) 포장·표기', link: LINKS.tradenavi },
    { re: /(hcfc|cfc|냉매|refrigerant|r-22|r22)/i, level: 'warn', title: '오존층 파괴물질 가능', detail: '오존층보호법 — 특정물질 수출입 허가', link: LINKS.tradenavi },
    { re: /(드론|drone|uav|암호화|encryption|레이더|radar|적외선|thermal camera|열화상)/i, level: 'warn', title: '전략물자 가능성 높음', detail: '이중용도 품목 — 전략물자관리원 Yestrade 자가판정/전문판정 후 필요 시 수출허가', link: LINKS.yestrade },
  ];

  /**
   * @param {{description?:string, hs?:string, country?:string, direction?:'export'|'import', payment?:string, amountUSD?:number}} q
   */
  function check(q) {
    const alerts = [];
    const add = (level, title, detail, link) => alerts.push({ level, title, detail, link });
    const direction = q.direction || 'export';
    const text = String(q.description || '');
    const prof = q.hs ? TP.engine.hs.profile(q.hs, q.country, direction) : null;

    // 1) 제재·수출통제 국가
    const s = q.country && TP.data.SANCTIONS[q.country];
    if (s) add(s.level === 'block' ? 'block' : 'warn', `${s.name}: 제재·수출통제 대상국`, s.note, LINKS.yestrade);

    // 2) 전략물자
    if (prof && prof.strategic && direction === 'export') {
      add('warn', '전략물자 판정 권장', `HS ${prof.hs}는 이중용도 품목이 많은 세번입니다. 대외무역법상 전략물자 해당 여부를 판정받으세요(미판정 수출 시 처벌).`, LINKS.yestrade);
    }
    if (prof && prof.hs.replace(/\D/g, '').startsWith('93')) add('block', '무기류(제93류)', '방위사업청·경찰청 허가 없이는 수출입 불가', LINKS.tradenavi);

    // 3) 품목 키워드
    for (const r of KEYWORD_RULES) if (r.re.test(text)) add(r.level, r.title, r.detail, r.link);

    // 4) 수입 요건(세관장확인)
    if (prof && direction === 'import') {
      add('info', `세관장확인대상 여부 확인 — ${prof.categoryInfo.name}`, (TP.data.COUNTRIES.KR.certs[prof.category] || []).join(', ') || '통합공고 확인', LINKS.clip);
      if (prof.krDuty !== null && prof.krDuty >= 30) add('warn', `고율관세 품목(기본 ${prof.krDuty}%)`, prof.note || '관세율할당(TRQ)·조정관세 여부 확인', LINKS.clip);
    }
    if (prof && prof.dangerousGoods && !alerts.some((a) => a.title.includes('위험물'))) {
      add('warn', '위험물 운송 규정', 'IMDG(해상)·IATA DGR(항공) 분류·포장·서류 필요', LINKS.tradenavi);
    }

    // 5) FTA 활용
    if (prof && q.country && prof.fta.length) {
      add('info', `FTA 활용 가능: ${prof.fta.join(', ')}`, `원산지결정기준(참고): ${prof.ftaRule || '협정별 확인'}. 원산지증명서·소명자료(5년) 준비`, LINKS.fta);
    }

    // 6) 외국환거래법
    const pay = String(q.payment || '').toUpperCase();
    if (/(THIRD|제3자)/.test(pay)) add('warn', '제3자 지급·수령', '거래 당사자가 아닌 자와의 지급·수령은 금액에 따라 외국환은행 또는 한국은행 신고 대상', LINKS.fx);
    if (/(NETTING|상계)/.test(pay)) add('warn', '상계 결제', '수출입 대금 상계는 외국환은행 신고 대상(일부 예외)', LINKS.fx);
    if (/(CASH|현금)/.test(pay)) add('warn', '현금 휴대 결제', 'USD 1만 상당 초과 지급수단 휴대 반출·입 시 세관 신고', LINKS.fx);
    if (direction === 'import' && /(ADVANCE|선급|T\/T)/.test(pay) && q.amountUSD > 0) {
      add('info', '수입대금 송금 증빙', '외국환은행에 계약서·P/I 등 거래 증빙을 제출해 송금합니다. 거래외국환은행 지정 여부 확인', LINKS.fx);
    }

    // 7) 공통
    add('info', '수출입공고·통합공고 최종 확인', 'HSK 10단위로 관세법령정보포털·TradeNAVI에서 수출입 제한 여부를 최종 확인하세요', LINKS.tradenavi);

    const order = { block: 0, warn: 1, info: 2 };
    alerts.sort((a, b) => order[a.level] - order[b.level]);
    return { ok: !alerts.some((a) => a.level === 'block'), alerts };
  }

  TP.engine.compliance = { check, LINKS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
