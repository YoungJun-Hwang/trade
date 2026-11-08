/*
 * HS코드 참조 데이터 (6단위 기준 + 대표 품목)
 * krDuty: 한국 기본관세율(%) — 참고용. 실제 세율은 10단위 HSK·시점·협정별로 다르므로
 *         관세법령정보포털(unipass.customs.go.kr/clip) 또는 UNI-PASS API 조회 결과로 반드시 대체하세요.
 * ftaRule: 대표적인 품목별 원산지결정기준(PSR) 유형 — 협정마다 다름(참고용)
 * kw: 품목 설명 매칭 키워드(한글·영문)
 */
(function (root) {
  'use strict';
  const TP = root.TP;

  const HS = [
    // 식품·농수산
    { hs: '0303.89', ko: '냉동 어류(기타)', en: 'Frozen fish, n.e.s.', cat: 'food', krDuty: 10, ftaRule: 'WO(완전생산기준)', kw: ['냉동','생선','어류','수산','frozen fish','fish','seafood'] },
    { hs: '0402.21', ko: '분유·탈지분유(무가당)', en: 'Milk powder, unsweetened', cat: 'food', krDuty: 176, note: '관세율할당(TRQ) 품목 — 쿼터 내/외 세율 상이', ftaRule: 'WO', kw: ['분유','우유','milk powder','dairy','powdered milk'] },
    { hs: '0901.21', ko: '볶은 커피(카페인 함유)', en: 'Coffee, roasted', cat: 'food', krDuty: 8, ftaRule: 'CTH', kw: ['커피','원두','coffee','roasted coffee','bean'] },
    { hs: '1006.30', ko: '쌀(정미)', en: 'Rice, milled', cat: 'food', krDuty: 513, note: '쌀은 TRQ·국영무역 — 일반 상업 수입 사실상 제한', ftaRule: 'WO', kw: ['쌀','rice'] },
    { hs: '1902.30', ko: '라면·기타 면류(조리된 것 제외)', en: 'Instant noodles / other pasta', cat: 'food', krDuty: 8, ftaRule: 'CTH', kw: ['라면','면','국수','noodle','ramen','instant noodle','pasta'] },
    { hs: '1905.90', ko: '과자·비스킷·베이커리', en: 'Bakery products, biscuits, snacks', cat: 'food', krDuty: 8, ftaRule: 'CTH', kw: ['과자','스낵','비스킷','쿠키','빵','snack','biscuit','cookie','bakery','cracker'] },
    { hs: '2005.99', ko: '김치·조제 채소', en: 'Prepared vegetables (e.g. kimchi)', cat: 'food', krDuty: 30, ftaRule: 'CTH(일부 원료 제외)', kw: ['김치','채소','절임','kimchi','pickle','vegetable'] },
    { hs: '2103.90', ko: '소스·조미료(고추장 등)', en: 'Sauces and condiments', cat: 'food', krDuty: 8, ftaRule: 'CTH', kw: ['소스','고추장','된장','양념','조미료','sauce','condiment','seasoning','gochujang'] },
    { hs: '2106.90', ko: '기타 조제식품(건강식품 포함)', en: 'Food preparations n.e.s.', cat: 'food', krDuty: 8, ftaRule: 'CTH', kw: ['조제식품','건강식품','홍삼','food preparation','supplement','red ginseng','ginseng'] },
    // 주류·음료
    { hs: '2202.99', ko: '음료(비알코올)', en: 'Non-alcoholic beverages', cat: 'beverage', krDuty: 8, ftaRule: 'CTH', kw: ['음료','주스','드링크','beverage','drink','juice','soft drink'] },
    { hs: '2203.00', ko: '맥주', en: 'Beer made from malt', cat: 'beverage', krDuty: 30, liquor: { type: 'beer' }, ftaRule: 'CTH', kw: ['맥주','beer','ale','lager'] },
    { hs: '2204.21', ko: '포도주(2L 이하 용기)', en: 'Wine in containers ≤ 2L', cat: 'beverage', krDuty: 15, liquor: { type: 'wine', rate: 30 }, ftaRule: 'CTH', kw: ['와인','포도주','wine'] },
    { hs: '2208.30', ko: '위스키', en: 'Whiskies', cat: 'beverage', krDuty: 20, liquor: { type: 'spirits', rate: 72 }, ftaRule: 'CTH', kw: ['위스키','whisky','whiskey','spirits'] },
    { hs: '2208.90', ko: '소주·기타 증류주', en: 'Soju / other spirits', cat: 'beverage', krDuty: 30, liquor: { type: 'spirits', rate: 72 }, ftaRule: 'CTH', kw: ['소주','증류주','soju','liquor'] },
    // 화장품
    { hs: '3304.99', ko: '기초화장품(크림·로션·에센스)', en: 'Beauty or skin-care preparations', cat: 'cosmetics', krDuty: 6.5, ftaRule: 'CTH 또는 RVC', kw: ['화장품','크림','로션','에센스','세럼','스킨케어','마스크팩','선크림','cosmetic','cream','lotion','serum','skincare','sheet mask','sunscreen','k-beauty'] },
    { hs: '3304.20', ko: '눈 화장용 제품', en: 'Eye make-up preparations', cat: 'cosmetics', krDuty: 6.5, ftaRule: 'CTH 또는 RVC', kw: ['아이섀도','마스카라','아이라이너','eyeshadow','mascara','eyeliner'] },
    { hs: '3304.10', ko: '입술 화장용 제품', en: 'Lip make-up preparations', cat: 'cosmetics', krDuty: 6.5, ftaRule: 'CTH 또는 RVC', kw: ['립스틱','틴트','립밤','lipstick','lip tint','lip'] },
    { hs: '3305.10', ko: '샴푸', en: 'Shampoos', cat: 'cosmetics', krDuty: 6.5, ftaRule: 'CTH 또는 RVC', kw: ['샴푸','헤어','shampoo','hair'] },
    { hs: '3401.11', ko: '화장비누', en: 'Toilet soap', cat: 'cosmetics', krDuty: 8, ftaRule: 'CTH', kw: ['비누','soap'] },
    // 의약·건기식
    { hs: '3004.90', ko: '의약품(소매포장)', en: 'Medicaments, retail packed', cat: 'pharma', krDuty: 6.5, ftaRule: 'CTSH 또는 RVC', kw: ['의약품','약','medicine','pharmaceutical','drug','tablet'] },
    // 화학
    { hs: '3824.99', ko: '기타 화학공업 조제품', en: 'Chemical preparations n.e.s.', cat: 'chemicals', krDuty: 6.5, ftaRule: 'CTSH 또는 화학반응', kw: ['화학','첨가제','chemical','additive','compound'] },
    { hs: '3208.90', ko: '페인트·바니시(비수성)', en: 'Paints and varnishes', cat: 'chemicals', krDuty: 6.5, ftaRule: 'CTH', kw: ['페인트','도료','바니시','paint','varnish','coating'] },
    { hs: '3923.10', ko: '플라스틱 상자·용기', en: 'Plastic boxes, cases, crates', cat: 'general', krDuty: 6.5, ftaRule: 'CTH', kw: ['플라스틱','용기','박스','plastic box','container','case','crate'] },
    // 섬유·잡화
    { hs: '4202.21', ko: '핸드백(가죽)', en: 'Handbags, leather outer surface', cat: 'textiles', krDuty: 8, ftaRule: 'CTH', kw: ['핸드백','가방','가죽가방','handbag','bag','leather bag'] },
    { hs: '6109.10', ko: '티셔츠(면, 편직)', en: 'T-shirts, knitted, of cotton', cat: 'textiles', krDuty: 13, ftaRule: '원사기준(Yarn Forward) — 한-미 등', kw: ['티셔츠','반팔','면티','t-shirt','tee','tshirt','cotton shirt'] },
    { hs: '6110.20', ko: '스웨터·풀오버(면, 편직)', en: 'Sweaters, pullovers, of cotton', cat: 'textiles', krDuty: 13, ftaRule: '원사기준 / 재단·봉제', kw: ['스웨터','니트','후드','맨투맨','sweater','pullover','hoodie','sweatshirt','knit'] },
    { hs: '6204.62', ko: '여성용 바지(면, 직물)', en: "Women's trousers, of cotton", cat: 'textiles', krDuty: 13, ftaRule: '원사기준 / 재단·봉제', kw: ['바지','청바지','팬츠','jeans','trousers','pants','denim'] },
    { hs: '6403.99', ko: '신발(갑피 가죽)', en: 'Footwear, leather uppers', cat: 'textiles', krDuty: 13, ftaRule: 'CTH(부분품 제외)', kw: ['구두','신발','가죽신발','shoes','footwear','leather shoes'] },
    { hs: '6404.11', ko: '운동화(갑피 섬유)', en: 'Sports footwear, textile uppers', cat: 'textiles', krDuty: 13, ftaRule: 'CTH(부분품 제외)', kw: ['운동화','스니커즈','sneakers','sports shoes','running shoes'] },
    // 생활용품
    { hs: '7013.37', ko: '유리제 식탁·주방용품', en: 'Glassware for table/kitchen', cat: 'general', krDuty: 8, ftaRule: 'CTH', kw: ['유리컵','유리','glassware','glass cup'] },
    { hs: '7323.93', ko: '스테인리스 주방용품', en: 'Stainless steel kitchenware', cat: 'general', krDuty: 8, ftaRule: 'CTH', kw: ['냄비','프라이팬','텀블러','스테인리스','주방용품','pot','pan','tumbler','stainless','kitchenware','cookware'] },
    { hs: '9102.11', ko: '손목시계(전자식)', en: 'Wrist-watches, electrically operated', cat: 'general', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['시계','손목시계','watch','wristwatch'] },
    { hs: '9506.91', ko: '운동·피트니스 용품', en: 'Gymnastics / fitness equipment', cat: 'general', krDuty: 8, ftaRule: 'CTH', kw: ['운동기구','피트니스','덤벨','요가매트','fitness','gym','dumbbell','yoga mat','exercise'] },
    // 완구
    { hs: '9503.00', ko: '완구·인형·퍼즐', en: 'Toys, dolls, puzzles', cat: 'toys', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['장난감','완구','인형','퍼즐','블록','toy','doll','puzzle','block','plush'] },
    // 전기·전자
    { hs: '8415.10', ko: '에어컨(벽걸이형 등)', en: 'Air conditioning machines', cat: 'electronics', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['에어컨','냉방기','air conditioner','aircon','hvac'] },
    { hs: '8418.10', ko: '냉장고(냉동·냉장 겸용)', en: 'Combined refrigerator-freezers', cat: 'electronics', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['냉장고','refrigerator','fridge','freezer'] },
    { hs: '8450.11', ko: '세탁기(가정용, 10kg 이하)', en: 'Household washing machines', cat: 'electronics', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['세탁기','washing machine','washer'] },
    { hs: '8471.30', ko: '노트북·휴대용 컴퓨터', en: 'Portable computers (laptops)', cat: 'electronics', krDuty: 0, note: 'ITA(정보기술협정) 무세 품목', ftaRule: 'CTSH', kw: ['노트북','랩탑','컴퓨터','태블릿','laptop','notebook','computer','tablet'] },
    { hs: '8504.40', ko: '충전기·어댑터(정지형 변환기)', en: 'Static converters (chargers, adapters)', cat: 'electronics', krDuty: 0, note: '세번에 따라 0~8% — 10단위 확인', ftaRule: 'CTSH 또는 RVC', kw: ['충전기','어댑터','파워서플라이','charger','adapter','power supply','power bank'] },
    { hs: '8507.60', ko: '리튬이온 축전지', en: 'Lithium-ion accumulators', cat: 'electronics', krDuty: 8, dg: true, ftaRule: 'CTH 또는 RVC', kw: ['배터리','리튬','2차전지','battery','lithium','li-ion','accumulator'] },
    { hs: '8509.40', ko: '믹서·블렌더(가정용)', en: 'Food grinders, mixers, blenders', cat: 'electronics', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['믹서기','블렌더','blender','mixer','juicer'] },
    { hs: '8516.31', ko: '헤어드라이어', en: 'Hair dryers', cat: 'electronics', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['드라이기','헤어드라이어','고데기','hair dryer','hairdryer','hair straightener'] },
    { hs: '8517.13', ko: '스마트폰', en: 'Smartphones', cat: 'electronics', krDuty: 0, note: 'ITA 무세', ftaRule: 'CTSH', kw: ['스마트폰','휴대폰','핸드폰','smartphone','mobile phone','cell phone'] },
    { hs: '8518.30', ko: '헤드폰·이어폰', en: 'Headphones and earphones', cat: 'electronics', krDuty: 8, ftaRule: 'CTSH 또는 RVC', kw: ['이어폰','헤드폰','헤드셋','earphone','headphone','earbuds','headset'] },
    { hs: '8528.72', ko: 'TV(컬러)', en: 'Colour television receivers', cat: 'electronics', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['티비','텔레비전','모니터','tv','television','monitor'] },
    { hs: '8542.31', ko: '집적회로(프로세서·컨트롤러)', en: 'Electronic integrated circuits', cat: 'electronics', krDuty: 0, note: 'ITA 무세, 전략물자 해당 가능', strategic: true, ftaRule: 'CTSH 또는 확산공정', kw: ['반도체','칩','집적회로','semiconductor','chip','ic','processor','microcontroller'] },
    { hs: '8541.43', ko: '태양광 모듈', en: 'Photovoltaic modules', cat: 'electronics', krDuty: 0, ftaRule: 'CTSH', kw: ['태양광','솔라','태양전지','solar','pv module','solar panel'] },
    { hs: '8806.21', ko: '드론(무인기, 250g 이하)', en: 'Unmanned aircraft ≤ 250g', cat: 'electronics', krDuty: 8, strategic: true, ftaRule: 'CTH', kw: ['드론','무인기','drone','uav'] },
    // 기계
    { hs: '8422.30', ko: '충전·포장 기계', en: 'Filling, sealing, packing machinery', cat: 'machinery', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['포장기','충전기계','포장기계','packing machine','filling machine','packaging machinery'] },
    { hs: '8457.10', ko: '머시닝센터(공작기계)', en: 'Machining centres', cat: 'machinery', krDuty: 8, strategic: true, ftaRule: 'CTH 또는 RVC', kw: ['머시닝센터','공작기계','cnc','machining center','machine tool'] },
    { hs: '8479.89', ko: '기타 특수기계', en: 'Machines with individual functions n.e.s.', cat: 'machinery', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['기계','장비','설비','machine','equipment','machinery'] },
    { hs: '8413.70', ko: '원심펌프', en: 'Centrifugal pumps', cat: 'machinery', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['펌프','pump'] },
    // 자동차
    { hs: '8703.80', ko: '전기자동차(승용)', en: 'Electric passenger vehicles', cat: 'auto', krDuty: 8, excise: 5, ftaRule: 'RVC', kw: ['전기차','ev','electric vehicle','electric car'] },
    { hs: '8703.23', ko: '승용차(가솔린 1,500~3,000cc)', en: 'Passenger cars, 1500-3000cc', cat: 'auto', krDuty: 8, excise: 5, ftaRule: 'RVC', kw: ['자동차','승용차','중고차','car','vehicle','used car','sedan','suv'] },
    { hs: '8708.99', ko: '자동차 부분품(기타)', en: 'Motor vehicle parts n.e.s.', cat: 'auto', krDuty: 8, ftaRule: 'CTH 또는 RVC', kw: ['자동차부품','부품','auto parts','car parts','spare parts'] },
    { hs: '4011.10', ko: '승용차용 타이어', en: 'New pneumatic tyres for cars', cat: 'auto', krDuty: 8, ftaRule: 'CTH', kw: ['타이어','tire','tyre'] },
    // 의료기기
    { hs: '9018.90', ko: '의료용 기기(기타)', en: 'Medical instruments n.e.s.', cat: 'medical', krDuty: 8, ftaRule: 'CTSH 또는 RVC', kw: ['의료기기','의료장비','medical device','medical instrument','medical equipment'] },
    { hs: '9019.10', ko: '마사지기', en: 'Massage apparatus', cat: 'medical', krDuty: 8, ftaRule: 'CTSH 또는 RVC', kw: ['안마기','마사지기','massager','massage chair'] },
    { hs: '9021.21', ko: '인공치아(임플란트 등)', en: 'Artificial teeth', cat: 'medical', krDuty: 8, ftaRule: 'CTSH', kw: ['임플란트','치과','dental implant','dental'] },
  ];

  // 대한민국 FTA 체결 현황(발효 기준, 요약) — 국가코드 → 협정명
  const KOREA_FTA = {
    CL: ['한-칠레'], SG: ['한-싱가포르', '한-아세안', 'RCEP'], CH: ['한-EFTA'], NO: ['한-EFTA'], IS: ['한-EFTA'], LI: ['한-EFTA'],
    VN: ['한-베트남', '한-아세안', 'RCEP'], TH: ['한-아세안', 'RCEP'], MY: ['한-아세안', 'RCEP'], ID: ['한-인도네시아 CEPA', '한-아세안', 'RCEP'],
    PH: ['한-필리핀', '한-아세안', 'RCEP'], KH: ['한-캄보디아', '한-아세안', 'RCEP'], MM: ['한-아세안', 'RCEP'], LA: ['한-아세안', 'RCEP'], BN: ['한-아세안', 'RCEP'],
    IN: ['한-인도 CEPA'], PE: ['한-페루'], US: ['한-미'], TR: ['한-튀르키예'], AU: ['한-호주', 'RCEP'], CA: ['한-캐나다'],
    CN: ['한-중', 'RCEP'], NZ: ['한-뉴질랜드', 'RCEP'], CO: ['한-콜롬비아'], GB: ['한-영'], JP: ['RCEP'], IL: ['한-이스라엘'],
    DE: ['한-EU'], FR: ['한-EU'], IT: ['한-EU'], ES: ['한-EU'], NL: ['한-EU'], PL: ['한-EU'], BE: ['한-EU'], SE: ['한-EU'], AT: ['한-EU'], CZ: ['한-EU'],
    CR: ['한-중미'], PA: ['한-중미'], HN: ['한-중미'], SV: ['한-중미'], NI: ['한-중미'],
  };

  TP.data.HS = HS;
  TP.data.KOREA_FTA = KOREA_FTA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
