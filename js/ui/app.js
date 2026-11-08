/*
 * TradePilot UI
 * 화면 구성: 거래 플래너 · 품목/HS · 절차/인증 · 바이어 · 비용 · 서류 · 통관/법규 · 물류 · 결제/환율 · 설정
 * 모든 화면은 공통 컨텍스트(ctx: 수출/수입, 품목, HS, 상대국)를 공유합니다.
 */
(function () {
  'use strict';
  const TP = window.TP;
  const { fmt, fmtKRW, escapeHtml: e, num, store, round } = TP;
  const D = TP.data;
  const E = TP.engine;

  // ---------------- 상태 ----------------
  const state = {
    view: (location.hash || '#planner').slice(1),
    fx: { rates: TP.api.FX_DEMO, source: '불러오는 중…', demo: true },
    costTab: 'export',
    docType: 'PI',
  };
  const ctx = Object.assign({ direction: 'export', description: '', hs: '', category: '', country: 'US', keyword: '' }, store.get('ctx', {}));
  const saveCtx = () => { store.set('ctx', ctx); renderCtx(); };
  const settings = () => Object.assign({ seller: {}, bank: {}, proxyUrl: '', trackingEndpoint: '' }, store.get('settings', {}));

  // 사용자가 저장한 운임으로 참고 운임 덮어쓰기
  const applyRateOverrides = () => {
    const ov = store.get('rateOverrides', {});
    for (const [r, v] of Object.entries(ov)) D.REF_RATES[r] = Object.assign({}, D.REF_RATES[r], v);
  };
  applyRateOverrides();

  // ---------------- 공통 헬퍼 ----------------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function field(label, name, value, o = {}) {
    const v = value === undefined || value === null ? '' : value;
    let input;
    if (o.options) {
      input = `<select name="${name}">${o.options.map(([val, lab]) => `<option value="${e(val)}" ${String(val) === String(v) ? 'selected' : ''}>${e(lab)}</option>`).join('')}</select>`;
    } else if (o.type === 'textarea') {
      input = `<textarea name="${name}" placeholder="${e(o.ph || '')}">${e(v)}</textarea>`;
    } else {
      input = `<input name="${name}" type="${o.type || 'text'}" value="${e(v)}" ${o.step ? `step="${o.step}"` : o.type === 'number' ? 'step="any"' : ''} placeholder="${e(o.ph || '')}" ${o.list ? `list="${o.list}"` : ''}>`;
    }
    return `<label class="f ${o.full ? 'full' : ''}">${e(label)}${input}</label>`;
  }

  function readForm(form) {
    const o = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      o[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    }
    return o;
  }

  const countryOptions = (includeKR = false) => Object.entries(D.COUNTRIES)
    .filter(([k]) => includeKR || k !== 'KR').map(([k, c]) => [k, `${c.name} (${k})`]);
  const categoryOptions = () => Object.entries(D.CATEGORIES).map(([k, c]) => [k, `${c.icon} ${c.name}`]);
  const currencyOptions = () => ['USD', 'EUR', 'JPY', 'CNY', 'GBP', 'AUD', 'CAD', 'SGD', 'HKD', 'AED', 'VND', 'KRW'].map((c) => [c, c]);
  const incotermOptions = () => Object.keys(D.INCOTERMS).map((k) => [k, `${k} — ${D.INCOTERMS[k].name}`]);
  const regionOptions = () => Object.entries(D.REGIONS).filter(([k]) => k !== 'KR').map(([k, n]) => [k, n]);
  const fxOf = (cur) => num(state.fx.rates[cur], cur === 'KRW' ? 1 : TP.api.FX_DEMO[cur] || 1);
  const alertHTML = (a) => `<div class="alert ${a.level}"><b>${a.level === 'block' ? '⛔ ' : a.level === 'warn' ? '⚠️ ' : 'ℹ️ '}${e(a.title)}</b><span class="detail">${e(a.detail)}</span>${a.link ? ` <a href="${e(a.link)}" target="_blank" rel="noopener">확인 ↗</a>` : ''}</div>`;
  const head = (title, desc, right = '') => `<div class="page-head"><div><h1>${title}</h1><p>${desc}</p></div><div class="row">${right}</div></div>`;

  function currentProfile() {
    if (!ctx.hs) return null;
    return E.hs.profile(ctx.hs, ctx.country, ctx.direction);
  }
  const currentCategory = () => ctx.category || (currentProfile() && currentProfile().category) || 'general';

  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------------- 메뉴 ----------------
  const VIEWS = [
    ['planner', '🧭', '거래 플래너'],
    ['items', '🏷️', '품목 · HS코드'],
    ['certs', '📋', '절차 · 인증'],
    ['buyers', '🤝', '바이어 찾기'],
    ['cost', '🧮', '비용 계산'],
    ['docs', '📄', '서류 생성'],
    ['customs', '🛃', '통관 · 법규'],
    ['logistics', '🚢', '물류 · 추적'],
    ['finance', '💱', '결제 · 환율'],
    ['settings', '⚙️', '설정'],
  ];

  function renderNav() {
    $('#nav').innerHTML = VIEWS.map(([k, ico, label]) =>
      `<button data-go="${k}" ${state.view === k ? 'aria-current="page"' : ''}><span class="ico">${ico}</span>${label}</button>`).join('');
  }

  function renderCtx() {
    const c = D.COUNTRIES[ctx.country];
    const p = currentProfile();
    $('#ctx').innerHTML = `
      <span class="chip brand">${ctx.direction === 'export' ? '📤 수출' : '📥 수입'}</span>
      <span class="chip">품목 <b>${e(ctx.description || '미입력')}</b></span>
      <span class="chip">HS <b>${e(ctx.hs || '-')}</b></span>
      <span class="chip">분류 <b>${p ? e(p.categoryInfo.name) : ctx.category ? e(D.CATEGORIES[ctx.category].name) : '-'}</b></span>
      <span class="chip">${ctx.direction === 'export' ? '수출국' : '원산지국'} <b>${c ? e(c.name) : '-'}</b></span>
      <span class="chip">환율 <b>USD ${fmt(fxOf('USD'), 1)}원</b> <small>${e(state.fx.source)}</small></span>`;
  }

  function go(view) {
    state.view = VIEWS.some(([k]) => k === view) ? view : 'planner';
    if (location.hash !== '#' + state.view) history.replaceState(null, '', '#' + state.view);
    renderNav();
    $('#view').innerHTML = views[state.view]();
    (after[state.view] || (() => {}))();
    window.scrollTo(0, 0);
  }

  // =====================================================================
  // 1. 거래 플래너
  // =====================================================================
  const views = {};
  const after = {};

  views.planner = () => {
    const cands = ctx.description ? E.hs.classify(ctx.description + ' ' + (ctx.hs || '')) : [];
    return `${head('거래 플래너', '품목과 상대국을 입력하면 HS코드, 품목별 절차, 국가별 인증, 법규 체크를 한 번에 정리합니다.')}
    <div class="grid g2">
      <div class="card">
        <h2>1. 무엇을 어디로?</h2>
        <form id="plan-form" class="form">
          <div class="full"><div class="seg" role="group">
            <button type="button" data-dir="export" aria-pressed="${ctx.direction === 'export'}">📤 수출 (한국 → 해외)</button>
            <button type="button" data-dir="import" aria-pressed="${ctx.direction === 'import'}">📥 수입 (해외 → 한국)</button>
          </div></div>
          ${field('품목 설명 (한글/영문, 규격·재질·용도 포함하면 정확도 ↑)', 'description', ctx.description, { type: 'textarea', full: true, ph: '예: 수분크림 50ml 스킨케어 / cotton t-shirt / 리튬이온 배터리팩' })}
          ${field(ctx.direction === 'export' ? '수출 대상국' : '수입 원산지국(공급국)', 'country', ctx.country, { options: countryOptions() })}
          ${field('알고 있는 HS코드(선택)', 'hs', ctx.hs, { ph: '예: 3304.99' })}
          <div class="full row"><button class="btn primary" type="submit">분석하기</button><span class="muted">입력값은 다른 메뉴(바이어·비용·서류)에도 자동으로 이어집니다.</span></div>
        </form>
      </div>
      <div class="card">
        <h2>2. HS코드 후보 <small>클릭해서 선택</small></h2>
        ${cands.length ? `<div class="cand">${cands.map((c) => `
          <button data-pick-hs="${c.hs}" data-cat="${c.cat}" aria-pressed="${ctx.hs === c.hs}">
            <code>${c.hs}</code>
            <span><b>${e(c.ko)}</b><br><small>${e(c.en)} · ${D.CATEGORIES[c.cat].name} · 기본세율 ${c.krDuty}%</small></span>
            <span class="badge ${c.confidence === '높음' ? 'ok' : c.confidence === '보통' ? '' : 'warn'}">${c.confidence}</span>
          </button>`).join('')}</div>
          <p class="muted">키워드 기반 1차 추천입니다. 최종 세번은 관세사 확인 또는 관세청 <a href="https://unipass.customs.go.kr/clip/index.do" target="_blank" rel="noopener">품목분류 사전심사</a>로 확정하세요.</p>`
        : ctx.description ? `<div class="alert warn"><b>일치하는 후보가 없습니다</b><span class="detail">영문 품명이나 재질·용도를 추가하거나, 아래에서 분류를 직접 고르세요.</span></div>
          <form id="cat-form" class="form" style="margin-top:12px">${field('물품 분류 직접 선택', 'category', ctx.category || 'general', { options: categoryOptions() })}</form>`
        : '<p class="muted">왼쪽에 품목을 입력하고 분석하기를 누르세요.</p>'}
      </div>
    </div>
    <div id="plan-result" style="margin-top:16px">${planResult()}</div>`;
  };

  function planResult() {
    if (!ctx.description && !ctx.hs) return '';
    const p = currentProfile();
    const cat = currentCategory();
    const catInfo = D.CATEGORIES[cat];
    const country = D.COUNTRIES[ctx.country];
    const comp = E.compliance.check({ description: ctx.description, hs: ctx.hs, country: ctx.country, direction: ctx.direction });
    const certs = ctx.direction === 'import' ? D.COUNTRIES.KR.certs[cat] || [] : (country && (country.certs[cat] || country.certs.general)) || [];
    const common = ctx.direction === 'export' ? D.COMMON_EXPORT : D.COMMON_IMPORT;
    const special = ctx.direction === 'export' ? catInfo.export : catInfo.import;
    return `<div class="grid g3">
      <div class="card">
        <h3>${catInfo.icon} ${e(catInfo.name)} — 핵심 요약</h3>
        <div class="kpi">
          <div><span>HS코드</span><b>${e(ctx.hs || '-')}</b></div>
          <div><span>한국 기본관세</span><b>${p && p.krDuty !== null ? p.krDuty + '%' : '-'}</b></div>
          <div><span>FTA</span><b style="font-size:14px">${p && p.fta.length ? e(p.fta.join(', ')) : '없음'}</b></div>
          <div><span>${e(country ? country.name : '')} 부가세</span><b>${country ? country.vat + '%' : '-'}</b></div>
        </div>
        ${p && p.note ? `<div class="alert warn" style="margin-top:10px"><b>세율 참고</b><span class="detail">${e(p.note)}</span></div>` : ''}
        ${p && p.ftaRule ? `<p><b>원산지결정기준(참고)</b><br><span class="muted">${e(p.ftaRule)}</span></p>` : ''}
        <p><b>주요 리스크</b><br><span class="muted">${e(catInfo.risk)}</span></p>
        <p><b>준비 서류</b><br><span class="muted">${e(catInfo.docs.join(' · '))}</span></p>
      </div>
      <div class="card">
        <h3>${ctx.direction === 'export' ? `${e(country ? country.name : '')} 수출 시 필요한 인증` : '한국 수입 요건(세관장확인)'}</h3>
        <ul class="plain">${certs.map((c) => `<li>${e(c)}</li>`).join('') || '<li class="muted">등록된 정보 없음 — KOTRA 해외시장뉴스에서 확인</li>'}</ul>
        ${country && country.notes && country.notes.length && ctx.direction === 'export' ? `<p class="muted" style="margin-top:10px">${country.notes.map(e).join('<br>')}</p>` : ''}
        <h3 style="margin-top:14px">${catInfo.name} 특화 절차</h3>
        <ul class="plain">${special.map((s) => `<li>${e(s)}</li>`).join('')}</ul>
      </div>
      <div class="card">
        <h3>법규·요건 체크 ${comp.ok ? '<span class="badge ok">진행 가능</span>' : '<span class="badge bad">진행 불가 항목</span>'}</h3>
        ${comp.alerts.map(alertHTML).join('')}
      </div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3>${ctx.direction === 'export' ? '수출' : '수입'} 진행 순서</h3>
        <ol class="steps">${common.map((s) => `<li><b>${e(s.step)}</b><span>${e(s.detail)}</span></li>`).join('')}</ol>
      </div>
      <div class="card"><h3>다음 할 일</h3>
        <div class="links">
          ${ctx.direction === 'export' ? '<a href="#buyers" data-go="buyers">🤝 이 품목의 해외 바이어 찾기<small>수입국 분석·B/L 데이터·디렉토리·콜드메일 초안</small></a>' : ''}
          <a href="#cost" data-go="cost">🧮 ${ctx.direction === 'export' ? '수출 견적가(EXW~DDP) 계산' : '수입 착지원가(관세·부가세) 계산'}<small>운임·보험·관세 포함</small></a>
          <a href="#docs" data-go="docs">📄 P/I · C/I · P/L · S/R 서류 만들기<small>품목·금액 자동 계산, PDF/엑셀 출력</small></a>
          <a href="#items" data-go="items">🏷️ 품목 마스터에 등록<small>서류에 반복 사용되는 규격·재질·HS를 한 곳에서 관리</small></a>
          <a href="#customs" data-go="customs">🛃 UNI-PASS 통관 진행 조회</a>
        </div>
      </div>
    </div>`;
  }

  after.planner = () => {
    const form = $('#plan-form');
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = readForm(form);
      Object.assign(ctx, { description: v.description.trim(), country: v.country, hs: v.hs.trim() });
      const top = E.hs.classify(ctx.description + ' ' + ctx.hs)[0];
      if (top && (!ctx.hs || top.confidence === '높음')) { ctx.hs = top.hs; ctx.category = top.cat; }
      if (!ctx.keyword && top) ctx.keyword = top.en.split(/[,(]/)[0].trim();
      saveCtx(); go('planner');
    });
    const cf = $('#cat-form');
    if (cf) cf.addEventListener('change', () => { ctx.category = readForm(cf).category; saveCtx(); $('#plan-result').innerHTML = planResult(); });
  };

  // =====================================================================
  // 2. 품목 마스터 · HS
  // =====================================================================
  const ITEM_FIELDS = [
    ['code', '품목코드'], ['nameEn', '영문 품명(서류용)'], ['nameKo', '한글 품명'], ['hs', 'HS코드'], ['spec', '규격'], ['material', '재질'],
    ['usage', '용도'], ['origin', '원산지'], ['unit', '단위'], ['unitPrice', '기본 단가'], ['currency', '통화'], ['perCarton', '카톤당 수량'],
    ['nwPerCtn', '카톤당 순중량(kg)'], ['gwPerCtn', '카톤당 총중량(kg)'], ['l', '카톤 가로(cm)'], ['w', '카톤 세로(cm)'], ['h', '카톤 높이(cm)'],
  ];
  const items = () => store.get('items', []);
  let editingItem = null;

  views.items = () => {
    const list = items();
    const it = editingItem || { origin: 'KOREA', unit: 'PCS', currency: 'USD', nameKo: ctx.description, hs: ctx.hs };
    return `${head('품목 마스터 · HS코드', '규격·재질·용도·원산지 등 서류에 반복되는 정보를 한 번만 등록하세요. 서류 생성 시 그대로 불러옵니다.')}
    <div class="grid g2">
      <div class="card">
        <h2>${editingItem ? '품목 수정' : '새 품목 등록'}</h2>
        <form id="item-form" class="form">
          ${ITEM_FIELDS.map(([k, label]) => k === 'currency' ? field(label, k, it[k], { options: currencyOptions() }) : field(label, k, it[k], { type: ['unitPrice', 'perCarton', 'nwPerCtn', 'gwPerCtn', 'l', 'w', 'h'].includes(k) ? 'number' : 'text' })).join('')}
          <div class="full row">
            <button type="button" class="btn" data-act="suggest-hs">🔎 품명으로 HS 추천</button>
            <span class="spacer"></span>
            ${editingItem ? '<button type="button" class="btn" data-act="cancel-item">취소</button>' : ''}
            <button class="btn primary" type="submit">${editingItem ? '수정 저장' : '등록'}</button>
          </div>
          <div class="full" id="hs-suggest"></div>
        </form>
      </div>
      <div class="card">
        <h2>HS코드 조회 · 요건 매칭</h2>
        <form id="hs-lookup" class="form">
          ${field('품목 설명 또는 HS코드', 'q', ctx.description || ctx.hs, { full: true })}
          ${field('상대국', 'country', ctx.country, { options: countryOptions() })}
          ${field('구분', 'direction', ctx.direction, { options: [['export', '수출'], ['import', '수입']] })}
        </form>
        <div id="hs-lookup-out" style="margin-top:12px"></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>등록된 품목 (${list.length}) <span class="row"><button class="btn sm" data-act="export-items">엑셀/CSV 내보내기</button></span></h2>
      ${list.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>코드</th><th>품명</th><th>HS</th><th>규격/재질</th><th>원산지</th><th class="r">단가</th><th class="r">카톤</th><th></th></tr></thead><tbody>
        ${list.map((x, i) => `<tr><td>${e(x.code)}</td><td><b>${e(x.nameEn)}</b><br><small>${e(x.nameKo)}</small></td><td>${e(x.hs)}</td><td>${e([x.spec, x.material].filter(Boolean).join(' / '))}</td><td>${e(x.origin)}</td>
          <td class="r">${x.unitPrice ? e(x.currency) + ' ' + fmt(x.unitPrice) : '-'}</td><td class="r">${x.perCarton ? x.perCarton + ' ' + e(x.unit) + '/CTN' : '-'}</td>
          <td class="row end"><button class="btn sm" data-edit-item="${i}">수정</button><button class="btn sm danger" data-del-item="${i}">삭제</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">아직 등록된 품목이 없습니다.</p>'}
    </div>`;
  };

  function hsLookupOut() {
    const f = $('#hs-lookup'); if (!f) return;
    const v = readForm(f);
    const cands = E.hs.classify(v.q);
    $('#hs-lookup-out').innerHTML = cands.length ? cands.map((c) => {
      const p = E.hs.profile(c.hs, v.country, v.direction);
      return `<details ${c === cands[0] ? 'open' : ''} style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px">
        <summary><code>${c.hs}</code> ${e(c.ko)} <span class="badge">${c.confidence}</span></summary>
        <table class="t" style="margin-top:8px"><tbody>
          <tr><th>영문</th><td>${e(c.en)}</td></tr>
          <tr><th>분류</th><td>${e(p.categoryInfo.name)}</td></tr>
          <tr><th>한국 기본관세</th><td>${c.krDuty}% ${c.note ? `<small>(${e(c.note)})</small>` : ''}</td></tr>
          <tr><th>FTA</th><td>${p.fta.length ? e(p.fta.join(', ')) : '해당 없음'}</td></tr>
          <tr><th>원산지기준(참고)</th><td>${e(c.ftaRule || '-')}</td></tr>
          <tr><th>${v.direction === 'import' ? '한국 수입요건' : '상대국 인증'}</th><td>${e(p.certs.join(' · ') || '-')}</td></tr>
          <tr><th>전략물자</th><td>${p.strategic ? '<span class="badge warn">판정 권장</span>' : '해당 가능성 낮음'}</td></tr>
        </tbody></table>
        <div class="row" style="margin-top:8px"><button class="btn sm" data-use-hs="${c.hs}" data-cat="${c.cat}">이 HS를 현재 거래에 적용</button>
        <a class="btn sm" href="https://unipass.customs.go.kr/clip/index.do" target="_blank" rel="noopener">관세법령정보포털에서 10단위 확인 ↗</a></div>
      </details>`;
    }).join('') : '<p class="muted">설명을 입력하면 후보가 표시됩니다.</p>';
  }

  after.items = () => {
    hsLookupOut();
    $('#hs-lookup').addEventListener('input', hsLookupOut);
    $('#item-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = readForm(ev.target);
      if (!v.nameEn && !v.nameKo) return toast('품명을 입력하세요');
      const list = items();
      if (editingItem && editingItem._i !== undefined) list[editingItem._i] = v; else list.push(Object.assign(v, { code: v.code || 'ITM-' + String(list.length + 1).padStart(3, '0') }));
      store.set('items', list); editingItem = null; toast('저장했습니다'); go('items');
    });
  };

  // =====================================================================
  // 3. 절차 · 인증
  // =====================================================================
  views.certs = () => {
    const cat = currentCategory();
    return `${head('품목별 절차 · 국가별 인증', '물품 분류에 따라 달라지는 절차와, 국가별로 필요한 인증·등록을 비교합니다.')}
    <div class="card"><form id="cert-form" class="form">
      ${field('물품 분류', 'category', cat, { options: categoryOptions() })}
      ${field('국가', 'country', ctx.country, { options: countryOptions(true) })}
      ${field('구분', 'direction', ctx.direction, { options: [['export', '수출'], ['import', '수입(한국)']] })}
    </form></div>
    <div id="cert-out" style="margin-top:16px"></div>`;
  };

  function certOut() {
    const v = readForm($('#cert-form'));
    const c = D.CATEGORIES[v.category];
    const country = D.COUNTRIES[v.direction === 'import' ? 'KR' : v.country];
    const certs = (country.certs[v.category] || country.certs.general || []);
    const common = v.direction === 'export' ? D.COMMON_EXPORT : D.COMMON_IMPORT;
    const special = v.direction === 'export' ? c.export : c.import;
    $('#cert-out').innerHTML = `<div class="grid g2">
      <div class="card"><h3>${c.icon} ${e(c.name)} — ${v.direction === 'export' ? '수출' : '수입'} 절차</h3>
        <ol class="steps">${common.map((s, i) => `<li><b>${e(s.step)}</b><span>${e(s.detail)}</span>${i === (v.direction === 'export' ? 3 : 1) ? `<div class="alert info" style="margin-top:6px"><b>${e(c.name)} 추가 사항</b><ul class="plain">${special.map((x) => `<li>${e(x)}</li>`).join('')}</ul></div>` : ''}</li>`).join('')}</ol>
      </div>
      <div class="stack">
        <div class="card"><h3>${e(country.name)} — 필요한 인증·등록</h3>
          <ul class="plain">${certs.map((x) => `<li>${e(x)}</li>`).join('') || '<li class="muted">등록된 정보 없음</li>'}</ul>
          ${country.vatNote ? `<p class="muted">부가세: ${country.vat}% · ${e(country.vatNote)}</p>` : `<p class="muted">부가세: ${country.vat}%</p>`}
          ${(country.notes || []).map((n) => `<div class="alert info">${e(n)}</div>`).join('')}
          ${D.SANCTIONS[v.country] && v.direction === 'export' ? alertHTML({ level: 'warn', title: D.SANCTIONS[v.country].name + ' 제재 주의', detail: D.SANCTIONS[v.country].note }) : ''}
        </div>
        <div class="card"><h3>준비 서류 · 리스크</h3><p>${e(c.docs.join(' · '))}</p><div class="alert warn">${e(c.risk)}</div></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><h3>${e(c.name)} — 국가별 인증 비교</h3>
      <div class="table-wrap"><table class="t"><thead><tr><th>국가</th><th>필요 인증·등록</th><th class="r">부가세</th><th>FTA</th></tr></thead><tbody>
      ${Object.entries(D.COUNTRIES).filter(([k]) => k !== 'KR').map(([k, cn]) => `<tr ${k === v.country ? 'class="hl"' : ''}><td>${e(cn.name)}</td><td>${e((cn.certs[v.category] || cn.certs.general || ['-']).join(' · '))}</td><td class="r">${cn.vat}%</td><td>${e((D.KOREA_FTA[k] || []).join(', ') || '-')}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`;
  }
  after.certs = () => { certOut(); $('#cert-form').addEventListener('change', certOut); };

  // =====================================================================
  // 4. 바이어 찾기
  // =====================================================================
  views.buyers = () => {
    const s = settings();
    return `${head('해외 바이어 찾기', '품목·HS·국가로 바이어 DB 검색 경로를 만들고, 컨택용 영문 메일 초안을 생성합니다.')}
    <div class="grid g2">
      <div class="card"><h2>검색 조건</h2>
        <form id="buyer-form" class="form">
          ${field('영문 품목 키워드', 'keyword', ctx.keyword, { ph: 'sheet mask, cotton t-shirt …' })}
          ${field('HS코드', 'hs', ctx.hs)}
          ${field('목표 국가', 'country', ctx.country, { options: countryOptions() })}
          ${field('물품 분류', 'category', currentCategory(), { options: categoryOptions() })}
        </form>
      </div>
      <div class="card"><h2>컨택 메일 초안</h2>
        <form id="mail-form" class="form">
          ${field('우리 회사', 'company', s.seller.name)}${field('보내는 사람', 'sender', s.seller.contact)}
          ${field('직함', 'title', 'Export Manager')}${field('바이어 회사', 'buyerCompany', '')}
          ${field('담당자 이름', 'buyerName', '', { ph: 'Mr. John Smith' })}${field('MOQ', 'moq', '')}
          ${field('리드타임', 'leadTime', '3-4 weeks after order')}${field('가격조건', 'incoterm', 'FOB Busan')}
          ${field('강점(줄바꿈/세미콜론 구분)', 'usp', '', { type: 'textarea', full: true, ph: 'Made in Korea, GMP certified factory; Private label available' })}
        </form>
      </div>
    </div>
    <div id="buyer-out" style="margin-top:16px"></div>
    <div id="mail-out" class="card" style="margin-top:16px"></div>`;
  };

  function buyerOut() {
    const v = readForm($('#buyer-form'));
    Object.assign(ctx, { keyword: v.keyword, hs: v.hs || ctx.hs, country: v.country, category: v.category }); store.set('ctx', ctx);
    const p = E.buyers.plan(v);
    const groups = {};
    p.channels.forEach((c) => (groups[c.group] = groups[c.group] || []).push(c));
    $('#buyer-out').innerHTML = `<div class="grid g2">
      <div class="card"><h3>바이어 발굴 채널</h3>
        ${Object.entries(groups).map(([g, list]) => `<h4 style="margin:12px 0 6px">${e(g)}</h4><div class="links">${list.map((c) => `<a href="${e(c.url)}" target="_blank" rel="noopener"><b>${e(c.name)}</b> ↗<small>${e(c.desc)}</small><small>👉 ${e(c.how)}</small></a>`).join('')}</div>`).join('')}
      </div>
      <div class="stack">
        <div class="card"><h3>컨택 진행 순서</h3><ul class="plain">${p.steps.map((s) => `<li>${e(s)}</li>`).join('')}</ul></div>
        <div class="card"><h3>KOTRA 무역관 (${e(D.COUNTRIES[v.country].name)})</h3><p>${p.kotra.length ? e(p.kotra.join(' · ')) : '-'}</p>
          <p class="muted">KOTRA 「해외시장조사」 서비스를 신청하면 무역관이 현지 잠재 바이어를 조사해 연락처를 제공합니다. 수출바우처로 비용 지원 가능.</p></div>
        <div class="card"><h3>추천 전시회</h3><ul class="plain">${p.fairs.map((f) => `<li>${e(f)}</li>`).join('')}</ul></div>
        <div class="card"><h3>검색어 예시</h3>${p.searchTerms.map((t) => `<code style="display:block;margin:4px 0">${e(t)}</code>`).join('') || '<p class="muted">키워드를 입력하세요</p>'}</div>
      </div>
    </div>`;
    mailOut();
  }

  function mailOut() {
    const b = readForm($('#buyer-form'));
    const m = E.buyers.coldEmail(Object.assign(readForm($('#mail-form')), { product: b.keyword, country: b.country }));
    $('#mail-out').innerHTML = `<h3>생성된 메일 <span class="row"><button class="btn sm" data-copy="mail-body">본문 복사</button><button class="btn sm" data-copy="mail-follow">팔로업 복사</button></span></h3>
      <p><b>Subject:</b> ${e(m.subject)}</p><pre class="mail" id="mail-body">${e(m.body)}</pre>
      <h4 style="margin:14px 0 6px">팔로업 메일 (3~5영업일 후)</h4><pre class="mail" id="mail-follow">${e(m.followUp)}</pre>`;
  }
  after.buyers = () => { buyerOut(); $('#buyer-form').addEventListener('input', buyerOut); $('#mail-form').addEventListener('input', mailOut); };

  // =====================================================================
  // 5. 비용 계산
  // =====================================================================
  views.cost = () => `${head('비용 계산', '수출 견적(EXW~DDP), 수입 착지원가(관세·부가세), 운임·컨테이너를 계산합니다.',
    `<div class="seg">${[['export', '수출 견적'], ['import', '수입 원가'], ['freight', '운임·컨테이너']].map(([k, l]) => `<button data-cost-tab="${k}" aria-pressed="${state.costTab === k}">${l}</button>`).join('')}</div>`)}
    <div id="cost-body">${costViews[state.costTab]()}</div>`;

  const costViews = {
    export() {
      const c = D.COUNTRIES[ctx.country] || {};
      const p = currentProfile();
      const L = D.LOCAL_CHARGES_KRW;
      const saved = store.get('exportQuote', {});
      const d = Object.assign({
        currency: c.currency && ['USD', 'EUR', 'JPY', 'CNY', 'GBP'].includes(c.currency) ? c.currency : 'USD', qty: 1000, unitCostKRW: 5000, packingKRW: 0, marginPct: 20,
        inlandKRW: 250000, customsFeeKRW: L.CUSTOMS_FEE, thcKRW: L.THC['20GP'], docKRW: L.DOC, otherOriginKRW: 0,
        mode: 'FCL', region: c.region || 'USWC', container: '20GP', containerCount: 1, cbm: 10, grossKg: 2000, freightUSD: '',
        insuranceRatePct: 0.1, destChargesKRW: 400000, dutyRatePct: '', destVatPct: c.vat || 0, importClearanceKRW: 150000, bankChargeKRW: 30000,
      }, saved);
      return `<div class="grid g2">
        <div class="card"><h2>입력 <small>${e(c.name || '')} 기준</small></h2>
          <form id="eq-form" class="form">
            ${field('견적 통화', 'currency', d.currency, { options: currencyOptions() })}
            ${field('수량', 'qty', d.qty, { type: 'number' })}
            ${field('단위 원가(원)', 'unitCostKRW', d.unitCostKRW, { type: 'number' })}
            ${field('수출 포장비 총액(원)', 'packingKRW', d.packingKRW, { type: 'number' })}
            ${field('마진(%)', 'marginPct', d.marginPct, { type: 'number' })}
            ${field('은행·기타 수수료(원)', 'bankChargeKRW', d.bankChargeKRW, { type: 'number' })}
            <div class="full muted"><b>출발지 비용</b></div>
            ${field('내륙운송(원)', 'inlandKRW', d.inlandKRW, { type: 'number' })}
            ${field('수출통관 수수료(원)', 'customsFeeKRW', d.customsFeeKRW, { type: 'number' })}
            ${field('THC(원)', 'thcKRW', d.thcKRW, { type: 'number' })}
            ${field('서류발급비(원)', 'docKRW', d.docKRW, { type: 'number' })}
            ${field('기타(원)', 'otherOriginKRW', d.otherOriginKRW, { type: 'number' })}
            <div class="full muted"><b>운임·보험</b></div>
            ${field('운송 방식', 'mode', d.mode, { options: [['FCL', '해상 FCL'], ['LCL', '해상 LCL'], ['AIR', '항공'], ['COURIER', '특송']] })}
            ${field('도착 권역', 'region', d.region, { options: regionOptions() })}
            ${field('컨테이너', 'container', d.container, { options: Object.keys(D.CONTAINERS).map((k) => [k, k]) })}
            ${field('컨테이너 수', 'containerCount', d.containerCount, { type: 'number' })}
            ${field('총 CBM', 'cbm', d.cbm, { type: 'number' })}
            ${field('총 중량(kg)', 'grossKg', d.grossKg, { type: 'number' })}
            ${field('운임 직접입력(USD, 비우면 참고운임)', 'freightUSD', d.freightUSD, { type: 'number' })}
            ${field('적하보험 요율(%)', 'insuranceRatePct', d.insuranceRatePct, { type: 'number' })}
            <div class="full muted"><b>도착지 비용 (DAP·DDP)</b></div>
            ${field('도착지 부대비·배송(원)', 'destChargesKRW', d.destChargesKRW, { type: 'number' })}
            ${field(`수입국 관세율(%)${p ? '' : ''}`, 'dutyRatePct', d.dutyRatePct, { type: 'number', ph: '상대국 세율 입력' })}
            ${field('수입국 부가세(%)', 'destVatPct', d.destVatPct, { type: 'number' })}
            ${field('수입통관 수수료(원)', 'importClearanceKRW', d.importClearanceKRW, { type: 'number' })}
          </form>
        </div>
        <div class="card"><h2>가격 조건별 견적</h2><div id="eq-out"></div></div>
      </div>`;
    },
    import() {
      const p = currentProfile();
      const c = D.COUNTRIES[ctx.country] || {};
      const saved = store.get('importCost', {});
      const liquor = p && p.item && p.item.liquor;
      const d = Object.assign({
        currency: c.currency && fxOf(c.currency) ? c.currency : 'USD', invoiceAmount: 10000, incoterm: 'FOB', qty: 1000,
        freightKRW: 1500000, insuranceKRW: 20000, dutyRatePct: p && p.krDuty !== null ? p.krDuty : 8,
        exciseRatePct: p && p.item && p.item.excise ? p.item.excise : 0, liquorRate: liquor && liquor.rate ? liquor.rate : '',
        brokerFeeKRW: '', domesticKRW: 300000, otherKRW: 0,
      }, saved);
      return `<div class="grid g2">
        <div class="card"><h2>입력 <small>한국 수입 기준</small></h2>
          <form id="ic-form" class="form">
            ${field('송장 통화', 'currency', d.currency, { options: currencyOptions() })}
            ${field('송장 금액', 'invoiceAmount', d.invoiceAmount, { type: 'number' })}
            ${field('가격조건', 'incoterm', d.incoterm, { options: incotermOptions() })}
            ${field('수량', 'qty', d.qty, { type: 'number' })}
            ${field('해상/항공 운임(원)', 'freightKRW', d.freightKRW, { type: 'number' })}
            ${field('보험료(원)', 'insuranceKRW', d.insuranceKRW, { type: 'number' })}
            ${field(`관세율(%) ${p && p.fta.length ? '— FTA 협정세율 확인' : ''}`, 'dutyRatePct', d.dutyRatePct, { type: 'number' })}
            ${field('개별소비세율(%)', 'exciseRatePct', d.exciseRatePct, { type: 'number' })}
            ${field('주세율(%, 주류만)', 'liquorRate', d.liquorRate, { type: 'number' })}
            ${field('관세사 수수료(원, 비우면 0.2%)', 'brokerFeeKRW', d.brokerFeeKRW, { type: 'number' })}
            ${field('국내 운송·창고(원)', 'domesticKRW', d.domesticKRW, { type: 'number' })}
            ${field('기타(원)', 'otherKRW', d.otherKRW, { type: 'number' })}
          </form>
          ${p && p.fta.length ? `<div class="alert info" style="margin-top:12px"><b>FTA 적용 가능: ${e(p.fta.join(', '))}</b><span class="detail">원산지증명서를 갖추면 협정세율(대부분 0~기본세율 이하)을 적용할 수 있습니다. <a href="https://unipass.customs.go.kr/clip/index.do" target="_blank" rel="noopener">협정세율 조회 ↗</a></span></div>` : ''}
        </div>
        <div class="card"><h2>착지원가</h2><div id="ic-out"></div></div>
      </div>`;
    },
    freight() {
      const c = D.COUNTRIES[ctx.country] || {};
      return `<div class="card"><h2>운임 비교 · 컨테이너 추천</h2>
        <form id="fr-form" class="form">
          ${field('도착 권역', 'region', c.region && c.region !== 'KR' ? c.region : 'USWC', { options: regionOptions() })}
          ${field('총 CBM', 'cbm', 12, { type: 'number' })}
          ${field('총 중량(kg)', 'grossKg', 3000, { type: 'number' })}
          ${field('특송 kg당 요금(USD)', 'courierRate', 8, { type: 'number' })}
        </form>
        <div id="fr-out" style="margin-top:14px"></div>
        <p class="muted">참고 운임은 예시 기본값입니다. 설정 메뉴에서 포워더 견적으로 바꿔두면 모든 계산에 반영됩니다. 실시간 비교는 포워더 견적 또는 Freightos 등 운임 플랫폼을 이용하세요.</p>
      </div>`;
    },
  };

  function eqOut() {
    const f = $('#eq-form'); const v = readForm(f); store.set('exportQuote', v);
    let freightUSD = num(v.freightUSD);
    let fr = null;
    if (!v.freightUSD) {
      fr = E.cost.freight({ mode: v.mode, region: v.region, container: v.container, containerCount: num(v.containerCount, 1), cbm: v.cbm, grossKg: v.grossKg });
      freightUSD = fr.usd;
    }
    const q = E.cost.exportQuote(Object.assign({}, v, { freightUSD, fx: fxOf(v.currency), fxUSD: fxOf('USD'), country: ctx.country }));
    $('#eq-out').innerHTML = `
      <div class="table-wrap"><table class="t"><thead><tr><th>조건</th><th class="r">총액(${e(v.currency)})</th><th class="r">단가(${e(v.currency)})</th><th class="r">원화</th></tr></thead><tbody>
      ${q.terms.map((t) => `<tr ${t.term === 'FOB' || t.term === 'CIF' ? 'class="hl"' : ''}><td><b>${t.term}</b> <small>${e(D.INCOTERMS[t.term].risk)}</small></td><td class="r">${fmt(t.amount)}</td><td class="r">${fmt(t.perUnit, 4)}</td><td class="r">${fmtKRW(t.krw)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="kpi" style="margin-top:12px">
        <div><span>운임</span><b>USD ${fmt(freightUSD)}</b><small>${fr ? e(fr.basis) : '직접입력'}</small></div>
        <div><span>적하보험료</span><b>${fmtKRW(q.breakdown.insurance)}</b></div>
        <div><span>마진</span><b>${fmtKRW(q.breakdown.profit)}</b></div>
        <div><span>수입국 관세(${q.breakdown.dutyBasis} 기준)</span><b>${fmtKRW(q.breakdown.duty)}</b></div>
      </div>
      <p class="muted">환율: 1 ${e(v.currency)} = ${fmt(fxOf(v.currency), 2)}원 (${e(state.fx.source)}). 보험금액 = CIF × 110%.</p>
      <div class="row"><button class="btn" data-act="quote-to-pi">이 견적으로 P/I 만들기 →</button></div>`;
    eqOut.last = { v, q };
  }

  function icOut() {
    const v = readForm($('#ic-form')); store.set('importCost', v);
    const r = E.cost.importLandedCost(Object.assign({}, v, { fx: fxOf(v.currency), liquor: num(v.liquorRate) > 0 ? { rate: num(v.liquorRate) } : null }));
    const rows = [
      ['송장금액(원화)', r.invoiceKRW], ['과세가격', r.customsValue], ['관세', r.duty], r.excise ? ['개별소비세', r.excise] : null,
      r.liquorTax ? ['주세', r.liquorTax] : null, r.eduTax ? ['교육세', r.eduTax] : null, ['부가세(10%)', r.vat], ['관세사 수수료', r.brokerFee], ['국내비용·기타', r.other],
    ].filter(Boolean);
    $('#ic-out').innerHTML = `<div class="kpi">
        <div><span>세금 합계</span><b>${fmtKRW(r.taxes)}</b></div>
        <div><span>총 지출(부가세 포함)</span><b>${fmtKRW(r.totalCash)}</b></div>
        <div><span>원가(부가세 공제 후)</span><b>${fmtKRW(r.totalCost)}</b></div>
        <div><span>개당 원가</span><b>${fmtKRW(r.unitCost)}</b></div>
      </div>
      <div class="table-wrap" style="margin-top:12px"><table class="t"><tbody>${rows.map(([k, val]) => `<tr><th>${k}</th><td class="r">${fmtKRW(val)}</td></tr>`).join('')}</tbody></table></div>
      <ul class="plain muted" style="margin-top:10px">${r.notes.map((n) => `<li>${e(n)}</li>`).join('')}<li>과세환율: 1 ${e(v.currency)} = ${fmt(fxOf(v.currency))}원 — 실제는 관세청 고시 과세환율(주간) 적용</li></ul>`;
  }

  function frOut() {
    const v = readForm($('#fr-form'));
    const plan = E.cost.containerPlan({ cbm: v.cbm, grossKg: v.grossKg, region: v.region });
    const r = D.REF_RATES[v.region];
    const air = E.cost.freight({ mode: 'AIR', region: v.region, cbm: v.cbm, grossKg: v.grossKg });
    const courier = E.cost.freight({ mode: 'COURIER', cbm: v.cbm, grossKg: v.grossKg, ratePerUnit: v.courierRate });
    const rows = [
      ...plan.options.map((o) => ({ name: o.type === 'LCL' ? '해상 LCL' : `해상 FCL ${o.type} × ${o.count}`, usd: o.usd, note: o.type === 'LCL' ? `${fmt(Math.max(num(v.cbm), num(v.grossKg) / 1000, 1), 2)} R/T × $${r.LCL}` : `적재율 ${o.fill}%`, transit: r.transit, best: plan.best === o })),
      { name: '항공', usd: air.usd, note: air.basis, transit: '1~3일' },
      { name: '특송(DHL·FedEx 등)', usd: courier.usd, note: courier.basis, transit: '2~5일' },
    ];
    $('#fr-out').innerHTML = `<div class="table-wrap"><table class="t"><thead><tr><th>방식</th><th class="r">예상 운임(USD)</th><th class="r">원화</th><th>산출 근거</th><th>운송기간</th></tr></thead><tbody>
      ${rows.map((x) => `<tr ${x.best ? 'class="hl"' : ''}><td>${e(x.name)} ${x.best ? '<span class="badge ok">해상 최저</span>' : ''}</td><td class="r">${fmt(x.usd)}</td><td class="r">${fmtKRW(x.usd * fxOf('USD'))}</td><td><small>${e(x.note)}</small></td><td>${e(x.transit)}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="muted">해상 운임에는 출발지 THC·서류비·도착지 비용이 포함되지 않습니다(비용 계산 → 수출 견적에서 합산).</p>`;
  }

  after.cost = () => {
    if (state.costTab === 'export') { eqOut(); $('#eq-form').addEventListener('input', eqOut); }
    if (state.costTab === 'import') { icOut(); $('#ic-form').addEventListener('input', icOut); }
    if (state.costTab === 'freight') { frOut(); $('#fr-form').addEventListener('input', frOut); }
  };

  // =====================================================================
  // 6. 서류 생성
  // =====================================================================
  function defaultDeal() {
    const s = settings();
    const c = D.COUNTRIES[ctx.country] || {};
    const dt = new Date(); const valid = new Date(Date.now() + 30 * 86400000);
    return {
      docNo: E.documents.nextDocNo('PI', (store.get('deals', []).length || 0) + 1), date: dt.toISOString().slice(0, 10),
      currency: 'USD', incoterm: 'FOB', incotermPlace: 'BUSAN, KOREA', payment: 'T/T 30% IN ADVANCE, 70% BEFORE SHIPMENT',
      validity: valid.toISOString().slice(0, 10), depositPct: 30, lcNo: '', poNo: '', origin: 'REPUBLIC OF KOREA',
      seller: Object.assign({ name: '', address: '', tel: '', email: '' }, s.seller),
      buyer: { name: '', address: '', tel: '', email: '' }, consignee: { name: '', address: '' }, notify: { name: '', address: '' },
      portLoading: 'BUSAN, KOREA', portDischarge: '', finalDestination: c.name ? '' : '', vessel: '', etd: '',
      marks: '', remarks: '', bank: Object.assign({}, s.bank), discount: 0, freightCharge: 0, insuranceCharge: 0, otherCharge: 0,
      shipment: { mode: 'FCL', containerType: '20GP', containerCount: 1, freightTerm: 'COLLECT', cargoReady: '', blType: 'ORIGINAL B/L', forwarder: '', instructions: '' },
      items: [],
    };
  }
  const getDeal = () => store.get('deal', null) || defaultDeal();
  const setDeal = (d) => store.set('deal', d);

  const DEAL_FIELDS = {
    basic: [['docNo', '서류 번호'], ['date', '발행일', 'date'], ['currency', '통화', currencyOptions], ['incoterm', '가격조건', () => Object.keys(D.INCOTERMS).map((k) => [k, k])],
      ['incotermPlace', '인도 장소'], ['payment', '결제조건'], ['validity', '견적 유효기간(P/I)', 'date'], ['depositPct', '선금 비율(%)', 'number'],
      ['lcNo', 'L/C 번호'], ['poNo', '바이어 P/O 번호'], ['origin', '원산지']],
    ship: [['portLoading', '선적항'], ['portDischarge', '도착항'], ['finalDestination', '최종 목적지'], ['vessel', '선명/항차·편명'], ['etd', '선적 예정일(ETD)', 'date']],
    charges: [['discount', '할인액', 'number'], ['freightCharge', '운임 청구액(CFR/CIF)', 'number'], ['insuranceCharge', '보험료 청구액', 'number'], ['otherCharge', '기타 청구액', 'number']],
    sr: [['mode', '운송 방식', () => [['FCL', 'FCL'], ['LCL', 'LCL'], ['AIR', 'AIR']]], ['containerType', '컨테이너', () => Object.keys(D.CONTAINERS).map((k) => [k, k])], ['containerCount', '컨테이너 수', 'number'],
      ['freightTerm', '운임 지불', () => [['PREPAID', 'PREPAID'], ['COLLECT', 'COLLECT']]], ['cargoReady', '화물 준비일', 'date'], ['blType', 'B/L 종류', () => [['ORIGINAL B/L', 'ORIGINAL B/L'], ['SURRENDERED B/L', 'SURRENDERED B/L'], ['SEA WAYBILL', 'SEA WAYBILL']]],
      ['forwarder', '포워더'], ['instructions', '특별 지시사항']],
  };
  const PARTY = [['name', '상호'], ['address', '주소'], ['tel', '전화'], ['email', '이메일']];
  const ITEM_COLS = [['description', '품명(영문)', 'text', 180], ['hs', 'HS', 'text', 80], ['qty', '수량', 'number', 70], ['unit', '단위', 'text', 55], ['unitPrice', '단가', 'number', 75],
    ['perCarton', '입수/CTN', 'number', 65], ['nwPerCtn', 'NW/CTN', 'number', 65], ['gwPerCtn', 'GW/CTN', 'number', 65], ['l', 'L', 'number', 50], ['w', 'W', 'number', 50], ['h', 'H', 'number', 50]];

  function dealField(path, label, kind, value) {
    const opts = typeof kind === 'function' ? kind() : null;
    return field(label, path, value, opts ? { options: opts } : { type: kind || 'text' });
  }

  views.docs = () => {
    const d = getDeal();
    const its = items();
    const saved = store.get('deals', []);
    return `${head('무역 서류 생성', '한 번 입력하면 P/I · C/I · P/L · S/R이 모두 같은 데이터로 계산·생성됩니다.',
      `<div class="seg">${Object.entries(E.documents.TYPES).map(([k, t]) => `<button data-doc-type="${k}" aria-pressed="${state.docType === k}">${k} ${t.ko}</button>`).join('')}</div>`)}
    <form id="deal-form">
    <div class="grid g2">
      <div class="card"><h2>거래 기본정보</h2><div class="form">${DEAL_FIELDS.basic.map(([k, l, t]) => dealField(k, l, t, d[k])).join('')}</div></div>
      <div class="card"><h2>운송 · 화인</h2><div class="form">${DEAL_FIELDS.ship.map(([k, l, t]) => dealField(k, l, t, d[k])).join('')}
        ${field('화인(Shipping Mark)', 'marks', d.marks, { type: 'textarea', full: true, ph: 'BUYER\nLOS ANGELES\nC/NO. 1-UP\nMADE IN KOREA' })}
        ${field('비고(Remarks)', 'remarks', d.remarks, { type: 'textarea', full: true })}</div></div>
      ${['seller', 'buyer', 'consignee', 'notify'].map((p) => `<div class="card"><h2>${{ seller: '판매자(Seller/Shipper)', buyer: '구매자(Buyer)', consignee: '수하인(Consignee) — 비우면 Buyer', notify: '통지처(Notify) — 비우면 Same as Consignee' }[p]}</h2>
        <div class="form">${PARTY.map(([k, l]) => field(l, `${p}.${k}`, (d[p] || {})[k], { full: k === 'address', type: k === 'address' ? 'textarea' : 'text' })).join('')}</div></div>`).join('')}
      <div class="card"><h2>추가 청구 · 은행(P/I)</h2><div class="form">${DEAL_FIELDS.charges.map(([k, l, t]) => dealField(k, l, t, d[k])).join('')}
        ${[['name', '은행명'], ['swift', 'SWIFT'], ['account', '계좌번호'], ['beneficiary', '수취인']].map(([k, l]) => field(l, `bank.${k}`, (d.bank || {})[k])).join('')}</div></div>
      <div class="card"><h2>선적요청(S/R) 정보</h2><div class="form">${DEAL_FIELDS.sr.map(([k, l, t]) => dealField(`shipment.${k}`, l, t, (d.shipment || {})[k])).join('')}</div></div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>품목 <span class="row">
        <select id="add-from-master" style="width:auto"><option value="">품목 마스터에서 추가…</option>${its.map((x, i) => `<option value="${i}">${e(x.code)} ${e(x.nameEn || x.nameKo)}</option>`).join('')}</select>
        <button type="button" class="btn sm" data-act="add-row">+ 빈 행</button></span></h2>
      <div class="table-wrap"><table class="t" id="item-table"><thead><tr><th>#</th>${ITEM_COLS.map(([, l]) => `<th>${l}</th>`).join('')}<th></th></tr></thead><tbody>
        ${(d.items || []).map((it, i) => `<tr><td>${i + 1}</td>${ITEM_COLS.map(([k, , t, wd]) => `<td><input data-row="${i}" data-key="${k}" type="${t}" ${t === 'number' ? 'step="any"' : ''} value="${e(it[k])}" style="min-width:${wd}px"></td>`).join('')}<td><button type="button" class="btn sm danger" data-del-row="${i}">×</button></td></tr>`).join('') || `<tr><td colspan="${ITEM_COLS.length + 2}" class="muted">품목을 추가하세요. L·W·H는 카톤 치수(cm)입니다.</td></tr>`}
      </tbody></table></div>
    </div>
    </form>
    <div class="card" style="margin-top:16px">
      <h2>저장된 거래 (${saved.length})</h2>
      ${saved.length ? `<div class="table-wrap"><table class="t"><tbody>${saved.map((s, i) => `<tr><td>${e(s.docNo)}</td><td>${e(s.buyer && s.buyer.name)}</td><td>${e(s.date)}</td><td class="r">${e(s.currency)} ${fmt(E.documents.compute(s).totals.total)}</td><td class="row end"><button class="btn sm" data-load-deal="${i}">불러오기</button><button class="btn sm danger" data-del-deal="${i}">삭제</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">저장된 거래가 없습니다.</p>'}
    </div>
    <div class="card print-target" style="margin-top:16px">
      <h2>미리보기 <span class="row">
        <button class="btn" data-act="new-deal">새 거래</button>
        <button class="btn" data-act="save-deal">거래 저장</button>
        <button class="btn" data-act="doc-excel">엑셀</button>
        <button class="btn primary" data-act="doc-print">PDF 저장 / 인쇄</button></span></h2>
      <div id="doc-check"></div>
      <div class="doc-stage" id="doc-preview"></div>
    </div>`;
  };

  function setPath(obj, path, val) {
    const keys = path.split('.'); let o = obj;
    keys.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; });
    o[keys[keys.length - 1]] = val;
  }

  function docPreview() {
    const d = getDeal();
    const missing = E.documents.validate(state.docType, d);
    $('#doc-check').innerHTML = missing.length
      ? `<div class="alert warn" style="margin-bottom:12px"><b>${state.docType} 필수 항목 누락 ${missing.length}건</b><span class="detail">${e(missing.join(', '))}</span></div>`
      : '<div class="alert ok" style="margin-bottom:12px"><b>필수 항목이 모두 입력되었습니다</b></div>';
    $('#doc-preview').innerHTML = E.documents.renderHTML(state.docType, d);
  }

  after.docs = () => {
    docPreview();
    const form = $('#deal-form');
    form.addEventListener('input', (ev) => {
      const t = ev.target; const d = getDeal();
      if (t.dataset.row !== undefined) d.items[Number(t.dataset.row)][t.dataset.key] = t.value;
      else if (t.name) setPath(d, t.name, t.value);
      setDeal(d); docPreview();
    });
    $('#add-from-master').addEventListener('change', (ev) => {
      if (ev.target.value === '') return;
      const x = items()[Number(ev.target.value)];
      const d = getDeal();
      d.items.push({ description: [x.nameEn || x.nameKo, x.spec].filter(Boolean).join(' '), hs: x.hs, qty: x.perCarton || 1, unit: x.unit || 'PCS', unitPrice: x.unitPrice,
        perCarton: x.perCarton, nwPerCtn: x.nwPerCtn, gwPerCtn: x.gwPerCtn, l: x.l, w: x.w, h: x.h });
      if (x.currency) d.currency = x.currency;
      setDeal(d); go('docs');
    });
  };

  function exportRows(name, rows) {
    if (window.XLSX) {
      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
      window.XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 30));
      window.XLSX.writeFile(wb, name + '.xlsx');
    } else {
      const csv = rows.map((r) => r.map((c) => `"${String(c === undefined || c === null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      download(name + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
      toast('엑셀 라이브러리를 불러오지 못해 CSV로 저장했습니다');
    }
  }

  // =====================================================================
  // 7. 통관 · 법규
  // =====================================================================
  views.customs = () => `${head('통관 · 법규', '수출입 제한·전략물자·외국환 요건을 사전 점검하고, UNI-PASS로 통관 진행 상태를 조회합니다.')}
    <div class="grid g2">
      <div class="card"><h2>수출입 요건 사전 검증</h2>
        <form id="comp-form" class="form">
          ${field('품목 설명', 'description', ctx.description, { full: true })}
          ${field('HS코드', 'hs', ctx.hs)}
          ${field('상대국', 'country', ctx.country, { options: [...countryOptions(), ...Object.entries(D.SANCTIONS).filter(([k]) => !D.COUNTRIES[k]).map(([k, s]) => [k, `${s.name} (${k}) ⚠`])] })}
          ${field('구분', 'direction', ctx.direction, { options: [['export', '수출'], ['import', '수입']] })}
          ${field('결제 방식', 'payment', 'T/T', { options: [['T/T', 'T/T 송금'], ['L/C', '신용장'], ['ADVANCE T/T', '수입 선급금 송금'], ['THIRD PARTY', '제3자 지급/수령'], ['NETTING', '상계'], ['CASH', '현금 휴대']] })}
          ${field('거래금액(USD)', 'amountUSD', 10000, { type: 'number' })}
        </form>
        <div id="comp-out" style="margin-top:12px"></div>
      </div>
      <div class="stack">
        <div class="card"><h2>UNI-PASS 화물통관 진행정보</h2>
          ${settings().proxyUrl ? '' : '<div class="alert info" style="margin-bottom:10px"><b>데모 모드</b><span class="detail">설정에서 프록시 URL을 등록하면 관세청 실데이터를 조회합니다.</span></div>'}
          <form id="cargo-form" class="form">
            ${field('M B/L 번호', 'mblNo', '')}${field('H B/L 번호', 'hblNo', '')}
            ${field('B/L 연도', 'blYy', new Date().getFullYear(), { type: 'number' })}${field('화물관리번호(선택)', 'cargMtNo', '')}
            <div class="full"><button class="btn primary">조회</button></div>
          </form>
          <div id="cargo-out" style="margin-top:12px"></div>
        </div>
        <div class="card"><h2>수출신고 이행(적재) 조회</h2>
          <form id="exp-form" class="form">${field('수출신고번호', 'expDclrNo', '', { ph: '12345-26-123456X' })}<div class="full"><button class="btn primary">조회</button></div></form>
          <div id="exp-out" style="margin-top:12px"></div>
          <p class="muted">수출신고 수리일로부터 30일 내 선적해야 하며, 미선적 시 신고수리가 취소될 수 있습니다.</p>
        </div>
      </div>
    </div>`;

  function compOut() {
    const v = readForm($('#comp-form'));
    const r = E.compliance.check(v);
    $('#comp-out').innerHTML = (r.ok ? '<div class="alert ok"><b>진행 불가 항목은 발견되지 않았습니다</b><span class="detail">아래 확인 항목을 검토하세요.</span></div>' : '<div class="alert block"><b>진행 불가 가능성이 있는 항목이 있습니다</b></div>')
      + r.alerts.map(alertHTML).join('');
  }

  after.customs = () => {
    compOut();
    $('#comp-form').addEventListener('input', compOut);
    $('#cargo-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const out = $('#cargo-out'); out.innerHTML = '<p class="muted">조회 중…</p>';
      try {
        const r = await TP.api.cargoProgress(readForm(ev.target));
        const s = r.summary || {};
        out.innerHTML = (r.demo ? '<p class="muted">※ 데모 데이터</p>' : '') + (r.notice ? `<div class="alert warn">${e(r.notice)}</div>` : '')
          + (r.summary ? `<div class="kpi"><div><span>진행상태</span><b>${e(s.prgsStts || s.csclPrgsStts)}</b></div><div><span>선박</span><b style="font-size:14px">${e(s.shipNm)}</b></div><div><span>입항일</span><b>${e(s.etprDt)}</b></div><div><span>포장/중량</span><b style="font-size:14px">${e(s.pckGcnt)} / ${e(s.ttwg)}${e(s.wghtUt)}</b></div></div>` : '')
          + `<div class="table-wrap" style="margin-top:10px"><table class="t"><thead><tr><th>처리일시</th><th>처리구분</th><th>장치장</th></tr></thead><tbody>${(r.events || []).map((x) => `<tr><td>${e(x.prcsDttm)}</td><td>${e(x.cargTrcnRelaBsopTpcd)}</td><td>${e(x.shedNm)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">결과 없음</td></tr>'}</tbody></table></div>`;
      } catch (err) { out.innerHTML = `<div class="alert block"><b>조회 실패</b><span class="detail">${e(err.message)}</span></div>`; }
    });
    $('#exp-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const out = $('#exp-out');
      try {
        const r = await TP.api.exportPerformance(readForm(ev.target).expDclrNo);
        out.innerHTML = (r.demo ? '<p class="muted">※ 데모 데이터</p>' : '') + `<div class="table-wrap"><table class="t"><thead><tr><th>신고번호</th><th>선적완료</th><th>수리일</th><th>적재의무기한</th></tr></thead><tbody>${(r.rows || []).map((x) => `<tr><td>${e(x.expDclrNo)}</td><td>${x.shpmCmplYn === 'Y' ? '<span class="badge ok">완료</span>' : '<span class="badge warn">미완료</span>'}</td><td>${e(x.acptDt)}</td><td>${e(x.loadDtyTmlm)}</td></tr>`).join('') || '<tr><td colspan="4">결과 없음</td></tr>'}</tbody></table></div>`;
      } catch (err) { out.innerHTML = `<div class="alert block"><b>조회 실패</b><span class="detail">${e(err.message)}</span></div>`; }
    });
  };

  // =====================================================================
  // 8. 물류 · 추적
  // =====================================================================
  views.logistics = () => `${head('물류 · 선적 관리', '컨테이너/B/L 번호로 선사를 인식해 추적하고, 운송 방식별 운임을 비교합니다.')}
    <div class="grid g2">
      <div class="card"><h2>화물 추적</h2>
        <form id="track-form" class="form">${field('컨테이너 번호 또는 B/L 번호', 'no', '', { full: true, ph: 'MSKU9070323 / HDMUSELA12345678' })}<div class="full"><button class="btn primary">추적</button></div></form>
        <div id="track-out" style="margin-top:12px"></div>
      </div>
      <div class="card"><h2>Incoterms 2020 비용·위험 분담</h2>
        <div class="table-wrap"><table class="t"><thead><tr><th>조건</th><th>위험 이전</th><th>판매자 부담</th></tr></thead><tbody>
        ${Object.entries(D.INCOTERMS).map(([k, t]) => `<tr><td><b>${k}</b></td><td>${e(t.risk)}</td><td><small>${e(t.seller.join(', '))}</small></td></tr>`).join('')}
        </tbody></table></div>
      </div>
    </div>
    <div style="margin-top:16px">${costViews.freight()}</div>`;

  after.logistics = () => {
    frOut(); $('#fr-form').addEventListener('input', frOut);
    $('#track-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const no = readForm(ev.target).no.trim();
      const out = $('#track-out');
      if (!no) return;
      const val = E.tracking.validateContainer(no);
      const carrier = E.tracking.detectCarrier(no);
      let html = /^[A-Z]{4}\d/i.test(no.replace(/\s/g, '')) && no.replace(/\W/g, '').length === 11
        ? `<div class="alert ${val.valid ? 'ok' : 'warn'}"><b>컨테이너 번호 ${val.valid ? '유효' : '확인 필요'}</b><span class="detail">${e(val.reason)}</span></div>` : '';
      html += carrier ? `<div class="links" style="margin-top:8px"><a href="${e(carrier.url)}" target="_blank" rel="noopener"><b>${e(carrier.name)}</b> 공식 추적 페이지 ↗<small>접두어로 선사를 인식했습니다</small></a></div>`
        : '<p class="muted">선사를 인식하지 못했습니다. 아래 범용 추적을 이용하세요.</p>';
      html += `<div class="links" style="margin-top:8px">${E.tracking.genericLinks(no).map((l) => `<a href="${e(l.url)}" target="_blank" rel="noopener">${e(l.name)} ↗</a>`).join('')}</div>`;
      out.innerHTML = html;
      try {
        const r = await TP.api.trackShipment(no);
        if (r) out.innerHTML += `<div class="card" style="margin-top:12px"><h3>실시간 위치 (${e(r.vessel || '')})</h3><p>ETA: <b>${e(r.eta || '-')}</b>${r.position ? ` · 위치 ${e(r.position.lat)}, ${e(r.position.lon)}` : ''}</p>
          <table class="t"><tbody>${(r.events || []).map((x) => `<tr><td>${e(x.time)}</td><td>${e(x.place)}</td><td>${e(x.status)}</td></tr>`).join('')}</tbody></table></div>`;
        else out.innerHTML += '<p class="muted" style="margin-top:8px">설정에서 화물추적 API(Project44·MarineTraffic 등 프록시)를 연결하면 선박 위치·ETA가 자동 표시됩니다.</p>';
      } catch (err) { out.innerHTML += `<div class="alert warn" style="margin-top:8px">추적 API 오류: ${e(err.message)}</div>`; }
    });
  };

  // =====================================================================
  // 9. 결제 · 환율
  // =====================================================================
  views.finance = () => {
    const tt = store.get('tt', { contract: 50000, currency: 'USD', entries: [] });
    const sum = E.finance.ttSummary(tt.contract, tt.entries);
    const main = ['USD', 'EUR', 'JPY', 'CNY', 'GBP', 'AUD', 'CAD', 'SGD', 'HKD', 'VND', 'AED', 'THB'];
    return `${head('결제 · 환율', '실시간 환율로 금액을 환산하고, 신용장(L/C) 서류 일치 여부와 T/T 입금 현황을 관리합니다.', '<button class="btn" data-act="refresh-fx">↻ 환율 새로고침</button>')}
    <div class="grid g2">
      <div class="card"><h2>환율 <small>${e(state.fx.source)}${state.fx.at ? ' · ' + e(state.fx.at) : ''}</small></h2>
        <div class="table-wrap"><table class="t"><thead><tr><th>통화</th><th class="r">1단위당 원화</th></tr></thead><tbody>
        ${main.filter((c) => state.fx.rates[c]).map((c) => `<tr><td>${c}</td><td class="r">${fmt(state.fx.rates[c], c === 'JPY' || c === 'VND' ? 4 : 2)}</td></tr>`).join('')}
        </tbody></table></div>
        <form id="conv-form" class="form" style="margin-top:12px">
          ${field('금액', 'amount', 1000, { type: 'number' })}${field('From', 'from', 'USD', { options: currencyOptions() })}${field('To', 'to', 'KRW', { options: currencyOptions() })}
          <div class="full" id="conv-out"></div>
        </form>
      </div>
      <div class="card"><h2>T/T 입금 관리</h2>
        <form id="tt-form" class="form">
          ${field('계약 금액', 'contract', tt.contract, { type: 'number' })}${field('통화', 'currency', tt.currency, { options: currencyOptions() })}
        </form>
        <div class="kpi" style="margin-top:12px">
          <div><span>입금 누계</span><b>${e(tt.currency)} ${fmt(sum.received)}</b></div>
          <div><span>미수금</span><b>${e(tt.currency)} ${fmt(sum.outstanding)}</b></div>
          <div><span>회수율</span><b>${sum.ratio}%</b></div>
        </div>
        <form id="tt-add" class="form" style="margin-top:12px">
          ${field('입금일', 'date', TP.today(), { type: 'date' })}${field('구분', 'type', 'deposit', { options: [['deposit', '선금'], ['balance', '잔금'], ['refund', '환불/차감']] })}
          ${field('금액', 'amount', '', { type: 'number' })}${field('메모(은행·참조번호)', 'memo', '')}
          <div class="full"><button class="btn primary">입금 기록</button></div>
        </form>
        <div class="table-wrap" style="margin-top:10px"><table class="t"><tbody>${tt.entries.map((x, i) => `<tr><td>${e(x.date)}</td><td>${{ deposit: '선금', balance: '잔금', refund: '환불' }[x.type]}</td><td class="r">${fmt(x.amount)}</td><td>${e(x.memo)}</td><td><button class="btn sm danger" data-del-tt="${i}">×</button></td></tr>`).join('') || '<tr><td class="muted">기록 없음</td></tr>'}</tbody></table></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><h2>신용장(L/C) 서류 일치 검증 <small>UCP600 주요 조항 기준</small></h2>
      <div class="grid g2">
        <form id="lc-form" class="form"><div class="full"><b>신용장 조건</b></div>
          ${field('L/C 금액', 'amount', 50000, { type: 'number' })}${field('통화', 'currency', 'USD', { options: currencyOptions() })}
          ${field('과부족 허용(%)', 'tolerancePct', 0, { type: 'number' })}${field('최종 선적일', 'latestShipmentDate', '', { type: 'date' })}
          ${field('유효기일', 'expiryDate', '', { type: 'date' })}${field('제시기간(일)', 'presentationDays', 21, { type: 'number' })}
          ${field('선적항', 'portLoading', 'BUSAN, KOREA')}${field('양륙항', 'portDischarge', '')}
          ${field('가격조건', 'incoterm', 'CIF', { options: Object.keys(D.INCOTERMS).map((k) => [k, k]) })}
          ${field('분할선적', 'partialShipment', 'allowed', { options: [['allowed', '허용'], ['prohibited', '금지']] })}
          ${field('환적', 'transhipment', 'allowed', { options: [['allowed', '허용'], ['prohibited', '금지']] })}
          ${field('물품명세(45A)', 'goods', '', { full: true })}
          ${field('요구 서류(46A, 쉼표 구분)', 'requiredDocs', 'Commercial Invoice, Packing List, B/L, Certificate of Origin, Insurance Policy', { full: true })}
        </form>
        <form id="lcdoc-form" class="form"><div class="full"><b>선적·제시 서류</b> <button type="button" class="btn sm" data-act="lc-from-deal">현재 거래(C/I)에서 불러오기</button></div>
          ${field('송장 금액', 'invoiceAmount', '', { type: 'number' })}${field('송장 통화', 'currency', 'USD', { options: currencyOptions() })}
          ${field('본선적재일(B/L)', 'onBoardDate', '', { type: 'date' })}${field('서류 제시일', 'presentationDate', TP.today(), { type: 'date' })}
          ${field('B/L 선적항', 'portLoading', '')}${field('B/L 양륙항', 'portDischarge', '')}
          ${field('송장 가격조건', 'incoterm', 'CIF', { options: Object.keys(D.INCOTERMS).map((k) => [k, k]) })}
          ${field('분할선적 여부', 'partial', 'no', { options: [['no', '아니오'], ['yes', '예']] })}
          ${field('환적 여부', 'transhipment', 'no', { options: [['no', '아니오'], ['yes', '예']] })}
          ${field('송장 물품명세', 'goods', '', { full: true })}
          ${field('제시 서류(쉼표 구분)', 'docsPresented', 'Commercial Invoice, Packing List, B/L', { full: true })}
        </form>
      </div>
      <div id="lc-out" style="margin-top:14px"></div>
    </div>`;
  };

  function convOut() {
    const v = readForm($('#conv-form'));
    try { $('#conv-out').innerHTML = `<div class="alert info"><b>${fmt(v.amount)} ${e(v.from)} = ${fmt(E.finance.convert(v.amount, v.from, v.to, state.fx.rates), v.to === 'KRW' ? 0 : 2)} ${e(v.to)}</b></div>`; }
    catch (err) { $('#conv-out').innerHTML = `<div class="alert warn">${e(err.message)}</div>`; }
  }

  function lcOut() {
    const l = readForm($('#lc-form')); const d = readForm($('#lcdoc-form'));
    const split = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
    const r = E.finance.checkLC(
      Object.assign({}, l, { partialShipment: l.partialShipment === 'allowed', transhipment: l.transhipment === 'allowed', requiredDocs: split(l.requiredDocs) }),
      Object.assign({}, d, { partial: d.partial === 'yes', transhipment: d.transhipment === 'yes', docsPresented: split(d.docsPresented) }));
    $('#lc-out').innerHTML = `<div class="alert ${r.clean ? 'ok' : 'block'}"><b>${r.clean ? '하자(Discrepancy) 없음 — 네고 가능' : `하자 ${r.issues.length}건 — 정정 후 제시하세요`}</b></div>
      <div class="grid g2" style="margin-top:10px">
        <div>${r.issues.map((i) => `<div class="alert warn"><b>${e(i.msg)}</b><span class="detail">${e(i.rule)}</span></div>`).join('')}</div>
        <div>${r.ok.map((i) => `<div class="alert info">✓ ${e(i.msg)} <small>${e(i.rule)}</small></div>`).join('')}</div>
      </div>`;
  }

  after.finance = () => {
    convOut(); $('#conv-form').addEventListener('input', convOut);
    lcOut(); $('#lc-form').addEventListener('input', lcOut); $('#lcdoc-form').addEventListener('input', lcOut);
    $('#tt-form').addEventListener('change', (ev) => { const tt = store.get('tt', { entries: [] }); Object.assign(tt, readForm(ev.currentTarget)); store.set('tt', tt); go('finance'); });
    $('#tt-add').addEventListener('submit', (ev) => {
      ev.preventDefault(); const v = readForm(ev.target);
      if (!num(v.amount)) return toast('금액을 입력하세요');
      const tt = store.get('tt', { contract: 50000, currency: 'USD', entries: [] }); tt.entries.push(v); store.set('tt', tt); go('finance');
    });
  };

  // =====================================================================
  // 10. 설정
  // =====================================================================
  views.settings = () => {
    const s = settings();
    return `${head('설정', '회사 정보는 서류에 자동 입력되고, API 설정은 관세청·환율·추적 연동에 쓰입니다.')}
    <form id="settings-form">
    <div class="grid g2">
      <div class="card"><h2>회사(판매자) 정보</h2><div class="form">
        ${field('상호(영문)', 'seller.name', s.seller.name)}${field('담당자(영문)', 'seller.contact', s.seller.contact)}
        ${field('주소(영문)', 'seller.address', s.seller.address, { type: 'textarea', full: true })}
        ${field('전화', 'seller.tel', s.seller.tel)}${field('이메일', 'seller.email', s.seller.email)}
        ${field('사업자등록번호', 'seller.bizNo', s.seller.bizNo)}${field('무역업고유번호', 'seller.tradeNo', s.seller.tradeNo)}
      </div></div>
      <div class="card"><h2>입금 은행</h2><div class="form">
        ${field('은행명', 'bank.name', s.bank.name)}${field('SWIFT', 'bank.swift', s.bank.swift)}${field('계좌번호', 'bank.account', s.bank.account)}${field('수취인', 'bank.beneficiary', s.bank.beneficiary)}
      </div></div>
      <div class="card span2"><h2>외부 API 연동</h2><div class="form">
        ${field('API 프록시 URL (UNI-PASS·수출입은행)', 'proxyUrl', s.proxyUrl, { full: true, ph: 'https://tradepilot-proxy.yourname.workers.dev' })}
        ${field('화물추적 API 엔드포인트 (Project44·MarineTraffic 등 프록시)', 'trackingEndpoint', s.trackingEndpoint, { full: true, ph: 'https://.../track' })}
      </div>
      <ul class="plain muted" style="margin-top:10px">
        <li>관세청 UNI-PASS·한국수출입은행 API는 브라우저에서 직접 호출할 수 없고(CORS) 인증키 노출 위험이 있어 프록시를 씁니다. 저장소의 <code>proxy/cloudflare-worker.js</code>를 Cloudflare Workers에 배포하고 인증키는 비밀변수로 등록하세요.</li>
        <li>UNI-PASS 인증키: unipass.customs.go.kr → 서비스 → Open API에서 API별 신청</li>
        <li>수출입은행 환율 인증키: koreaexim.go.kr → Open API</li>
        <li>프록시가 없으면 환율은 open.er-api.com 공개 시세를, 통관 조회는 데모 데이터를 사용합니다.</li>
      </ul></div>
    </div>
    <div class="row end" style="margin-top:16px"><button class="btn primary">설정 저장</button></div>
    </form>
    <div class="card" style="margin-top:16px"><h2>참고 운임 수정 (USD, 부산 출발)</h2>
      <form id="rate-form"><div class="table-wrap"><table class="t"><thead><tr><th>권역</th><th>20GP</th><th>40GP</th><th>40HC</th><th>LCL / RT</th><th>AIR / kg</th></tr></thead><tbody>
      ${Object.entries(D.REGIONS).filter(([k]) => k !== 'KR').map(([k, n]) => `<tr><td>${e(n)}</td>${['20GP', '40GP', '40HC', 'LCL', 'AIR'].map((c) => `<td><input type="number" step="any" name="${k}.${c}" value="${D.REF_RATES[k][c]}" style="min-width:70px"></td>`).join('')}</tr>`).join('')}
      </tbody></table></div><div class="row end" style="margin-top:10px"><button type="button" class="btn" data-act="reset-rates">기본값 복원</button><button class="btn primary">운임 저장</button></div></form>
    </div>
    <div class="card" style="margin-top:16px"><h2>데이터 관리</h2>
      <div class="row"><button class="btn" data-act="backup">전체 백업(JSON)</button>
      <label class="btn">백업 불러오기<input type="file" id="restore" accept="application/json" hidden></label>
      <button class="btn" data-act="theme">화면 테마 전환</button>
      <button class="btn danger" data-act="reset-all">모든 데이터 삭제</button></div>
    </div>`;
  };

  const STORE_KEYS = ['ctx', 'settings', 'items', 'deal', 'deals', 'tt', 'rateOverrides', 'exportQuote', 'importCost'];

  after.settings = () => {
    $('#settings-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = readForm(ev.target); const s = settings();
      for (const [k, val] of Object.entries(v)) setPath(s, k, val.trim());
      store.set('settings', s);
      const d = store.get('deal', null);
      if (d) { d.seller = Object.assign({}, d.seller, s.seller); if (!d.bank || !d.bank.name) d.bank = Object.assign({}, s.bank); setDeal(d); }
      toast('저장했습니다'); loadFx();
    });
    $('#rate-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const ov = {};
      for (const [k, val] of Object.entries(readForm(ev.target))) { const [r, c] = k.split('.'); (ov[r] = ov[r] || {})[c] = num(val); }
      store.set('rateOverrides', ov); applyRateOverrides(); toast('운임을 저장했습니다');
    });
    $('#restore').addEventListener('change', async (ev) => {
      const file = ev.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        for (const k of STORE_KEYS) if (k in data) store.set(k, data[k]);
        toast('복원했습니다'); setTimeout(() => location.reload(), 600);
      } catch (err) { toast('백업 파일을 읽지 못했습니다'); }
    });
  };

  // ---------------- 전역 클릭 처리 ----------------
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-go],[data-act],[data-dir],[data-pick-hs],[data-use-hs],[data-cost-tab],[data-doc-type],[data-edit-item],[data-del-item],[data-del-row],[data-load-deal],[data-del-deal],[data-del-tt],[data-copy]');
    if (!t) return;
    const ds = t.dataset;
    if (ds.go) { ev.preventDefault(); go(ds.go); return; }
    if (ds.dir) { ctx.direction = ds.dir; saveCtx(); go('planner'); return; }
    if (ds.pickHs || ds.useHs) {
      ctx.hs = ds.pickHs || ds.useHs; ctx.category = ds.cat;
      const item = E.hs.find(ctx.hs); if (item && !ctx.keyword) ctx.keyword = item.en.split(/[,(]/)[0].trim();
      saveCtx(); if (ds.pickHs) go('planner'); else toast(`HS ${ctx.hs}를 적용했습니다`);
      return;
    }
    if (ds.costTab) { state.costTab = ds.costTab; go('cost'); return; }
    if (ds.docType) { state.docType = ds.docType; const d = getDeal(); if (/^(PI|CI|PL|SR)-/.test(d.docNo)) { d.docNo = d.docNo.replace(/^(PI|CI|PL|SR)/, ds.docType); setDeal(d); } go('docs'); return; }
    if (ds.editItem !== undefined) { editingItem = Object.assign({ _i: Number(ds.editItem) }, items()[Number(ds.editItem)]); go('items'); return; }
    if (ds.delItem !== undefined) { if (!confirm('삭제할까요?')) return; const l = items(); l.splice(Number(ds.delItem), 1); store.set('items', l); go('items'); return; }
    if (ds.delRow !== undefined) { const d = getDeal(); d.items.splice(Number(ds.delRow), 1); setDeal(d); go('docs'); return; }
    if (ds.loadDeal !== undefined) { setDeal(JSON.parse(JSON.stringify(store.get('deals', [])[Number(ds.loadDeal)]))); go('docs'); toast('불러왔습니다'); return; }
    if (ds.delDeal !== undefined) { if (!confirm('저장된 거래를 삭제할까요?')) return; const l = store.get('deals', []); l.splice(Number(ds.delDeal), 1); store.set('deals', l); go('docs'); return; }
    if (ds.delTt !== undefined) { const tt = store.get('tt', { entries: [] }); tt.entries.splice(Number(ds.delTt), 1); store.set('tt', tt); go('finance'); return; }
    if (ds.copy) { navigator.clipboard.writeText($('#' + ds.copy).textContent).then(() => toast('복사했습니다'), () => toast('복사하지 못했습니다')); return; }

    switch (ds.act) {
      case 'suggest-hs': {
        const f = $('#item-form'); const v = readForm(f);
        const c = E.hs.classify([v.nameKo, v.nameEn, v.spec, v.material, v.usage].join(' '));
        $('#hs-suggest').innerHTML = c.length ? `<div class="cand">${c.slice(0, 3).map((x) => `<button type="button" data-fill-hs="${x.hs}"><code>${x.hs}</code><span>${e(x.ko)}<br><small>${e(x.en)} · 기본세율 ${x.krDuty}%</small></span><span class="badge">${x.confidence}</span></button>`).join('')}</div>` : '<p class="muted">후보 없음 — 영문 품명·재질을 추가해 보세요.</p>';
        $$('[data-fill-hs]').forEach((b) => b.addEventListener('click', () => { f.elements.hs.value = b.dataset.fillHs; toast('HS를 입력했습니다'); }));
        break;
      }
      case 'cancel-item': editingItem = null; go('items'); break;
      case 'export-items': {
        const rows = [ITEM_FIELDS.map(([, l]) => l), ...items().map((x) => ITEM_FIELDS.map(([k]) => x[k] || ''))];
        exportRows('ItemMaster', rows); break;
      }
      case 'add-row': { const d = getDeal(); d.items.push({ description: ctx.keyword || '', hs: ctx.hs, qty: '', unit: 'PCS', unitPrice: '' }); setDeal(d); go('docs'); break; }
      case 'new-deal': if (confirm('현재 입력 중인 서류를 비우고 새로 시작할까요?')) { setDeal(defaultDeal()); go('docs'); } break;
      case 'save-deal': {
        const d = getDeal(); const l = store.get('deals', []);
        const i = l.findIndex((x) => x.docNo === d.docNo); if (i >= 0) l[i] = d; else l.push(d);
        store.set('deals', l); toast('거래를 저장했습니다'); go('docs'); break;
      }
      case 'doc-excel': exportRows(`${state.docType}_${getDeal().docNo || 'doc'}`, E.documents.toRows(state.docType, getDeal())); break;
      case 'doc-print': {
        document.body.classList.add('print-doc');
        const done = () => { document.body.classList.remove('print-doc'); window.removeEventListener('afterprint', done); };
        window.addEventListener('afterprint', done);
        window.print();
        setTimeout(done, 1500);
        break;
      }
      case 'quote-to-pi': {
        const last = eqOut.last; if (!last) break;
        const d = getDeal();
        const fob = last.q.terms.find((t) => t.term === 'FOB');
        const term = last.q.terms.find((t) => t.term === d.incoterm) || fob;
        d.currency = last.v.currency;
        if (!d.items.length) d.items.push({ description: ctx.keyword || ctx.description, hs: ctx.hs, qty: last.q.qty, unit: 'PCS', unitPrice: round(term.perUnit, 2) });
        else { d.items[0].qty = last.q.qty; d.items[0].unitPrice = round(term.perUnit, 2); }
        setDeal(d); state.docType = 'PI'; go('docs'); toast(`${term.term} 단가 ${fmt(term.perUnit, 2)}를 P/I에 넣었습니다(센트 단위 반올림)`);
        break;
      }
      case 'lc-from-deal': {
        const d = getDeal(); const c = E.documents.compute(d); const f = $('#lcdoc-form');
        f.elements.invoiceAmount.value = c.totals.total; f.elements.currency.value = d.currency; f.elements.portLoading.value = d.portLoading || '';
        f.elements.portDischarge.value = d.portDischarge || ''; f.elements.incoterm.value = d.incoterm; f.elements.onBoardDate.value = d.etd || '';
        f.elements.goods.value = (d.items || []).map((x) => x.description).join(', ');
        lcOut(); break;
      }
      case 'refresh-fx': loadFx(true); break;
      case 'reset-rates': store.set('rateOverrides', {}); toast('새로고침하면 기본 운임으로 돌아갑니다'); setTimeout(() => location.reload(), 600); break;
      case 'backup': {
        const data = {}; STORE_KEYS.forEach((k) => (data[k] = store.get(k, null)));
        download(`tradepilot-backup-${TP.today()}.json`, JSON.stringify(data, null, 2), 'application/json'); break;
      }
      case 'theme': {
        const cur = document.documentElement.dataset.theme;
        const dark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.dataset.theme = dark ? 'light' : 'dark';
        try { localStorage.setItem('tp.theme', document.documentElement.dataset.theme); } catch (err) { /* 무시 */ }
        break;
      }
      case 'reset-all':
        if (confirm('품목·거래·설정 등 이 브라우저에 저장된 모든 데이터를 삭제합니다. 계속할까요?')) {
          try { STORE_KEYS.forEach((k) => localStorage.removeItem('tp.' + k)); } catch (err) { /* 무시 */ }
          location.reload();
        }
        break;
      default: break;
    }
  });

  // ---------------- 시작 ----------------
  async function loadFx(notify) {
    state.fx = await TP.api.fetchRates();
    renderCtx();
    if (state.view === 'finance' || state.view === 'cost') go(state.view);
    if (notify) toast('환율: ' + state.fx.source);
  }

  try { const th = localStorage.getItem('tp.theme'); if (th) document.documentElement.dataset.theme = th; } catch (err) { /* 무시 */ }
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== state.view) go(v); });
  renderCtx();
  go(state.view);
  loadFx();
})();
