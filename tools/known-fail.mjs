/**
 * @file 【限人工】把最近一次報告中某案例的「缺孔」標成已知失敗（寫入 expected.json 的 `_match.knownFail`）。
 * AI 不得執行本工具（見 AI操作指引.md）。
 *
 * 用法：
 *   node tools/known-fail.mjs <案例名> "<原因>"     標記
 *   node tools/known-fail.mjs <案例名> --clear      清除該案例全部 knownFail
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [name, reason] = process.argv.slice(2);
if (!name || !reason) { console.error('用法：node tools/known-fail.mjs <案例名> "<原因>" | --clear'); process.exit(2); }
const file = path.join(HERE, 'fixtures', 'holes', name, 'expected.json');
if (!fs.existsSync(file)) { console.error(`找不到 ${file}`); process.exit(2); }
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));

if (reason === '--clear') {
  for (const r of rows) if (r._match) { delete r._match.knownFail; if (!Object.keys(r._match).length) delete r._match; }
} else {
  const rep = JSON.parse(fs.readFileSync(path.join(HERE, 'reports', 'report.json'), 'utf8'));
  const c = rep.cases.find((x) => x.name === name);
  if (!c?.missing?.length) { console.error('最近一次報告中，這個案例沒有缺孔可標記'); process.exit(1); }
  const since = new Date().toISOString().slice(0, 10);
  for (const m of c.missing) {
    const r = rows.at(m.expectedIndex);
    r._match = { ...(r._match ?? {}), knownFail: { since, reason } };
    console.log(`標記：${r.face} Ø${r.diameter} (${r.x}, ${r.y})`);
  }
}
fs.writeFileSync(file, JSON.stringify(rows, null, 2) + '\n', 'utf8');
console.log('完成；請重跑 node run.mjs 確認');
