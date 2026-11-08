/**
 * TradePilot API 프록시 (Cloudflare Workers)
 *
 * 역할: 브라우저 → 이 프록시 → 관세청 UNI-PASS / 한국수출입은행
 *  - 인증키를 브라우저에 노출하지 않음(Workers 비밀변수에 저장)
 *  - CORS 헤더 추가
 *
 * 배포:
 *   npm i -g wrangler
 *   wrangler init tradepilot-proxy  (이 파일을 src/index.js로)
 *   wrangler secret put UNIPASS_CARGO_KEY    # UNI-PASS 화물통관진행정보 API 키
 *   wrangler secret put UNIPASS_EXPORT_KEY   # UNI-PASS 수출이행내역 API 키
 *   wrangler secret put EXIM_KEY             # 한국수출입은행 환율 API 키
 *   wrangler deploy
 * 그 다음 TradePilot 설정 화면의 '프록시 URL'에 배포 주소를 입력합니다.
 *
 * UNI-PASS API 키는 unipass.customs.go.kr → 서비스 → Open API 에서 API별로 신청합니다.
 * 엔드포인트 경로는 관세청 OpenAPI 명세서 기준이며 변경될 수 있으니 명세서를 확인하세요.
 */
const UNIPASS = 'https://unipass.customs.go.kr:38010/ext/rest';
const ROUTES = {
  cargo: { path: '/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo', key: 'UNIPASS_CARGO_KEY', params: ['cargMtNo', 'mblNo', 'hblNo', 'blYy'] },
  export: { path: '/expDclrNoPrExpFfmnBrkdQry/retrieveExpDclrNoPrExpFfmnBrkd', key: 'UNIPASS_EXPORT_KEY', params: ['expDclrNo'] },
};

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || '*'; // 예: https://youngjun-hwang.github.io
    const headers = cors(allowed);
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    const url = new URL(request.url);

    if (url.pathname.endsWith('/unipass')) {
      const route = ROUTES[url.searchParams.get('api')];
      if (!route) return new Response('unknown api', { status: 400, headers });
      const q = new URLSearchParams({ crkyCn: env[route.key] || '' });
      for (const p of route.params) if (url.searchParams.get(p)) q.set(p, url.searchParams.get(p));
      const res = await fetch(`${UNIPASS}${route.path}?${q}`);
      return new Response(await res.text(), { status: res.status, headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8' } });
    }

    if (url.pathname.endsWith('/exim')) {
      // 영업일 오전 11시 이전·휴일에는 빈 배열이 오므로 최대 7일 전까지 거슬러 조회
      for (let back = 0; back < 7; back++) {
        const d = new Date(Date.now() + 9 * 3600000 - back * 86400000);
        const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
        const res = await fetch(`https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${env.EXIM_KEY}&searchdate=${ymd}&data=AP01`);
        const data = await res.json().catch(() => []);
        if (Array.isArray(data) && data.length) return Response.json(data, { headers });
      }
      return Response.json([], { headers });
    }

    return new Response('TradePilot proxy: /unipass?api=cargo|export, /exim', { headers });
  },
};
