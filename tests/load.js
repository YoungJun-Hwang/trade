// 브라우저용 스크립트들을 Node에서 순서대로 불러옵니다.
const path = require('path');
const files = [
  'core.js', 'data/categories.js', 'data/hs.js', 'data/countries.js', 'data/logistics.js', 'data/buyers.js',
  'engine/hs.js', 'engine/cost.js', 'engine/compliance.js', 'engine/finance.js', 'engine/tracking.js',
  'engine/documents.js', 'engine/buyers.js',
];
for (const f of files) require(path.join(__dirname, '..', 'js', f));
module.exports = globalThis.TP;
