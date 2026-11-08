/*
 * 비용 계산 엔진
 * - freight(): 운송 방식별 운임 (FCL/LCL/AIR/COURIER)
 * - containerPlan(): CBM·중량으로 컨테이너 조합 추천
 * - exportQuote(): 수출 가격 사다리(EXW → FCA → FOB → CFR → CIF → DAP → DDP)
 * - importLandedCost(): 한국 수입 시 관세·개소세·주세·교육세·부가세 포함 착지원가
 * 내부 계산은 KRW 기준입니다.
 */
(function (root) {
  'use strict';
  const TP = root.TP;
  const { round, num } = TP;

  const AIR_DIVISOR = 167;      // 항공 1CBM = 167kg
  const COURIER_DIVISOR = 200;  // 특송 부피중량 (5000cm³/kg)

  function freight({ mode, region, container = '20GP', containerCount = 1, cbm = 0, grossKg = 0, rates, ratePerUnit }) {
    const r = Object.assign({}, (TP.data.REF_RATES || {})[region] || {}, rates || {});
    cbm = num(cbm); grossKg = num(grossKg);
    switch (mode) {
      case 'FCL': {
        const rate = num(ratePerUnit, num(r[container]));
        return { mode, usd: round(rate * containerCount), basis: `${container} × ${containerCount}`, rate, chargeable: containerCount };
      }
      case 'LCL': {
        const rt = Math.max(cbm, grossKg / 1000, 1);
        const rate = num(ratePerUnit, num(r.LCL));
        return { mode, usd: round(rt * rate), basis: `${round(rt, 3)} R/T (CBM과 톤 중 큰 값, 최소 1)`, rate, chargeable: round(rt, 3) };
      }
      case 'AIR': {
        const cw = Math.max(grossKg, cbm * AIR_DIVISOR);
        const rate = num(ratePerUnit, num(r.AIR));
        return { mode, usd: round(cw * rate), basis: `운임중량 ${round(cw, 1)}kg (실중량·용적중량 중 큰 값)`, rate, chargeable: round(cw, 1) };
      }
      case 'COURIER': {
        const cw = Math.max(grossKg, cbm * COURIER_DIVISOR);
        const rate = num(ratePerUnit, 8);
        return { mode, usd: round(cw * rate), basis: `부피중량 기준 ${round(cw, 1)}kg`, rate, chargeable: round(cw, 1) };
      }
      default:
        throw new Error('unknown freight mode: ' + mode);
    }
  }

  /** CBM/중량으로 필요한 컨테이너 수와 예상 운임 비교 */
  function containerPlan({ cbm, grossKg = 0, region }) {
    cbm = num(cbm); grossKg = num(grossKg);
    const options = [];
    for (const [type, spec] of Object.entries(TP.data.CONTAINERS)) {
      const count = Math.max(1, Math.ceil(cbm / spec.usable), Math.ceil(grossKg / spec.payload));
      const f = region ? freight({ mode: 'FCL', region, container: type, containerCount: count }) : null;
      options.push({ type, count, fill: round((cbm / (spec.usable * count)) * 100, 1), usd: f ? f.usd : null });
    }
    if (region) {
      options.push({ type: 'LCL', count: 0, fill: null, usd: freight({ mode: 'LCL', region, cbm, grossKg }).usd });
    }
    const priced = options.filter((o) => o.usd !== null && o.usd > 0);
    const best = priced.length ? priced.reduce((a, b) => (b.usd < a.usd ? b : a)) : options[0];
    return { options, best };
  }

  /** 수입국 관세 과세가격 기준: 미국·캐나다·호주 등은 FOB, 대부분 CIF */
  const FOB_BASIS = ['US', 'CA', 'AU', 'NZ'];

  /**
   * 수출 견적 가격 사다리
   * 모든 비용 입력은 KRW. fx = 견적통화 1단위당 KRW, fxUSD = USD 1달러당 KRW(운임 환산)
   */
  function exportQuote(p) {
    const qty = Math.max(1, num(p.qty, 1));
    const fx = num(p.fx, 1);
    const fxUSD = num(p.fxUSD, fx);
    const goods = qty * num(p.unitCostKRW) + num(p.packingKRW);
    const profit = goods * num(p.marginPct) / 100;
    const bank = num(p.bankChargeKRW);

    const EXW = goods + profit + bank;
    const FCA = EXW + num(p.inlandKRW) + num(p.customsFeeKRW);
    const FOB = FCA + num(p.thcKRW) + num(p.docKRW) + num(p.otherOriginKRW);
    const freightKRW = num(p.freightUSD) * fxUSD;
    const CFR = FOB + freightKRW;
    const ins = num(p.insuranceRatePct) / 100;
    const CIF = ins > 0 ? CFR / (1 - 1.1 * ins) : CFR; // 보험금액 = CIF × 110% × 요율
    const insurance = CIF - CFR;
    const DAP = CIF + num(p.destChargesKRW);
    const dutyBase = FOB_BASIS.includes(p.country) ? FOB : CIF;
    const duty = dutyBase * num(p.dutyRatePct) / 100;
    const vat = (CIF + duty) * num(p.destVatPct) / 100;
    const DDP = DAP + duty + vat + num(p.importClearanceKRW);

    const ladder = { EXW, FCA, FOB, CFR, CIF, DAP, DDP };
    const terms = Object.entries(ladder).map(([term, krw]) => ({
      term, krw: round(krw, 0), amount: round(krw / fx, 2), perUnit: round(krw / fx / qty, 4),
    }));
    return {
      qty, currency: p.currency || 'USD', terms,
      breakdown: {
        goods: round(goods, 0), profit: round(profit, 0), freightKRW: round(freightKRW, 0), insurance: round(insurance, 0),
        duty: round(duty, 0), vat: round(vat, 0), dutyBasis: FOB_BASIS.includes(p.country) ? 'FOB' : 'CIF',
      },
    };
  }

  const floor10 = (n) => Math.floor(n / 10) * 10; // 세액 10원 미만 절사

  /**
   * 한국 수입 착지원가 (관세법상 과세가격 = CIF 상당 금액)
   * invoiceAmount: 송장 금액(외화), incoterm, fx: 과세환율
   * freightKRW / insuranceKRW: EXW·FCA·FOB(운임·보험 가산), CFR(보험 가산)일 때만 반영
   * liquor: { rate } 종가세율(%) 또는 { perLiter, liters } 종량세(맥주·탁주)
   */
  function importLandedCost(p) {
    const fx = num(p.fx, 1);
    const invoiceKRW = num(p.invoiceAmount) * fx;
    const term = (p.incoterm || 'FOB').toUpperCase();
    const needFreight = ['EXW', 'FCA', 'FOB', 'FAS'].includes(term);
    const needIns = needFreight || ['CFR', 'CPT'].includes(term);
    const addFreight = needFreight ? num(p.freightKRW) : 0;
    const addIns = needIns ? num(p.insuranceKRW) : 0;
    const exwAdd = term === 'EXW' ? num(p.originChargesKRW) : 0;

    const customsValue = Math.floor(invoiceKRW + addFreight + addIns + exwAdd); // 과세가격(원 미만 절사)
    const duty = floor10(customsValue * num(p.dutyRatePct) / 100);

    let excise = 0, liquorTax = 0, eduTax = 0;
    if (p.liquor) {
      if (p.liquor.perLiter) liquorTax = floor10(num(p.liquor.perLiter) * num(p.liquor.liters));
      else liquorTax = floor10((customsValue + duty) * num(p.liquor.rate) / 100);
      // 교육세: 주세의 10% (주세율 70% 초과 주류는 30%)
      eduTax = floor10(liquorTax * (num(p.liquor.rate) > 70 ? 0.3 : 0.1));
    } else if (num(p.exciseRatePct) > 0) {
      excise = floor10((customsValue + duty) * num(p.exciseRatePct) / 100);
      eduTax = floor10(excise * 0.3); // 개별소비세의 30%
    }
    const vatBase = customsValue + duty + excise + liquorTax + eduTax;
    const vat = floor10(vatBase * num(p.vatPct, 10) / 100);
    const taxes = duty + excise + liquorTax + eduTax + vat;
    const brokerFee = p.brokerFeeKRW !== undefined && p.brokerFeeKRW !== '' ? num(p.brokerFeeKRW) : Math.max(30000, Math.round(customsValue * 0.002));
    const other = num(p.domesticKRW) + num(p.otherKRW);
    const freightPaid = needFreight ? num(p.freightKRW) : 0;
    const insPaid = needIns ? num(p.insuranceKRW) : 0;

    const totalCash = invoiceKRW + freightPaid + insPaid + exwAdd + taxes + brokerFee + other;
    const totalCost = totalCash - vat; // 부가세는 매입세액 공제 가능(일반과세자)
    const qty = Math.max(1, num(p.qty, 1));
    return {
      invoiceKRW: round(invoiceKRW, 0), customsValue, duty, excise, liquorTax, eduTax, vatBase, vat, taxes,
      brokerFee, other, totalCash: round(totalCash, 0), totalCost: round(totalCost, 0),
      unitCost: round(totalCost / qty, 0), qty,
      notes: [
        needFreight ? '운임·보험료를 과세가격에 가산했습니다(FOB 등 조건).' : '송장가격에 운임이 포함된 조건입니다.',
        '부가세는 일반과세자라면 매입세액 공제 대상이라 원가(totalCost)에서 제외했습니다.',
        '관세사 수수료는 입력이 없으면 과세가격의 0.2%(최저 3만원) 참고값을 썼습니다.',
      ],
    };
  }

  /** 카톤 정보로 총 CBM·중량 계산 */
  function packing({ qty, perCarton, lengthCm, widthCm, heightCm, nwPerCtn, gwPerCtn }) {
    const cartons = Math.ceil(num(qty) / Math.max(1, num(perCarton, 1)));
    const cbmPer = (num(lengthCm) * num(widthCm) * num(heightCm)) / 1e6;
    return { cartons, cbm: round(cartons * cbmPer, 3), nw: round(cartons * num(nwPerCtn), 2), gw: round(cartons * num(gwPerCtn), 2) };
  }

  TP.engine.cost = { freight, containerPlan, exportQuote, importLandedCost, packing, FOB_BASIS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
