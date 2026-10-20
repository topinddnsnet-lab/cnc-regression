/**
 * @file 比對規則自我測試（不需要模擬器）。改 lib/match.mjs 後先跑：node tools/selftest.mjs
 */
import assert from 'node:assert/strict';
import { compareCase } from '../lib/match.mjs';

const H = (face, diameter, x, y, z, extra = {}) => ({ face, diameter, x, y, z, ...extra });
const got = (face, diameter, x, y, z, confidence = 1, status = 'accepted') => ({ face, diameter, x, y, z, confidence, status });
const cases = [];
const t = (name, fn) => cases.push([name, fn]);

t('完全相同 → 通過', () => {
  assert.equal(compareCase([H('FRONT', 7, 10, -20, 5)], [got('FRONT', 7, 10, -20, 5)]).pass, true);
});
t('Y 偏 0.2 → 通過；偏 0.3 → 失敗', () => {
  assert.equal(compareCase([H('FRONT', 7, 10, -20, 5)], [got('FRONT', 7, 10, -20.2, 5)]).pass, true);
  assert.equal(compareCase([H('FRONT', 7, 10, -20, 5)], [got('FRONT', 7, 10, -20.3, 5)]).pass, false);
});
t('孔徑、X 偏 0.3 → 失敗', () => {
  assert.equal(compareCase([H('FRONT', 7, 10, -20, 5)], [got('FRONT', 7.3, 10, -20, 5)]).pass, false);
  assert.equal(compareCase([H('FRONT', 7, 10, -20, 5)], [got('FRONT', 7, 10.3, -20, 5)]).pass, false);
});
t('Z 不同 → 仍通過，但列入 zMismatch', () => {
  const r = compareCase([H('FRONT', 7, 10, -20, 5)], [got('FRONT', 7, 10, -20, 9)]);
  assert.equal(r.pass, true);
  assert.equal(r.zMismatch.length, 1);
});
t('zCheck:false → 不報 Z', () => {
  const r = compareCase([H('FRONT', 7, 10, -20, 5, { _match: { zCheck: false } })], [got('FRONT', 7, 10, -20, 9)]);
  assert.equal(r.zMismatch.length, 0);
});
t('面向不同 → 失敗；faceAlternatives 內 → 通過', () => {
  assert.equal(compareCase([H('BACK', 7, 10, -20, 5)], [got('FRONT', 7, 10, -20, 5)]).pass, false);
  const r = compareCase([H('BACK', 7, 10, -20, 5, { _match: { faceAlternatives: ['FRONT'] } })], [got('FRONT', 7, 10, -20, 5)]);
  assert.equal(r.pass, true);
  assert.equal(r.faceAlt.length, 1);
});
t('斜孔 yzTol:5 → Y 偏 3 仍通過', () => {
  assert.equal(compareCase([H('BOTTOM', 5.5, 10, -150, 5, { _match: { yzTol: 5 } })], [got('BOTTOM', 5.5, 10, -153, 5)]).pass, true);
});
t('optional 沒抓到 → 通過', () => {
  const r = compareCase([H('BOTTOM', 20, 10, -97, 5, { _match: { optional: true } })], []);
  assert.equal(r.pass, true);
  assert.equal(r.counts.missingOptional, 1);
});
t('只多孔 → 通過並警告，不因 accepted／信心度判失敗', () => {
  for(const [confidence,status] of [[.3,'review'],[.3,'accepted'],[.6,'review']]) {
    const r=compareCase([], [got('FRONT',7,10,-20,5,confidence,status)]);
    assert.equal(r.pass,true);assert.equal(r.warnings[0].code,'extra_holes');
    assert.equal(r.warnings[0].count,1);
  }
});
t('有多孔但必要孔缺少／錯面 → 仍失敗', () => {
  const expected=[H('BACK',7,10,-20,5)];
  for(const actual of [[got('FRONT',7,10,-20,5)], [got('BACK',8,30,-20,5)]]) {
    const r=compareCase(expected,actual);
    assert.equal(r.pass,false);assert.equal(r.counts.missing,1);
    assert.equal(r.warnings[0].count,1);
  }
});
t('knownFail 缺孔 → knownFailOnly；未標記 → 一般失敗', () => {
  const kf = { _match: { knownFail: { since: '2026-10-13', reason: 'test' } } };
  const a = compareCase([H('FRONT', 7, 10, -20, 5, kf)], [got('FRONT', 7, 10, -20.3, 5)]);
  assert.equal(a.pass, false); assert.equal(a.knownFailOnly, true);
  const b = compareCase([H('FRONT', 7, 10, -20, 5)], [got('FRONT', 7, 10, -20.3, 5)]);
  assert.equal(b.knownFailOnly, false);
});
t('一對一配對：兩顆同位置答案不可共用一顆輸出', () => {
  const r = compareCase([H('FRONT', 7, 10, -20, 5), H('FRONT', 7, 10, -20, 5)], [got('FRONT', 7, 10, -20, 5)]);
  assert.equal(r.counts.missing, 1);
});
t('缺孔附最接近候選差值', () => {
  const r = compareCase([H('FRONT', 7, 10, -20, 5)], [got('FRONT', 7, 10.1, -20.4, 5)]);
  assert.equal(r.missing[0].nearest.delta.y, -0.4);
});

let fail = 0;
for (const [name, fn] of cases) {
  try { fn(); console.log(`✓ ${name}`); } catch (e) { fail++; console.log(`✗ ${name}\n  ${e.message}`); }
}
console.log(fail ? `${fail} 項失敗` : `全部 ${cases.length} 項通過`);
process.exit(fail ? 1 : 0);
