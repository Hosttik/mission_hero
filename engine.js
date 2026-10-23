// Mission Hero v0.1.0 — deterministic, dependency-free game engine.
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
export const getEvent = id => EVENTS.find(e=>e.id===id);
export const getLocation = id => LOCATIONS.find(l=>l.id===id) || LOCATIONS[0];
export function createGame({lang='ru',minutes=0,seed=Date.now()}={}){
  return {schema:1,lang:lang==='en'?'en':'ru',minutes:[0,10,20,30].includes(minutes)?minutes:0,
    location:'home',energy:83,hull:94,shield:74,shieldsOn:false,scans:0,
    visited:['home'],seen:[],recent:[],activeEvent:null,variant:'noProp',lastPhysical:null,
    elapsed:0,status:'playing',seed:(Number(seed)>>>0)||1};
}
function meters(s, delta){return {...s,energy:clamp(s.energy+(delta.energy||0)),hull:clamp(s.hull+(delta.hull||0)),shield:clamp(s.shield+(delta.shield||0))};}
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
  if(s.activeEvent&&!['VARIANT','RESOLVE','PAUSE','LANG','TICK'].includes(a.type))return s;
  switch(a.type){
    case 'SCAN': return s.energy<6?s:{...meters(s,{energy:-6}),scans:s.scans+1};
    case 'RECHARGE': return meters(s,{energy:17,shield:-3});
    case 'SHIELDS':return !s.shieldsOn&&s.energy<5?s:{...meters(s,{energy:s.shieldsOn?0:-5,shield:s.shieldsOn?0:8}),shieldsOn:!s.shieldsOn};
    case 'TRAVEL':
      if(!LOCATIONS.some(x=>x.id===a.to)||a.to===s.location||s.energy<12)return s;
      return {...meters(s,{energy:-12,hull:a.to==='asteroids'&&!s.shieldsOn?-6:0}),location:a.to,visited:[...new Set([...s.visited,a.to])]};
    case 'EVENT':{
      const {seed,event}=pick(s);return {...s,seed,activeEvent:event.id,variant:'noProp'};
    }
    case 'VARIANT':return s.activeEvent?{...s,variant:a.value==='prop'?'prop':'noProp'}:s;
    case 'RESOLVE':{
      if(!s.activeEvent)return s;
      const event=getEvent(s.activeEvent),done=a.done===true;
      return {...(done?meters(s,event.reward):s),activeEvent:null,variant:'noProp',
        seen:done?[...s.seen,event.id]:s.seen,recent:[...s.recent.slice(-1),event.id],
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
  try{const s=JSON.parse(raw);
    if(s?.schema!==1||!LOCATIONS.some(l=>l.id===s.location)||!['playing','paused','complete'].includes(s.status))return null;
    if(![0,10,20,30].includes(s.minutes)||!Number.isFinite(s.elapsed)||s.elapsed<0)return null;
    if(['energy','hull','shield'].some(k=>!Number.isFinite(s[k])||s[k]<0||s[k]>100))return null;
    if(s.activeEvent&&!getEvent(s.activeEvent))return null;
    if(!Array.isArray(s.recent)||!Array.isArray(s.seen)||!Array.isArray(s.visited))return null;
    return {...s,seed:(Number(s.seed)>>>0)||1,status:s.status==='playing'?'paused':s.status};
  }catch{return null;}
}
