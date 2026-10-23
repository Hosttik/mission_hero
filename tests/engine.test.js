import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, restoreGame, reduceGame, EVENTS, LOCATIONS } from '../engine.js';

test('game creates independent valid state', () => {
  const start = createGame({ lang:'ru', minutes:10, seed:42 });
  assert.equal(start.status,'playing');
  assert.equal(start.location,'home');
  assert.equal(start.energy,83);
  assert.equal(LOCATIONS.length,4);
});

test('travel updates location and consumes energy, asteroid field has recoverable risk', () => {
  const before = createGame({seed:11});
  const after = reduceGame(before,{type:'TRAVEL',to:'asteroids'});
  assert.equal(after.location,'asteroids');
  assert.equal(after.energy,71);
  assert.equal(after.hull,88);
  assert.equal(before.location,'home');
});

test('event skip is always consequence-free', () => {
  let game = reduceGame(createGame({seed:4}),{type:'EVENT'});
  const before = [game.energy,game.hull,game.shield];
  game = reduceGame(game,{type:'RESOLVE',done:false});
  assert.deepEqual([game.energy,game.hull,game.shield],before);
  assert.equal(game.activeEvent,null);
});

test('actions do not let resources overflow or underflow', () => {
  let game=createGame();
  for(let i=0;i<40;i++)game=reduceGame(game,{type:'RECHARGE'});
  assert.equal(game.energy,100);
  assert.equal(game.shield,0);
});

test('encounters are deterministic and locations have varied content', () => {
  const a=reduceGame(createGame({seed:222}),{type:'EVENT'});
  const b=reduceGame(createGame({seed:222}),{type:'EVENT'});
  assert.equal(a.activeEvent,b.activeEvent);
  assert.equal(EVENTS.length,5);
});

test('a physical encounter activates cooldown while panel encounters remain possible', () => {
  let game=createGame({seed:1});
  for(let i=0;i<25;i++){
    game=reduceGame(game,{type:'EVENT'});
    if(EVENTS.find(e=>e.id===game.activeEvent).type==='physical')break;
    game=reduceGame(game,{type:'RESOLVE',done:false});
  }
  assert.equal(EVENTS.find(e=>e.id===game.activeEvent).type,'physical');
  game=reduceGame(game,{type:'RESOLVE',done:false});
  game=reduceGame(game,{type:'EVENT'});
  assert.equal(EVENTS.find(e=>e.id===game.activeEvent).type,'panel');
});

test('session timeout never interrupts current encounter', () => {
  let game=createGame({minutes:10,seed:2});
  game=reduceGame(game,{type:'EVENT'});
  for(let i=0;i<10;i++)game=reduceGame(game,{type:'TICK',ms:60000});
  assert.equal(game.status,'playing');
  game=reduceGame(game,{type:'RESOLVE',done:false});
  game=reduceGame(game,{type:'TICK',ms:1000});
  assert.equal(game.status,'complete');
});

test('saved state resumes paused; damaged or unknown state is ignored', () => {
  const game=createGame({seed:10});
  assert.equal(restoreGame(JSON.stringify(game)).status,'paused');
  assert.equal(restoreGame('not json'),null);
  assert.equal(restoreGame(JSON.stringify({...game,schema:99})),null);
  assert.equal(restoreGame(JSON.stringify({...game,energy:-10})),null);
});

test('pause freezes time and navigation until resume', () => {
  const paused=reduceGame(createGame(),{type:'PAUSE'});
  assert.deepEqual(reduceGame(paused,{type:'TICK',ms:1000}),paused);
  assert.equal(reduceGame(paused,{type:'TRAVEL',to:'nebula'}).location,'home');
  assert.equal(reduceGame(paused,{type:'RESUME'}).status,'playing');
});
