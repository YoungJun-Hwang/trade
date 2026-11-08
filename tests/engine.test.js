const test = require('node:test');
const assert = require('node:assert/strict');
const TP = require('./load');
const { hs, cost, compliance, finance, tracking, documents, buyers } = TP.engine;

test('금액 영문 표기', () => {
  assert.equal(TP.amountInWords(12345.6, 'USD'), 'SAY TOTAL US DOLLARS TWELVE THOUSAND THREE HUNDRED FORTY FIVE AND CENTS SIXTY ONLY.');
  assert.equal(TP.amountInWords(1000000, 'EUR'), 'SAY TOTAL EUROS ONE MILLION ONLY.');
  assert.equal(TP.intToWords(101), 'ONE HUNDRED ONE');
});

test('HS 분류: 한글·영문 설명과 코드로 후보 추천', () => {
  assert.equal(hs.classify('수분 크림 50ml 스킨케어')[0].hs, '3304.99');
  assert.equal(hs.classify('cotton t-shirt for men')[0].hs, '6109.10');
  assert.equal(hs.classify('Lithium-ion battery pack')[0].hs, '8507.60');
  assert.equal(hs.classify('8517.13')[0].hs, '8517.13');
  assert.equal(hs.classify('8517.13')[0].confidence, '높음');
  assert.deepEqual(hs.classify(''), []);
});

test('HS 프로파일: FTA·인증·전략물자', () => {
  const p = hs.profile('3304.99', 'US', 'export');
  assert.equal(p.category, 'cosmetics');
  assert.deepEqual(p.fta, ['한-미']);
  assert.ok(p.certs.some((c) => c.includes('MoCRA')));
  const imp = hs.profile('3304.99', 'CN', 'import');
  assert.ok(imp.certs.some((c) => c.includes('화장품책임판매업')));
  assert.equal(hs.profile('8542.31', 'CN').strategic, true);
  assert.equal(hs.profile('1905.90', 'JP').strategic, false);
});

test('운임 계산: LCL R/T, 항공 운임중량', () => {
  const lcl = cost.freight({ mode: 'LCL', region: 'JP', cbm: 2.5, grossKg: 3200 });
  assert.equal(lcl.chargeable, 3.2);  // 3.2톤 > 2.5CBM
  assert.equal(lcl.usd, 112);
  const air = cost.freight({ mode: 'AIR', region: 'USWC', cbm: 1, grossKg: 100 });
  assert.equal(air.chargeable, 167);
  assert.equal(air.usd, 701.4);
  assert.equal(cost.freight({ mode: 'LCL', region: 'JP', cbm: 0.2 }).chargeable, 1); // 최소 1 R/T
});

test('컨테이너 추천', () => {
  const plan = cost.containerPlan({ cbm: 60, grossKg: 10000, region: 'NEU' });
  const hc = plan.options.find((o) => o.type === '40HC');
  assert.equal(hc.count, 1);
  assert.equal(plan.options.find((o) => o.type === '20GP').count, 3);
  assert.equal(plan.best.type, '40HC');
  assert.equal(cost.containerPlan({ cbm: 3, region: 'JP' }).best.type, 'LCL');
});

test('수출 가격 사다리 EXW→DDP', () => {
  const q = cost.exportQuote({
    qty: 1000, unitCostKRW: 10000, packingKRW: 0, marginPct: 20, fx: 1400, fxUSD: 1400, currency: 'USD',
    inlandKRW: 200000, customsFeeKRW: 30000, thcKRW: 170000, docKRW: 50000, freightUSD: 1000,
    insuranceRatePct: 0.1, destChargesKRW: 300000, dutyRatePct: 8, destVatPct: 10, country: 'DE',
  });
  const t = Object.fromEntries(q.terms.map((x) => [x.term, x]));
  assert.equal(t.EXW.krw, 12000000);
  assert.equal(t.FOB.krw, 12450000);
  assert.equal(t.CFR.krw, 13850000);
  assert.equal(t.CIF.krw, Math.round(13850000 / (1 - 0.0011)));
  assert.ok(t.DDP.krw > t.DAP.krw && t.DAP.krw > t.CIF.krw);
  assert.equal(t.EXW.amount, 8571.43);
  assert.equal(q.breakdown.dutyBasis, 'CIF');
  assert.equal(cost.exportQuote({ qty: 1, fx: 1, country: 'US' }).breakdown.dutyBasis, 'FOB');
});

test('한국 수입 착지원가: 관세·부가세·절사', () => {
  const r = cost.importLandedCost({ invoiceAmount: 10000, incoterm: 'FOB', fx: 1400, freightKRW: 1000000, insuranceKRW: 15000, dutyRatePct: 8, qty: 500, brokerFeeKRW: 50000 });
  assert.equal(r.customsValue, 15015000);
  assert.equal(r.duty, 1201200);
  assert.equal(r.vat, Math.floor((15015000 + 1201200) * 0.1 / 10) * 10);
  assert.equal(r.totalCost, 14000000 + 1015000 + 1201200 + 50000);
  // CIF 조건은 운임 미가산
  assert.equal(cost.importLandedCost({ invoiceAmount: 100, incoterm: 'CIF', fx: 1000, freightKRW: 99999, dutyRatePct: 0 }).customsValue, 100000);
});

test('수입 주류: 위스키 주세 72%·교육세 30%', () => {
  const r = cost.importLandedCost({ invoiceAmount: 1000, incoterm: 'CIF', fx: 1000, dutyRatePct: 20, liquor: { rate: 72 } });
  assert.equal(r.duty, 200000);
  assert.equal(r.liquorTax, 864000);
  assert.equal(r.eduTax, 259200);
  assert.equal(r.vat, Math.floor((1000000 + 200000 + 864000 + 259200) * 0.1 / 10) * 10);
});

test('카톤 패킹 계산', () => {
  assert.deepEqual(cost.packing({ qty: 1001, perCarton: 50, lengthCm: 50, widthCm: 40, heightCm: 30, nwPerCtn: 10, gwPerCtn: 11 }),
    { cartons: 21, cbm: 1.26, nw: 210, gw: 231 });
});

test('법규 검증: 제재국·전략물자·키워드', () => {
  const r = compliance.check({ description: 'thermal camera drone', hs: '8806.21', country: 'RU', direction: 'export' });
  assert.ok(r.alerts.some((a) => a.title.includes('러시아')));
  assert.ok(r.alerts.some((a) => a.title.includes('전략물자')));
  assert.equal(compliance.check({ description: 'x', country: 'KP' }).ok, false);
  assert.ok(compliance.check({ description: 'furniture', country: 'JP' }).alerts.every((a) => !a.title.includes('CITES')));
  const w = compliance.check({ description: 'whisky', hs: '2208.30', country: 'GB', direction: 'import' });
  assert.ok(w.alerts.some((a) => a.title.includes('세관장확인')));
  assert.ok(w.alerts.some((a) => a.title.includes('FTA')));
});

test('환율 환산', () => {
  const rates = { USD: 1400, EUR: 1540, JPY: 9.3 };
  assert.equal(finance.convert(100, 'USD', 'KRW', rates), 140000);
  assert.equal(finance.convert(1540, 'KRW', 'EUR', rates), 1);
  assert.equal(finance.convert(100, 'EUR', 'USD', rates), 110);
  assert.deepEqual(finance.toKrwTable({ USD: 1, KRW: 1400, EUR: 0.875 }), { KRW: 1, USD: 1400, EUR: 1600 });
});

test('신용장 일치 검증', () => {
  const lc = { amount: 50000, currency: 'USD', tolerancePct: 5, latestShipmentDate: '2026-12-10', expiryDate: '2026-12-31',
    presentationDays: 21, partialShipment: false, portLoading: 'BUSAN, KOREA', portDischarge: 'LOS ANGELES', incoterm: 'CIF',
    goods: 'SKIN CARE CREAM 50ML', requiredDocs: ['Commercial Invoice', 'Packing List', 'B/L'] };
  const clean = finance.checkLC(lc, { invoiceAmount: 52000, currency: 'USD', onBoardDate: '2026-12-05', presentationDate: '2026-12-15',
    portLoading: 'Busan Port', portDischarge: 'Los Angeles', incoterm: 'CIF', goods: 'Skin care cream 50ml x 1000pcs', docsPresented: ['commercial invoice', 'packing list', 'b/l'] });
  assert.equal(clean.clean, true, JSON.stringify(clean.issues));
  const bad = finance.checkLC(lc, { invoiceAmount: 53000, currency: 'USD', onBoardDate: '2026-12-12', presentationDate: '2027-01-05',
    portLoading: 'Incheon', portDischarge: 'Los Angeles', incoterm: 'FOB', goods: 'Cream', partial: true, docsPresented: ['Commercial Invoice'] });
  assert.equal(bad.clean, false);
  assert.ok(bad.issues.length >= 7, bad.issues.map((i) => i.msg).join('\n'));
});

test('T/T 원장 요약', () => {
  assert.deepEqual(finance.ttSummary(10000, [{ type: 'deposit', amount: 3000 }, { type: 'balance', amount: 6000 }, { type: 'refund', amount: 500 }]),
    { contractAmount: 10000, received: 8500, outstanding: 1500, ratio: 85 });
});

test('컨테이너 번호 검증·선사 인식', () => {
  assert.equal(tracking.validateContainer('CSQU 305438-3').valid, true);
  assert.equal(tracking.validateContainer('CSQU3054384').valid, false);
  assert.equal(tracking.validateContainer('ABC123').valid, false);
  assert.equal(tracking.detectCarrier('MSKU9070323').name, 'Maersk');
  assert.equal(tracking.detectCarrier('HMMU1234567').name, 'HMM');
  assert.equal(tracking.detectCarrier('XXXU1234567'), null);
});

const deal = {
  docNo: 'CI-1', date: '2026-11-08', currency: 'USD', incoterm: 'FOB', incotermPlace: 'BUSAN', payment: 'T/T 30/70', origin: 'KOREA',
  portLoading: 'BUSAN', portDischarge: 'LOS ANGELES', marks: 'ABC\nLA\nC/NO.1-UP', validity: '2026-12-08', depositPct: 30,
  seller: { name: 'K-Beauty Co.', address: 'Seoul' }, buyer: { name: 'US Buyer <Inc>', address: 'LA' },
  shipment: { cargoReady: '2026-11-20', freightTerm: 'COLLECT', mode: 'FCL', containerType: '20GP', containerCount: 1 },
  items: [
    { description: 'Moisture Cream 50ml', hs: '3304.99', qty: 1000, unit: 'PCS', unitPrice: 4.5, perCarton: 48, nwPerCtn: 5, gwPerCtn: 6, l: 40, w: 30, h: 25 },
    { description: 'Sheet Mask', hs: '3304.99', qty: 500, unit: 'PCS', unitPrice: 0.8, perCarton: 100, nwPerCtn: 3, gwPerCtn: 3.5, l: 40, w: 30, h: 20 },
  ],
};

test('서류 계산: 금액·카톤·중량·CBM', () => {
  const c = documents.compute(deal);
  assert.equal(c.totals.subtotal, 4900);
  assert.equal(c.totals.cartons, 21 + 5);
  assert.equal(c.totals.gw, 21 * 6 + 5 * 3.5);
  assert.equal(c.totals.cbm, Math.round((21 * 0.03 + 5 * 0.024) * 1000) / 1000);
  assert.equal(c.totals.deposit, 1470);
  assert.equal(c.words, 'SAY TOTAL US DOLLARS FOUR THOUSAND NINE HUNDRED ONLY.');
});

test('서류 검증·렌더링·엑셀 행', () => {
  for (const t of ['PI', 'CI', 'PL', 'SR']) assert.deepEqual(documents.validate(t, deal), [], t);
  assert.ok(documents.validate('CI', { items: [] }).includes('품목(최소 1개)'));
  const html = documents.renderHTML('CI', deal);
  assert.ok(html.includes('COMMERCIAL INVOICE') && html.includes('US Buyer &lt;Inc&gt;') && !html.includes('<Inc>'));
  assert.ok(documents.renderHTML('PL', deal).includes('26 CTNS'));
  const rows = documents.toRows('PI', deal);
  assert.equal(rows[0][0], 'PROFORMA INVOICE');
  assert.ok(rows.some((r) => r[1] === 'TOTAL' && r[6] === 4900));
  assert.match(documents.nextDocNo('PI', 7), /^PI-\d{8}-007$/);
});

test('바이어 발굴 경로·메일 초안', () => {
  const p = buyers.plan({ keyword: 'sheet mask', hs: '3304.99', country: 'US', category: 'cosmetics' });
  assert.ok(p.channels.some((c) => c.url === 'https://www.importyeti.com/search?q=sheet%20mask'));
  assert.ok(p.channels.find((c) => c.name === 'ITC Trade Map').how.includes('330499'));
  assert.ok(p.fairs.some((f) => f.includes('Cosmoprof')));
  assert.ok(p.kotra.length > 0);
  assert.ok(!buyers.plan({ keyword: 'x', country: 'JP' }).channels.some((c) => /ImportYeti/.test(c.name)));
  const m = buyers.coldEmail({ product: 'sheet masks', company: 'K-Beauty', buyerName: 'Ms. Kim', country: 'US' });
  assert.ok(m.body.startsWith('Dear Ms. Kim,') && m.subject.includes('USA'));
});

test('단가 소수점 표시: 4자리 단가는 그대로 보여 금액과 일치', () => {
  const html = documents.renderHTML('CI', Object.assign({}, deal, { items: [{ description: 'A', qty: 1000, unitPrice: 4.6571 }] }));
  assert.ok(html.includes('4.6571') && html.includes('4,657.10'));
  assert.ok(documents.renderHTML('CI', deal).includes('>4.50<'));
});
