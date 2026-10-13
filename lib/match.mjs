/**
 * @module match
 * @description 孔位回歸比對規則（唯一一份）。
 *
 * 【公差】（2026-10-13 使用者確認）
 * - 孔徑、X、Y：±0.2
 * - Z：能抓就抓，只列入報告，不判定失敗；配對時只當成平手時的次要依據
 * - 多出候選：status 為 accepted 或信心度 ≥ 0.5 才算失敗（沿用 Python
 *   `AUTO_CHECK_CONFIDENCE_THRESHOLD`），低信心多出只列入報告
 *
 * 【答案例外規則】寫在 expected.json 每顆孔的隱藏欄位 `_match`（人看的 `note` 不參與判定）：
 * - `faceAlternatives: string[]`：這些面向也算對
 * - `yzTol: number`：Y 放寬到此公差（斜孔），Z 報告也用此公差
 * - `zCheck: false`：Z 完全不列入報告
 * - `optional: true`：沒抓到不算失敗（例如使用者標註「非正確孔位，有證據後隨時能刪除」）
 * - `knownFail: {since, reason}`：已知失敗，列入報告但不讓結束碼非 0
 *
 * 本模組只做比對，不讀檔、不呼叫演算法；答案只用來比對，絕不回流到演算法。
 */

/** 孔徑、X、Y 的標準公差（mm） */
export const FLOAT_TOL = 0.2;
/** Z 報告公差（mm） */
export const Z_TOL = 0.2;
/** 低於此信心度、且狀態不是 accepted 的多出候選，視為設計內行為 */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;
/** 找「最接近的候選」做缺孔診斷時，X 與孔徑的搜尋半徑（mm） */
const NEAR_RADIUS = 5;

const up = (v) => String(v ?? '').toUpperCase();
const num = (v) => (v == null || v === '' ? null : Number(v));
const within = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol + 1e-9;
const round = (v) => (v == null || !Number.isFinite(v) ? v : Math.round(v * 1000) / 1000);

/**
 * 取得某顆標準答案的比對規則（含預設值）。
 * @param {object} want 標準答案孔
 * @returns {{faces:string[], yTol:number, zTol:number, zCheck:boolean, optional:boolean, knownFail:(object|null)}}
 */
export function rulesOf(want) {
  const m = want?._match ?? {};
  const faces = [up(want.face), ...(m.faceAlternatives ?? []).map(up)];
  return {
    faces,
    yTol: Number.isFinite(m.yzTol) ? m.yzTol : FLOAT_TOL,
    zTol: Number.isFinite(m.yzTol) ? m.yzTol : Z_TOL,
    zCheck: m.zCheck !== false,
    optional: m.optional === true,
    knownFail: m.knownFail ?? null,
  };
}

/**
 * 把演算法輸出的孔整理成比對用的精簡紀錄。
 * @param {object} h 演算法輸出的孔
 * @param {number} index 在輸出陣列中的序號
 * @returns {{i:number, face:string, diameter:number, x:number, y:number, z:(number|null), confidence:(number|null), status:string}}
 */
export function normalizeActual(h, index) {
  return {
    i: index,
    face: up(h.face),
    diameter: num(h.diameter),
    x: num(h.x),
    y: num(h.y),
    z: num(h.z),
    confidence: num(h.confidence ?? h.assessment?.confidence),
    status: String(h.status ?? h.assessment?.status ?? ''),
  };
}

/**
 * 判斷標準孔與實際孔能否配對；可以就回傳排序用距離，否則 null。
 * Z 不是過濾條件，只以很小的權重參與距離，用來在平手時挑較接近者。
 * @param {object} want 標準答案孔
 * @param {object} got normalizeActual 後的實際孔
 * @returns {number|null}
 */
export function pairDistance(want, got) {
  const r = rulesOf(want);
  if (!r.faces.includes(got.face)) return null;
  if (!within(num(want.diameter), got.diameter, FLOAT_TOL)) return null;
  if (!within(num(want.x), got.x, FLOAT_TOL)) return null;
  if (!within(num(want.y), got.y, r.yTol)) return null;
  const dz = r.zCheck && num(want.z) != null && got.z != null ? Math.abs(num(want.z) - got.z) : 0;
  const faceCost = up(want.face) === got.face ? 0 : 0.01;
  return Math.abs(num(want.diameter) - got.diameter) + Math.abs(num(want.x) - got.x)
    + Math.abs(num(want.y) - got.y) + dz * 1e-3 + faceCost;
}

/**
 * 缺孔診斷：找出最接近的實際孔（同孔徑±5、X±5），列出各欄位差值，讓 AI／人知道「差在哪」。
 * @param {object} want 標準答案孔
 * @param {object[]} actual normalizeActual 後的全部實際孔
 * @returns {object|null}
 */
function nearestFor(want, actual) {
  let best = null;
  for (const g of actual) {
    if (!within(num(want.diameter), g.diameter, NEAR_RADIUS) || !within(num(want.x), g.x, NEAR_RADIUS)) continue;
    const d = Math.abs(num(want.x) - g.x) + Math.abs(num(want.y) - g.y) + Math.abs(num(want.diameter) - g.diameter)
      + (up(want.face) === g.face ? 0 : 10);
    if (!best || d < best.d) best = { d, g };
  }
  if (!best) return null;
  const g = best.g;
  return {
    actualIndex: g.i,
    face: g.face,
    delta: {
      diameter: round(g.diameter - num(want.diameter)),
      x: round(g.x - num(want.x)),
      y: round(g.y - num(want.y)),
      z: num(want.z) != null && g.z != null ? round(g.z - num(want.z)) : null,
    },
    faceMatches: rulesOf(want).faces.includes(g.face),
    confidence: g.confidence,
    status: g.status,
  };
}

/**
 * 比對一張圖的標準答案與演算法輸出（無序一對一配對，標準答案依面向、孔徑、X、Y 排序後逐顆挑最近者，
 * 與 Python `_match_records` 的作法相同）。
 * @param {object[]} expected expected.json 內容
 * @param {object[]} rawActual 演算法輸出的 holes
 * @returns {{
 *   pass:boolean, knownFailOnly:boolean,
 *   counts:{expected:number, actual:number, matched:number, missing:number, missingOptional:number, extraHard:number, extraSoft:number, zMismatch:number, faceAlt:number},
 *   missing:object[], extraHard:object[], extraSoft:object[], zMismatch:object[], faceAlt:object[]
 * }}
 */
export function compareCase(expected, rawActual) {
  const actual = rawActual.map(normalizeActual);
  const free = new Set(actual.map((g) => g.i));
  const order = expected.map((w, i) => i).sort((a, b) => {
    const A = expected[a], B = expected[b];
    return up(A.face).localeCompare(up(B.face)) || A.diameter - B.diameter || A.x - B.x || A.y - B.y;
  });
  const pairs = [];
  const missing = [];
  for (const ei of order) {
    const want = expected[ei];
    let best = null;
    for (const ai of free) {
      const d = pairDistance(want, actual[ai]);
      if (d != null && (!best || d < best.d)) best = { d, ai };
    }
    if (best) { free.delete(best.ai); pairs.push([ei, best.ai]); }
    else {
      const r = rulesOf(want);
      missing.push({
        expectedIndex: ei,
        expected: { face: up(want.face), diameter: want.diameter, x: want.x, y: want.y, z: want.z ?? null },
        note: want.note ?? null,
        optional: r.optional,
        knownFail: r.knownFail,
        nearest: nearestFor(want, actual),
      });
    }
  }
  const zMismatch = [];
  const faceAlt = [];
  for (const [ei, ai] of pairs) {
    const want = expected[ei], got = actual[ai], r = rulesOf(want);
    if (up(want.face) !== got.face) faceAlt.push({ expectedIndex: ei, expectedFace: up(want.face), actualFace: got.face });
    if (r.zCheck && num(want.z) != null && !within(num(want.z), got.z, r.zTol)) {
      zMismatch.push({ expectedIndex: ei, actualIndex: ai, face: got.face, diameter: got.diameter, x: got.x, y: got.y,
        expectedZ: num(want.z), actualZ: got.z, delta: got.z == null ? null : round(got.z - num(want.z)), tol: r.zTol });
    }
  }
  const extras = [...free].map((ai) => actual[ai]);
  const isHard = (g) => g.status === 'accepted' || (g.confidence ?? 1) >= LOW_CONFIDENCE_THRESHOLD;
  const brief = (g) => ({ actualIndex: g.i, face: g.face, diameter: g.diameter, x: g.x, y: g.y, z: g.z, confidence: g.confidence, status: g.status });
  const extraHard = extras.filter(isHard).map(brief);
  const extraSoft = extras.filter((g) => !isHard(g)).map(brief);
  const hardMissing = missing.filter((m) => !m.optional);
  const unexplained = hardMissing.filter((m) => !m.knownFail);
  const pass = hardMissing.length === 0 && extraHard.length === 0;
  // 只要失敗項目全部屬於 knownFail 孔，就算「已知失敗」；多出孔沒有對應的答案可標註，
  // 所以只在同一張圖也有 knownFail 缺孔時（通常是同一批孔偏移）才一併視為已知
  const anyKnown = hardMissing.some((m) => m.knownFail);
  const knownFailOnly = !pass && unexplained.length === 0 && (extraHard.length === 0 || anyKnown);
  return {
    pass,
    knownFailOnly,
    counts: {
      expected: expected.length, actual: actual.length, matched: pairs.length,
      missing: hardMissing.length, missingOptional: missing.length - hardMissing.length,
      extraHard: extraHard.length, extraSoft: extraSoft.length, zMismatch: zMismatch.length, faceAlt: faceAlt.length,
    },
    missing, extraHard, extraSoft, zMismatch, faceAlt,
  };
}
