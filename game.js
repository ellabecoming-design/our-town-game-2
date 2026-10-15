'use strict';
// All image files in assets/ are .webp. Keep these paths unchanged.
const JOBS = {
  police_officer:'Police Officer', firefighter:'Firefighter', doctor:'Doctor',
  nurse:'Nurse', teacher:'Teacher', jeepney_driver:'Jeepney Driver',
  hairdresser:'Hairdresser / Barber', cook:'Cook', cashier:'Cashier',
  basketball_player:'Basketball Player', farmer:'Farmer'
};
const PLACES = {
  police_station:'Police Station', fire_station:'Fire Station',
  hospital_doctor:'Hospital', hospital_nurse:'Hospital',
  child_development_center:'Child Development Center', jeepney:'Jeepney',
  salon:'Salon / Barber Shop', restaurant:'Restaurant', store:'Store',
  basketball_court:'Basketball Arena', farm:'Farm'
};
// Two hospital images have DIFFERENT silhouettes and therefore different answers.
const PAIRS = [
  ['police_station','police_officer'], ['fire_station','firefighter'],
  ['hospital_doctor','doctor'], ['hospital_nurse','nurse'],
  ['child_development_center','teacher'], ['jeepney','jeepney_driver'],
  ['salon','hairdresser'], ['restaurant','cook'], ['store','cashier'],
  ['basketball_court','basketball_player'], ['farm','farmer']
];
const SCENES = [
  ['01_sick','hospital_doctor','I feel sick!'],
  ['02_fire','fire_station','There is a fire!'],
  ['03_lost','police_station','I am lost!'],
  ['04_haircut','salon','I need a haircut!'],
  ['05_hungry','restaurant','I am hungry!'],
  ['06_basketball','basketball_court','I want to play basketball!']
];
const file = (type,id) => `assets/${type}/${type==='jobs'?'job_':type==='places'?'place_':'scene_'}${id}.webp`;
const el = id => document.getElementById(id);
const screen = el('screen'), counter = el('counter'), ghost = el('dragGhost');
let level=0, index=0, questions=[], question=null, solved=false;
let sound=true, audioContext=null, gesture=null;
const canSpeak=('speechSynthesis' in window)&&('SpeechSynthesisUtterance' in window);
let speechUnlocked=false;
function speak(text){
  if(!sound||!canSpeak)return;
  try{
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.lang='en-US';utterance.rate=0.82;utterance.pitch=1.06;utterance.volume=1;
    const voices=window.speechSynthesis.getVoices();
    const english=voices.find(v=>v.lang.toLowerCase()==='en-us')||voices.find(v=>v.lang.toLowerCase().startsWith('en'));
    if(english)utterance.voice=english;
    window.speechSynthesis.speak(utterance);
  }catch(error){console.warn('Speech unavailable',error)}
}
function pairedSpeech(q){
  if(q.targetType==='scenes')return `${q.prompt} ${PLACES[q.correctId]}.`;
  // Read the upper (question) card first, then the dragged answer card.
  if(q.targetType==='places')return `${PLACES[q.targetId]}. ${JOBS[q.correctId]}.`;
  if(q.targetType==='jobs')return `${JOBS[q.targetId]}. ${PLACES[q.correctId]}.`;
  return '';
}
function stopSpeech(){if(canSpeak)try{window.speechSynthesis.cancel()}catch(_){}}
const randomize = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b; };
function playSound(correct){
  if(!sound)return;
  try{
    audioContext ||= new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const notes=correct?[523,659,784]:[310,250];
    notes.forEach((hz,i)=>{
      const t=audioContext.currentTime+i*.11, osc=audioContext.createOscillator(), gain=audioContext.createGain();
      osc.type='sine';osc.frequency.value=hz;
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.085,t+.02);
      gain.gain.exponentialRampToValueAtTime(.0001,t+.17);
      osc.connect(gain);gain.connect(audioContext.destination);osc.start(t);osc.stop(t+.18);
    });
  }catch(e){/* Some browsers do not allow sound. The game still works. */}
}
function showHome(){
  level=0;index=0;solved=false;gesture=null;ghost.hidden=true;counter.textContent='';stopSpeech();
  screen.innerHTML=`<section class="panel home-panel">
    <h1 class="hero"><span class="a">O</span><span class="b">u</span><span class="c">r</span> <span class="d">T</span><span class="e">o</span><span class="f">w</span><span class="c">n</span><span class="gameword">GAME! 🏡</span></h1>
    <p class="subtitle">Match places, jobs, and situations!</p>
    <div class="levels">
      <button type="button" class="level pink" data-level="1">
        <div class="level-photos"><img src="${file('places','hospital_doctor')}" alt=""><img src="${file('jobs','doctor')}" alt=""></div>
        <strong>Level 1</strong><small>Match places &amp; jobs · 20</small>
      </button>
      <button type="button" class="level green" data-level="2">
        <div class="level-photos"><img src="${file('scenes','01_sick')}" alt=""><img src="${file('places','hospital_nurse')}" alt=""></div>
        <strong>Level 2</strong><small>Where should we go? · 6</small>
      </button>
    </div><p class="instructions">👆 Choose a level, then drag a card UP! ⬆️</p></section>`;
  screen.querySelectorAll('[data-level]').forEach(btn=>btn.addEventListener('click',()=>begin(Number(btn.dataset.level))));
}
function begin(selected){
  level=selected;index=0;stopSpeech();
  if(level===1){
    // 20 questions: all 11 pairs appear at least once, 9 return in reverse direction.
    const allPairs=randomize(PAIRS);
    const directions=allPairs.map(([place,job])=>({
      place,job,forward:Math.random()<0.5
    }));
    const makePairQuestion=({place,job,forward})=>forward
      ? {targetType:'places',targetId:place,optionType:'jobs',correctId:job,
         prompt:'Who works here?'}
      : {targetType:'jobs',targetId:job,optionType:'places',correctId:place,
         prompt:'Where does this person work?'};
    const firstRound=directions.map(makePairQuestion);
    const reverseRound=randomize(directions).slice(0,9).map(pair=>
      makePairQuestion({...pair,forward:!pair.forward}));
    questions=randomize([...firstRound,...reverseRound]);
  }else{
    questions=randomize(SCENES.map(([scene,place,prompt])=>({
      targetType:'scenes',targetId:scene,optionType:'places',correctId:place,prompt
    })));
  }
  renderQuestion();
}
function makeOptions(q){
  const candidates=Object.keys(q.optionType==='jobs'?JOBS:PLACES).filter(id=>{
    if(id===q.correctId)return false;
    // In Level 1, doctor/nurse hospital cards are distinct: the opposite silhouette is a valid wrong answer.
    // In Level 2, either hospital can represent a hospital, so avoid an ambiguous hospital distractor.
    if(q.targetType==='scenes' && q.optionType==='places' && id.startsWith('hospital_') && q.correctId.startsWith('hospital_')) return false;
    return true;
  });
  return randomize([q.correctId,...randomize(candidates).slice(0,2)]);
}
function renderQuestion(){
  question=questions[index];solved=false;gesture=null;ghost.hidden=true;stopSpeech();
  const q=question, labels=q.optionType==='jobs'?JOBS:PLACES;
  counter.textContent=`⭐ ${index+1} / ${questions.length}`;
  screen.innerHTML=`<section class="game">
    <div class="heading"><span class="badge">LEVEL ${level}</span><h2>${q.prompt}</h2>
       <button type="button" id="readPrompt" class="read-button" aria-label="Read the question aloud">🔊 Listen</button></div>
    <div class="stage"><div class="dropzone" id="dropzone">
      <img src="${file(q.targetType,q.targetId)}" draggable="false" alt="Question picture">
      <span class="drop-label">⬆️ DROP HERE</span>
    </div></div>
    <div class="answer-area"><div class="choices">${makeOptions(q).map(id=>`<button type="button" class="choice" data-id="${id}" aria-label="${labels[id]}">
      <img src="${file(q.optionType,id)}" draggable="false" alt=""><span>${labels[id]}</span></button>`).join('')}
    </div><p class="notice" id="notice">Hold a card, drag UP and release! ⬆️</p></div>
  </section>`;
  el('readPrompt').addEventListener('click',()=>speak(q.prompt));
  screen.querySelectorAll('.choice').forEach(btn=>{
    btn.addEventListener('pointerdown',pointerDown);
    btn.addEventListener('pointermove',pointerMove);
    btn.addEventListener('pointerup',pointerUp);
    btn.addEventListener('pointercancel',pointerCancel);
  });
}
function insideDrop(x,y){
  const box=el('dropzone');if(!box)return false;
  const r=box.getBoundingClientRect();
  // A forgiving drop target: children can release slightly outside the frame.
  const horizontalPadding=Math.min(85,window.innerWidth*.09);
  const verticalPadding=Math.min(95,window.innerHeight*.13);
  return x>=r.left-horizontalPadding&&x<=r.right+horizontalPadding
    &&y>=r.top-verticalPadding&&y<=r.bottom+verticalPadding;
}
function pointerDown(e){
  if(solved||e.button!==0)return;
  gesture={pointerId:e.pointerId,btn:e.currentTarget,id:e.currentTarget.dataset.id,
    startX:e.clientX,startY:e.clientY,dragging:false};
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_e){}
}
function pointerMove(e){
  const g=gesture;if(!g||g.pointerId!==e.pointerId)return;
  if(!g.dragging&&Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>9){
    g.dragging=true;g.btn.classList.add('picked');
    const label=(question.optionType==='jobs'?JOBS:PLACES)[g.id];
    ghost.innerHTML=`<img alt="" src="${file(question.optionType,g.id)}"><span>${label}</span>`;
    ghost.hidden=false;
  }
  if(g.dragging){
    ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';
    el('dropzone')?.classList.toggle('over',insideDrop(e.clientX,e.clientY));
  }
}
function clearGesture(){
  if(gesture)gesture.btn.classList.remove('picked');
  gesture=null;ghost.hidden=true;el('dropzone')?.classList.remove('over');
}
function pointerUp(e){
  const g=gesture;if(!g||g.pointerId!==e.pointerId)return;
  const movedUp=g.startY-e.clientY;
  const validDrop=g.dragging&&movedUp>=35&&insideDrop(e.clientX,e.clientY);
  clearGesture();
  if(validDrop)judge(g.id,g.btn);
  else el('notice').textContent=g.dragging
    ? 'Almost! Move the card a little closer to the top! ⬆️'
    : 'Hold the card and drag it up! ⬆️';
}
function pointerCancel(){clearGesture();}
function judge(id,btn){
  if(solved)return;
  if(id!==question.correctId){
    playSound(false);btn.classList.remove('wrong');void btn.offsetWidth;btn.classList.add('wrong');
    el('notice').textContent='Try again! 💛';return;
  }
  solved=true;playSound(true);
  const spokenAnswer=pairedSpeech(question);
  // Called during the user's pointerup gesture, including on Safari/iPadOS.
  speak(spokenAnswer);
  screen.innerHTML=`<section class="panel result"><h1>🌟 Great Job! 🌟</h1>
    <div class="matched"><img src="${file(question.targetType,question.targetId)}" alt="Question">
    <span class="tick">✅</span><img src="${file(question.optionType,question.correctId)}" alt="Correct answer"></div>
    <p class="spoken-answer">${spokenAnswer}</p>
    <button type="button" id="replayAnswer" class="read-button">🔊 Listen again</button><br>
    <button type="button" id="next" class="action">${index===questions.length-1?'Finish! 🏆':'Next ▶'}</button></section>`;
  el('replayAnswer').onclick=()=>speak(spokenAnswer);
  el('next').onclick=()=>{stopSpeech();index++;index<questions.length?renderQuestion():finish();};
}
function finish(){
  counter.textContent=`⭐ ${questions.length} / ${questions.length}`;playSound(true);
  screen.innerHTML=`<section class="panel"><h1 class="hero">🏆 Amazing!</h1>
    <p class="subtitle">You finished Level ${level}!</p>
    <button type="button" class="action" id="again">Play Again ↻</button>
    <button type="button" class="action secondary" id="menu">Home ⌂</button></section>`;
  el('again').onclick=()=>begin(level);el('menu').onclick=showHome;
}
el('home').addEventListener('click',showHome);
el('sound').addEventListener('click',()=>{sound=!sound;stopSpeech();el('sound').classList.toggle('muted',!sound);el('sound').textContent=sound?'🔊':'🔇';});
window.addEventListener('keydown',e=>{if(e.key==='Escape')showHome();});
showHome();
