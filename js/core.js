/*
 * TradePilot core — 공통 네임스페이스와 유틸리티
 * 모든 모듈은 globalThis.TP 아래에 붙습니다. (브라우저: 일반 <script>, Node: require)
 * 빌드 도구 없이 index.html을 바로 열어도 동작하도록 ES module 대신 이 방식을 씁니다.
 */
(function (root) {
  'use strict';
  const TP = (root.TP = root.TP || {});

  const round = (n, d = 2) => {
    const f = Math.pow(10, d);
    return Math.round((Number(n) + Number.EPSILON) * f) / f;
  };

  const num = (v, fallback = 0) => {
    if (v === null || v === undefined || v === '') return fallback;
    const n = Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : fallback;
  };

  function fmt(n, d = 2) {
    if (!Number.isFinite(Number(n))) return '-';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  const fmtKRW = (n) => (Number.isFinite(Number(n)) ? Math.round(n).toLocaleString('ko-KR') + '원' : '-');

  function escapeHtml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---- 금액 영문 표기 (서류의 "SAY TOTAL ..." 문구) ----
  const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  const SCALES = ['', 'THOUSAND', 'MILLION', 'BILLION', 'TRILLION'];

  function below1000(n) {
    const out = [];
    if (n >= 100) { out.push(ONES[Math.floor(n / 100)], 'HUNDRED'); n %= 100; }
    if (n >= 20) { out.push(TENS[Math.floor(n / 10)]); if (n % 10) out.push(ONES[n % 10]); }
    else if (n > 0) out.push(ONES[n]);
    return out.join(' ');
  }

  function intToWords(n) {
    n = Math.floor(n);
    if (n === 0) return 'ZERO';
    const parts = [];
    let i = 0;
    while (n > 0) {
      const chunk = n % 1000;
      if (chunk) parts.unshift(below1000(chunk) + (SCALES[i] ? ' ' + SCALES[i] : ''));
      n = Math.floor(n / 1000); i++;
    }
    return parts.join(' ');
  }

  const CURRENCY_WORDS = {
    USD: ['US DOLLARS', 'CENTS'], EUR: ['EUROS', 'CENTS'], JPY: ['JAPANESE YEN', 'SEN'],
    CNY: ['CHINESE YUAN', 'FEN'], GBP: ['POUNDS STERLING', 'PENCE'], KRW: ['KOREAN WON', ''],
    AUD: ['AUSTRALIAN DOLLARS', 'CENTS'], CAD: ['CANADIAN DOLLARS', 'CENTS'], SGD: ['SINGAPORE DOLLARS', 'CENTS'],
    HKD: ['HONG KONG DOLLARS', 'CENTS'], VND: ['VIETNAMESE DONG', ''], AED: ['UAE DIRHAMS', 'FILS'],
  };

  function amountInWords(amount, currency = 'USD') {
    const [major, minor] = CURRENCY_WORDS[currency] || [currency, 'CENTS'];
    const cents = Math.round(round(amount, 2) * 100) % 100;
    let s = 'SAY TOTAL ' + major + ' ' + intToWords(Math.floor(round(amount, 2)));
    if (cents && minor) s += ' AND ' + minor + ' ' + intToWords(cents);
    return s + ' ONLY.';
  }

  // ---- 저장소 (브라우저 localStorage, 실패 시 메모리) ----
  const memory = {};
  const store = {
    get(key, fallback) {
      try {
        const raw = root.localStorage && root.localStorage.getItem('tp.' + key);
        return raw ? JSON.parse(raw) : (key in memory ? memory[key] : fallback);
      } catch (e) { return key in memory ? memory[key] : fallback; }
    },
    set(key, value) {
      memory[key] = value;
      try { root.localStorage && root.localStorage.setItem('tp.' + key, JSON.stringify(value)); } catch (e) { /* 메모리만 */ }
    },
  };

  const uid = (p = 'id') => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const today = () => new Date().toISOString().slice(0, 10);

  Object.assign(TP, { round, num, fmt, fmtKRW, escapeHtml, intToWords, amountInWords, store, uid, today });
  TP.data = TP.data || {};
  TP.engine = TP.engine || {};
  TP.api = TP.api || {};

  if (typeof module !== 'undefined' && module.exports) module.exports = TP;
})(typeof globalThis !== 'undefined' ? globalThis : this);
