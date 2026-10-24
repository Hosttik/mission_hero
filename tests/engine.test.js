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

test('powered shields absorb asteroid damage and spend their charge', () => {
  const start=createGame({seed:9});
  const powered=reduceGame(start,{type:'SHIELDS'});
  assert.equal(powered.shieldsOn,true);
  assert.equal(powered.energy,78);
  assert.equal(powered.shield,82);
  const travelled=reduceGame(powered,{type:'TRAVEL',to:'asteroids'});
  assert.equal(travelled.energy,66);
  assert.equal(travelled.shield,76);
  assert.equal(travelled.hull,start.hull);
  assert.equal(start.shield,74,'actions do not mutate their input');
});

test('depleted shield allows only the uncovered damage through and switches off', () => {
  let s={...createGame({seed:8}),shield:2,shieldsOn:true};
  s=reduceGame(s,{type:'TRAVEL',to:'asteroids'});
  assert.equal(s.shield,0);
  assert.equal(s.shieldsOn,false);
  assert.equal(s.hull,90);
  assert.equal(s.energy,71);
});

test('reactor remains available at zero energy and powers down an empty shield', () => {
  const before={...createGame(),energy:0,shield:2,shieldsOn:true};
  const after=reduceGame(before,{type:'RECHARGE'});
  assert.equal(after.energy,17);
  assert.equal(after.shield,0);
  assert.equal(after.shieldsOn,false);
  assert.equal(reduceGame(after,{type:'TRAVEL',to:'nebula'}).location,'nebula');
});

test('critical hull triggers a safe emergency landing without losing progress', () => {
  const before={...createGame({seed:123}),location:'nebula',visited:['home','nebula'],
    hull:11,energy:12,seen:['robot'],scans:5};
  const after=reduceGame(before,{type:'TRAVEL',to:'asteroids'});
  assert.equal(after.location,'home');
  assert.equal(after.hull,25);
  assert.equal(after.energy,20);
  assert.equal(after.emergencyLandings,1);
  assert.equal(after.shieldsOn,false);
  assert.deepEqual(after.visited,['home','nebula','asteroids']);
  assert.deepEqual(after.seen,['robot']);
  assert.equal(after.scans,5);
  assert.equal(after.seed,123);
  assert.equal(before.hull,11);
  assert.equal(reduceGame(after,{type:'TRAVEL',to:'planet'}).location,'planet');
});

test('legacy v0.1.0 save remains readable and an in-progress mission is preserved', () => {
  const {emergencyLandings:unused,...legacy}=createGame({seed:222,minutes:20});
  const saved={...legacy,status:'playing',location:'planet',visited:['home','planet'],
    activeEvent:'alien',variant:'prop',elapsed:145000,lastPhysical:120000};
  const restored=restoreGame(JSON.stringify(saved));
  assert.equal(restored.status,'paused');
  assert.equal(restored.activeEvent,'alien');
  assert.equal(restored.variant,'prop');
  assert.equal(restored.location,'planet');
  assert.equal(restored.emergencyLandings,0);
  const resumed=reduceGame(restored,{type:'RESUME'});
  assert.equal(resumed.activeEvent,'alien');
  assert.equal(resumed.elapsed,145000);
});

test('legacy critical-hull saves are safely rescued rather than discarded', () => {
  const {emergencyLandings:unused,...legacy}=createGame({seed:7});
  const restored=restoreGame(JSON.stringify({...legacy,location:'asteroids',
    visited:['home','asteroids'],hull:0,energy:0,seen:['crystal']}));
  assert.equal(restored.status,'paused');
  assert.equal(restored.location,'home');
  assert.equal(restored.hull,25);
  assert.equal(restored.energy,20);
  assert.deepEqual(restored.seen,['crystal']);
  assert.equal(restored.emergencyLandings,1);
});

test('corrupt saved gameplay fields are rejected, not interpreted as valid actions', () => {
  const baseline=createGame({seed:7});
  const invalid=[
    {lang:'xx'}, {seed:'7'}, {seed:Infinity}, {seed:0}, {seed:2**33},
    {scans:-1}, {scans:'1'}, {shieldsOn:'yes'}, {energy:3.5},
    {elapsed:-1}, {elapsed:1.5}, {lastPhysical:1},
    {activeEvent:'missing'}, {variant:'invalid'}, {visited:['nebula']},
    {visited:['home','unknown']}, {recent:['unknown']}, {recent:['robot','robot','robot']},
    {seen:['missing']}, {emergencyLandings:-1}, {status:'complete',activeEvent:'alien'},
  ];
  for(const change of invalid){
    const restored=restoreGame(JSON.stringify({...baseline,...change}));
    assert.equal(restored,null,JSON.stringify(change));
  }
});

test('repeated discoveries stay unique across saves, random sequence stays repeatable', () => {
  const a=createGame({seed:42}), b=createGame({seed:42});
  function simulate(start){
    let state=start;
    const order=[];
    for(let i=0;i<15;i++){
      state=reduceGame(state,{type:'EVENT'});
      order.push(state.activeEvent);
      state=reduceGame(state,{type:'RESOLVE',done:true});
    }
    return {state,order};
  }
  const first=simulate(a),second=simulate(b);
  assert.deepEqual(first,second);
  assert.equal(first.state.seen.length,new Set(first.state.seen).size);
  assert.ok(first.state.seen.length<=EVENTS.length);
  assert.equal(restoreGame(JSON.stringify(first.state)).seen.length,first.state.seen.length);
});

test('restored seed resumes the same event sequence after pausing', () => {
  let live=reduceGame(createGame({seed:932}),{type:'EVENT'});
  const paused=restoreGame(JSON.stringify(live));
  assert.equal(paused.status,'paused');
  assert.equal(paused.activeEvent,live.activeEvent);
  live=reduceGame(live,{type:'RESOLVE',done:true});
  live=reduceGame(live,{type:'EVENT'});
  let resumed=reduceGame(paused,{type:'RESUME'});
  resumed=reduceGame(resumed,{type:'RESOLVE',done:true});
  resumed=reduceGame(resumed,{type:'EVENT'});
  assert.deepEqual(resumed,live);
});

test('pausing an active mission freezes time and protects it from unrelated actions', () => {
  const active=reduceGame(createGame({minutes:10,seed:3}),{type:'EVENT'});
  const paused=reduceGame(active,{type:'PAUSE'});
  assert.deepEqual(reduceGame(paused,{type:'TICK',ms:60000}),paused);
  assert.deepEqual(reduceGame(paused,{type:'RESOLVE',done:false}),paused);
  const resumed=reduceGame(paused,{type:'RESUME'});
  assert.equal(resumed.activeEvent,active.activeEvent);
  assert.deepEqual(reduceGame(resumed,{type:'TRAVEL',to:'nebula'}),resumed);
  const resolved=reduceGame(resumed,{type:'RESOLVE',done:false});
  assert.equal(resolved.activeEvent,null);
  assert.equal(resolved.elapsed,0);
});

test('all resources stay bounded through repeated travel, repairs and encounters', () => {
  let game=createGame({seed:12345});
  for(let i=0;i<500;i++){
    game=reduceGame(game,{type:'RECHARGE'});
    game=reduceGame(game,{type:'SHIELDS'});
    game=reduceGame(game,{type:'TRAVEL',to:LOCATIONS[i%LOCATIONS.length].id});
    game=reduceGame(game,{type:'SCAN'});
    game=reduceGame(game,{type:'EVENT'});
    game=reduceGame(game,{type:'RESOLVE',done:i%3!==0});
    game=reduceGame(game,{type:'TICK',ms:1000});
    for(const name of ['energy','hull','shield']){
      assert.ok(Number.isInteger(game[name])&&game[name]>=0&&game[name]<=100,name);
    }
  }
  assert.ok(restoreGame(JSON.stringify(game)));
});
