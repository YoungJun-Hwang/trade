/*
 * 무역 서류 자동 생성 엔진
 * 하나의 거래(deal) 데이터로 P/I, C/I, P/L, S/R을 모두 만듭니다.
 * - compute(deal): 품목별 금액·카톤·중량·CBM 및 합계 계산
 * - validate(type, deal): 서류별 필수 항목 누락 점검
 * - renderHTML(type, deal): 인쇄(PDF 저장)용 A4 HTML
 * - toRows(type, deal): 엑셀 출력용 2차원 배열
 */
(function (root) {
  'use strict';
  const TP = root.TP;
  const { round, num, fmt, escapeHtml: e } = TP;
  // 단가는 최소 2자리, 필요하면 4자리까지 표시(금액과 단가×수량이 어긋나 보이지 않도록)
  const fmtPrice = (n) => fmt(n, Math.round(n * 100) === round(n * 100, 6) ? 2 : 4);

  const TYPES = {
    PI: { title: 'PROFORMA INVOICE', ko: '견적송장', prefix: 'PI' },
    CI: { title: 'COMMERCIAL INVOICE', ko: '상업송장', prefix: 'CI' },
    PL: { title: 'PACKING LIST', ko: '포장명세서', prefix: 'PL' },
    SR: { title: 'SHIPPING REQUEST', ko: '선적요청서', prefix: 'SR' },
  };

  function compute(deal) {
    const lines = (deal.items || []).map((it, i) => {
      const qty = num(it.qty);
      const unitPrice = num(it.unitPrice);
      const perCarton = Math.max(1, num(it.perCarton, 1));
      const cartons = it.cartons !== undefined && it.cartons !== '' ? num(it.cartons) : Math.ceil(qty / perCarton);
      const cbmPer = (num(it.l) * num(it.w) * num(it.h)) / 1e6;
      return {
        no: i + 1, ...it, qty, unitPrice, cartons,
        amount: round(qty * unitPrice, 2),
        nw: round(cartons * num(it.nwPerCtn), 2),
        gw: round(cartons * num(it.gwPerCtn), 2),
        cbm: round(cartons * cbmPer, 3),
      };
    });
    const sum = (k) => lines.reduce((s, l) => s + l[k], 0);
    const subtotal = round(sum('amount'), 2);
    const discount = num(deal.discount);
    const extra = num(deal.freightCharge) + num(deal.insuranceCharge) + num(deal.otherCharge);
    const total = round(subtotal - discount + extra, 2);
    const deposit = round(total * num(deal.depositPct) / 100, 2);
    return {
      lines,
      totals: {
        qty: sum('qty'), cartons: sum('cartons'), nw: round(sum('nw'), 2), gw: round(sum('gw'), 2), cbm: round(sum('cbm'), 3),
        subtotal, discount, extra, total, deposit, balance: round(total - deposit, 2),
      },
      words: TP.amountInWords(total, deal.currency || 'USD'),
    };
  }

  const REQUIRED = {
    common: [['seller.name', '판매자(Seller) 상호'], ['buyer.name', '구매자(Buyer) 상호'], ['docNo', '서류 번호'], ['date', '발행일']],
    PI: [['incoterm', '가격조건'], ['payment', '결제조건'], ['validity', '견적 유효기간']],
    CI: [['incoterm', '가격조건'], ['payment', '결제조건'], ['portLoading', '선적항'], ['portDischarge', '도착항'], ['origin', '원산지']],
    PL: [['portLoading', '선적항'], ['portDischarge', '도착항'], ['marks', '화인(Shipping Mark)']],
    SR: [['portLoading', '선적항'], ['portDischarge', '도착항'], ['shipment.cargoReady', '화물 준비일'], ['shipment.freightTerm', '운임 지불조건']],
  };
  const get = (o, path) => path.split('.').reduce((v, k) => (v ? v[k] : undefined), o);

  function validate(type, deal) {
    const missing = [...REQUIRED.common, ...(REQUIRED[type] || [])]
      .filter(([p]) => !String(get(deal, p) || '').trim()).map(([, label]) => label);
    const items = deal.items || [];
    if (!items.length) missing.push('품목(최소 1개)');
    items.forEach((it, i) => {
      if (!String(it.description || '').trim()) missing.push(`품목 ${i + 1} 설명`);
      if (num(it.qty) <= 0) missing.push(`품목 ${i + 1} 수량`);
      if (type !== 'PL' && type !== 'SR' && num(it.unitPrice) <= 0) missing.push(`품목 ${i + 1} 단가`);
      if ((type === 'PL' || type === 'SR') && num(it.gwPerCtn) <= 0) missing.push(`품목 ${i + 1} 카톤당 총중량`);
    });
    if (type === 'CI' && items.some((it) => !it.hs)) missing.push('HS 코드(통관용 권장)');
    return missing;
  }

  const party = (label, p) => `
    <div class="doc-box"><div class="doc-label">${label}</div>
      <strong>${e(p && p.name)}</strong><br>${e(p && p.address).replace(/\n/g, '<br>')}
      ${p && p.tel ? '<br>TEL: ' + e(p.tel) : ''}${p && p.email ? '<br>' + e(p.email) : ''}</div>`;

  const field = (label, value) => `<div class="doc-field"><span>${label}</span><b>${e(value || '-')}</b></div>`;

  function renderHTML(type, deal) {
    const t = TYPES[type];
    const c = compute(deal);
    const cur = deal.currency || 'USD';
    const s = deal.shipment || {};
    const isInvoice = type === 'PI' || type === 'CI';

    let head = `<div class="doc-title">${t.title}</div>
      <div class="doc-grid2">
        ${party(type === 'SR' ? 'SHIPPER' : 'SELLER / EXPORTER', deal.seller)}
        <div class="doc-box">${field('No.', deal.docNo)}${field('Date', deal.date)}
          ${type === 'PI' ? field('Valid Until', deal.validity) : ''}
          ${type === 'CI' || type === 'PL' ? field('L/C No.', deal.lcNo) : ''}
          ${field('Ref. P/O', deal.poNo)}</div>
      </div>
      <div class="doc-grid2">
        ${party(type === 'SR' ? 'CONSIGNEE' : 'BUYER / CONSIGNEE', deal.consignee && deal.consignee.name ? deal.consignee : deal.buyer)}
        ${party('NOTIFY PARTY', deal.notify && deal.notify.name ? deal.notify : { name: 'SAME AS CONSIGNEE' })}
      </div>
      <div class="doc-grid4">
        ${field('Port of Loading', deal.portLoading)}${field('Port of Discharge', deal.portDischarge)}
        ${field('Final Destination', deal.finalDestination)}${field(type === 'SR' ? 'Requested ETD' : 'Vessel / Flight', type === 'SR' ? deal.etd : deal.vessel)}
        ${isInvoice ? field('Terms of Delivery', [deal.incoterm, deal.incotermPlace].filter(Boolean).join(' ')) : field('Country of Origin', deal.origin)}
        ${isInvoice ? field('Terms of Payment', deal.payment) : field('Total Packages', c.totals.cartons + ' CTNS')}
        ${isInvoice ? field('Country of Origin', deal.origin) : field('Total G.W.', fmt(c.totals.gw) + ' KGS')}
        ${type === 'SR' ? field('Freight', s.freightTerm) : isInvoice ? field('Shipment', deal.etd) : field('Total CBM', fmt(c.totals.cbm, 3) + ' CBM')}
      </div>`;

    if (type === 'SR') {
      head += `<div class="doc-grid4">
        ${field('Mode', s.mode)}${field('Container', s.mode === 'FCL' ? `${s.containerType || ''} × ${s.containerCount || 1}` : s.mode)}
        ${field('Cargo Ready', s.cargoReady)}${field('B/L Type', s.blType)}
        ${field('Forwarder', s.forwarder)}${field('Commodity', (deal.items || []).map((i) => i.description).join(', '))}
        ${field('HS Code', (deal.items || []).map((i) => i.hs).filter(Boolean).join(', '))}${field('Total CBM', fmt(c.totals.cbm, 3))}
      </div>`;
    }

    let table;
    if (isInvoice) {
      table = `<table class="doc-table"><thead><tr><th>No</th><th>Description of Goods</th><th>HS Code</th><th>Q'ty</th><th>Unit</th><th>Unit Price (${cur})</th><th>Amount (${cur})</th></tr></thead><tbody>
        ${c.lines.map((l) => `<tr><td>${l.no}</td><td>${e(l.description)}${l.spec ? '<br><small>' + e(l.spec) + '</small>' : ''}</td><td>${e(l.hs)}</td><td class="r">${fmt(l.qty, 0)}</td><td>${e(l.unit || 'PCS')}</td><td class="r">${fmtPrice(l.unitPrice)}</td><td class="r">${fmt(l.amount, 2)}</td></tr>`).join('')}
        </tbody><tfoot>
        <tr><td colspan="3">TOTAL</td><td class="r">${fmt(c.totals.qty, 0)}</td><td></td><td class="r">Sub-total</td><td class="r">${fmt(c.totals.subtotal)}</td></tr>
        ${c.totals.discount ? `<tr><td colspan="6" class="r">Discount</td><td class="r">-${fmt(c.totals.discount)}</td></tr>` : ''}
        ${c.totals.extra ? `<tr><td colspan="6" class="r">Freight / Insurance / Other</td><td class="r">${fmt(c.totals.extra)}</td></tr>` : ''}
        <tr class="grand"><td colspan="6" class="r">GRAND TOTAL (${e([deal.incoterm, deal.incotermPlace].filter(Boolean).join(' '))})</td><td class="r">${cur} ${fmt(c.totals.total)}</td></tr>
        </tfoot></table>
        <p class="doc-words">${e(c.words)}</p>`;
      if (type === 'PI' && num(deal.depositPct) > 0) {
        table += `<p class="doc-note">Payment schedule: ${num(deal.depositPct)}% deposit ${cur} ${fmt(c.totals.deposit)} / balance ${cur} ${fmt(c.totals.balance)}</p>`;
      }
    } else {
      table = `<table class="doc-table"><thead><tr><th>No</th><th>Description of Goods</th><th>Q'ty</th><th>Packages</th><th>N.W. (KGS)</th><th>G.W. (KGS)</th><th>Measurement (CBM)</th></tr></thead><tbody>
        ${c.lines.map((l) => `<tr><td>${l.no}</td><td>${e(l.description)}${l.l ? `<br><small>CTN ${l.l}×${l.w}×${l.h}cm, ${l.perCarton || 1} ${e(l.unit || 'PCS')}/CTN</small>` : ''}</td><td class="r">${fmt(l.qty, 0)} ${e(l.unit || 'PCS')}</td><td class="r">${fmt(l.cartons, 0)} CTNS</td><td class="r">${fmt(l.nw)}</td><td class="r">${fmt(l.gw)}</td><td class="r">${fmt(l.cbm, 3)}</td></tr>`).join('')}
        </tbody><tfoot><tr class="grand"><td colspan="2">TOTAL</td><td class="r">${fmt(c.totals.qty, 0)}</td><td class="r">${fmt(c.totals.cartons, 0)} CTNS</td><td class="r">${fmt(c.totals.nw)}</td><td class="r">${fmt(c.totals.gw)}</td><td class="r">${fmt(c.totals.cbm, 3)}</td></tr></tfoot></table>
        <p class="doc-words">SAY TOTAL ${TP.intToWords(c.totals.cartons)} (${c.totals.cartons}) CARTONS ONLY.</p>`;
    }

    let foot = '';
    if (deal.marks) foot += `<div class="doc-box"><div class="doc-label">SHIPPING MARKS</div><pre>${e(deal.marks)}</pre></div>`;
    if (type === 'PI' && deal.bank && deal.bank.name) {
      foot += `<div class="doc-box"><div class="doc-label">BANK INFORMATION</div>
        Bank: ${e(deal.bank.name)}<br>SWIFT: ${e(deal.bank.swift)}<br>A/C No.: ${e(deal.bank.account)}<br>Beneficiary: ${e(deal.bank.beneficiary || (deal.seller && deal.seller.name))}</div>`;
    }
    if (type === 'SR' && s.instructions) foot += `<div class="doc-box"><div class="doc-label">SPECIAL INSTRUCTIONS</div>${e(s.instructions)}</div>`;
    if (deal.remarks) foot += `<div class="doc-box"><div class="doc-label">REMARKS</div>${e(deal.remarks).replace(/\n/g, '<br>')}</div>`;
    foot += `<div class="doc-sign">${type === 'PI' ? '<div>Accepted by (Buyer)<br><br>__________________</div>' : ''}<div>Signed by ${e(deal.seller && deal.seller.name)}<br><br>__________________<br>Authorized Signature</div></div>`;

    return `<article class="doc" data-type="${type}">${head}${table}${foot}</article>`;
  }

  function toRows(type, deal) {
    const t = TYPES[type];
    const c = compute(deal);
    const cur = deal.currency || 'USD';
    const rows = [
      [t.title], [],
      ['No.', deal.docNo, '', 'Date', deal.date],
      ['Seller', deal.seller && deal.seller.name, '', 'Buyer', deal.buyer && deal.buyer.name],
      ['Address', deal.seller && deal.seller.address, '', 'Address', deal.buyer && deal.buyer.address],
      ['Port of Loading', deal.portLoading, '', 'Port of Discharge', deal.portDischarge],
      ['Terms of Delivery', [deal.incoterm, deal.incotermPlace].filter(Boolean).join(' '), '', 'Terms of Payment', deal.payment],
      ['Country of Origin', deal.origin, '', 'Vessel/ETD', [deal.vessel, deal.etd].filter(Boolean).join(' / ')],
      [],
    ];
    if (type === 'PI' || type === 'CI') {
      rows.push(['No', 'Description', 'HS Code', "Q'ty", 'Unit', `Unit Price (${cur})`, `Amount (${cur})`]);
      c.lines.forEach((l) => rows.push([l.no, l.description, l.hs || '', l.qty, l.unit || 'PCS', l.unitPrice, l.amount]));
      rows.push(['', 'TOTAL', '', c.totals.qty, '', '', c.totals.total]);
      rows.push([], [c.words]);
    } else {
      rows.push(['No', 'Description', "Q'ty", 'Cartons', 'N.W.(KGS)', 'G.W.(KGS)', 'CBM']);
      c.lines.forEach((l) => rows.push([l.no, l.description, l.qty, l.cartons, l.nw, l.gw, l.cbm]));
      rows.push(['', 'TOTAL', c.totals.qty, c.totals.cartons, c.totals.nw, c.totals.gw, c.totals.cbm]);
      if (type === 'SR') {
        const s = deal.shipment || {};
        rows.push([], ['Mode', s.mode, 'Container', `${s.containerType || ''} x ${s.containerCount || ''}`, 'Freight', s.freightTerm],
          ['Cargo Ready', s.cargoReady, 'B/L Type', s.blType, 'Forwarder', s.forwarder], ['Instructions', s.instructions || '']);
      }
    }
    if (deal.marks) rows.push([], ['Shipping Marks', deal.marks]);
    return rows;
  }

  function nextDocNo(type, seq) {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `${TYPES[type].prefix}-${ymd}-${String(seq || 1).padStart(3, '0')}`;
  }

  TP.engine.documents = { TYPES, compute, validate, renderHTML, toRows, nextDocNo };
})(typeof globalThis !== 'undefined' ? globalThis : this);
