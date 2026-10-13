/**
 * @file 一次性工具：把 expected.json 裡 `note`（給人看的備註）中會影響判定的字樣，
 * 轉成隱藏欄位 `_match`。`note` 原文保留不動。
 *
 * 用法：node tools/migrate-notes.mjs [--dry]
 *
 * 對照表（依 Python run_regression.py 的既有規則＋使用者 2026-10-13 指示）：
 * - 「斜孔辨識，不要求Y、Z尺寸正確」 → `yzTol: 5`
 * - 「不要求絕對正確」               → `zCheck: false`
 * - 「答案為FRONT也沒問題」           → `faceAlternatives: ['FRONT']`
 * - 「非正確孔位…有證據後隨時能刪除」 → `optional: true`
 * 轉完請人工核對 git diff。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'holes');
const dry = process.argv.includes('--dry');

/** @type {Array<[RegExp, (m:RegExpMatchArray)=>object]>} 字樣 → _match 片段 */
const RULES = [
  [/斜孔辨識，不要求Y、Z尺寸正確/, () => ({ yzTol: 5 })],
  [/不要求絕對正確/, () => ({ zCheck: false })],
  [/答案為(FRONT|BACK|TOP|BOTTOM)也沒問題/, (m) => ({ faceAlternatives: [m[1]] })],
  [/非正確孔位.*隨時能刪除/, () => ({ optional: true })],
];

let changed = 0;
for (const name of fs.readdirSync(root).sort()) {
  const file = path.join(root, name, 'expected.json');
  if (!fs.existsSync(file)) continue;
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  let dirty = false;
  for (const row of rows) {
    const note = String(row.note ?? '');
    const patch = {};
    for (const [re, make] of RULES) {
      const m = note.match(re);
      if (m) Object.assign(patch, make(m));
    }
    if (!Object.keys(patch).length) continue;
    row._match = { ...(row._match ?? {}), ...patch };
    dirty = true;
    console.log(`${name}: ${row.face} Ø${row.diameter} (${row.x},${row.y}) ← ${JSON.stringify(patch)}`);
  }
  if (dirty) {
    changed++;
    if (!dry) fs.writeFileSync(file, JSON.stringify(rows, null, 2) + '\n', 'utf8');
  }
}
console.log(`${dry ? '[預覽] ' : ''}更新 ${changed} 個案例`);
