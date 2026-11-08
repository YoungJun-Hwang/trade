/*
 * 외부 API 연동 클라이언트
 *
 * 브라우저에서 관세청 UNI-PASS·한국수출입은행 API를 직접 부르면 CORS로 막히고 인증키가 노출됩니다.
 * 그래서 proxy/cloudflare-worker.js 같은 프록시를 두고, 인증키는 프록시 비밀변수에 보관합니다.
 * 설정 화면에서 프록시 URL을 넣으면 실제 조회, 비워두면 데모 데이터로 동작합니다.
 *
 * 환율은 무료·CORS 허용인 open.er-api.com을 기본으로 쓰고, 프록시가 있으면 수출입은행 고시환율을 씁니다.
 */
(function (root) {
  'use strict';
  const TP = root.TP;

  const settings = () => TP.store.get('settings', {});

  async function getJSON(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ---------- 환율 ----------
  const FX_DEMO = { KRW: 1, USD: 1400, EUR: 1620, JPY: 9.3, CNY: 196, GBP: 1860, AUD: 920, CAD: 1010, SGD: 1080, HKD: 180, VND: 0.055, AED: 381, THB: 41, IDR: 0.086, MYR: 330, PHP: 24, INR: 16, SAR: 373, MXN: 76, BRL: 255, TWD: 44 };

  async function fetchRates() {
    const s = settings();
    if (s.proxyUrl) {
      try {
        const data = await getJSON(`${s.proxyUrl.replace(/\/$/, '')}/exim`);
        if (Array.isArray(data) && data.length) {
          const table = { KRW: 1 };
          for (const r of data) {
            const code = String(r.cur_unit || '').replace(/\(100\)/, '');
            const rate = Number(String(r.deal_bas_r || '').replace(/,/g, ''));
            if (code && rate) table[code] = /\(100\)/.test(r.cur_unit) ? rate / 100 : rate;
          }
          return { rates: table, source: '한국수출입은행 매매기준율', at: new Date().toISOString() };
        }
      } catch (e) { /* 아래 공개 API로 대체 */ }
    }
    try {
      const data = await getJSON('https://open.er-api.com/v6/latest/USD');
      if (data && data.rates && data.rates.KRW) {
        return { rates: TP.engine.finance.toKrwTable(data.rates), source: 'open.er-api.com (참고 시세)', at: data.time_last_update_utc };
      }
    } catch (e) { /* 데모 */ }
    return { rates: FX_DEMO, source: '오프라인 예시 환율(실시간 아님)', at: null, demo: true };
  }

  // ---------- UNI-PASS ----------
  // XML 응답을 단순 객체 배열로 변환
  function parseXmlList(xmlText, tag) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    return Array.from(doc.getElementsByTagName(tag)).map((node) => {
      const o = {};
      for (const ch of Array.from(node.children)) o[ch.tagName] = ch.textContent;
      return o;
    });
  }

  /** 화물통관진행정보 (API001) — mblNo/hblNo + blYy 또는 cargMtNo */
  async function cargoProgress({ mblNo, hblNo, blYy, cargMtNo }) {
    const s = settings();
    if (!s.proxyUrl) return demoCargo(mblNo || hblNo || cargMtNo);
    const params = new URLSearchParams({ api: 'cargo' });
    if (cargMtNo) params.set('cargMtNo', cargMtNo);
    if (mblNo) params.set('mblNo', mblNo);
    if (hblNo) params.set('hblNo', hblNo);
    if (blYy) params.set('blYy', blYy);
    const res = await fetch(`${s.proxyUrl.replace(/\/$/, '')}/unipass?${params}`);
    const xml = await res.text();
    const summary = parseXmlList(xml, 'cargCsclPrgsInfoQryVo')[0] || null;
    const events = parseXmlList(xml, 'cargCsclPrgsInfoDtlQryVo');
    const err = (xml.match(/<ntceInfo>([^<]*)<\/ntceInfo>/) || [])[1];
    return { summary, events, notice: err || null };
  }

  /** 수출신고번호별 수출이행내역 (적재 여부 확인) */
  async function exportPerformance(expDclrNo) {
    const s = settings();
    if (!s.proxyUrl) return { demo: true, rows: [{ expDclrNo, shpmCmplYn: 'Y', acptDt: TP.today().replace(/-/g, ''), sanm: '데모 수출자', loadDtyTmlm: '' }] };
    const res = await fetch(`${s.proxyUrl.replace(/\/$/, '')}/unipass?api=export&expDclrNo=${encodeURIComponent(expDclrNo)}`);
    const xml = await res.text();
    return { rows: parseXmlList(xml, 'expDclrNoPrExpFfmnBrkdQryRsltVo') };
  }

  function demoCargo(no) {
    const d = (n) => { const t = new Date(Date.now() - n * 86400000); return t.toISOString().slice(0, 10).replace(/-/g, '') + '0900'; };
    return {
      demo: true,
      summary: { mblNo: no, prgsStts: '수입신고수리', csclPrgsStts: '반출완료', shipNm: 'DEMO VESSEL', ldprNm: 'SHANGHAI', dsprNm: 'BUSAN', etprDt: d(4).slice(0, 8), pckGcnt: '120', ttwg: '2450', wghtUt: 'KG' },
      events: [
        { cargTrcnRelaBsopTpcd: '입항적하목록 운항정보 정정', prcsDttm: d(5), shedNm: '' },
        { cargTrcnRelaBsopTpcd: '입항', prcsDttm: d(4), shedNm: '부산신항' },
        { cargTrcnRelaBsopTpcd: '하선신고 수리', prcsDttm: d(4), shedNm: '부산신항 CY' },
        { cargTrcnRelaBsopTpcd: '반입신고', prcsDttm: d(3), shedNm: '보세창고' },
        { cargTrcnRelaBsopTpcd: '수입신고', prcsDttm: d(2), shedNm: '보세창고' },
        { cargTrcnRelaBsopTpcd: '수입신고수리', prcsDttm: d(1), shedNm: '보세창고' },
        { cargTrcnRelaBsopTpcd: '반출신고', prcsDttm: d(0), shedNm: '보세창고' },
      ],
    };
  }

  // ---------- 화물 위치 추적 (Project44·MarineTraffic 등 유료 API 어댑터) ----------
  /**
   * 설정의 trackingEndpoint로 GET {endpoint}?ref=번호 를 호출하고
   * { vessel, position:{lat,lon}, eta, events:[{time, place, status}] } 형태의 JSON을 기대합니다.
   * 프록시에서 각 사업자 응답을 이 형태로 바꿔주면 됩니다(proxy/cloudflare-worker.js 참고).
   */
  async function trackShipment(ref) {
    const s = settings();
    if (!s.trackingEndpoint) return null;
    return getJSON(`${s.trackingEndpoint}${s.trackingEndpoint.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`);
  }

  TP.api = Object.assign(TP.api || {}, { fetchRates, cargoProgress, exportPerformance, trackShipment, FX_DEMO, parseXmlList });
})(typeof globalThis !== 'undefined' ? globalThis : this);
