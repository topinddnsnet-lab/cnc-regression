/**
 * @module trace
 * @description 決策軌跡指紋與案例自動分類。
 *
 * - 第 2 層「圖面特徵」：從演算法既有的 `debug`／`size` 輸出歸納成標籤（不改模擬器）。
 * - 第 3 層「孔位決策鍵」：從每顆孔既有的 `note`（規則名）、`evidence`、
 *   `details.evidence_scores`（面向的證據來源）組成，不改模擬器。
 * - 分類：以「標籤 ∪ 決策規則」集合的 Jaccard 相似度做平均連結階層分群。
 *
 * 不讀答案；分類只依演算法自己的輸出。
 */

/**
 * 取規則名稱：note 的全形括號前段（括號內是個案說明，不適合當分類鍵）。
 * @param {string|null|undefined} note
 * @returns {string}
 */
export function ruleName(note) {
  return String(note ?? '').split(/[（(]/)[0].trim() || '(無規則名)';
}

/**
 * 組出一顆孔的決策鍵：規則｜證據｜面向證據來源。
 * @param {object} h 演算法輸出的孔
 * @returns {string}
 */
export function decisionKey(h) {
  const face = (h.details?.evidence_scores ?? []).find((s) => s.field === 'face');
  return [ruleName(h.note), h.evidence ?? '-', face?.selectedSource ?? '-'].join('｜');
}

/**
 * 把數量分桶，避免分類對微小數量差異過度敏感。
 * @param {number} n
 * @returns {string}
 */
const bucket = (n) => (n <= 0 ? '0' : n <= 2 ? '1-2' : n <= 5 ? '3-5' : n <= 20 ? '6-20' : n <= 50 ? '21-50' : '50+');

/**
 * 第 2 層：圖面特徵標籤。
 * @param {{debug?:object, size?:object, warnings?:any[], unresolved?:any[], holes?:object[]}} r extractSpatialHoles 的結果
 * @returns {string[]}
 */
export function drawingTags(r) {
  const d = r.debug ?? {};
  const t = new Set();
  t.add(`視圖群:${bucket(d.clusterCount ?? 0)}`);
  if ((d.detailClusterCount ?? 0) > 0) t.add('有詳圖');
  for (const s of d.detailScales ?? []) t.add(`詳圖倍率:${Math.round(Number(s.value) * 10) / 10}`);
  if ((d.sectionClusterCount ?? 0) > 0) t.add('有剖面群');
  if (d.hatchProfileUsed) t.add('剖面線斷面');
  if ((d.faceMarkerCount ?? 0) > 0) t.add('有面向標記');
  for (const s of d.secondarySections ?? []) t.add(`次要斷面:${s.role}`);
  if ((d.directViewCircleFaces ?? []).length) t.add('直視圓');
  if (d.frameExcluded) t.add('有圖框');
  if ((r.warnings ?? []).length) t.add('有警告');
  if ((r.unresolved ?? []).length) t.add('有未解孔');
  const s = r.size ?? {};
  if (s.x && s.y && s.x / Math.max(s.y, s.z ?? 0, 1) > 10) t.add('長料');
  const diam = new Set((r.holes ?? []).map((h) => h.diameter));
  t.add(`孔徑種類:${bucket(diam.size)}`);
  t.add(`孔數:${bucket((r.holes ?? []).length)}`);
  for (const h of r.holes ?? []) t.add(`面:${String(h.face).toUpperCase()}`);
  return [...t].sort();
}

/**
 * 案例的分類特徵集合：圖面標籤 ＋ 用到的決策規則。
 * @param {{tags:string[], holes:{decision:string}[]}} res worker 回傳的案例結果
 * @returns {Set<string>}
 */
export function featureSet(res) {
  const f = new Set(res.tags ?? []);
  for (const h of res.holes ?? []) f.add(`規則:${h.decision.split('｜')[0]}`);
  return f;
}

/**
 * 找出沒有鑑別力的特徵（出現在 ≥ ratio 比例的案例中），分群時忽略。
 * @param {Map<string, Set<string>>} feats
 * @param {number} [ratio=0.9]
 * @returns {string[]}
 */
export function ubiquitousFeatures(feats, ratio = 0.9) {
  const count = new Map();
  for (const f of feats.values()) for (const x of f) count.set(x, (count.get(x) ?? 0) + 1);
  return [...count].filter(([, c]) => c >= feats.size * ratio).map(([x]) => x).sort();
}

/**
 * 移除指定特徵後的新集合。
 * @param {Set<string>} feat
 * @param {string[]} ignored
 * @returns {Set<string>}
 */
export function withoutFeatures(feat, ignored) {
  const s = new Set(feat);
  for (const x of ignored ?? []) s.delete(x);
  return s;
}

/**
 * Jaccard 相似度。
 * @param {Set<string>} a
 * @param {Set<string>} b
 * @returns {number}
 */
export function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = a.size + b.size - inter;
  return uni ? inter / uni : 1;
}

/**
 * 平均連結階層分群，合併到群間平均相似度低於門檻為止。
 * @param {Map<string, Set<string>>} feats 案例名 → 特徵集合
 * @param {number} threshold 合併門檻（0~1）
 * @returns {{id:string, members:string[], signature:string[]}[]}
 */
export function clusterCases(feats, threshold) {
  const names = [...feats.keys()].sort();
  const sim = new Map();
  const S = (a, b) => {
    const k = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
    if (!sim.has(k)) sim.set(k, jaccard(feats.get(a), feats.get(b)));
    return sim.get(k);
  };
  let groups = names.map((n) => [n]);
  const avg = (g, h) => {
    let s = 0;
    for (const a of g) for (const b of h) s += S(a, b);
    return s / (g.length * h.length);
  };
  for (;;) {
    let best = null;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const v = avg(groups.at(i), groups.at(j));
        if (!best || v > best.v) best = { v, i, j };
      }
    }
    if (!best || best.v < threshold) break;
    const merged = [...groups.at(best.i), ...groups.at(best.j)].sort();
    groups = groups.filter((_, k) => k !== best.i && k !== best.j);
    groups.push(merged);
  }
  groups.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  return groups.map((members, i) => ({ id: `G${String(i + 1).padStart(2, '0')}`, members, signature: signatureOf(members, feats) }));
}

/**
 * 群組代表特徵：群內至少 80% 案例都有的特徵。
 * @param {string[]} members
 * @param {Map<string, Set<string>>} feats
 * @returns {string[]}
 */
export function signatureOf(members, feats) {
  const count = new Map();
  for (const m of members) for (const f of feats.get(m) ?? []) count.set(f, (count.get(f) ?? 0) + 1);
  return [...count].filter(([, c]) => c >= Math.ceil(members.length * 0.8)).map(([f]) => f).sort();
}

/**
 * 把一個案例歸到最相近的既有群組；低於門檻則判為新型態。
 * @param {Set<string>} feat 該案例的特徵
 * @param {{id:string, name?:string, members:string[]}[]} groups 既有群組
 * @param {Map<string, Set<string>>} feats 所有已知案例的特徵
 * @param {number} threshold 門檻
 * @returns {{group:string|null, name:string|null, similarity:number, isNew:boolean}}
 */
export function classifyCase(feat, groups, feats, threshold) {
  let best = { group: null, name: null, similarity: 0 };
  for (const g of groups) {
    const known = g.members.filter((m) => feats.has(m));
    if (!known.length) continue;
    const v = known.reduce((s, m) => s + jaccard(feat, feats.get(m)), 0) / known.length;
    if (v > best.similarity) best = { group: g.id, name: g.name ?? null, similarity: Math.round(v * 1000) / 1000 };
  }
  return { ...best, isNew: best.similarity < threshold };
}
