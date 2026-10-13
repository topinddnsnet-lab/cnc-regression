/**
 * @file SAT 文字 ACIS 的 REGION 輪廓解析（移植自 Python tests/unit/test_acis_sat_region.py，6.74.0）。
 * 全部用合成 SAT，不依賴任何案例圖面。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { dxf3d } from './_sim.mjs';

const { decryptDxfSatLine, parseSatRecords } = await dxf3d('acisSat.js');
const { extractRegionProfile } = await dxf3d('regionProfile.js');
const { bboxOfPoints } = await dxf3d('geometry.js');

/**
 * 產生 w×h 矩形面域的 SAT（座標全為整數）。
 * 記錄序號：0 body、1 lump、2 shell、3 face、4 loop、5-8 coedge、9-12 edge、
 * 13-16 vertex、17-20 point、21-24 straight-curve。
 * @param {number} version SAT 版本
 * @param {number} w
 * @param {number} h
 * @returns {string[]}
 */
function rectSat(version, w, h) {
  const hid = version >= 700 ? ' -1' : '';
  const pts = [[0, 0], [w, 0], [w, h], [0, h]];
  const m = (i) => ((i % 4) + 4) % 4;
  const rec = [
    `body $-1${hid} $1 $-1 $-1 #`,
    `lump $-1${hid} $-1 $2 $0 #`,
    `shell $-1${hid} $-1 $-1 $-1 $3 $-1 $1 #`,
    `face $-1${hid} $-1 $4 $2 $-1 $-1 forward single #`,
    `loop $-1${hid} $-1 $5 $3 #`,
  ];
  for (let i = 0; i < 4; i++) rec.push(`coedge $-1${hid} $${5 + m(i + 1)} $${5 + m(i - 1)} $-1 $${9 + i} forward $4 $-1 #`);
  for (let i = 0; i < 4; i++) rec.push(`edge $-1${hid} $${13 + i} $${13 + m(i + 1)} $${5 + i} $${21 + i} forward #`);
  for (let i = 0; i < 4; i++) rec.push(`vertex $-1${hid} $${9 + i} $${17 + i} #`);
  for (const [x, y] of pts) rec.push(`point $-1${hid} ${x} ${y} 0 #`);
  pts.forEach(([x, y], i) => {
    const [nx, ny] = pts[m(i + 1)];
    rec.push(`straight-curve $-1${hid} ${x} ${y} 0 ${nx - x} ${ny - y} 0 F 0 F 1 #`);
  });
  return [`${version} 25 1 0`, '8 synthetic 4 ACIS 4 NONE', '1 9.9999999999999995e-07 1e-10', ...rec];
}

/**
 * 以 REGION（只有內嵌 SAT、沒有 ACDSDATA）取輪廓 bbox。
 * @param {string[]} lines
 * @returns {object}
 */
function profileBBox(lines) {
  const profile = extractRegionProfile({ type: 'REGION', layer: '0', attrs: {}, satLines: lines });
  assert.ok(profile, 'SAT 必須解析出輪廓');
  return bboxOfPoints(profile.vertices);
}

test('舊版 SAT（<700）整數座標不可被當成 history id 吃掉', () => {
  const b = profileBBox(rectSat(400, 70, 140));
  assert.ok(Math.abs(b.width - 70) < 1e-9 && Math.abs(b.height - 140) < 1e-9, `${b.width}×${b.height}`);
});

test('SAT 7.0+ 第一個指標後的整數 history id 要略過', () => {
  const b = profileBBox(rectSat(700, 70, 140));
  assert.ok(Math.abs(b.width - 70) < 1e-9 && Math.abs(b.height - 140) < 1e-9, `${b.width}×${b.height}`);
});

test('DXF group 1 內嵌的加密 SAT 會自動解密', () => {
  const plain = rectSat(400, 30, 40);
  const encrypted = plain.map(decryptDxfSatLine);
  assert.notEqual(encrypted[0], plain[0]);
  const b = profileBBox(encrypted);
  assert.ok(Math.abs(b.width - 30) < 1e-9 && Math.abs(b.height - 40) < 1e-9);
});

test('$-1 空指標保留在指標序列中，索引與 SAB 一致', () => {
  const records = parseSatRecords(rectSat(400, 10, 10));
  const lumpPtrs = records[1].filter((t) => t.tag === 0x0c).map((t) => t.value);
  assert.deepEqual(lumpPtrs, [-1, -1, 2, 0]);
});

test('解析器從 DXF 文字收集 REGION 的 group 1/3 SAT 行', async () => {
  const { parseDxf } = await dxf3d('DxfRawParser.js');
  const sat = rectSat(400, 20, 50).map(decryptDxfSatLine);
  const body = ['0', 'SECTION', '2', 'ENTITIES', '0', 'REGION', '5', 'AB', '8', '0', '70', '1'];
  for (const line of sat) body.push('1', line);
  body.push('0', 'ENDSEC', '0', 'EOF');
  const { entities } = parseDxf(body.join('\n'));
  const region = entities.find((e) => e.type === 'REGION');
  assert.equal(region?.satLines?.length, sat.length);
  const b = bboxOfPoints(extractRegionProfile(region).vertices);
  assert.ok(Math.abs(b.width - 20) < 1e-9 && Math.abs(b.height - 50) < 1e-9);
});
