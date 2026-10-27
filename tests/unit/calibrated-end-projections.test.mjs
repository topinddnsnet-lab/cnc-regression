import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dxf3d} from './_sim.mjs';
import {compareCase} from '../../lib/match.mjs';
const {extractSpatialHoles}=await dxf3d('index.js');
const folder=new URL('../../fixtures/holes/WBN37-A02/',import.meta.url);

test('人工校正：雙投影端面標記產生全部正背面孔，深度正確且不把缺口當孔',()=>{
  const text=fs.readFileSync(new URL('source.dxf',folder),'utf8');
  const expected=JSON.parse(fs.readFileSync(new URL('expected.json',folder),'utf8'));
  const result=extractSpatialHoles(text);
  const comparison=compareCase(expected,result.holes);
  assert(comparison.pass,JSON.stringify(comparison.missing));
  assert.equal(result.holes.length,expected.length,'No speculative TOP/BOTTOM holes from projected notches');
  assert.equal(comparison.counts.extraHard,0);
  assert.equal(comparison.counts.extraSoft,0);
  for(const want of expected) {
    const got=result.holes.find(h=>h.face===want.face&&Math.abs(h.diameter-want.diameter)<=.2
      && Math.abs(h.x-want.x)<=.2&&Math.abs(h.y-want.y)<=.2);
    assert(got);
    assert(Math.abs(got.z-want.z)<=.2,`Z mismatch: ${JSON.stringify({want,got})}`);
    assert.equal(got.evidence,'BOX QUADRANT / SECTION MARKER');
  }
});
