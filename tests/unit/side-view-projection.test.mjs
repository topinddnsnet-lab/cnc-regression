/**
 * @file 側視圖：LINE＋ARC 斷面重建與正投影對齊（移植自 Python
 * tests/unit/test_side_view_line_arc_projection.py，6.74.0）。
 * 合成圖面由 tools/gen_unit_fixtures.py 產生；移植前這三張 Z 都是 0（找不到側視圖）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dxf3d } from './_sim.mjs';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
for (const k of ['log', 'warn', 'info', 'debug']) console[k] = () => {};
const { extractSpatialHoles } = await dxf3d('index.js');
const { closedLoopsFromEntities, BBox, bboxOfPoints } = await dxf3d('geometry.js');
const { frontMaterialEdgeYs, isProjectionAligned } = await dxf3d('projectionEvidence.js');

const sizeOf = (name) => extractSpatialHoles(fs.readFileSync(path.join(FIX, name), 'utf8')).size;
const near = (a, b) => Math.abs(a - b) < 1e-6;

/** 4 條 LINE＋4 個圓角 ARC 的封閉矩形（JS 實體格式） */
function filletedRect(x0, y0, w, h, r) {
  const L = (a, b) => ({ type: 'LINE', attrs: { 10: a[0], 20: a[1], 11: b[0], 21: b[1] } });
  const A = (c, s, e) => ({ type: 'ARC', attrs: { 10: c[0], 20: c[1], 40: r, 50: s, 51: e } });
  return [
    L([x0 + r, y0], [x0 + w - r, y0]), L([x0 + w, y0 + r], [x0 + w, y0 + h - r]),
    L([x0 + w - r, y0 + h], [x0 + r, y0 + h]), L([x0, y0 + h - r], [x0, y0 + r]),
    A([x0 + w - r, y0 + r], 270, 360), A([x0 + w - r, y0 + h - r], 0, 90),
    A([x0 + r, y0 + h - r], 90, 180), A([x0 + r, y0 + r], 180, 270),
  ];
}

test('ARC 折線化後圓角外框才能閉合', () => {
  const ents = filletedRect(0, 0, 70, 166, 3);
  const without = closedLoopsFromEntities(ents, 0.5).map(bboxOfPoints);
  assert.ok(!without.some((b) => near(b.width, 70)), '不含 ARC 時不應閉合');
  const withArcs = closedLoopsFromEntities(ents, 0.5, { includeArcs: true }).map(bboxOfPoints);
  assert.ok(withArcs.some((b) => near(b.width, 70) && near(b.height, 166)));
});

test('斷面只由 LINE＋ARC 構成時仍找得到側視圖', () => {
  const s = sizeOf('line_arc_side.dxf');
  assert.equal(s.y, 166); assert.equal(s.z, 70);
});

test('主視圖被附件襯條撐高（148）時，正投影對齊的側視盒（140）提供材料 Y', () => {
  const s = sizeOf('aligned_side.dxf');
  assert.equal(s.y, 140); assert.equal(s.z, 70);
});

test('開放線段薄板斷面：群集盒對齊即成立，且排除不相連的引線', () => {
  const s = sizeOf('open_profile.dxf');
  assert.equal(s.y, 40); assert.equal(s.z, 30);
});

test('正投影對齊需要上下兩緣都對齊，且盒高達主視圖 75%', () => {
  const edges = [0, 30, 140];
  assert.ok(isProjectionAligned(new BBox(0, 70, 0, 140), edges, { expectedHeight: 148 }));
  assert.ok(!isProjectionAligned(new BBox(0, 70, 0, 139), edges), '只對齊一緣不算');
  assert.ok(!isProjectionAligned(new BBox(0, 10, 0, 30), edges, { expectedHeight: 148 }), '只跨內部肋線的小盒不算');
});

test('主視圖材料水平線忽略短線', () => {
  const ents = [
    { type: 'LINE', attrs: { 10: 0, 20: 0, 11: 1000, 21: 0 } },
    { type: 'LINE', attrs: { 10: 0, 20: 50, 11: 100, 21: 50 } },
    { type: 'LWPOLYLINE', closed: true, attrs: {}, vertices: [{ x: 0, y: 10 }, { x: 1000, y: 10 }, { x: 1000, y: 20 }, { x: 0, y: 20 }] },
  ];
  assert.deepEqual(frontMaterialEdgeYs(ents, 1000), [0, 10, 20]);
  assert.equal(frontMaterialEdgeYs(ents, null).length, 0);
});

test('帶 bulge 的 LWPOLYLINE 外框包含圓弧凸出（Python get_entity_points 對齊）', async () => {
  const { bboxOfEntity } = await dxf3d('geometry.js');
  const e = { type: 'LWPOLYLINE', closed: true, attrs: {}, vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], bulges: [0, 1, 0, 0] };
  const b = bboxOfEntity(e);
  assert.ok(near(b.xMax, 15) && near(b.yMax, 10));
});
