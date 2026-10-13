/**
 * @file JS 與 Python 參考輸出的逐孔比對（含低信心候選）。
 *
 * 用法：node tools/parity.mjs [--ref fixtures/py-reference-6.80] [--case 名稱 ...] [--sim 路徑] [--conf]
 *   --conf 也比較信心度（差超過 0.05 列出）
 *
 * 輸出：reports/parity.json、reports/parity.md
 * 判定：面向相同，且孔徑、X、Y、Z 都在 ±0.2 內，算同一顆孔。
 * 這是移植對照工具，不是回歸判定；Python 退役後參考檔保留作歷史紀錄。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SIM_PATH } from '../config.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = { ref: path.join(HERE, 'fixtures', 'py-reference-6.80'), cases: [], sim: path.resolve(HERE, process.env.CNC_SIM_PATH || SIM_PATH), conf: false };
for (let i = 0; i < args.length; i++) {
  const a = args.at(i);
  if (a === '--ref') opt.ref = path.resolve(args.at(++i));
  else if (a === '--case') opt.cases.push(args.at(++i));
  else if (a === '--sim') opt.sim = path.resolve(args.at(++i));
  else if (a === '--conf') opt.conf = true;
}

const log = console.log;
for (const k of ['log', 'warn', 'error', 'info', 'debug']) console[k] = () => {};
const { extractSpatialHoles } = await import(pathToFileURL(path.join(opt.sim, 'src/ai/services/dxf3d/index.js')).href);

const T = 0.2;
const up = (v) => String(v ?? '').toUpperCase();
const near = (a, b) => a != null && b != null && Math.abs(Number(a) - Number(b)) <= T + 1e-9;
const same = (p, j) => up(p.face) === up(j.face) && near(p.diameter, j.diameter) && near(p.x, j.x) && near(p.y, j.y)
  && ((p.z == null && j.z == null) || near(p.z, j.z));
const fmt = (h) => `${up(h.face)} Ø${h.diameter} (${h.x}, ${h.y}, z ${h.z ?? '-'}) c=${h.confidence == null ? '-' : Math.round(h.confidence * 100) / 100}`;

const names = opt.cases.length ? opt.cases : fs.readdirSync(opt.ref).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const out = [];
for (const name of names) {
  const ref = JSON.parse(fs.readFileSync(path.join(opt.ref, `${name}.json`), 'utf8'));
  const dxf = path.join(HERE, 'fixtures', 'holes', name, 'source.dxf');
  let js;
  try { js = extractSpatialHoles(fs.readFileSync(dxf, 'utf8')); } catch (e) { out.push({ name, error: `JS：${e.message}` }); continue; }
  if (!ref.ok) { out.push({ name, error: `PY：${String(ref.error).slice(-200)}` }); continue; }
  const jh = (js.holes ?? []).map((h) => ({ ...h, confidence: h.confidence ?? h.assessment?.confidence ?? null }));
  const free = new Set(jh.map((_, i) => i));
  const onlyPy = [];
  const confDiff = [];
  for (const p of ref.holes) {
    const i = [...free].find((k) => same(p, jh.at(k)));
    if (i === undefined) { onlyPy.push(p); continue; }
    free.delete(i);
    const j = jh.at(i);
    if (opt.conf && p.confidence != null && j.confidence != null && Math.abs(p.confidence - j.confidence) > 0.05) confDiff.push({ py: p, js: j });
  }
  const onlyJs = [...free].map((i) => jh.at(i));
  const sizeDiff = ['x', 'y', 'z'].filter((k) => !near(ref.size?.[k], js.size?.[k])).map((k) => `${k}: PY ${ref.size?.[k]} / JS ${js.size?.[k]}`);
  out.push({ name, equal: !onlyPy.length && !onlyJs.length && !sizeDiff.length && !confDiff.length, py: ref.holes.length, js: jh.length, sizeDiff, onlyPy, onlyJs, confDiff });
}

const eq = out.filter((o) => o.equal).length;
const L = ['# JS 與 Python 參考輸出比對', '', `- 參考：${path.relative(HERE, opt.ref)}　模擬器：${opt.sim}`, `- 完全一致 ${eq}／${out.length}`, ''];
for (const o of out.filter((x) => !x.equal)) {
  L.push(`## ${o.name}`, '');
  if (o.error) { L.push(`- 錯誤：${o.error}`, ''); continue; }
  L.push(`- 孔數 PY ${o.py}／JS ${o.js}`);
  for (const s of o.sizeDiff) L.push(`- 尺寸不同：${s}`);
  for (const h of o.onlyPy) L.push(`- 只有 PY：${fmt(h)}　${h.note ?? ''}`);
  for (const h of o.onlyJs) L.push(`- 只有 JS：${fmt(h)}　${h.note ?? ''}`);
  for (const c of o.confDiff) L.push(`- 信心不同：${fmt(c.py)} → JS ${Math.round(c.js.confidence * 100) / 100}`);
  L.push('');
}
fs.mkdirSync(path.join(HERE, 'reports'), { recursive: true });
fs.writeFileSync(path.join(HERE, 'reports', 'parity.json'), JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(path.join(HERE, 'reports', 'parity.md'), L.join('\n'));
log(`完全一致 ${eq}／${out.length}；不一致：${out.filter((o) => !o.equal).map((o) => `${o.name}(PY${o.py ?? '?'}/JS${o.js ?? '?'})`).join(', ') || '無'}`);
log('報告：reports/parity.md');
