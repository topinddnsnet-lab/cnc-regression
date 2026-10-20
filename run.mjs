#!/usr/bin/env node
/**
 * @file 孔位回歸執行器（JS 版，取代 Python run_regression.py）。
 *
 * 用法（在 cnc-regression 資料夾執行）：
 *   node run.mjs                         全圖（模擬器位置見 config.mjs 的 SIM_PATH，或環境變數 CNC_SIM_PATH）
 *   node run.mjs --sim <模擬器路徑>        臨時指定模擬器（優先於 config.mjs）
 *   node run.mjs --case PYN02-L38A       單案例（可重複）
 *   node run.mjs --affected src/ai/services/dxf3d/holePipeline.js   只跑用到這些檔案的案例
 *   node run.mjs --affected-git          以模擬器 git 未提交的改動決定影響案例
 *   node run.mjs --coverage              同時收集覆蓋率（較慢）
 *   node run.mjs --accept                【限人工】全圖跑完後把結果寫成新 baseline
 *   node run.mjs --classify              全圖跑完後產生分群草稿 reports/groups.draft.json
 *   選項：--jobs N（平行數）、--timeout 秒（單案例上限）；預設值都在 config.mjs
 *
 * 輸出：reports/report.json（給 AI）、reports/report.md（給人）、reports/cases/<案例>.json（失敗或有變化的案例細節）
 * 結束碼：0＝沒有新壞；1＝有新壞或分析錯誤（無 baseline 時：有任何失敗）；2＝參數錯誤
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compareCase } from './lib/match.mjs';
import { SIM_PATH, CASE_TIMEOUT_SEC, JOBS } from './config.mjs';
import { featureSet, clusterCases, classifyCase, ubiquitousFeatures, withoutFeatures } from './lib/trace.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'fixtures', 'holes');
const BASE = path.join(HERE, 'baseline');
const REP = path.join(HERE, 'reports');
const GROUPS = path.join(HERE, 'fixtures', 'groups.json');
const CLASSIFY_THRESHOLD = 0.4;

// ---------------- 參數 ----------------
/**
 * 解析命令列參數。
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  const o = { sim: path.resolve(HERE, process.env.CNC_SIM_PATH || SIM_PATH), cases: [], affected: [], affectedGit: false,
    coverage: false, accept: false, classify: false,
    jobs: JOBS > 0 ? JOBS : Math.max(1, Math.min(os.cpus().length - 1, 8)), timeout: CASE_TIMEOUT_SEC };
  for (let i = 0; i < argv.length; i++) {
    const a = argv.at(i), next = () => argv.at(++i);
    if (a === '--sim') o.sim = path.resolve(next());
    else if (a === '--case') o.cases.push(next());
    else if (a === '--affected') { while (argv.at(i + 1) && !argv.at(i + 1).startsWith('--')) o.affected.push(next()); }
    else if (a === '--affected-git') o.affectedGit = true;
    else if (a === '--coverage') o.coverage = true;
    else if (a === '--accept') { o.accept = true; o.coverage = true; }
    else if (a === '--classify') o.classify = true;
    else if (a === '--jobs') o.jobs = Number(next());
    else if (a === '--timeout') o.timeout = Number(next());
    else if (a === '-h' || a === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); process.exit(0); }
    else { console.error(`不認得的參數：${a}`); process.exit(2); }
  }
  return o;
}

const readJson = (f, d = null) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', 'utf8'); };
const git = (cwd, args) => { try { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };

// ---------------- 案例選擇 ----------------
/**
 * 列出所有案例（含 source.dxf 與 expected.json 的子資料夾）。
 * @returns {string[]}
 */
function allCases() {
  return fs.readdirSync(FIX, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(FIX, d.name, 'source.dxf')) && fs.existsSync(path.join(FIX, d.name, 'expected.json')))
    .map((d) => d.name).sort((a, b) => a.localeCompare(b));
}

/**
 * 依覆蓋率找出受影響的案例。
 * @param {string[]} files 模擬器內的相對路徑（src/...）
 * @param {object|null} cov baseline/coverage.json
 * @returns {{cases:string[], note:string}}
 */
function affectedCases(files, cov) {
  const norm = files.map((f) => f.replace(/\\/g, '/').replace(/^\.\//, '')).filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));
  if (!cov) return { cases: allCases(), note: '沒有 baseline/coverage.json，改跑全圖（請先由人執行 --accept 建立）' };
  if (!norm.length) return { cases: [], note: '沒有改到任何 .js 檔' };
  const hit = new Set();
  const unknown = [];
  for (const f of norm) {
    let found = false;
    for (const [name, fns] of Object.entries(cov.cases)) {
      if (fns.some((fn) => fn.startsWith(`${f}#`))) { hit.add(name); found = true; }
    }
    if (!found) unknown.push(f);
  }
  const note = unknown.length ? `這些檔案在 baseline 覆蓋率中沒有任何案例用到（可能是新檔或與孔位無關）：${unknown.join(', ')}` : '';
  return { cases: [...hit].sort((a, b) => a.localeCompare(b)), note };
}

// ---------------- 執行 ----------------
/**
 * 以 worker 池平行執行案例；逾時的 worker 會被終止並重開。
 * @param {string[]} names
 * @param {object} opt
 * @returns {Promise<Map<string, object>>}
 */
async function runAll(names, opt) {
  const results = new Map();
  const queue = [...names];
  const spawn = () => new Promise((resolve) => {
    const w = new Worker(path.join(HERE, 'lib', 'worker.mjs'), { workerData: { simRoot: opt.sim, coverage: opt.coverage }, stdout: true, stderr: true });
    w.once('message', () => resolve(w));
    w.once('error', (e) => { console.error(`worker 啟動失敗：${e.message}`); process.exit(1); });
  });
  let done = 0;
  const lane = async () => {
    let w = await spawn();
    while (queue.length) {
      const name = queue.shift();
      const res = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve({ name, ok: false, ms: opt.timeout * 1000, error: `逾時（>${opt.timeout} 秒）`, timeout: true }), opt.timeout * 1000);
        const onMsg = (m) => { if (m.name === name) { clearTimeout(timer); w.off('message', onMsg); w.off('error', onErr); resolve(m); } };
        const onErr = (e) => { clearTimeout(timer); w.off('message', onMsg); resolve({ name, ok: false, ms: 0, error: `worker 崩潰：${e.message}`, crashed: true }); };
        w.on('message', onMsg);
        w.once('error', onErr);
        w.postMessage({ name, dxfPath: path.join(FIX, name, 'source.dxf') });
      });
      results.set(name, res);
      done++;
      process.stderr.write(`\r執行中 ${done}/${names.length}  `);
      if (res.timeout || res.crashed) { await w.terminate().catch(() => {}); w = await spawn(); }
    }
    await w.terminate();
  };
  await Promise.all(Array.from({ length: Math.min(opt.jobs, names.length) }, lane));
  process.stderr.write('\n');
  return results;
}

/**
 * 決策鍵對照表：位置鍵 → 決策鍵（同位置重複者加序號）。
 * @param {object[]} holes
 * @returns {Record<string,string>}
 */
function decisionMap(holes) {
  const m = {};
  for (const h of holes) {
    let k = `${String(h.face).toUpperCase()}|Ø${h.diameter}|${Number(h.x).toFixed(1)}|${Number(h.y).toFixed(1)}`;
    let n = 2;
    while (m[k] !== undefined) k = `${k.split('#')[0]}#${n++}`;
    m[k] = h.decision;
  }
  return m;
}

/**
 * 比較兩份決策對照表。
 * @param {Record<string,string>|undefined} before
 * @param {Record<string,string>} after
 * @returns {{changed:object[], added:object[], removed:object[]}}
 */
function decisionDiff(before, after) {
  const out = { changed: [], added: [], removed: [] };
  if (!before) return out;
  for (const [k, v] of Object.entries(after)) {
    if (!(k in before)) out.added.push({ hole: k, decision: v });
    else if (before[k] !== v) out.changed.push({ hole: k, before: before[k], after: v });
  }
  for (const [k, v] of Object.entries(before)) if (!(k in after)) out.removed.push({ hole: k, decision: v });
  return out;
}

// ---------------- 主流程 ----------------
const opt = parseArgs(process.argv.slice(2));
if (!fs.existsSync(path.join(opt.sim, 'src/ai/services/dxf3d/index.js'))) {
  console.error(`找不到模擬器演算法：${opt.sim}/src/ai/services/dxf3d/index.js（請修改 config.mjs 的 SIM_PATH，或用 --sim 指定）`);
  process.exit(2);
}
const baseline = readJson(path.join(BASE, 'holes.json'));
const covBase = readJson(path.join(BASE, 'coverage.json'));
const groups = readJson(GROUPS);
const groupFeats = groups ? new Map(Object.entries(groups.features ?? {}).map(([k, v]) => [k, new Set(v)])) : null;

let selected = allCases();
let mode = 'all';
let selectNote = '';
if (opt.cases.length) {
  const missing = opt.cases.filter((c) => !selected.includes(c));
  if (missing.length) { console.error(`找不到案例：${missing.join(', ')}`); process.exit(2); }
  selected = opt.cases; mode = 'case';
} else if (opt.affected.length || opt.affectedGit) {
  let files = opt.affected.map((f) => (path.isAbsolute(f) ? path.relative(opt.sim, f) : f));
  if (opt.affectedGit) {
    const changed = git(opt.sim, ['diff', '--name-only', 'HEAD']) ?? '';
    const untracked = git(opt.sim, ['ls-files', '--others', '--exclude-standard']) ?? '';
    files = files.concat(`${changed}\n${untracked}`.split('\n').filter(Boolean));
  }
  const a = affectedCases(files, covBase);
  selected = a.cases; selectNote = a.note; mode = 'affected';
}
if (opt.accept && mode !== 'all') { console.error('--accept 只能在全圖執行時使用'); process.exit(2); }
if (opt.classify && mode !== 'all') { console.error('--classify 只能在全圖執行時使用'); process.exit(2); }

const t0 = Date.now();
const raw = selected.length ? await runAll(selected, opt) : new Map();
const caseReports = [];
const featMap = new Map();
for (const name of selected) {
  const r = raw.get(name);
  const expected = readJson(path.join(FIX, name, 'expected.json'), []);
  const before = baseline?.cases?.[name];
  if (!r.ok) {
    caseReports.push({ name, status: 'error', ms: r.ms, error: r.error, baselineStatus: before?.status ?? null });
    continue;
  }
  const cmp = compareCase(expected, r.holes);
  const status = cmp.pass ? 'pass' : cmp.knownFailOnly ? 'knownFail' : 'fail';
  const decisions = decisionMap(r.holes);
  const dd = decisionDiff(before?.decisions, decisions);
  const feat = featureSet(r);
  featMap.set(name, feat);
  caseReports.push({
    name, status, ms: r.ms, baselineStatus: before?.status ?? null,
    counts: cmp.counts, missing: cmp.missing, extraHard: cmp.extraHard, extraSoft: cmp.extraSoft,
    comparisonWarnings: cmp.warnings,
    zMismatch: cmp.zMismatch, faceAlt: cmp.faceAlt, decisionChanges: dd,
    size: r.size, unresolved: r.unresolved, warnings: r.warnings, tags: r.tags,
    group: groups ? classifyCase(withoutFeatures(feat, groups.ignoredFeatures), groups.groups, groupFeats, groups.threshold ?? CLASSIFY_THRESHOLD) : null,
    _decisions: decisions, _coverage: r.coverage, _version: r.version,
  });
}

const bad = (s) => s === 'fail' || s === 'error';
const newlyBroken = caseReports.filter((c) => c.baselineStatus && (c.baselineStatus === 'pass' ? c.status !== 'pass' : c.baselineStatus === 'knownFail' && bad(c.status)));
const newlyFixed = caseReports.filter((c) => c.baselineStatus && c.baselineStatus !== 'pass' && c.status === 'pass');
const decisionChanged = caseReports.filter((c) => c.decisionChanges && (c.decisionChanges.changed.length || c.decisionChanges.added.length || c.decisionChanges.removed.length));
const count = (s) => caseReports.filter((c) => c.status === s).length;
const simRev = git(opt.sim, ['rev-parse', '--short', 'HEAD']);
const simDirty = (git(opt.sim, ['status', '--porcelain']) ?? '').length > 0;
const exitCode = baseline
  ? (newlyBroken.length || count('error') ? 1 : 0)
  : (count('fail') || count('error') ? 1 : 0);

const summary = {
  generatedAt: new Date().toISOString(),
  mode, selectNote: selectNote || null,
  simulator: { path: opt.sim, gitRev: simRev, dirty: simDirty, pyParityVersion: caseReports.find((c) => c._version)?._version ?? null },
  baseline: baseline ? { createdAt: baseline.createdAt, gitRev: baseline.simulator?.gitRev ?? null } : null,
  tolerance: { diameter: 0.2, x: 0.2, y: 0.2, z: '只報告（±0.2）', extraHard: 'status=accepted 或 confidence≥0.5（僅分類）', extras:'多孔只警告；必要孔必須全數匹配' },
  totals: {
    cases: caseReports.length, pass: count('pass'), fail: count('fail'), knownFail: count('knownFail'), error: count('error'),
    warningCases: caseReports.filter(c=>c.comparisonWarnings?.length).length,
    zMismatchHoles: caseReports.reduce((s, c) => s + (c.counts?.zMismatch ?? 0), 0),
    seconds: Math.round((Date.now() - t0) / 100) / 10,
  },
  exitCode,
  newlyBroken: newlyBroken.map((c) => c.name),
  newlyFixed: newlyFixed.map((c) => c.name),
  decisionChanged: decisionChanged.map((c) => c.name),
};
if (mode !== 'all') summary.hint = '這是部分執行；修改確認前請再跑一次全圖：node run.mjs';

// 給 AI 的報告：每案例精簡，細節放 cases/<名稱>.json
const strip = ({ _decisions, _coverage, _version, ...rest }) => rest;
const compact = (c) => ({
  name: c.name, status: c.status, baselineStatus: c.baselineStatus, ms: c.ms, counts: c.counts, group: c.group,
  ...(c.status === 'error' ? { error: c.error } : {}),
  ...(c.missing?.length ? { missing: c.missing } : {}),
  ...(c.extraHard?.length ? { extraHard: c.extraHard } : {}),
  ...(c.comparisonWarnings?.length ? { comparisonWarnings:c.comparisonWarnings } : {}),
  ...(c.decisionChanges && (c.decisionChanges.changed.length + c.decisionChanges.added.length + c.decisionChanges.removed.length)
    ? { decisionChanges: c.decisionChanges } : {}),
});
fs.rmSync(path.join(REP, 'cases'), { recursive: true, force: true });
writeJson(path.join(REP, 'report.json'), { ...summary, cases: caseReports.map(compact) });
for (const c of caseReports) {
  if (c.status !== 'pass' || c.comparisonWarnings?.length || c.counts?.zMismatch || decisionChanged.includes(c)) writeJson(path.join(REP, 'cases', `${c.name}.json`), strip(c));
}
fs.writeFileSync(path.join(REP, 'report.md'), renderMarkdown(summary, caseReports), 'utf8');

if (opt.classify) {
  const ignored = ubiquitousFeatures(featMap);
  const feats = new Map([...featMap].map(([k, v]) => [k, withoutFeatures(v, ignored)]));
  const draft = clusterCases(feats, CLASSIFY_THRESHOLD);
  writeJson(path.join(REP, 'groups.draft.json'), {
    threshold: CLASSIFY_THRESHOLD,
    ignoredFeatures: ignored,
    說明: '自動分群草稿。請替每群填 name 後另存為 fixtures/groups.json（features 一併保留，供新案例歸類）。',
    groups: draft.map((g) => ({ ...g, name: '' })),
    features: Object.fromEntries([...feats].map(([k, v]) => [k, [...v].sort()])),
  });
  console.log(`分群草稿：reports/groups.draft.json（${draft.length} 群）`);
}

if (opt.accept) {
  if (count('error')) { console.error('有分析錯誤，拒絕寫入 baseline'); process.exit(1); }
  writeJson(path.join(BASE, 'holes.json'), {
    createdAt: summary.generatedAt, simulator: summary.simulator,
    cases: Object.fromEntries(caseReports.map((c) => [c.name, { status: c.status, counts: c.counts, decisions: c._decisions }])),
  });
  writeJson(path.join(BASE, 'coverage.json'), {
    createdAt: summary.generatedAt, simulator: summary.simulator,
    cases: Object.fromEntries(caseReports.map((c) => [c.name, (c._coverage ?? []).sort()])),
  });
  console.log('已寫入 baseline/holes.json 與 baseline/coverage.json');
}

console.log(`通過 ${summary.totals.pass}／失敗 ${summary.totals.fail}／已知失敗 ${summary.totals.knownFail}／錯誤 ${summary.totals.error}`
  + `（共 ${summary.totals.cases} 案，${summary.totals.seconds} 秒）`);
if (baseline) console.log(`新壞 ${newlyBroken.length}：${summary.newlyBroken.join(', ') || '無'}；新修好 ${newlyFixed.length}：${summary.newlyFixed.join(', ') || '無'}；決策有變 ${decisionChanged.length}`);
else console.log('尚無 baseline：人工確認結果後執行 node run.mjs --accept');
if (selectNote) console.log(selectNote);
console.log('報告：reports/report.json、reports/report.md');
console.log(`多孔警告 ${summary.totals.warningCases} 案（不影響通過；必要孔缺少或錯面仍失敗）`);
process.exit(opt.accept ? 0 : exitCode);

/**
 * 產生給人看的 Markdown 報告（只列變化與失敗）。
 * @param {object} s 摘要
 * @param {object[]} cases 案例報告
 * @returns {string}
 */
function renderMarkdown(s, cases) {
  const L = [];
  const t = s.totals;
  L.push('# 孔位回歸報告', '');
  L.push(`- 時間：${s.generatedAt}　模式：${s.mode}　模擬器：${s.simulator.gitRev ?? '(無 git)'}${s.simulator.dirty ? '（有未提交改動）' : ''}`);
  L.push(`- 結果：通過 ${t.pass}、失敗 ${t.fail}、已知失敗 ${t.knownFail}、錯誤 ${t.error}（共 ${t.cases} 案，${t.seconds} 秒）`);
  L.push(`- Z 不符（只報告）：${t.zMismatchHoles} 顆`);
  L.push(`- 多孔警告：${t.warningCases} 案；多孔不判失敗，必要孔仍須全部匹配。`);
  if (s.baseline) L.push(`- 對照 baseline（${s.baseline.createdAt}）：新壞 ${s.newlyBroken.length}、新修好 ${s.newlyFixed.length}、決策有變 ${s.decisionChanged.length}`);
  else L.push('- 尚無 baseline');
  if (s.selectNote) L.push(`- 注意：${s.selectNote}`);
  if (s.hint) L.push(`- ${s.hint}`);
  L.push('');
  const fmtH = (h) => `${h.face} Ø${h.diameter} (${h.x}, ${h.y}${h.z != null ? `, z ${h.z}` : ''})`;
  const sect = (title, list) => { if (list.length) { L.push(`## ${title}`, ''); list.forEach((c) => detail(c)); } };
  const detail = (c) => {
    L.push(`### ${c.name}　${c.status}${c.baselineStatus ? `（baseline：${c.baselineStatus}）` : ''}${c.group?.name ? `　群組：${c.group.name}` : ''}`, '');
    if (c.status === 'error') { L.push('```', c.error, '```', ''); return; }
    const cap = (list, fn) => { list.slice(0, 12).forEach(fn); if (list.length > 12) L.push(`- …還有 ${list.length - 12} 筆，詳見 reports/cases/${c.name}.json`); };
    for(const w of c.comparisonWarnings ?? []) L.push(`- ⚠ ${w.message}`);
    cap(c.missing ?? [], (m) => {
      const n = m.nearest;
      const near = n ? `；最接近：${n.face} Δx ${n.delta.x}、Δy ${n.delta.y}、ΔØ ${n.delta.diameter}（信心 ${n.confidence ?? '-'}）` : '；附近沒有候選';
      L.push(`- 缺：${fmtH(m.expected)}${m.optional ? '（可選）' : ''}${m.knownFail ? `（已知：${m.knownFail.reason}）` : ''}${near}`);
    });
    cap(c.extraHard ?? [], (e) => L.push(`- 多出：${fmtH(e)}　信心 ${e.confidence}　${e.status}　規則 ${e.decision ?? '-'}`));
    cap(c.extraSoft ?? [], (e) => L.push(`- 多出低信心：${fmtH(e)}　信心 ${e.confidence}　${e.status}`));
    const dc = c.decisionChanges;
    if (dc) {
      cap(dc.changed, (x) => L.push(`- 決策變更：${x.hole}　${x.before} → ${x.after}`));
      cap(dc.added, (x) => L.push(`- 新增孔：${x.hole}　${x.decision}`));
      cap(dc.removed, (x) => L.push(`- 消失孔：${x.hole}　${x.decision}`));
    }
    L.push('');
  };
  sect('新壞', cases.filter((c) => s.newlyBroken.includes(c.name)));
  sect('失敗與錯誤', cases.filter((c) => (c.status === 'fail' || c.status === 'error') && !s.newlyBroken.includes(c.name)));
  sect('已知失敗', cases.filter((c) => c.status === 'knownFail' && !s.newlyBroken.includes(c.name)));
  sect('新修好', cases.filter((c) => s.newlyFixed.includes(c.name)));
  sect('通過但有多孔警告', cases.filter(c=>c.status==='pass' && c.comparisonWarnings?.length));
  sect('通過但決策有變', cases.filter((c) => c.status === 'pass' && s.decisionChanged.includes(c.name) && !s.newlyFixed.includes(c.name)));
  const z = cases.filter((c) => c.zMismatch?.length);
  if (z.length) {
    L.push('## Z 不符（只報告）', '', '| 案例 | 孔 | 答案 Z | 輸出 Z |', '| --- | --- | --- | --- |');
    for (const c of z) for (const m of c.zMismatch) L.push(`| ${c.name} | ${m.face} Ø${m.diameter} (${m.x}, ${m.y}) | ${m.expectedZ} | ${m.actualZ} |`);
    L.push('');
  }
  const label = { pass: '通過', fail: '失敗', knownFail: '已知失敗', error: '錯誤' };
  L.push('## 全部案例', '', '| 案例 | 結果 | 答案／輸出孔數 | 群組（相似度） | 耗時 ms |', '| --- | --- | --- | --- | --- |');
  for (const c of cases) {
    const g = c.group ? `${c.group.isNew ? '新型態？' : ''}${c.group.name || c.group.group || '-'}（${c.group.similarity}）` : '-';
    const warning=c.comparisonWarnings?.length?' ⚠ 多孔警告':'';
    L.push(`| ${c.name} | ${label[c.status] ?? c.status}${warning} | ${c.counts ? `${c.counts.expected}／${c.counts.actual}` : '-'} | ${g} | ${c.ms ?? '-'} |`);
  }
  L.push('');
  return L.join('\n');
}
