import test from 'node:test';
import assert from 'node:assert/strict';
import {clampOverlayPosition as clamp} from '../src/lib/overlayPosition.js';
test('keeps all edges inside viewport',()=>{assert.deepEqual(clamp(-100,-50,394,574,1280,900),{x:8,y:8});assert.deepEqual(clamp(2000,2000,394,574,1280,900),{x:878,y:318});});
test('preserves arbitrary positions and handles narrow viewports',()=>{assert.deepEqual(clamp(120,75,394,574,1280,900),{x:120,y:75});assert.deepEqual(clamp(500,900,351,500,375,650),{x:16,y:142});assert.deepEqual(clamp(0,0,394,574,320,400),{x:8,y:8});});
