/*
 * 물류 기준 데이터: 컨테이너 규격, 권역별 참고 운임(부산 출발), 선사 코드, Incoterms
 * REF_RATES는 견적 비교용 '예시 기본값'입니다. 실제 운임은 매주 변동하므로
 * 설정 화면에서 포워더 견적값으로 덮어쓰세요(브라우저에 저장됨).
 */
(function (root) {
  'use strict';
  const TP = root.TP;

  // 내부 용적(m³), 실적재 권장 CBM, 최대 적재중량(kg)
  const CONTAINERS = {
    '20GP': { name: "20' Dry", volume: 33.2, usable: 28, payload: 28000 },
    '40GP': { name: "40' Dry", volume: 67.7, usable: 58, payload: 26500 },
    '40HC': { name: "40' High Cube", volume: 76.4, usable: 68, payload: 26500 },
  };

  const REGIONS = {
    KR: '국내', JP: '일본', CN: '중국·대만·홍콩', SEA: '동남아', IN: '인도·남아시아', ME: '중동',
    NEU: '북유럽·서유럽', USWC: '미주 서안·캐나다', USEC: '미주 동안', AU: '호주·뉴질랜드', LATAM: '중남미',
  };

  // 부산 출발 참고 운임(USD). FCL은 컨테이너당 해상운임(부대비 제외), LCL은 RT(1CBM 또는 1톤)당, AIR는 kg당
  const REF_RATES = {
    JP:    { '20GP': 350,  '40GP': 600,  '40HC': 650,  LCL: 35, AIR: 2.2, transit: '2~4일' },
    CN:    { '20GP': 300,  '40GP': 550,  '40HC': 600,  LCL: 30, AIR: 2.0, transit: '2~5일' },
    SEA:   { '20GP': 450,  '40GP': 800,  '40HC': 850,  LCL: 40, AIR: 2.8, transit: '5~12일' },
    IN:    { '20GP': 1000, '40GP': 1700, '40HC': 1800, LCL: 55, AIR: 3.5, transit: '15~25일' },
    ME:    { '20GP': 1300, '40GP': 2200, '40HC': 2300, LCL: 60, AIR: 3.8, transit: '18~28일' },
    NEU:   { '20GP': 2000, '40GP': 3400, '40HC': 3500, LCL: 75, AIR: 4.5, transit: '30~40일' },
    USWC:  { '20GP': 1900, '40GP': 2600, '40HC': 2700, LCL: 70, AIR: 4.2, transit: '12~18일' },
    USEC:  { '20GP': 2900, '40GP': 3800, '40HC': 3900, LCL: 90, AIR: 4.8, transit: '28~38일' },
    AU:    { '20GP': 1100, '40GP': 1900, '40HC': 2000, LCL: 60, AIR: 3.6, transit: '14~20일' },
    LATAM: { '20GP': 2600, '40GP': 4200, '40HC': 4300, LCL: 95, AIR: 5.5, transit: '30~45일' },
    KR:    { '20GP': 0, '40GP': 0, '40HC': 0, LCL: 0, AIR: 0, transit: '-' },
  };

  // 출발지 부대비용 참고값(KRW) — 컨테이너당 / 건당
  const LOCAL_CHARGES_KRW = {
    THC: { '20GP': 160000, '40GP': 220000, '40HC': 220000, LCL_PER_CBM: 9000 },
    DOC: 50000,          // 서류발급비
    WHARFAGE_PER_TEU: 4500,
    CUSTOMS_FEE: 30000,  // 수출신고 관세사 수수료(건당 최저 수준)
    CFS_PER_CBM: 7000,
  };

  // ISO 6346 선사(소유자) 코드 → 선사명·추적 URL
  const CARRIERS = [
    { name: 'Maersk', prefixes: ['MAEU', 'MSKU', 'MRKU', 'MRSU', 'SEAU', 'SUDU'], track: 'https://www.maersk.com/tracking/{no}' },
    { name: 'MSC', prefixes: ['MSCU', 'MEDU', 'MSDU', 'MSMU', 'FSCU'], track: 'https://www.msc.com/en/track-a-shipment?trackingNumber={no}' },
    { name: 'CMA CGM', prefixes: ['CMAU', 'CGMU', 'APHU', 'APZU', 'ECMU'], track: 'https://www.cma-cgm.com/ebusiness/tracking/search?SearchBy=Container&Reference={no}' },
    { name: 'COSCO', prefixes: ['COSU', 'CBHU', 'CSNU', 'CCLU', 'OOLU', 'OOCU'], track: 'https://elines.coscoshipping.com/ebusiness/cargoTracking?trackingType=CONTAINER&number={no}' },
    { name: 'Hapag-Lloyd', prefixes: ['HLCU', 'HLXU', 'HAMU', 'UACU'], track: 'https://www.hapag-lloyd.com/en/online-business/track/track-by-container-solution.html?container={no}' },
    { name: 'ONE', prefixes: ['ONEU', 'NYKU', 'MOLU', 'KKFU', 'TCLU'], track: 'https://ecomm.one-line.com/one-ecom/manage-shipment/cargo-tracking?trakNoParam={no}' },
    { name: 'Evergreen', prefixes: ['EGLV', 'EGHU', 'EISU', 'EMCU', 'TGHU'], track: 'https://ct.shipmentlink.com/servlet/TDB1_CargoTracking.do' },
    { name: 'HMM', prefixes: ['HMMU', 'HDMU'], track: 'https://www.hmm21.com/e-service/general/trackNTrace/TrackNTrace.do' },
    { name: 'Yang Ming', prefixes: ['YMLU', 'YMMU'], track: 'https://www.yangming.com/e-service/track_trace/track_trace_cargo_tracking.aspx' },
    { name: 'ZIM', prefixes: ['ZIMU', 'ZCSU'], track: 'https://www.zim.com/tools/track-a-shipment?consnumber={no}' },
    { name: '고려해운(KMTC)', prefixes: ['KMTU'], track: 'https://www.ekmtc.com/index.html#/cargo-tracking' },
    { name: '장금상선(Sinokor)', prefixes: ['SKLU', 'SKHU'], track: 'https://ebiz.sinokor.co.kr/Tracking' },
    { name: '흥아라인/SM상선', prefixes: ['SMCU', 'SMLU', 'HASU'], track: 'https://www.smlines.com/' },
    { name: 'Wan Hai', prefixes: ['WHLU', 'WHSU'], track: 'https://www.wanhai.com/views/cargoTrack/CargoTrack.xhtml' },
  ];

  const INCOTERMS = {
    EXW: { name: 'EX Works', risk: '판매자 작업장 인도', seller: ['포장'], buyer: ['수출통관', '내륙운송', '해상운임', '보험', '수입통관·관세'] },
    FCA: { name: 'Free Carrier', risk: '지정 운송인 인도', seller: ['포장', '수출통관', '지정장소까지 운송'], buyer: ['해상운임', '보험', '수입통관·관세'] },
    FOB: { name: 'Free On Board', risk: '선적항 본선 적재', seller: ['포장', '수출통관', '내륙운송', '선적항 THC'], buyer: ['해상운임', '보험', '수입통관·관세'] },
    CFR: { name: 'Cost and Freight', risk: '선적항 본선 적재(운임은 판매자)', seller: ['FOB 비용', '해상운임'], buyer: ['보험', '도착항 비용', '수입통관·관세'] },
    CIF: { name: 'Cost, Insurance and Freight', risk: '선적항 본선 적재(운임·보험은 판매자)', seller: ['CFR 비용', '적하보험(110%, ICC(C) 이상)'], buyer: ['도착항 비용', '수입통관·관세'] },
    DAP: { name: 'Delivered at Place', risk: '목적지 도착(양하 전)', seller: ['CIF 비용', '도착지 운송'], buyer: ['수입통관·관세·부가세'] },
    DDP: { name: 'Delivered Duty Paid', risk: '목적지 도착(수입통관 완료)', seller: ['DAP 비용', '수입관세·부가세'], buyer: ['양하'] },
  };

  TP.data.CONTAINERS = CONTAINERS;
  TP.data.REGIONS = REGIONS;
  TP.data.REF_RATES = REF_RATES;
  TP.data.LOCAL_CHARGES_KRW = LOCAL_CHARGES_KRW;
  TP.data.CARRIERS = CARRIERS;
  TP.data.INCOTERMS = INCOTERMS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
