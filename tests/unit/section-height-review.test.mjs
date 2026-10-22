import test from 'node:test';
import assert from 'node:assert/strict';
import {dxf3d} from './_sim.mjs';
const {enrichWithAssessment}=await dxf3d('resultDomain.js');
test('正視真圓由高度不同的斷面補回時保留低信心，不得被強證據升回 accepted',()=>{
  const hole={face:'FRONT',diameter:6,x:500,y:-55,z:73,
    note:'SECTION VIEW CONVERSION',evidence:'BOX QUADRANT / SECTION MARKER'};
  const normal=enrichWithAssessment(hole);
  const review=enrichWithAssessment({...hole,sectionPrimaryHeightMismatch:true});
  assert.equal(review.face,normal.face);
  assert.equal(review.x,normal.x);
  assert.equal(review.y,normal.y);
  assert.equal(review.z,normal.z);
  assert.equal(review.status,'review');
  assert(review.confidence<=.5);
  assert(review.assessment.needsReview);
  assert(review.assessment.warnings.some(w=>w.code==='section_primary_height_mismatch'));
});
