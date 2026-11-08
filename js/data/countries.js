/*
 * 국가별 무역 정보: 통화, 수입 부가세(VAT/GST) 기본값, 운임 권역, 분류별 필수 인증
 * vat: 수입 시 부과되는 표준 부가세율(%) — 품목·지역별 경감세율이 있을 수 있음
 * certs: 물품 분류(categories.js의 키) → 해당 국가 수입/판매 시 필요한 대표 인증·등록
 * 모든 값은 참고용이며, 최신 규정은 KOTRA 해외시장뉴스·KTL/KTR/KTC 등 인증기관에서 확인하세요.
 */
(function (root) {
  'use strict';
  const TP = root.TP;

  const COUNTRIES = {
    US: {
      name: '미국', currency: 'USD', vat: 0, region: 'USWC',
      vatNote: '연방 VAT 없음(주별 판매세 별도). MPF(0.3464%)·HMF(0.125%) 부과',
      certs: {
        food: ['FDA 식품시설등록(FFR)', 'FDA 사전통보(Prior Notice)', 'FSMA FSVP(외국공급자검증) — 수입자 의무', '영양성분표(Nutrition Facts)'],
        beverage: ['TTB COLA 라벨승인', 'FDA 식품시설등록', '수입자 연방 주류 면허(Basic Permit)'],
        cosmetics: ['FDA MoCRA 시설등록·제품리스팅', '안전성 입증자료(Safety Substantiation)', 'OTC 해당 시(선크림 등) FDA 의약품 등록·NDC'],
        electronics: ['FCC(SDoC 또는 Certification)', 'UL/ETL 등 NRTL 안전인증(유통사 요구)', 'DOE 에너지효율(해당 가전)', '캘리포니아 Prop 65 경고'],
        machinery: ['OSHA NRTL 인증(UL 등)', 'ASME(압력용기)', 'NFPA 79(산업기계 전기)'],
        textiles: ['FTC 섬유라벨(혼용률·원산지·RN)', '세탁표시(Care Labeling Rule)', '가연성 기준(16 CFR 1610)'],
        chemicals: ['TSCA 인벤토리 등재 확인', 'OSHA HazCom SDS', 'DOT 위험물 규정'],
        medical: ['FDA 시설등록·기기리스팅', '510(k) 또는 PMA(등급별)', 'QMSR(21 CFR 820)'],
        pharma: ['FDA NDA/ANDA 또는 OTC 모노그래프', '건강기능식품은 Dietary Supplement 규정(DSHEA)'],
        toys: ['CPSC CPC(어린이제품인증서)', 'ASTM F963', 'CPSIA 추적라벨·납/프탈레이트'],
        auto: ['NHTSA FMVSS(DOT)', 'EPA 배출가스', '부품: DOT 표시(조명·타이어 등)'],
        general: ['CPSC 일반 안전요건', '식품접촉물질 FDA 21 CFR', '원산지 표시(Country of Origin Marking)'],
      },
      notes: ['섹션 301 추가관세는 중국산에만 해당(한국산 아님) — 원산지 관리 중요', '2025년 이후 상호관세 등 대미 관세 변동이 잦음 — 수출 직전 최신 세율 확인'],
      kotra: ['뉴욕', 'LA', '시카고', '댈러스', '워싱턴DC', '실리콘밸리', '디트로이트', '마이애미'],
    },
    CN: {
      name: '중국', currency: 'CNY', vat: 13, region: 'CN', vatNote: '식품·농산물 등 일부 9%',
      certs: {
        food: ['GACC 해외생산기업 등록(CIFER)', '중문 라벨(GB 7718)', '위생증명서'],
        beverage: ['GACC 등록', '중문 라벨'],
        cosmetics: ['NMPA 등록(특수)/비안(일반)', '중국 내 책임자(경내책임자) 지정', '효능 평가 자료'],
        electronics: ['CCC 강제인증', 'SRRC(무선)', 'CEL 에너지라벨', '중국 RoHS'],
        machinery: ['CCC(해당 품목)', '특종설비 허가(보일러·압력용기)'],
        textiles: ['GB 18401 안전기술규범', '중문 라벨'],
        chemicals: ['MEE 신규화학물질 등록', '위험화학품 등기'],
        medical: ['NMPA 의료기기 등록(2·3등급)/비안(1등급)'],
        pharma: ['NMPA 수입약품 등록'],
        toys: ['CCC(완구)', 'GB 6675'],
        auto: ['CCC', '부품 CCC'],
        general: ['CCC 대상 여부 확인', '중문 라벨'],
      },
      notes: ['크로스보더 이커머스(CBEC)는 일반무역과 다른 통관·라벨 규정 적용'],
      kotra: ['베이징', '상하이', '광저우', '칭다오', '청두', '선양', '우한', '시안'],
    },
    JP: {
      name: '일본', currency: 'JPY', vat: 10, region: 'JP', vatNote: '식품 경감세율 8%',
      certs: {
        food: ['식품위생법 수입신고(검역소)', '일본어 식품표시(식품표시법)'],
        beverage: ['식품위생법 수입신고', '주류는 주세법 표시'],
        cosmetics: ['화장품 제조판매업 허가 보유 수입자', '전성분 일본어 표시'],
        electronics: ['PSE(전기용품안전법, 특정/특정이외)', 'TELEC/기술기준적합(무선)', 'VCCI(자율)'],
        machinery: ['JIS(자율)', '노동안전위생법 형식검정(해당 시)'],
        textiles: ['가정용품품질표시법 라벨'],
        chemicals: ['화심법(CSCL) 신규물질 신고', '독극물법'],
        medical: ['PMDA 승인/인증/신고(등급별)', '외국제조업자 인정'],
        pharma: ['약기법 승인'],
        toys: ['ST마크(자율)', '식품위생법(유아 입에 닿는 완구)'],
        auto: ['국토교통성 형식지정·PHP'],
        general: ['가정용품품질표시법', '식품위생법(식품접촉 용품)'],
      },
      notes: ['RCEP으로 한-일 간 일부 품목 관세 단계 인하 중'],
      kotra: ['도쿄', '오사카', '나고야', '후쿠오카'],
    },
    VN: {
      name: '베트남', currency: 'VND', vat: 10, region: 'SEA', vatNote: '한시적 8% 경감 품목 존재(시기별 확인)',
      certs: {
        food: ['식품안전 자기공표/등록', '베트남어 보조라벨'],
        cosmetics: ['DAV 화장품 공고(Notification)', '자유판매증명서(CFS) 영사확인'],
        electronics: ['CR 마크(QCVN 적합성)', '에너지라벨(해당 가전)', '무선기기 형식승인'],
        machinery: ['QCVN 적합성(해당 품목)'],
        textiles: ['QCVN 01:2017/BCT(포름알데히드·아조염료)'],
        medical: ['보건부 의료기기 등록(A/B 공표, C/D 유통허가)'],
        toys: ['QCVN 3:2019/BKHCN CR 마크'],
        general: ['베트남어 라벨(Decree 43)'],
      },
      notes: ['한-베트남 FTA와 한-아세안 FTA 중 유리한 세율 선택'],
      kotra: ['하노이', '호치민', '다낭'],
    },
    DE: {
      name: '독일(EU)', currency: 'EUR', vat: 19, region: 'NEU',
      certs: {
        food: ['EU 식품법(Reg. 178/2002)', 'EU 라벨(Reg. 1169/2011)', '동물성 제품은 EU 승인 시설·수의증명'],
        cosmetics: ['CPNP 등록', 'EU 책임자(RP) 지정', 'CPSR 안전성평가', 'PIF 보관'],
        electronics: ['CE(LVD·EMC·RED)', 'RoHS', 'WEEE 등록(독일 stiftung ear)', '배터리법(EU 2023/1542)'],
        machinery: ['CE 기계류 규정(2027년 Reg. 2023/1230 전환)', '위험성평가·기술문서'],
        textiles: ['EU 섬유라벨 규정(1007/2011)', 'REACH 부속서 XVII 제한물질'],
        chemicals: ['REACH 등록(유일대리인)', 'CLP 라벨', 'SDS 현지어'],
        medical: ['MDR CE(인증기관)', 'EUDAMED 등록', 'EU 대리인'],
        toys: ['완구안전지침 CE(EN71)'],
        auto: ['e-Mark(UNECE)', 'EU 형식승인(WVTA)'],
        general: ['GPSR(일반제품안전규정) — EU 내 책임 경제운영자 필요', '포장재법(VerpackG) 등록'],
      },
      notes: ['CBAM(탄소국경조정): 철강·알루미늄·시멘트·비료 등 수출 시 내재 배출량 보고', 'EUDR(산림전용방지): 커피·코코아·목재·고무 등 실사 의무'],
      kotra: ['프랑크푸르트', '함부르크', '뮌헨', '베를린'],
    },
    FR: {
      name: '프랑스(EU)', currency: 'EUR', vat: 20, region: 'NEU',
      certs: {
        cosmetics: ['CPNP 등록', 'EU RP', 'CPSR'], electronics: ['CE', 'RoHS', 'WEEE'], food: ['EU 식품법·라벨'],
        textiles: ['EU 섬유라벨', 'AGEC법(순환경제) 라벨'], toys: ['CE(EN71)'], medical: ['MDR CE'], chemicals: ['REACH', 'CLP'],
        machinery: ['CE 기계류'], auto: ['e-Mark'], general: ['GPSR', 'Triman 재활용 표시'],
      },
      notes: ['EU 공통 규정은 독일 항목 참조'], kotra: ['파리'],
    },
    GB: {
      name: '영국', currency: 'GBP', vat: 20, region: 'NEU',
      certs: {
        electronics: ['UKCA(또는 CE 인정 — 유예 연장 여부 확인)', 'PSTI(스마트기기 보안)'],
        cosmetics: ['SCPN 등록', '영국 책임자'], food: ['영국 식품 라벨'], toys: ['UKCA/CE'],
        medical: ['MHRA 등록', 'UKCA/CE'], chemicals: ['UK REACH'], machinery: ['UKCA/CE'],
        textiles: ['섬유라벨'], auto: ['GB 형식승인'], general: ['GPSR 동등 규정'],
      },
      notes: ['한-영 FTA 적용'], kotra: ['런던'],
    },
    SG: {
      name: '싱가포르', currency: 'SGD', vat: 9, region: 'SEA', vatNote: 'GST 9%',
      certs: {
        food: ['SFA 수입 면허·건별 허가'], cosmetics: ['HSA 화장품 통지'], electronics: ['Safety Mark(통제품목, CPS)', 'IMDA 무선 등록'],
        medical: ['HSA 의료기기 등록'], general: ['CPS 일반 안전'],
      },
      notes: ['동남아 중계무역 허브 — 재수출 시 원산지 관리'], kotra: ['싱가포르'],
    },
    TH: {
      name: '태국', currency: 'THB', vat: 7, region: 'SEA',
      certs: { food: ['Thai FDA 식품 등록'], cosmetics: ['Thai FDA 화장품 통지'], electronics: ['TISI 강제인증', 'NBTC(무선)'], medical: ['Thai FDA 의료기기'], toys: ['TISI'], general: ['TISI 대상 확인'] },
      notes: [], kotra: ['방콕'],
    },
    ID: {
      name: '인도네시아', currency: 'IDR', vat: 11, region: 'SEA', vatNote: '세율 변경 이력 많음 — 최신 확인',
      certs: {
        food: ['BPOM ML 등록', '할랄 인증(BPJPH) 의무화 단계적 적용'], cosmetics: ['BPOM 화장품 통지', '할랄 인증'],
        electronics: ['SNI 강제인증', 'SDPPI(무선)', 'K3L 라벨'], toys: ['SNI'], medical: ['보건부 AKL 허가'], textiles: ['SNI(아동복 등)'], general: ['SNI 대상 확인', '인니어 라벨', '수입업자 API 면허'],
      },
      notes: ['수입 승인(PI) 및 쿼터 대상 품목 많음'], kotra: ['자카르타'],
    },
    MY: {
      name: '말레이시아', currency: 'MYR', vat: 10, region: 'SEA', vatNote: 'SST 판매세 5~10%',
      certs: { food: ['보건부 식품안전', '할랄(JAKIM) 선호'], cosmetics: ['NPRA 화장품 통지'], electronics: ['SIRIM/ST COA', 'MCMC(무선)'], medical: ['MDA 등록'], toys: ['SIRIM'], general: ['SIRIM 대상 확인'] },
      notes: [], kotra: ['쿠알라룸푸르'],
    },
    PH: {
      name: '필리핀', currency: 'PHP', vat: 12, region: 'SEA',
      certs: { food: ['FDA LTO·CPR'], cosmetics: ['FDA 화장품 통지'], electronics: ['BPS PS/ICC 마크', 'NTC(무선)'], medical: ['FDA CMDR'], toys: ['FDA 완구 등록'], general: ['BPS 대상 확인'] },
      notes: [], kotra: ['마닐라'],
    },
    IN: {
      name: '인도', currency: 'INR', vat: 18, region: 'IN', vatNote: 'IGST 품목별 5~28%(18% 표준)',
      certs: {
        food: ['FSSAI 수입 면허·라벨'], cosmetics: ['CDSCO 화장품 수입 등록'], electronics: ['BIS CRS 강제등록', 'WPC/TEC(무선·통신)'],
        machinery: ['BIS QCO(품질관리명령) 해당 여부'], medical: ['CDSCO 의료기기 등록'], toys: ['BIS 완구 QCO'],
        chemicals: ['BIS QCO(화학물질)'], textiles: ['BIS QCO(일부 섬유)'], general: ['BIS QCO 대상 확인', 'Legal Metrology 포장 표시'],
      },
      notes: ['QCO 확대로 BIS 인증 없는 품목 통관 거부 사례 많음'], kotra: ['뉴델리', '뭄바이', '첸나이', '벵갈루루'],
    },
    AU: {
      name: '호주', currency: 'AUD', vat: 10, region: 'AU', vatNote: 'GST 10%',
      certs: {
        food: ['DAFF 수입조건(BICON)', 'FSANZ 라벨'], cosmetics: ['AICIS 등록(수입자)', '선크림은 TGA'], electronics: ['RCM(EESS·ACMA)'],
        medical: ['TGA ARTG 등록'], toys: ['ACCC 의무 안전기준'], general: ['ACCC 의무 기준 확인', '목재 포장 검역(ISPM-15)'],
      },
      notes: ['검역(바이오시큐리티)이 매우 엄격'], kotra: ['시드니', '멜버른'],
    },
    CA: {
      name: '캐나다', currency: 'CAD', vat: 5, region: 'USWC', vatNote: 'GST 5% + 주별 PST/HST',
      certs: {
        food: ['CFIA SFC 면허(수입자)', '영·불 이중 라벨'], cosmetics: ['Health Canada 화장품 통지(CNF)'], electronics: ['CSA/cUL 등 SCC 인정 인증', 'ISED(무선)'],
        medical: ['Health Canada MDL(II~IV)', 'MDSAP'], toys: ['CCPSA 완구 규정'], general: ['CCPSA', '영·불 이중 라벨'],
      },
      notes: [], kotra: ['토론토', '밴쿠버', '몬트리올'],
    },
    AE: {
      name: '아랍에미리트', currency: 'AED', vat: 5, region: 'ME',
      certs: {
        food: ['ZAD/식품 등록(Montaji)', '할랄 인증', '아랍어 라벨'], cosmetics: ['ECAS/에미리트 품질마크 또는 지자체 등록'],
        electronics: ['ECAS(MoIAT) 적합성', 'TDRA(무선)'], medical: ['MOHAP 등록'], toys: ['ECAS'], general: ['ECAS 대상 확인', '아랍어 라벨'],
      },
      notes: ['GCC 공통 규정(GSO) 적용 품목 확인 — 사우디 등 재수출 허브'], kotra: ['두바이', '아부다비'],
    },
    SA: {
      name: '사우디아라비아', currency: 'SAR', vat: 15, region: 'ME',
      certs: {
        food: ['SFDA 등록', '할랄', '아랍어 라벨'], cosmetics: ['SFDA 화장품 등록'], electronics: ['SABER PC/SC', 'CITC(무선)', 'SASO 에너지효율'],
        machinery: ['SABER'], medical: ['SFDA MDMA'], toys: ['SABER'], auto: ['SABER/GSO'], general: ['SABER 제품적합성(PC)·선적적합성(SC)'],
      },
      notes: ['SABER 플랫폼 등록 없으면 통관 불가'], kotra: ['리야드', '제다'],
    },
    MX: {
      name: '멕시코', currency: 'MXN', vat: 16, region: 'LATAM',
      certs: { electronics: ['NOM 인증', 'IFT(무선)'], food: ['COFEPRIS', 'NOM-051 라벨'], cosmetics: ['COFEPRIS 통지', 'NOM-141'], medical: ['COFEPRIS 등록'], textiles: ['NOM-004 라벨'], general: ['NOM 라벨', '수입자 등록(Padrón)'] },
      notes: ['비FTA 국가 대상 일부 품목 관세 인상(2026) — 최신 세율 확인'], kotra: ['멕시코시티', '몬테레이'],
    },
    BR: {
      name: '브라질', currency: 'BRL', vat: 18, region: 'LATAM', vatNote: 'ICMS·IPI·PIS/COFINS 복합 — 단순 근사치',
      certs: { electronics: ['INMETRO', 'ANATEL(무선)'], cosmetics: ['ANVISA 등록/통지'], food: ['ANVISA/MAPA'], medical: ['ANVISA'], toys: ['INMETRO'], general: ['INMETRO 대상 확인', '포르투갈어 라벨'] },
      notes: ['세금 구조가 매우 복잡 — 현지 통관사 견적 필수'], kotra: ['상파울루'],
    },
    TW: {
      name: '대만', currency: 'TWD', vat: 5, region: 'CN',
      certs: { electronics: ['BSMI 검사', 'NCC(무선)'], cosmetics: ['TFDA 제품 등록(단계적)'], food: ['TFDA 수입검사'], medical: ['TFDA 허가'], toys: ['BSMI'], general: ['BSMI 대상 확인'] },
      notes: [], kotra: ['타이베이'],
    },
    HK: {
      name: '홍콩', currency: 'HKD', vat: 0, region: 'CN', vatNote: '관세·부가세 없음(주류·담배 등 일부 제외)',
      certs: { food: ['CFS 식품 수입자 등록'], electronics: ['전기안전규정(자기선언)', 'OFCA(무선)'], general: ['완구·아동제품 안전규정'] },
      notes: ['중국 본토 재수출 시 본토 규정 별도'], kotra: ['홍콩'],
    },
    KR: {
      name: '대한민국(수입)', currency: 'KRW', vat: 10, region: 'KR',
      certs: {
        food: ['식약처 수입식품 신고', '해외제조업소 등록', '한글 표시사항'], beverage: ['주류 수입업 면허', '식약처 수입신고'],
        cosmetics: ['화장품책임판매업 등록', '표준통관예정보고'], electronics: ['KC 전기안전', 'KC 전파적합성평가', '에너지효율등급'],
        machinery: ['KCs 안전인증(대상 기계)'], textiles: ['KC 안전확인(가정용 섬유)', '원산지 표시'], chemicals: ['화학물질 확인명세서', '화관법·화평법'],
        medical: ['의료기기 수입업 허가·품목 허가/인증/신고'], pharma: ['의약품 수입업 신고·품목 허가'], toys: ['어린이제품 KC 인증'],
        auto: ['자기인증', '배출가스·소음 인증'], general: ['KC 생활용품 안전관리 대상 확인'],
      },
      notes: ['세관장확인대상 여부는 관세법령정보포털 「세관장확인대상 물품」에서 HSK로 조회'],
      kotra: [],
    },
  };

  // 제재·수출통제 국가 (요약) — level: block(사실상 금지) / control(허가·상황허가 대상 다수) / caution(2차 제재 등 주의)
  const SANCTIONS = {
    KP: { name: '북한', level: 'block', note: '남북교류협력법·유엔 제재 — 일반 무역 불가' },
    IR: { name: '이란', level: 'control', note: '유엔·미국 제재. 대이란 거래는 외국환거래법상 허가·신고 및 금융기관 송금 제한' },
    SY: { name: '시리아', level: 'control', note: '제재 완화 동향 있으나 개별 확인 필요' },
    RU: { name: '러시아', level: 'control', note: '대러 수출통제: 상황허가 대상 HS 품목 다수(전자·기계·자동차 등) — 산업부 고시 목록 확인' },
    BY: { name: '벨라루스', level: 'control', note: '러시아와 동일한 상황허가 체계 적용' },
    CU: { name: '쿠바', level: 'caution', note: '미국 제재 — 미국산 부품 10% 이상 포함 시 EAR 재수출 통제' },
    VE: { name: '베네수엘라', level: 'caution', note: '미국 금융제재 — 결제 경로 확인' },
    MM: { name: '미얀마', level: 'caution', note: '군부 관련 기관과 거래 금지(미국·EU 제재)' },
  };

  TP.data.COUNTRIES = COUNTRIES;
  TP.data.SANCTIONS = SANCTIONS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
