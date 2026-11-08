/*
 * HS코드 자동 분류 엔진
 * - classify(description): 품목 설명 → HS 후보(점수순)
 * - profile(hs, countryCode, direction): HS → 관세율·요건·FTA·인증 종합
 * 키워드 매칭 기반의 1차 추천입니다. 최종 세번 결정은 관세사 확인 또는 관세청 품목분류 사전심사를 받으세요.
 */
(function (root) {
  'use strict';
  const TP = root.TP;

  const normalize = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}.\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const digits = (s) => String(s || '').replace(/[^0-9]/g, '');

  function classify(description, limit = 5) {
    const text = normalize(description);
    if (!text) return [];
    const code = digits(description);
    const results = [];

    for (const item of TP.data.HS) {
      let score = 0;
      const matched = [];
      const itemDigits = digits(item.hs);
      if (code.length >= 4 && (itemDigits.startsWith(code.slice(0, 6)) || code.startsWith(itemDigits))) {
        score += 100; matched.push('HS ' + item.hs);
      } else if (code.length >= 4 && itemDigits.slice(0, 4) === code.slice(0, 4)) {
        score += 40; matched.push('HS ' + item.hs.slice(0, 4));
      }
      for (const kw of item.kw) {
        const k = kw.toLowerCase();
        // 영문 단어는 단어 경계로, 한글은 부분 일치로 비교
        const hit = /^[a-z0-9 -]+$/.test(k)
          ? new RegExp('(^|[^a-z])' + k.replace(/[-]/g, '\\-') + '(s|es)?([^a-z]|$)').test(text)
          : text.includes(k);
        if (hit) { score += 10 + Math.min(k.length, 10); matched.push(kw); }
      }
      if (score > 0) results.push({ ...item, score, matched });
    }
    results.sort((a, b) => b.score - a.score);
    const top = results[0] ? results[0].score : 0;
    return results.slice(0, limit).map((r) => ({
      ...r,
      confidence: r.score >= 100 ? '높음' : r.score >= 30 && r.score >= top * 0.8 ? '보통' : '낮음',
    }));
  }

  function find(hs) {
    const d = digits(hs);
    if (d.length < 4) return null;
    return TP.data.HS.find((h) => digits(h.hs) === d.slice(0, 6))
      || TP.data.HS.find((h) => digits(h.hs).slice(0, 4) === d.slice(0, 4)) || null;
  }

  function strategicFlag(hsDigits, item) {
    if (item && item.strategic) return true;
    const ch = hsDigits.slice(0, 2), h4 = hsDigits.slice(0, 4);
    return ['93', '88'].includes(ch) || ['8471', '8517', '8525', '8526', '8542', '8543', '8456', '8457', '8458', '8459', '8806', '9013', '9014', '9015', '9031', '2812', '2853', '2930', '2931'].includes(h4);
  }

  /**
   * @param {string} hs HS 코드(4~10자리)
   * @param {string} country 상대국 코드(US, CN …)
   * @param {'export'|'import'} direction 한국 기준 수출/수입
   */
  function profile(hs, country, direction = 'export') {
    const item = find(hs);
    const d = digits(hs);
    const cat = item ? item.cat : 'general';
    const c = TP.data.COUNTRIES[country] || null;
    const fta = TP.data.KOREA_FTA[country] || [];
    const category = TP.data.CATEGORIES[cat];
    // 수입이면 한국 요건, 수출이면 상대국 인증
    const certCountry = direction === 'import' ? TP.data.COUNTRIES.KR : c;
    const certs = certCountry ? (certCountry.certs[cat] || certCountry.certs.general || []) : [];
    return {
      hs: item ? item.hs : hs, item, category: cat, categoryInfo: category,
      krDuty: item ? item.krDuty : null,
      note: item && item.note,
      fta, ftaRule: item ? item.ftaRule : null,
      certs, country: c,
      strategic: strategicFlag(d, item),
      dangerousGoods: !!(item && item.dg),
      procedures: direction === 'import' ? category.import : category.export,
    };
  }

  TP.engine.hs = { classify, profile, find, normalize };
})(typeof globalThis !== 'undefined' ? globalThis : this);
