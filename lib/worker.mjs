/**
 * @module worker
 * @description 回歸執行緒：在獨立 worker 內載入模擬器的孔位演算法，逐案例執行並回傳精簡結果。
 *
 * - 每個 worker 只載入一次演算法，處理多個案例。
 * - 演算法的 console 輸出全部靜音，避免干擾報告。
 * - 開啟 coverage 時，以 V8 精確覆蓋率（函式層級）記錄每個案例實際跑過的函式，
 *   作為「改動影響圖」（指紋第 1 層）。每案例取一次並重置計數器。
 * - 本檔不讀答案（expected.json）。
 */
import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import inspector from 'node:inspector';
import { drawingTags, decisionKey } from './trace.mjs';

for (const k of ['log', 'warn', 'error', 'info', 'debug']) console[k] = () => {};

const { simRoot, coverage } = workerData;
const srcUrl = pathToFileURL(path.join(simRoot, 'src') + path.sep).href;

let session = null;
/**
 * 呼叫 inspector 指令（Promise 包裝）。
 * @param {string} method 指令名稱
 * @param {object} [params] 參數
 * @returns {Promise<object>}
 */
const post = (method, params = {}) => new Promise((resolve, reject) =>
  session.post(method, params, (err, res) => (err ? reject(err) : resolve(res))));

if (coverage) {
  session = new inspector.Session();
  session.connect();
  await post('Profiler.enable');
  await post('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
}

const mod = await import(pathToFileURL(path.join(simRoot, 'src/ai/services/dxf3d/index.js')).href);

/**
 * 取出這個案例跑過的模擬器函式（並重置計數器）。
 * @returns {Promise<string[]>} `相對路徑#函式名@起始位移`
 */
async function takeCoverage() {
  if (!session) return [];
  const { result } = await post('Profiler.takePreciseCoverage');
  const out = [];
  for (const script of result) {
    if (!script.url.startsWith(srcUrl)) continue;
    const rel = 'src/' + decodeURIComponent(script.url.slice(srcUrl.length));
    for (const fn of script.functions) {
      if (!fn.ranges.length || fn.ranges[0].count === 0) continue;
      if (!fn.functionName) { out.push(`${rel}#`); continue; }
      out.push(`${rel}#${fn.functionName}@${fn.ranges[0].startOffset}`);
    }
  }
  return [...new Set(out)];
}

parentPort.on('message', async ({ name, dxfPath }) => {
  const t0 = performance.now();
  try {
    await takeCoverage(); // 清掉上一案例殘留的計數
    const text = fs.readFileSync(dxfPath, 'utf8');
    const r = mod.extractSpatialHoles(text);
    const ms = Math.round(performance.now() - t0);
    const cov = await takeCoverage();
    const holes = (r.holes ?? []).map((h) => ({
      face: h.face, diameter: h.diameter, x: h.x, y: h.y, z: h.z ?? null,
      confidence: h.confidence ?? h.assessment?.confidence ?? null,
      status: h.status ?? h.assessment?.status ?? null,
      note: h.note ?? null, evidence: h.evidence ?? null,
      decision: decisionKey(h),
    }));
    parentPort.postMessage({
      name, ok: true, ms, holes,
      size: r.size ?? null,
      unresolved: (r.unresolved ?? []).length,
      warnings: (r.warnings ?? []).length,
      tags: drawingTags(r),
      coverage: cov,
      version: mod.PY_PARITY_VERSION ?? null,
    });
  } catch (e) {
    parentPort.postMessage({ name, ok: false, ms: Math.round(performance.now() - t0), error: String(e?.stack ?? e).slice(0, 2000) });
  }
});
parentPort.postMessage({ ready: true });
