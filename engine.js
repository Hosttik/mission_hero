// Mission Hero — deterministic, dependency-free game engine.
export const SAVE_KEY = 'mission-hero-v1';
export const LOCATIONS = [
  { id:'home', icon:'◎', color:'#49d6fd', ru:'Домашняя орбита', en:'Home Orbit' },
  { id:'asteroids', icon:'✦', color:'#fba96c', ru:'Пояс астероидов', en:'Asteroid Belt' },
  { id:'nebula', icon:'◈', color:'#a88cf5', ru:'Туманность', en:'Nebula' },
  { id:'planet', icon:'●', color:'#64e7b2', ru:'Загадочная планета', en:'Mystery Planet' }
];
export const EVENTS = [
  {id:'meteor', icon:'☄', type:'physical', where:'asteroids', title:{ru:'Метеоритный дождь!',en:'Meteor Shower!'}, intro:{ru:'Кораблю нужен дополнительный защитный щит!',en:'The ship needs an extra shield!'}, prop:{ru:'Положи рядом две подушки — это защитный щит. Спрячься за ним на пять секунд.',en:'Place two cushions together as a shield. Hide behind them for five seconds.'}, noProp:{ru:'Расставь руки, как большой щит, и удерживай их пять секунд.',en:'Spread your arms like a giant shield for five seconds.'}, reward:{shield:15}},
  {id:'alien', icon:'✳', type:'physical', where:'planet', title:{ru:'Инопланетный гость',en:'An Alien Visitor'}, intro:{ru:'Пришелец понимает только движения. Поздоровайся!',en:'This alien understands only movements. Say hello!'}, prop:{ru:'Выбери игрушку-переводчик и покажи ей три смешных приветствия.',en:'Pick a toy translator and show it three funny greetings.'}, noProp:{ru:'Придумай три движения для космического приветствия.',en:'Invent three movements for a space greeting.'}, reward:{energy:10}},
  {id:'crystal', icon:'◇', type:'physical', where:'nebula', title:{ru:'Энергетический кристалл',en:'Energy Crystal'}, intro:{ru:'Бортовой компьютер ищет необычный кристалл.',en:'The computer is searching for an unusual crystal.'}, prop:{ru:'Выбери безопасный небольшой предмет и объяви его кристаллом.',en:'Find a safe small object and imagine it is a crystal.'}, noProp:{ru:'Представь невидимый кристалл в ладонях и осторожно принеси его к кораблю.',en:'Imagine a crystal in your hands and carefully bring it to the ship.'}, reward:{energy:18}},
  {id:'robot', icon:'⚙', type:'physical', title:{ru:'Потерявшийся робот',en:'A Lost Robot'}, intro:{ru:'Наш робот забыл, как двигаться. Покажи ему!',en:'Our robot forgot how to move. Show it!'}, prop:{ru:'Возьми игрушку-робота и проведи её по безопасному маршруту.',en:'Take a robot toy through a safe little route.'}, noProp:{ru:'Сделай три медленных шага робота и два забавных поворота.',en:'Take three slow robot steps and make two funny turns.'}, reward:{hull:12}},
  {id:'signal', icon:'≋', type:'panel', title:{ru:'Таинственный сигнал',en:'Mystery Signal'}, intro:{ru:'Из космоса доносится мелодия. Ответим дружелюбным сигналом?',en:'A tune comes from space. Shall we send a friendly reply?'}, prop:{ru:'Нажми «Готово», чтобы ответить.',en:'Press Done to reply.'}, noProp:{ru:'Нажми «Готово», чтобы ответить.',en:'Press Done to reply.'}, reward:{shield:9}}
];
const clamp = n => Math.max(0, Math.min(100, Math.round(n)));
const randomStep = n => (Math.imul(n,1664525)+1013904223)>>>0;
const isResource = n => Number.isInteger(n)&&n>=0&&n<=100;
const isCount = n => Number.isSafeInteger(n)&&n>=0;
const isEventId = id => EVENTS.some(e=>e.id===id);
const isLocationId = id => LOCATIONS.some(l=>l.id===id);
const CRITICAL_HULL = 10;
const RESCUE_HULL = 25;
export const getEvent = id => EVENTS.find(e=>e.id===id);
export const getLocation = id => LOCATIONS.find(l=>l.id===id) || LOCATIONS[0];
export function createGame({lang='ru',minutes=0,seed=Date.now()}={}){
  return {schema:1,lang:lang==='en'?'en':'ru',minutes:[0,10,20,30].includes(minutes)?minutes:0,
    location:'home',energy:83,hull:94,shield:74,shieldsOn:false,scans:0,
    visited:['home'],seen:[],recent:[],activeEvent:null,variant:'noProp',lastPhysical:null,
    elapsed:0,status:'playing',seed:(Number(seed)>>>0)||1,emergencyLandings:0};
}
function meters(s, delta){return {...s,energy:clamp(s.energy+(delta.energy||0)),hull:clamp(s.hull+(delta.hull||0)),shield:clamp(s.shield+(delta.shield||0))};}
function rescueIfCritical(s){
  if(s.hull>CRITICAL_HULL)return s;
  // Rescue is a safe landing, not a reset: discoveries, history and the seed survive.
  return {...s,location:'home',visited:[...new Set([...s.visited,'home'])],
    hull:RESCUE_HULL,energy:Math.max(20,s.energy),shieldsOn:false,
    emergencyLandings:s.emergencyLandings+1};
}
function pick(s){
  const physicalAllowed=s.lastPhysical===null||s.elapsed-s.lastPhysical>=240000;
  let pool=EVENTS.filter(e=>physicalAllowed||e.type==='panel');
  const fresh=pool.filter(e=>!s.recent.includes(e.id));if(fresh.length)pool=fresh;
  const weighted=pool.flatMap(e=>e.where===s.location?[e,e,e]:[e]);
  const seed=randomStep(s.seed);
  return {seed,event:weighted[seed%weighted.length]};
}
export function reduceGame(s,a){
  if(!s||s.schema!==1)throw new Error('Invalid game state');
  if(s.status==='paused'&&!['RESUME','LANG'].includes(a.type))return s;
  if(s.status==='complete'&&!['LANG'].includes(a.type))return s;
  if(s.activeEvent&&!['VARIANT','RESOLVE','PAUSE','RESUME','LANG','TICK'].includes(a.type))return s;
  switch(a.type){
    case 'SCAN': return s.energy<6?s:{...meters(s,{energy:-6}),scans:s.scans+1};
    case 'RECHARGE':{
      const next=meters(s,{energy:17,shield:-3});
      return {...next,shieldsOn:s.shieldsOn&&next.shield>0};
    }
    case 'SHIELDS':return !s.shieldsOn&&s.energy<5?s:{...meters(s,{energy:s.shieldsOn?0:-5,shield:s.shieldsOn?0:8}),shieldsOn:!s.shieldsOn};
    case 'TRAVEL':{
      if(!isLocationId(a.to)||a.to===s.location||s.energy<12)return s;
      const impact=a.to==='asteroids'?6:0;
      const absorbed=s.shieldsOn?Math.min(s.shield,impact):0;
      const next=meters(s,{energy:-12,shield:-absorbed,hull:-(impact-absorbed)});
      return rescueIfCritical({...next,location:a.to,shieldsOn:s.shieldsOn&&next.shield>0,
        visited:[...new Set([...s.visited,a.to])]});
    }
    case 'EVENT':{
      const {seed,event}=pick(s);return {...s,seed,activeEvent:event.id,variant:'noProp'};
    }
    case 'VARIANT':return s.activeEvent?{...s,variant:a.value==='prop'?'prop':'noProp'}:s;
    case 'RESOLVE':{
      if(!s.activeEvent)return s;
      const event=getEvent(s.activeEvent),done=a.done===true;
      return {...(done?meters(s,event.reward):s),activeEvent:null,variant:'noProp',
        seen:done?[...new Set([...s.seen,event.id])]:s.seen,recent:[...s.recent.slice(-1),event.id],
        lastPhysical:event.type==='physical'?s.elapsed:s.lastPhysical};
    }
    case 'TICK':{
      const elapsed=s.elapsed+Math.max(0,Math.min(60000,Number(a.ms)||0));
      return {...s,elapsed,status:s.minutes>0&&elapsed>=s.minutes*60000&&!s.activeEvent?'complete':s.status};
    }
    case 'PAUSE':return {...s,status:'paused'};
    case 'RESUME':return {...s,status:'playing'};
    case 'LANG':return {...s,lang:a.lang==='en'?'en':'ru'};
    default:return s;
  }
}
export function restoreGame(raw){
  try{
    const s=JSON.parse(raw);
    if(!s||typeof s!=='object'||Array.isArray(s)||s.schema!==1)return null;
    if(!isLocationId(s.location)||!['playing','paused','complete'].includes(s.status))return null;
    if(!['ru','en'].includes(s.lang)||![0,10,20,30].includes(s.minutes))return null;
    if(!Number.isFinite(s.elapsed)||s.elapsed<0||!Number.isSafeInteger(s.elapsed))return null;
    if(['energy','hull','shield'].some(k=>!isResource(s[k])))return null;
    if(typeof s.shieldsOn!=='boolean'||!isCount(s.scans))return null;
    if(!Number.isInteger(s.seed)||s.seed<1||s.seed>0xffffffff)return null;
    if(s.activeEvent!==null&&!isEventId(s.activeEvent))return null;
    if(!['prop','noProp'].includes(s.variant))return null;
    if(s.lastPhysical!==null&&(!isCount(s.lastPhysical)||s.lastPhysical>s.elapsed))return null;
    if(!Array.isArray(s.recent)||s.recent.length>2||!s.recent.every(isEventId))return null;
    if(!Array.isArray(s.seen)||!s.seen.every(isEventId))return null;
    if(!Array.isArray(s.visited)||!s.visited.every(isLocationId)||
      !s.visited.includes('home')||!s.visited.includes(s.location))return null;
    if(s.status==='complete'&&s.activeEvent!==null)return null;
    // v0.1.0 saves have no emergencyLandings field: preserve them as zero.
    const emergencyLandings=s.emergencyLandings===undefined?0:s.emergencyLandings;
    if(!isCount(emergencyLandings))return null;
    return rescueIfCritical({...s,seen:[...new Set(s.seen)],emergencyLandings,
      shieldsOn:s.shieldsOn&&s.shield>0,status:s.status==='playing'?'paused':s.status});
  }catch{return null;}
}
