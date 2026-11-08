/*
 * 바이어 발굴 엔진: 품목·HS·국가로 검색 경로와 콜드메일 초안을 만듭니다.
 */
(function (root) {
  'use strict';
  const TP = root.TP;

  const COUNTRY_EN = {
    US: 'USA', CN: 'China', JP: 'Japan', VN: 'Vietnam', DE: 'Germany', FR: 'France', GB: 'United Kingdom', SG: 'Singapore',
    TH: 'Thailand', ID: 'Indonesia', MY: 'Malaysia', PH: 'Philippines', IN: 'India', AU: 'Australia', CA: 'Canada',
    AE: 'UAE', SA: 'Saudi Arabia', MX: 'Mexico', BR: 'Brazil', TW: 'Taiwan', HK: 'Hong Kong', KR: 'Korea',
  };

  function plan({ keyword, hs, country, category }) {
    const q = String(keyword || '').trim();
    const hs6 = String(hs || '').replace(/\D/g, '').slice(0, 6);
    const countryEn = COUNTRY_EN[country] || '';
    const fill = (s) => s
      .replace(/\{q\}/g, encodeURIComponent(q)).replace(/\{hs\}/g, hs6).replace(/\{hs4\}/g, hs6.slice(0, 4))
      .replace(/\{country\}/g, encodeURIComponent(countryEn));
    const fillText = (s) => s.replace(/\{q\}/g, q).replace(/\{hs\}/g, hs6 || '(HS)').replace(/\{hs4\}/g, hs6.slice(0, 4) || '(HS4)').replace(/\{country\}/g, countryEn);

    const channels = TP.data.BUYER_CHANNELS
      .filter((c) => country === 'US' || !/ImportYeti/.test(c.name))
      .map((c) => ({ ...c, url: fill(c.url), how: fillText(c.how) }));
    const c = TP.data.COUNTRIES[country];
    const kotra = c && c.kotra && c.kotra.length ? c.kotra.map((city) => `KOTRA ${city} 무역관`) : [];
    return {
      channels, kotra,
      fairs: TP.data.FAIRS[category] || TP.data.FAIRS.general,
      steps: TP.data.OUTREACH_STEPS,
      searchTerms: q ? [`${q} importer ${countryEn}`, `${q} distributor ${countryEn}`, `${q} wholesaler ${countryEn}`, `Korean ${q} buyer ${countryEn}`] : [],
    };
  }

  function coldEmail({ product, company, sender, title, buyerCompany, buyerName, country, moq, leadTime, incoterm, usp }) {
    const name = buyerName ? `Dear ${buyerName},` : 'Dear Purchasing Manager,';
    const subject = `Korean ${product || 'product'} supplier – ${usp ? usp.split(/[,.]/)[0] : 'proposal'} for ${buyerCompany || (COUNTRY_EN[country] || 'your market')}`;
    const body = `${name}

My name is ${sender || '[Your name]'}, ${title || 'Export Manager'} at ${company || '[Company]'}, a manufacturer/exporter of ${product || '[product]'} based in Korea.

I noticed that ${buyerCompany || 'your company'} distributes products in this category${country ? ' in ' + (COUNTRY_EN[country] || country) : ''}, and I believe our line could be a good fit for your portfolio.

${usp ? '• ' + usp.split(/\n|;/).map((s) => s.trim()).filter(Boolean).join('\n• ') + '\n' : ''}• MOQ: ${moq || '[MOQ]'}
• Lead time: ${leadTime || '[lead time]'}
• Terms: ${incoterm || 'FOB Busan'} (CIF/DDP quotations available)

Would you be open to a short call next week, or may I send our catalog and price list? We can also ship samples for your evaluation.

Best regards,
${sender || '[Your name]'}
${title || 'Export Manager'} | ${company || '[Company]'}
[Phone] | [Email] | [Website]`;
    const followUp = `Subject: Re: ${subject}

${name}

I'm following up on my previous email about ${product || 'our products'}. I'd be happy to send free samples or a short product video so you can evaluate the quality.

Is there someone else on your team I should contact regarding new suppliers?

Best regards,
${sender || '[Your name]'}`;
    return { subject, body, followUp };
  }

  TP.engine.buyers = { plan, coldEmail, COUNTRY_EN };
})(typeof globalThis !== 'undefined' ? globalThis : this);
