import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dxf3d} from './_sim.mjs';
import {compareCase} from '../../lib/match.mjs';
const {extractSpatialHoles}=await dxf3d('index.js');
const {extractProfile}=await dxf3d('../../agent/ProfileExtractor.js');
const {buildWorkpieceModel,inSection}=await dxf3d('../../features/WorkpieceModel.js');
for(const [name,z,y,scale,count] of [['PYN02A-Z18A',45,150,1/3,17],['TRA031AF-Y062',53.3,220,1,3]]) {
 test(name+'：由尺寸與陰影核對裁減斷面，保留原生圓弧與全部孔位',()=>{
  const folder=new URL('../../fixtures/holes/'+name+'/',import.meta.url);
  const text=fs.readFileSync(new URL('source.dxf',folder),'utf8');
  const expected=JSON.parse(fs.readFileSync(new URL('expected.json',folder),'utf8'));
  const r=extractSpatialHoles(text),comparison=compareCase(expected,r.holes);
  assert(comparison.pass,JSON.stringify(comparison.missing));
  assert.equal(r.holes.length,count);
  const profile=extractProfile(text,r.size,{allowScaled:true,sectionBBox:r.sectionBBox});
  assert(Math.abs(profile.width-z)<.2);assert(Math.abs(profile.height-y)<.2);
  assert(Math.abs(profile.scale-scale)<1e-6);assert(profile.arcSegments>10);
  assert(profile.croppedSection);assert.equal(profile.finishedCandidates.length,1);
  if(name==='PYN02A-Z18A') {
   assert.equal(r.holes.filter(h=>h.face==='BACK'&&h.diameter===30).length,3);
   assert.equal(r.holes.filter(h=>h.face==='BACK'&&h.diameter===22).length,2);
   const low=r.holes.find(h=>h.face==='FRONT'&&h.diameter===7&&Math.abs(h.y+92)<.1);
   assert(low);assert(low.confidence<.5);assert(low.note.includes('FALLBACK'));
  }
 });
}

test('C3N075-B001：重複內腔不能填實，原生 CIRCLE 圓腔保留',()=>{
 const folder=new URL('../../fixtures/holes/C3N075-B001/',import.meta.url);
 const text=fs.readFileSync(new URL('source.dxf',folder),'utf8');
 const r=extractSpatialHoles(text);
 const p=extractProfile(text,r.size,{allowScaled:true,sectionBBox:r.sectionBBox});
 assert.equal(p.loopCount,3);
 const m=buildWorkpieceModel({profileText:p.dxfText,length:r.size.x});
 assert.equal(inSection(m,-12,35),false,'矩形內腔不得填實');
 assert.equal(inSection(m,-32.5,13.5),false,'圓形內腔不得填實');
 assert.equal(inSection(m,-1,35),true,'材料側牆不得消失');
});
