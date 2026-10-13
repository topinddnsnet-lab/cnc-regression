/**
 * @file 頂層 invisible 排除（6.76）、主視圖保底候選（6.76／6.77／6.79／6.80）、
 * 幾何 X 總長退路（6.78／6.79）。移植自 Python tests/unit/test_invisible_and_fallback.py
 * 與 test_geometric_x_fallback.py；合成圖面由 tools/gen_unit_fixtures.py 產生。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dxf3d } from './_sim.mjs';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
for (const k of ['log', 'warn', 'info', 'debug']) console[k] = () => {};
const { parseDxf } = await dxf3d('DxfRawParser.js');
const { getAllWcsEntities } = await dxf3d('dxfLoader.js');
const { findXDimension } = await dxf3d('holePipeline.js');
const fb = await dxf3d('frontViewFallback.js');
const { enrichWithAssessment } = await dxf3d('resultDomain.js');

const load = (name) => parseDxf(fs.readFileSync(path.join(FIX, name), 'utf8'));
const size = (over = {}) => ({ originX: 0, originY: 0, xValue: 100, yValue: 40, zValue: 3, ...over });
const circle = (d, x, y) => ({ diameter: d, cx: x, cy: y, entity: { type: 'CIRCLE', handle: 'C1', attrs: {} } });

test('頂層 invisible（group 60=1）實體不參與分析', () => {
  const { entities, blocks } = load('invisible_top_level.dxf');
  const ys = getAllWcsEntities(entities, blocks).filter((e) => e.type === 'LINE').map((e) => e.attrs[20]);
  assert.deepEqual(ys, [0]);
});

test('保底：同心群取最小徑、只取材料盒內、排除中心符號點', () => {
  const holes = fb.frontViewCircleFallback([
    circle(11.5, 20, -20), circle(5.5, 20, -20), circle(5.5, 80, -20),
    circle(5.5, 50, 30), circle(0.3, 60, -10),
  ], size());
  assert.deepEqual(holes.map((h) => [h.x, h.diameter]).sort((a, b) => a[0] - b[0]), [[20, 5.5], [80, 5.5]]);
  assert.ok(holes.every((h) => h.face === 'FRONT' && h.y === -20 && h.z === 3));
});

test('保底候選為低信心（約 0.19）、帶 fallback 警告與來源實體', () => {
  const [h] = fb.frontViewCircleFallback([circle(5.5, 20, -20)], size());
  const r = enrichWithAssessment(h);
  assert.ok(r.confidence < 0.25, `confidence=${r.confidence}`);
  assert.ok(r.assessment.warnings.some((w) => w.code === 'fallback_evidence'));
  assert.equal(h.provenance[0].sourceRefs[0].entity_handle, 'C1');
});

test('側面投影：貼下緣、長度＝牆厚、間距＝孔徑的豎線對 → 低信心 BOTTOM；中心線不配對', () => {
  const { entities } = load('edge_on_pair.dxf');
  const holes = fb.frontViewEdgeOnMarks(entities, size({ yValue: 20, zValue: 19 }));
  assert.deepEqual(holes.map((h) => [h.face, h.diameter, h.x, h.z]), [['BOTTOM', 5.5, 50, 3]]);
  assert.ok(holes[0].note.includes('FALLBACK'));
});

test('已被既有孔解釋的幾何不重複輸出（同 X、同孔徑；同心群任一圈被認領）', () => {
  const circles = [circle(11.5, 20, -20), circle(5.5, 20, -20), circle(5.5, 80, -20)];
  const existing = [{ face: 'BACK', diameter: 11.5, x: 20, y: -20 }];
  const added = fb.unclaimedFrontViewCandidates(existing, circles, [], size());
  assert.deepEqual(added.map((h) => h.x), [80]);
});

test('X 總長：只剩無材料邊支撐的短尺寸 → 改用 1000 的材料盒', () => {
  const { entities } = load('xdim_unsupported_small.dxf');
  const x = findXDimension(entities);
  assert.equal(Math.round(x.xMin * 1000) / 1000, 0);
  assert.equal(Math.round(x.value * 1000) / 1000, 1000);
});

test('X 總長：尺寸兩端有材料邊支撐時保留；單一長線不構成盒子證據', () => {
  const { entities } = load('xdim_supported_with_long_line.dxf');
  assert.equal(Math.round(findXDimension(entities).value * 1000) / 1000, 20);
});
