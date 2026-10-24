import { SAVE_KEY, createGame, restoreGame, reduceGame, LOCATIONS, getEvent, getLocation } from './engine.js';

const $ = selector => document.querySelector(selector);
const TEXT = {
 ru:{
  status:'СИСТЕМЫ КОРАБЛЯ',ready:'Всё работает!',energy:'⚡ ЭНЕРГИЯ',hull:'◈ КОРПУС',shield:'◎ ЗАЩИТА',online:'● НА СВЯЗИ',
  help:'Капитан, космос ждёт новых открытий!',log:'БОРТОВОЙ ЖУРНАЛ',logTitle:'Приключение начинается!',
  logMessage:'Выбери пункт назначения или включи сканер.',safety:'Твоя комната — часть приключения. Освободи место для безопасной игры.',
  signal:'✦ Новый сигнал',nav:'Навигация',navDesc:'Выбери маршрут',power:'Реактор',powerDesc:'Пополнить энергию',
  scanner:'Сканер',scannerDesc:'Найти сюрприз',shields:'Щиты',shieldsDesc:'Включить защиту',
  free:'СВОБОДНЫЙ ПОЛЁТ',timer:'ПРИКЛЮЧЕНИЕ',rotate:'Поверни устройство горизонтально, капитан!',
  welcome:'Капитан, добро пожаловать!',intro:'Это твой космический корабль. Нажимай на приборы, исследуй звёзды и выполняй задания в комнате.',
  duration:'ВЫБЕРИ РЕЖИМ',freeChoice:'Без времени',min:'мин',start:'ЗАПУСТИТЬ КОРАБЛЬ ✦',continue:'ПРОДОЛЖИТЬ ПОЛЁТ ↗',
  destination:'Куда полетим?',destinationSub:'Выбери место на звёздной карте.',here:'Здесь',fly:'Лететь',
  back:'← Назад',task:'МИССИЯ ЭКИПАЖА',props:'С предметами',noProps:'Без предметов',done:'ГОТОВО ✓',skip:'Пропустить',
  paused:'Корабль на паузе',pausedSub:'Все системы ждут тебя. Возвращайся, когда захочешь.',resume:'ПРОДОЛЖИТЬ ПОЛЁТ',newGame:'Новая игра',
  finished:'Приключение завершено!',finishedSub:'Отличная работа, капитан! Корабль в безопасности. Ты можешь продолжить свободный полёт или начать новое приключение.',
  finishContinue:'СВОБОДНЫЙ ПОЛЁТ',charged:'Энергия пополнена!',scanned:'Сканирование завершено',arrived:'Мы на месте!',
  noEnergy:'Мало энергии. Заряди реактор!',shieldOn:'Защитные щиты включены',shieldOff:'Щиты в режиме ожидания',
  completed:'Миссия выполнена!',skipped:'Ничего страшного. Летим дальше!',locked:'Сначала заверши активную миссию.',
  emergency:'Аварийная посадка! Спасательная команда вернула нас домой. Корабль отремонтирован.',
 },
 en:{
  status:'SHIP STATUS',ready:'All systems ready!',energy:'⚡ ENERGY',hull:'◈ HULL',shield:'◎ SHIELDS',online:'● ONLINE',
  help:'Captain, the universe is waiting for you!',log:"CAPTAIN'S LOG",logTitle:'Adventure awaits!',
  logMessage:'Choose a destination or scan the sky.',safety:'Your room is part of the adventure. Make space to play safely.',
  signal:'✦ Incoming signal',nav:'Navigation',navDesc:'Choose a destination',power:'Reactor',powerDesc:'Recharge the ship',
  scanner:'Scanner',scannerDesc:'Find a surprise',shields:'Shields',shieldsDesc:'Activate protection',
  free:'FREE FLIGHT',timer:'ADVENTURE',rotate:'Turn your screen sideways, Captain!',
  welcome:'Welcome aboard, Captain!',intro:'This is your spaceship. Tap the controls, explore the stars and complete missions around your room.',
  duration:'CHOOSE YOUR MODE',freeChoice:'No time limit',min:'min',start:'LAUNCH THE SHIP ✦',continue:'CONTINUE FLIGHT ↗',
  destination:'Where shall we go?',destinationSub:'Choose a place on the star map.',here:'Here',fly:'Travel',
  back:'← Back',task:'CREW MISSION',props:'With objects',noProps:'No objects',done:'DONE ✓',skip:'Skip',
  paused:'Ship on pause',pausedSub:'All systems will wait for you. Return whenever you like.',resume:'RESUME FLIGHT',newGame:'New game',
  finished:'Adventure complete!',finishedSub:'Great job, Captain! The ship is safe. Continue exploring or start another adventure.',
  finishContinue:'FREE FLIGHT',charged:'Energy recharged!',scanned:'Scan complete',arrived:'We have arrived!',
  noEnergy:'Low energy. Recharge the reactor!',shieldOn:'Shields are online',shieldOff:'Shields in standby',
  completed:'Mission complete!',skipped:'No problem. Let’s keep exploring!',locked:'Finish the current mission first.',
  emergency:'Emergency landing! The rescue crew brought us home and repaired the ship.',
 }
};
let game = null;
try { game = restoreGame(localStorage.getItem(SAVE_KEY)); } catch {}
let lang = game?.lang || 'ru';
let screen = 'start';
let choiceMinutes = 0;
let muted = false;
let messageTimeout = null;
const t = key => TEXT[lang][key] || key;
function persist(){try{if(game)localStorage.setItem(SAVE_KEY,JSON.stringify(game));}catch{}}
function dispatch(action){if(!game)return;game=reduceGame(game,action);lang=game.lang;persist();render();}
function localized(value){return typeof value==='string'?value:(value?.[lang] || value?.ru || '');}
function stars(){const el=$('#stars');let seed=42;for(let i=0;i<95;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%100;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%100;const star=document.createElement('span');star.className='star';star.style.left=x+'%';star.style.top=y+'%';star.style.animationDelay=(i%12)*-.25+'s';star.style.opacity=(.25+(i%5)*.14).toString();el.appendChild(star);}}
let context;
function beep(high=false){if(muted)return;try{context ??= new(window.AudioContext||window.webkitAudioContext)();const o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.value=high?740:470;g.gain.setValueAtTime(.04,context.currentTime);g.gain.exponentialRampToValueAtTime(.0001,context.currentTime+.13);o.connect(g);g.connect(context.destination);o.start();o.stop(context.currentTime+.14);}catch{}}
function toast(text){const el=$('#message');el.textContent=text;el.classList.remove('hidden');clearTimeout(messageTimeout);messageTimeout=setTimeout(()=>el.classList.add('hidden'),2600);}
function meter(id,value){const bar=$('#'+id+'-meter');bar.style.width=value+'%';bar.classList.toggle('warn',value>=25&&value<55);bar.classList.toggle('danger',value<25);$('#'+id+'-value').textContent=Math.round(value)+'%';}
function renderDashboard(){
  if(!game)return;
  $('#app').dataset.location=game.location;
  $('#location-label').textContent=localized(getLocation(game.location));
  $('#systems-caption').textContent=t('status');$('#systems-heading').textContent=t('ready');
  $('#energy-caption').textContent=t('energy');$('#hull-caption').textContent=t('hull');$('#shield-caption').textContent=t('shield');
  meter('energy',game.energy);meter('hull',game.hull);meter('shield',game.shield);
  $('#status-badge').textContent=t('online');$('#help-line').textContent=t('help');
  $('#captain-log').textContent=t('log');$('#log-title').textContent=t('logTitle');$('#log-message').textContent=t('logMessage');
  $('#log-meta').textContent=t('safety');$('#signal-btn').textContent=t('signal');
  for(const [id,a,b] of [['nav','nav','navDesc'],['power','power','powerDesc'],['scan','scanner','scannerDesc'],['shield','shields','shieldsDesc']]){
    $('#'+id+'-name').textContent=t(a);$('#'+id+'-desc').textContent=t(b);
  }
  $('#hud-label').textContent='SECTOR / '+String(LOCATIONS.findIndex(loc=>loc.id===game.location)+1).padStart(2,'0');
  $('#hud-scan').textContent='SCAN / '+String(game.scans).padStart(2,'0');
  $('#mode-caption').textContent='MISSION HERO · '+(game.minutes? t('timer')+' '+game.minutes+' '+t('min'):t('free'));
  $('#rotate-copy').textContent=t('rotate');
  $('#language').textContent=lang==='ru'?'EN':'RU';
  $('#sound').textContent=muted?'♪̸':'♫';
}
function markup(content,center=false){$('#overlay').innerHTML='<div class="modal'+(center?' center':'')+'">'+content+'</div>';}
function intro(){
  markup('<div class="modal-icon">✦</div><div class="eyebrow">MISSION HERO / SPACE ACADEMY</div><h1>'+t('welcome')+'</h1><p>'+t('intro')+'</p><div class="eyebrow">'+t('duration')+'</div>'+
    '<div class="options">'+[0,10,20,30].map(min=>'<button class="pill '+(choiceMinutes===min?'active':'')+'" data-action="duration" data-minutes="'+min+'">'+(min?min+' '+t('min'):t('freeChoice'))+'</button>').join('')+'</div>'+
    '<button class="primary" data-action="start">'+t('start')+'</button>'+
    (game?'<div style="margin-top:11px"><button class="secondary" data-action="continue">'+t('continue')+'</button></div>':''),true);
}
function destinations(){
  markup('<div class="eyebrow">STAR MAP / 04</div><h1>'+t('destination')+'</h1><p>'+t('destinationSub')+'</p><div class="destinations">'+
    LOCATIONS.map(loc=>'<button class="destination '+(loc.id===game.location?'current':'')+'" data-action="travel" data-to="'+loc.id+'" '+(loc.id===game.location?'disabled':'')+'><span class="d-icon" style="color:'+loc.color+'">'+loc.icon+'</span><span><b>'+localized(loc)+'</b><small>'+(loc.id===game.location?t('here'):t('fly')+' ↗')+'</small></span></button>').join('')+
    '</div><button class="secondary" data-action="back">'+t('back')+'</button>');
}
function encounter(){
  const event=getEvent(game.activeEvent);if(!event){screen='play';render();return;}
  const variant=game.variant;
  markup('<div class="modal-icon">'+event.icon+'</div><div class="eyebrow">'+t('task')+'</div><h1>'+localized(event.title)+'</h1><p>'+localized(event.intro)+'</p>'+
    (event.type==='physical'?'<div class="task-choice"><button class="pill '+(variant==='prop'?'active':'')+'" data-action="variant" data-variant="prop">'+t('props')+'</button><button class="pill '+(variant==='noProp'?'active':'')+'" data-action="variant" data-variant="noProp">'+t('noProps')+'</button></div>':'')+
    '<div class="task-text">'+localized(event[variant])+'</div><div class="modal-actions"><button class="secondary" data-action="skip">'+t('skip')+'</button><button class="primary" data-action="done">'+t('done')+'</button></div>');
}
function pause(){
  markup('<div class="modal-icon">Ⅱ</div><h1>'+t('paused')+'</h1><p>'+t('pausedSub')+'</p><button class="primary" data-action="resume">'+t('resume')+'</button><div style="margin-top:12px"><button class="secondary" data-action="reset">'+t('newGame')+'</button></div>',true);
}
function finish(){
  markup('<div class="modal-icon">✧</div><h1>'+t('finished')+'</h1><p>'+t('finishedSub')+'</p><button class="primary" data-action="free">'+t('finishContinue')+'</button><div style="margin-top:12px"><button class="secondary" data-action="reset">'+t('newGame')+'</button></div>',true);
}
function render(){
  renderDashboard();
  $('#overlay').classList.toggle('hidden',screen==='play');
  if(screen==='start')intro();else if(screen==='nav')destinations();else if(screen==='event')encounter();else if(screen==='pause')pause();else if(screen==='finish')finish();
}
function signal(){
  if(!game||game.status!=='playing')return;
  dispatch({type:'EVENT'});screen='event';beep(true);render();
}
document.addEventListener('click',event=>{
  const btn=event.target.closest('[data-action]');if(!btn)return;
  const action=btn.dataset.action;
  if(action!=='sound')beep();
  if(action==='language'){lang=lang==='ru'?'en':'ru';if(game)dispatch({type:'LANG',lang});render();return;}
  if(action==='sound'){muted=!muted;renderDashboard();return;}
  if(action==='duration'){choiceMinutes=Number(btn.dataset.minutes);render();return;}
  if(action==='start'){game=createGame({lang,minutes:choiceMinutes});screen='play';persist();render();toast(t('ready'));return;}
  if(action==='continue'&&game){dispatch({type:'RESUME'});screen=game.activeEvent?'event':game.status==='complete'?'finish':'play';render();return;}
  if(action==='reset'){screen='start';game=null;render();return;}
  if(!game)return;
  if(action==='pause'){dispatch({type:'PAUSE'});screen='pause';render();return;}
  if(action==='resume'){dispatch({type:'RESUME'});screen=game.activeEvent?'event':'play';render();return;}
  if(action==='free'){game={...game,status:'playing',minutes:0};persist();screen='play';render();return;}
  if(game.status!=='playing')return;
  if(action==='back'){screen='play';render();return;}
  if(action==='nav'){if(game.activeEvent)return toast(t('locked'));screen='nav';render();return;}
  if(action==='travel'){
    const old=game.location,landings=game.emergencyLandings;
    dispatch({type:'TRAVEL',to:btn.dataset.to});screen='play';render();
    toast(game.emergencyLandings>landings?t('emergency'):old===game.location?t('noEnergy'):t('arrived'));return;
  }
  if(action==='recharge'){dispatch({type:'RECHARGE'});toast(t('charged'));return;}
  if(action==='shields'){dispatch({type:'SHIELDS'});toast(game.shieldsOn?t('shieldOn'):t('shieldOff'));return;}
  if(action==='scan'){
    const old=game.scans;dispatch({type:'SCAN'});if(old===game.scans){toast(t('noEnergy'));return;}
    if(game.scans%2===1)signal();else toast(t('scanned'));return;
  }
  if(action==='signal'){signal();return;}
  if(action==='variant'){dispatch({type:'VARIANT',value:btn.dataset.variant});render();return;}
  if(action==='done'||action==='skip'){dispatch({type:'RESOLVE',done:action==='done'});screen='play';render();toast(t(action==='done'?'completed':'skipped'));return;}
});
stars();render();fetch('./VERSION').then(r=>r.ok?r.text():Promise.reject()).then(v=>{$('#version-label').textContent='VERSION '+v.trim();}).catch(()=>{$('#version-label').textContent='VERSION 0.2.0';});
setInterval(()=>{if(game?.status==='playing'){dispatch({type:'TICK',ms:1000});if(game.status==='complete'){screen='finish';render();}}},1000);
