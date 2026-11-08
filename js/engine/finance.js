/*
 * 대금 결제·환율 엔진
 * - convert(): 환율표(KRW 기준) 기반 통화 환산
 * - checkLC(): 신용장 조건 vs 선적·제시 서류 일치 여부 검증(UCP600 주요 조항)
 * - ttSummary(): T/T 선금·잔금 회수 현황
 */
(function (root) {
  'use strict';
  const TP = root.TP;
  const { round, num } = TP;

  /** rates: { USD: 1380, EUR: 1500, JPY: 9.2 ... } = 1단위당 KRW */
  function convert(amount, from, to, rates) {
    const r = Object.assign({ KRW: 1 }, rates);
    if (!r[from] || !r[to]) throw new Error(`환율 없음: ${from}→${to}`);
    return round((num(amount) * r[from]) / r[to], 4);
  }

  /** open.er-api.com 형식(USD 기준 rates) → KRW 기준 표로 변환 */
  function toKrwTable(usdBased) {
    const krwPerUsd = usdBased.KRW;
    const out = { KRW: 1 };
    for (const [cur, perUsd] of Object.entries(usdBased)) out[cur] = round(krwPerUsd / perUsd, 4);
    return out;
  }

  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const normPort = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').replace(/^PORTOF/, '').replace(/(PORT|KOREA|CHINA|JAPAN|USA)$/, '');
  const words = (s) => String(s || '').toUpperCase().split(/[^A-Z0-9가-힣]+/).filter((w) => w.length > 2);

  /**
   * @param lc { amount, currency, tolerancePct, latestShipmentDate, expiryDate, presentationDays,
   *             partialShipment, transhipment, portLoading, portDischarge, incoterm, goods, requiredDocs[] }
   * @param doc { invoiceAmount, currency, onBoardDate, presentationDate, portLoading, portDischarge,
   *             incoterm, goods, partial, transhipment, docsPresented[] }
   */
  function checkLC(lc, doc) {
    const issues = [];
    const ok = [];
    const push = (pass, msg, rule) => (pass ? ok : issues).push({ msg, rule });

    // 금액 (UCP600 30조: about/approximately는 ±10%)
    const tol = num(lc.tolerancePct);
    const maxAmt = num(lc.amount) * (1 + tol / 100);
    push(num(doc.invoiceAmount) <= maxAmt + 0.005,
      `송장금액 ${TP.fmt(doc.invoiceAmount)} ${doc.currency} ${num(doc.invoiceAmount) <= maxAmt + 0.005 ? '≤' : '>'} 신용장 한도 ${TP.fmt(maxAmt)} (과부족 ${tol}%)`, 'UCP600 18조·30조');
    push(!lc.currency || lc.currency === doc.currency, `통화 일치: L/C ${lc.currency} / 송장 ${doc.currency}`, 'UCP600 18조');

    // 선적기일
    if (lc.latestShipmentDate && doc.onBoardDate) {
      push(doc.onBoardDate <= lc.latestShipmentDate, `본선적재일 ${doc.onBoardDate} / 최종선적일 ${lc.latestShipmentDate}`, 'UCP600 20조');
    }
    // 유효기일·제시기간
    if (lc.expiryDate && doc.presentationDate) {
      push(doc.presentationDate <= lc.expiryDate, `서류제시일 ${doc.presentationDate} / 유효기일 ${lc.expiryDate}`, 'UCP600 6조');
    }
    if (doc.onBoardDate && doc.presentationDate) {
      const limit = num(lc.presentationDays, 21);
      const d = days(doc.onBoardDate, doc.presentationDate);
      push(d >= 0 && d <= limit, `선적 후 ${d}일 만에 제시 (허용 ${limit}일)`, 'UCP600 14조 c항');
    }
    // 분할선적·환적
    if (doc.partial) push(lc.partialShipment !== false, '분할선적: L/C ' + (lc.partialShipment === false ? '금지' : '허용'), 'UCP600 31조');
    if (doc.transhipment) push(lc.transhipment !== false, '환적: L/C ' + (lc.transhipment === false ? '금지' : '허용'), 'UCP600 20조 c항');

    // 항구
    if (lc.portLoading) push(normPort(lc.portLoading) === normPort(doc.portLoading), `선적항: L/C "${lc.portLoading}" / B/L "${doc.portLoading || '-'}"`, 'UCP600 20조');
    if (lc.portDischarge) push(normPort(lc.portDischarge) === normPort(doc.portDischarge), `양륙항: L/C "${lc.portDischarge}" / B/L "${doc.portDischarge || '-'}"`, 'UCP600 20조');
    if (lc.incoterm) push(String(lc.incoterm).toUpperCase() === String(doc.incoterm || '').toUpperCase(), `가격조건: L/C ${lc.incoterm} / 송장 ${doc.incoterm || '-'}`, 'UCP600 18조');

    // 물품명세 (상업송장은 L/C 명세와 일치해야 함)
    if (lc.goods) {
      const need = words(lc.goods);
      const have = new Set(words(doc.goods));
      const missing = need.filter((w) => !have.has(w));
      push(missing.length === 0, missing.length ? `송장 물품명세에 L/C 문구 누락: ${missing.join(', ')}` : '물품명세가 L/C 문구를 포함', 'UCP600 18조 c항');
    }
    // 요구 서류
    const req = (lc.requiredDocs || []).map((s) => s.trim()).filter(Boolean);
    const given = new Set((doc.docsPresented || []).map((s) => s.trim().toUpperCase()));
    const missingDocs = req.filter((r) => !given.has(r.toUpperCase()));
    if (req.length) push(missingDocs.length === 0, missingDocs.length ? `미제시 서류: ${missingDocs.join(', ')}` : '요구 서류 모두 제시', 'UCP600 14조');

    return { clean: issues.length === 0, issues, ok };
  }

  /** T/T 거래 원장 요약: entries [{date, type:'deposit'|'balance'|'refund', amount}], contractAmount */
  function ttSummary(contractAmount, entries) {
    const received = entries.reduce((s, e) => s + (e.type === 'refund' ? -1 : 1) * num(e.amount), 0);
    const outstanding = round(num(contractAmount) - received, 2);
    return { contractAmount: num(contractAmount), received: round(received, 2), outstanding, ratio: contractAmount ? round((received / contractAmount) * 100, 1) : 0 };
  }

  TP.engine.finance = { convert, toKrwTable, checkLC, ttSummary };
})(typeof globalThis !== 'undefined' ? globalThis : this);
