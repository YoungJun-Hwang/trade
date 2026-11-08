/*
 * 화물 추적 보조 엔진
 * - validateContainer(): ISO 6346 컨테이너 번호 체크디지트 검증
 * - detectCarrier(): 컨테이너/B/L 접두어로 선사 추정 및 추적 URL 생성
 */
(function (root) {
  'use strict';
  const TP = root.TP;

  // ISO 6346 문자 값: A=10부터 시작, 11의 배수(11,22,33)는 건너뜀
  const LETTER = (() => {
    const map = {}; let v = 10;
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') { if (v % 11 === 0) v++; map[ch] = v++; }
    return map;
  })();

  function checkDigit(first10) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const ch = first10[i];
      const val = /[A-Z]/.test(ch) ? LETTER[ch] : Number(ch);
      sum += val * Math.pow(2, i);
    }
    return (sum % 11) % 10;
  }

  function validateContainer(no) {
    const s = String(no || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-Z]{3}[UJZ][0-9]{7}$/.test(s)) return { valid: false, normalized: s, reason: '형식 오류(영문 4자리 + 숫자 7자리, 4번째는 U/J/Z)' };
    const expected = checkDigit(s.slice(0, 10));
    const actual = Number(s[10]);
    return { valid: expected === actual, normalized: s, expected, reason: expected === actual ? '정상' : `체크디지트 불일치(계산값 ${expected})` };
  }

  function detectCarrier(no) {
    const s = String(no || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const prefix = s.slice(0, 4);
    const carrier = TP.data.CARRIERS.find((c) => c.prefixes.includes(prefix));
    if (!carrier) return null;
    return { name: carrier.name, url: carrier.track.replace('{no}', encodeURIComponent(s)) };
  }

  /** 범용 추적 링크(선사 미확인 시) */
  function genericLinks(no) {
    const q = encodeURIComponent(String(no || '').trim());
    return [
      { name: 'UNI-PASS 화물진행정보(수입 B/L)', url: 'https://unipass.customs.go.kr/csp/index.do' },
      { name: 'Track-Trace (컨테이너)', url: `https://www.track-trace.com/container?number=${q}` },
      { name: 'MarineTraffic (선박 위치)', url: 'https://www.marinetraffic.com/' },
      { name: 'BPA 부산항 PORT-MIS 컨테이너 조회', url: 'https://www.busanpa.com/' },
    ];
  }

  TP.engine.tracking = { validateContainer, detectCarrier, genericLinks, checkDigit };
})(typeof globalThis !== 'undefined' ? globalThis : this);
