import test from 'node:test';
import assert from 'node:assert/strict';
import {clampOverlaySize as clamp} from '../src/lib/overlaySize.js';
import {clampOverlayPosition as place} from '../src/lib/overlayPosition.js';
test('resize supports short and tall panels within safe bounds',()=>{assert.deepEqual(clamp(400,500,1280,900),{width:400,height:500});assert.deepEqual(clamp(100,100,1280,900),{width:310,height:360});assert.deepEqual(clamp(2000,2000,1280,900),{width:1264,height:884});});
test('small screens override minimums and resizing remains reachable',()=>{const size=clamp(700,800,320,350);assert.deepEqual(size,{width:304,height:334});assert.deepEqual(place(150,100,size.width,size.height,320,350),{x:8,y:8});});
