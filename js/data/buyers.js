/*
 * 해외 바이어 발굴 채널 데이터
 * 이 프로그램은 자체 바이어 DB를 갖고 있지 않습니다. 대신 품목·HS코드·국가로
 * 공공/민간 바이어 DB와 검색 경로를 자동으로 조합해 보여줍니다.
 */
(function (root) {
  'use strict';
  const TP = root.TP;

  // {q}=영문 품목 키워드, {hs}=HS 6단위(점 제거), {hs4}=HS 4단위, {country}=국가 영문명
  const CHANNELS = [
    { group: '공공 지원(무료)', name: 'KOTRA buyKOREA', desc: '해외 바이어 구매오퍼(Inquiry) 확인·인콰이어리 응답', url: 'https://www.buykorea.org/', how: '회원가입 → 상품 등록 → 바이어 인콰이어리 수신/구매오퍼 검색' },
    { group: '공공 지원(무료)', name: 'KOTRA 해외무역관 서비스', desc: '해외시장조사(바이어 리스트 발굴) 유료/바우처 지원, 지사화 사업', url: 'https://www.kotra.or.kr/', how: '해외시장조사 신청 시 무역관이 잠재 바이어 리스트·연락처를 조사' },
    { group: '공공 지원(무료)', name: 'KITA TradeKorea', desc: '한국무역협회 B2B 매칭 플랫폼, 바이어 매칭 상담회', url: 'https://www.tradekorea.com/', how: '셀러 등록 → 바이어 인콰이어리·온라인 상담회 참가' },
    { group: '공공 지원(무료)', name: 'KOTRA 해외시장뉴스', desc: '국가·품목별 시장동향, 수입규제, 유통구조', url: 'https://dream.kotra.or.kr/kotranews/index.do', how: '품목명으로 검색해 현지 수입·유통 구조를 먼저 파악' },
    { group: '공공 지원(무료)', name: '수출바우처', desc: '해외인증·시장조사·전시회 비용을 바우처로 지원', url: 'https://www.exportvoucher.com/', how: '연초 참여기업 모집 공고 확인' },
    { group: '시장·수입국 분석', name: 'ITC Trade Map', desc: 'HS코드별 수입국 순위·수입 기업 목록', url: 'https://www.trademap.org/', how: 'HS {hs} 입력 → Importing markets → 상위 수입국 선정 → Companies 탭에서 수입 기업 확인' },
    { group: '시장·수입국 분석', name: 'KITA 무역통계', desc: '한국의 국가별·품목별 수출입 통계', url: 'https://stat.kita.net/', how: 'HS {hs4}로 한국의 국가별 수출 추이 확인' },
    { group: '시장·수입국 분석', name: 'UN Comtrade', desc: '국가별 수입액 원자료', url: 'https://comtradeplus.un.org/', how: 'Reporter=목표국, Commodity=HS {hs}' },
    { group: '수입 실적(B/L) 데이터', name: 'ImportYeti (미국)', desc: '미국 세관 B/L 기반 수입자·공급자 무료 검색', url: 'https://www.importyeti.com/search?q={q}', how: '경쟁 공급사의 미국 수입자를 찾아 직접 컨택' },
    { group: '수입 실적(B/L) 데이터', name: 'Volza / Panjiva (유료)', desc: '다국가 통관 데이터로 실제 수입자 파악', url: 'https://www.volza.com/', how: 'HS {hs}·목표국 필터 → 수입량 상위 기업 추출' },
    { group: 'B2B 디렉토리', name: 'Europages', desc: '유럽 제조·유통사 디렉토리', url: 'https://www.google.com/search?q=site%3Aeuropages.com+{q}+distributor', how: '유통사(distributor/wholesaler) 필터' },
    { group: 'B2B 디렉토리', name: 'Kompass', desc: '글로벌 기업 디렉토리(HS/산업분류 검색)', url: 'https://www.kompass.com/', how: '산업 분류로 수입·도매업체 검색' },
    { group: 'B2B 디렉토리', name: 'Alibaba RFQ / Global Sources', desc: '바이어 구매요청(RFQ) 확인', url: 'https://sourcing.alibaba.com/rfq/rfq_search_list.htm?searchText={q}', how: 'RFQ 검색 후 견적 응답(유료 회원 필요 경우 있음)' },
    { group: '검색·SNS', name: 'Google 바이어 검색', desc: '수입·유통사 검색 쿼리 자동 생성', url: 'https://www.google.com/search?q=%22{q}%22+(importer+OR+distributor+OR+wholesaler)+{country}', how: '회사 홈페이지의 Contact/Purchasing 담당자 확인' },
    { group: '검색·SNS', name: 'LinkedIn', desc: '구매 담당자(Purchasing/Sourcing Manager) 검색', url: 'https://www.linkedin.com/search/results/people/?keywords={q}%20purchasing%20manager%20{country}', how: '담당자 직함으로 검색 → 연결 요청 + 짧은 소개 메시지' },
  ];

  // 분류별 주요 국제 전시회
  const FAIRS = {
    food: ['SIAL Paris(프랑스)', 'Anuga(독일 쾰른)', 'Gulfood(두바이)', 'FOODEX Japan(도쿄)', 'Summer Fancy Food Show(뉴욕)', 'THAIFEX(방콕)'],
    beverage: ['ProWein(독일)', 'Vinexpo Paris', 'Bar Convent Berlin', 'Gulfood(두바이)'],
    cosmetics: ['Cosmoprof Worldwide Bologna', 'Cosmoprof Asia(홍콩)', 'Beautyworld Middle East(두바이)', 'In-Cosmetics Global', 'Cosmoprof North America(라스베이거스)'],
    electronics: ['CES(라스베이거스)', 'IFA(베를린)', 'HK Electronics Fair', 'Computex(타이베이)', 'Canton Fair(광저우)'],
    machinery: ['Hannover Messe', 'EMO(하노버/밀라노)', 'IMTS(시카고)', 'Interpack(포장기계)', 'PACK EXPO'],
    textiles: ['Texworld Paris', 'Première Vision', 'Intertextile Shanghai', 'MAGIC(라스베이거스)'],
    chemicals: ['CPHI Worldwide', 'ChemSpec Europe', 'ECS(European Coatings Show)'],
    medical: ['MEDICA(뒤셀도르프)', 'Arab Health(두바이)', 'FIME(마이애미)', 'IDS(쾰른, 치과)'],
    pharma: ['CPHI Worldwide', 'Vitafoods Europe(건기식)', 'Supply Side West'],
    toys: ['Spielwarenmesse(뉘른베르크)', 'HK Toys & Games Fair', 'Toy Fair New York'],
    auto: ['Automechanika Frankfurt', 'AAPEX(라스베이거스)', 'Automechanika Dubai'],
    general: ['Ambiente(프랑크푸르트)', 'Canton Fair', 'HK Gifts & Premium Fair', 'NY NOW'],
  };

  const OUTREACH_STEPS = [
    '1) Trade Map/KITA 통계로 수입 상위 3~5개국을 고른다',
    '2) B/L 데이터·디렉토리로 국가별 수입·유통사 20~50곳 리스트업(회사명·웹사이트·담당자·이메일)',
    '3) 회사 홈페이지·LinkedIn에서 구매 담당자 이름과 직함 확인',
    '4) 맞춤형 콜드메일 발송(아래 템플릿) — 카탈로그 PDF·가격표는 회신 후 송부',
    '5) 3~5영업일 후 1차 팔로업, 2주 후 2차 팔로업(신규 정보·샘플 제안 포함)',
    '6) 관심 바이어에 샘플 발송(Courier, 샘플 Invoice "No Commercial Value") → 화상 미팅',
    '7) 신용 확인: K-SURE 해외신용조사, KOTRA 바이어 연락처 확인 후 소량 T/T 선금 거래로 시작',
  ];

  TP.data.BUYER_CHANNELS = CHANNELS;
  TP.data.FAIRS = FAIRS;
  TP.data.OUTREACH_STEPS = OUTREACH_STEPS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
