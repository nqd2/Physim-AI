'use strict';

const $ = (selector) => document.querySelector(selector);
const app = $('#app');
const icons = {
  home: '<path d="M3 11l9-8 9 8v9H15v-6H9v6H3z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  lab: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3M8 15h8"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 21h15"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  left: '<path d="M15 5l-7 7 7 7"/>', right: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12l5 5 9-10"/>', reset: '<path d="M4 12a8 8 0 103-6M4 4v5h5"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><path d="m3 16 5-5 5 5 4-4 4 4"/>',
  star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
  heart: '<path d="M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-5 5 8 14 8 14S25 10 20 5z"/>'
};
function icon(name, size = 24) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.star}</svg>`; }
function esc(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function button(text, action, classes = '', attrs = '') { return `<button class="button ${classes}" data-action="${action}" ${attrs}>${text}</button>`; }
function heading(title, tag, step) { return `<header class="row between page-heading"><h1 class="heading">${title}</h1>${tag ? `<span class="tag dark">${tag}</span>` : ''}</header>${step ? `<div class="row between"><button class="plain" data-action="back">← Back</button><div class="step-label" aria-label="Step ${step} of 5">${[1,2,3,4,5].map(n => `<span class="step-dot ${n <= step ? 'active' : ''}"></span>`).join('')}</div></div>` : ''}`; }

let state = {profile:{name:'Alex'}, streak:0, coins:0, xp:0, sessions:[]};
let stateLoaded = false;
let weekOffset = 0;
let upload = null;
let photoUrl = null;
let uploadBusy = false;
let uploadError = '';
let params = {speed:20, angle:40, height:2};
let view = 'path';
let guess = 36;
let result = null;
let sessionStart = Date.now();
let saveBusy = false;
let saveError = false;
let firing = false;
let animationId;
let teachFeedback = '';
let triangleView = 'visualize';
let photoRevision = 0;
const validRoutes = ['home','snap','analyzing','pick','play','result','visualize','teach','review','me'];
function route() { const value = location.hash.slice(1); return validRoutes.includes(value) ? value : 'home'; }
function go(name) { if (route() === name) render(); else location.hash = name; }
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => { $('#toast').hidden = true; }, 4000); }
async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.body instanceof FormData ? 60000 : 12000);
  try {
    const response = await fetch(`/api${path}`, {...options, signal:controller.signal});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Server returned ${response.status}`);
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server took too long. Please try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}
async function refreshState() {
  try {
    state = await api('/state'); stateLoaded = true;
    $('#connection').hidden = true;
    if (['home','me','review'].includes(route())) render();
  } catch {
    $('#connection').innerHTML = 'Cannot reach the server. Check your connection.<button data-action="reconnect">Retry</button>';
    $('#connection').hidden = false;
  }
}
function metrics(items) { return `<div class="metrics">${items.map(([label,value,dark]) => `<div class="tile ${dark ? 'dark' : ''}"><p class="eyebrow">${label}</p><p class="value">${value}</p></div>`).join('')}</div>`; }
function progress(percent) { return `<div class="progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>`; }
function nav() {
  const active = {home:'home',snap:'snap',analyzing:'snap',pick:'lab',play:'lab',result:'lab',visualize:'lab',teach:'review',review:'review',me:'me'}[route()];
  $('#navigation').innerHTML = [['home','home','Home'],['snap','camera','Snap'],['lab','lab','Labs'],['review','book','Review'],['me','user','Me']].map(([key,svg,label]) => `<a class="nav-item" href="#${key === 'lab' ? 'pick' : key}" ${key === active ? 'aria-current="page"' : ''} aria-label="${label}">${icon(svg)}<span class="sr-only">${label}</span></a>`).join('');
}
function home() {
  const today = new Date();
  const monday = new Date(today); monday.setDate(today.getDate() - (today.getDay() + 6) % 7 + weekOffset * 7);
  const days = Array.from({length:7}, (_,i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const todaySessions = state.sessions.filter(s => new Date(s.createdAt).toDateString() === today.toDateString());
  const minutes = Math.floor(todaySessions.reduce((sum,s) => sum + s.durationSeconds, 0)/60);
  const completed = [todaySessions.some(s=>s.mode==='projectile'), todaySessions.some(s=>s.mode==='teach'), todaySessions.some(s=>s.mode==='triangle')];
  const percent = Math.round(completed.filter(Boolean).length / 3 * 100);
  const hour = today.getHours();
  return `<section class="card"><div class="card-header profile-band"><span class="tag dark">Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}</span></div><div class="card-body stack"><div class="row profile-top"><div class="tile avatar">${icon('user',46)}</div><div><h1 class="value profile-name">${esc(state.profile.name)}</h1><p class="eyebrow">Your little learning space</p></div></div>${metrics([['Streak',stateLoaded ? `${state.streak} days` : '—'],['Focus',stateLoaded ? `${minutes} min` : '—',true],['Level',state.xp >= 200 ? 'Bloom' : 'Sprout']])}<div class="row"><span class="eyebrow">Today</span>${progress(percent)}<span class="tag dark">${percent}%</span></div></div></section>
  <section class="card card-body"><div class="row between"><div><p class="eyebrow">${monday.getFullYear()} · A little progress, every day</p><h2 class="heading small">${monday.toLocaleDateString('en',{month:'long'})}</h2></div><div class="row">${button(icon('left',18),'prev-week','icon white','aria-label="Previous week"')}${button(icon('right',18),'next-week','icon white','aria-label="Next week"')}</div></div><div class="calendar-days">${days.map((d,i)=>`<div><p class="eyebrow">${['Mo','Tu','We','Th','Fr','Sa','Su'][i]}</p><div class="tile calendar-day ${d.toDateString()===today.toDateString() ? 'today' : ''}" ${d.toDateString()===today.toDateString() ? 'aria-current="date"' : ''}>${d.getDate()}</div></div>`).join('')}</div></section>
  <section class="card card-body"><div class="row" style="margin-bottom:10px"><span class="tile">${icon('check',18)}</span><div class="grow"><h2 class="value">Quests</h2><p class="eyebrow">${3-completed.filter(Boolean).length} left today</p></div><span class="tag white">Daily growth</span></div>${[['Explore a physics problem','snap'],['Teach-back: right triangles','teach'],['Review: Pythagoras','visualize']].map(([label,target],i)=>`<a href="#${target}" class="quest ${completed[i] ? 'done' : ''}"><span class="quest-check">${completed[i] ? icon('check',14) : ''}</span><span class="quest-label grow">${label}</span>${icon('right',16)}</a>`).join('')}</section>
  ${button(`${icon('camera')}Snap a problem`,'snap','wide big')}<p class="small text-muted" style="text-align:center">Small steps. Big discoveries. ✦</p>`;
}
function samplePaper() { return `<div class="sample-paper"><p class="eyebrow">A little physics challenge</p><p>7. A ball is thrown from a <b>2 m</b> ledge at <b>20 m/s</b>, <b>40°</b> above horizontal.</p><p style="margin-top:12px">How far from the base does it land?</p></div>`; }
function snap() {
  return `${heading('Snap it','Camera',1)}<section class="card card-body stack"><div class="camera-frame">${photoUrl ? `<img src="${photoUrl}" alt="Your selected problem">` : samplePaper()}</div><p class="small text-muted" style="text-align:center">${photoUrl ? 'Your photo is ready for your study session.' : 'Fit the whole problem in the frame.'}</p><div class="capture-row">${button(icon('image'),'gallery','icon white','aria-label="Choose photo"')}<button class="shutter" data-action="camera" aria-label="Take photo">${icon('camera',30)}</button><a class="button icon white" href="#home" aria-label="Return home">${icon('home')}</a></div></section>
  <p class="notice">Choose or take a photo to send it to your server. This version lets you enter the problem’s values yourself; automatic AI recognition is not connected.</p>
  ${uploadBusy ? '<div class="card card-body"><div class="spinner"></div><p style="text-align:center" role="status">Uploading your photo…</p></div>' : ''}
  ${uploadError ? `<p class="notice" role="alert">${esc(uploadError)}</p>${button('Choose photo again','gallery','white wide')}` : ''}
  ${upload ? `<p class="small upload-name">${icon('check',16)} Saved on server · ${esc(upload.name)}</p>${button('Set up my problem →','analyzing','wide')}` : ''}
  ${button('Try the sample problem →','sample','white wide',uploadBusy ? 'disabled' : '')}`;
}
function analyzing() {
  return `${heading('Set it up',upload ? 'Your photo' : 'Sample',2)}<section class="card"><div class="card-header"><p class="value">${upload ? 'Values from your problem' : 'A ball, a ledge & a little curiosity'}</p></div><form id="parameters-form" class="card-body stack"><p class="small text-muted">${upload ? 'Read your photo and enter the launch values below.' : 'Explore the sample, or change the values to make it yours.'}</p>${upload ? `<img src="${esc(upload.url)}" alt="Uploaded problem" style="width:100%;max-height:160px;object-fit:contain;border-radius:10px">` : ''}${[['Launch speed','speed','m/s',1,40],['Angle','angle','°',0,85],['Start height','height','m',0,20]].map(([label,key,unit,min,max])=>`<label class="parameter"><span><span class="value">${label}</span><br><span class="eyebrow">${min}–${max} ${unit}</span></span><input name="${key}" aria-label="${label}" type="number" value="${params[key]}" min="${min}" max="${max}" step="1" required></label>`).join('')}<div class="parameter"><span class="value">Gravity</span><span class="tag white">9.8 m/s²</span></div><div class="notice">Model: no air resistance, level landing ground. Goal: find the horizontal range.</div><button class="button wide" type="submit">Pick a demo ${icon('right',18)}</button></form></section>`;
}
function scene(showResult = false) {
  return `<svg class="scene" viewBox="0 0 320 200" role="img" aria-label="Interactive projectile motion diagram"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#fff" stroke-opacity=".45"/></pattern></defs><rect width="320" height="200" fill="url(#grid)"/><rect x="0" y="164" width="320" height="36" fill="#AEA5D6" stroke="#3B2849" stroke-width="3"/><rect id="ledge" x="0" y="151" width="35" height="13" fill="#FBB6E6" stroke="#3B2849" stroke-width="3"/><path id="trajectory" fill="none" stroke="#3B2849" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/><g id="guess-flag"><path d="M0 164V122" stroke="#3B2849" stroke-width="3"/><path d="M0 122h24l-6 8 6 8H0z" fill="#7EE5C8" stroke="#3B2849" stroke-width="2.5"/><text x="-4" y="114" text-anchor="middle" font-size="10" font-family="Fredoka" fill="#3B2849">${showResult ? 'Your guess' : 'Guess'}</text></g><g id="ruler"></g><g id="vectors" stroke-width="3"><path id="vx" stroke="#a83368"/><path id="vy" stroke="#4c467b"/></g><g id="cannon"><path d="M0 0h22" stroke="#3B2849" stroke-width="14" stroke-linecap="round"/><path d="M0 0h22" stroke="#DC9AC7" stroke-width="8" stroke-linecap="round"/></g><circle id="ball" r="6" fill="#FF8EC7" stroke="#3B2849" stroke-width="2.5"/></svg>`;
}
function pick() {
  return `${heading('Pick a demo','Explore',3)}<section class="card"><div class="card-header row between"><h2 class="value">Projectile Lab</h2><span class="tag dark">Physics</span></div><div class="card-body stack"><div class="scene-card">${scene()}</div><p>Something is launched at an angle. Can you figure out where it lands?</p><p class="eyebrow">${upload ? 'Your selected values' : 'Sample problem values'}</p><div class="chips"><span class="tag white">Speed ${params.speed} m/s</span><span class="tag white">Angle ${params.angle}°</span><span class="tag white">Height ${params.height} m</span></div>${button('Start exploring →','start-play','wide')}<p class="eyebrow" style="text-align:center">Predict · Experiment · Understand</p></div></section><h2 class="value">More ways to learn</h2><a class="demo-option" href="#visualize" style="text-decoration:none"><span class="demo-icon">△</span><div class="grow"><h3 class="value">Triangle Lab</h3><p class="small text-muted">See why the squares add up</p></div>${icon('right',18)}</a><a class="demo-option" href="#teach" style="text-decoration:none"><span class="demo-icon">${icon('book')}</span><div class="grow"><h3 class="value">Teach it back</h3><p class="small text-muted">Make a concept your own</p></div>${icon('right',18)}</a>`;
}
function control(label,key,min,max,unit,color) { const value = key==='guess' ? guess : params[key]; return `<label class="control"><span class="control-head"><span class="eyebrow">${label}</span><output id="${key}-value" class="tag">${value}${unit}</output></span><input type="range" id="${key}" aria-label="${label}" min="${min}" max="${max}" step="1" value="${value}" style="--slider-color:${color};--progress:${(value-min)/(max-min)*100}%"></label>`; }
function play() {
  return `${heading('Projectile Lab','Level 1')}<section class="card card-body dark-card"><p class="eyebrow">Your mission</p><p>How far from the base does the ball land?</p></section><div class="card scene-card">${scene()}</div><section class="card card-body stack">${control('Speed','speed',1,40,' m/s','#FF8EC7')}${control('Angle','angle',0,85,'°','#AEA5D6')}${control('Start height','height',0,20,' m','#7EE5C8')}<div class="segments" role="tablist" aria-label="Diagram view">${['path','vectors','ruler'].map(v=>`<button role="tab" aria-selected="${view===v}" data-action="view-${v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div></section><label class="card card-body row between"><span><span class="value">Your prediction</span><br><span class="eyebrow">Where will it land?</span></span><span><input class="guess-input" id="guess" aria-label="Your prediction in metres" type="number" required min="0" max="250" step="0.1" value="${guess}"> m</span></label><div class="row">${button(`${icon('bolt',18)} Fire!`,'fire','dark grow')}${button(icon('reset'),'reset','icon white','aria-label="Reset experiment"')}</div><p class="small text-muted" style="text-align:center">Change a value. Make a guess. See what happens.</p>`;
}
function physics(values = params) {
  const radians = values.angle * Math.PI / 180;
  const vx = values.speed * Math.cos(radians), vy = values.speed * Math.sin(radians);
  const time = (vy + Math.sqrt(vy*vy + 19.6*values.height))/9.8;
  return {vx,vy,time,range:vx*time,peak:values.height+vy*vy/19.6};
}
function drawScene(fraction = 0) {
  if (!$('#trajectory')) return;
  const values = route()==='result' && result ? result.params : params;
  const shownGuess = route()==='result' && result ? result.guess : guess;
  const p = physics(values);
  const xMax = Math.max(p.range*1.18, shownGuess*1.15, 50);
  const scaleX = 265/xMax, scaleY = Math.min(7,125/Math.max(p.peak,1));
  const x = t => 30+p.vx*t*scaleX;
  const y = t => 164-(values.height+p.vy*t-4.9*t*t)*scaleY;
  $('#trajectory').setAttribute('d',Array.from({length:51},(_,i)=>`${i ? 'L' : 'M'}${x(p.time*i/50).toFixed(2)} ${y(p.time*i/50).toFixed(2)}`).join(' '));
  $('#trajectory').style.opacity = view==='vectors' ? '.25' : '1';
  $('#guess-flag').setAttribute('transform',`translate(${30+shownGuess*scaleX} 0)`);
  $('#ledge').setAttribute('y',y(0)); $('#ledge').setAttribute('height',Math.max(0,164-y(0)));
  $('#cannon').setAttribute('transform',`translate(30 ${y(0)}) rotate(${-values.angle})`);
  $('#ball').setAttribute('cx',x(p.time*fraction)); $('#ball').setAttribute('cy',y(p.time*fraction));
  $('#vectors').style.display = view==='vectors' ? '' : 'none';
  $('#vx').setAttribute('d',`M30 ${y(0)}h${p.vx*2}`); $('#vy').setAttribute('d',`M30 ${y(0)}v${-p.vy*2}`);
  $('#ruler').innerHTML = Array.from({length:6},(_,i)=>{ const value=Math.round(xMax/5*i);return `<path d="M${30+i*53} 164v5" stroke="#3B2849" stroke-width="2"/><text x="${30+i*53}" y="186" text-anchor="middle" font-size="10" font-family="Fredoka" fill="#3B2849">${value}${i===5?' m':''}</text>`;}).join('');
  if (view==='ruler') $('#ruler').innerHTML += '<text x="160" y="25" text-anchor="middle" font-size="12" fill="#3B2849">Horizontal distance (metres)</text>';
}
function resultScreen() {
  if (!result) return `${heading('Ready to explore?','Lab')}<div class="card card-body stack"><p>Make a prediction and launch the ball to see your results.</p>${button('Open the lab','start-play','wide')}</div>`;
  const p = result.physics;
  return `${heading('Result','Nice exploring!',5)}<div class="card scene-card">${scene(true)}</div>${metrics([['Range',`${p.range.toFixed(1)} m`],['Peak',`${p.peak.toFixed(1)} m`],['Time',`${p.time.toFixed(1)} s`]])}<section class="card"><div class="card-header"><h2 class="value">${Math.abs(result.guess-p.range)<1 ? 'Right on target! ✦' : `${Math.abs(result.guess-p.range).toFixed(1)} m ${result.guess<p.range ? 'short' : 'too far'} — keep exploring!`}</h2></div><div class="card-body stack"><p>Your guess: ${result.guess} m. The ball moves sideways at a constant speed while gravity changes its upward speed.</p><p class="small text-muted">Try changing the start height to 0. Does the ball spend more or less time in the air?</p><div class="row"><div class="tile grow"><p class="eyebrow">Sideways</p><p class="value">${p.vx.toFixed(1)} m/s</p></div><div class="tile grow"><p class="eyebrow">Upward at launch</p><p class="value">${p.vy.toFixed(1)} m/s</p></div></div><p class="small">Range = horizontal speed × flight time. Gravity = 9.8 m/s²; no air resistance.</p></div></section><p class="saving" role="status">${saveBusy ? 'Saving your progress to the server…' : saveError ? 'Your result has not been saved. Please retry.' : result.saved ? `Saved on server · +${result.rewards?.xp || 0} XP` : 'Ready to save your progress.'}</p>${saveError ? button('Retry saving','retry-save','white wide') : ''}<div class="row">${button('Try a twist','start-play','grow')}${button('Explain it back','teach','white grow')}</div>`;
}
function triangle() {
  return `<svg class="triangle" viewBox="0 0 320 210" role="img" aria-label="Right triangle with legs 3 and 4 and unknown hypotenuse"><path d="M80 165V45L240 165Z" fill="#FFB3DA" stroke="#3B2849" stroke-width="4" stroke-linejoin="round"/><path d="M80 145h20v20" fill="none" stroke="#3B2849" stroke-width="3"/><text x="53" y="110" fill="#3B2849" font-family="Fredoka" font-size="24">3</text><text x="150" y="194" fill="#3B2849" font-family="Fredoka" font-size="24">4</text><text x="170" y="92" fill="#3B2849" font-family="Fredoka" font-size="24" transform="rotate(37 170 92)">x = ?</text></svg>`;
}
function visualize() {
  return `${heading('Snap & Visualize','Sample')}<section class="card card-body stack">${triangle()}<div class="row between"><p class="eyebrow">Let’s explore</p><span class="tag">Right triangle</span></div><div class="segments" role="tablist" aria-label="Triangle learning mode">${['visualize','explain','quiz'].map(v=>`<button role="tab" aria-selected="${triangleView===v}" data-action="triangle-${v}">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}</div></section><section class="card card-body stack">${triangleView==='visualize' ? '<h2 class="value">The squares tell the story</h2><div class="equation"><span class="digit">9</span> + <span class="digit">16</span> = <span class="digit">25</span></div><p>Square each short side, add them, then take the square root.</p><span class="tag mint">a² + b² = c²</span>' : triangleView==='explain' ? '<h2 class="value">Why isn’t the answer 7?</h2><p>The longest side is the hypotenuse. In a right triangle, its square equals the sum of the other two squares.</p><p>3² + 4² = 9 + 16 = 25<br>√25 = 5 units.</p>' : '<h2 class="value">Your turn!</h2><p>If the legs are 6 and 8, how long is the hypotenuse?</p><form id="triangle-quiz" class="stack"><input class="answer" aria-label="Hypotenuse length" name="answer" type="number" min="0" step="any" placeholder="Your answer in units" required><button class="button" type="submit">Check my answer</button></form><div id="triangle-feedback" role="status"></div>'}</section>${button(`${icon('book',20)} Teach it back`,'teach','wide')}`;
}
function teach() {
  return `${heading('Teach-back','Practice')}<section class="card"><div class="card-header row"><span class="tile">${icon('heart',24)}</span><h2 class="value">Let’s make it click.</h2></div><div class="card-body stack"><p>Explain the long side of the triangle like I’m 8!</p>${triangle()}<p class="small text-muted">Which explanation is correct for a right triangle with legs 3 and 4?</p><form id="teach-form" class="stack"><label class="demo-option"><input type="radio" name="explanation" value="add" required><span>Add the sides: 3 + 4 = 7.</span></label><label class="demo-option"><input type="radio" name="explanation" value="squares"><span>Add their squares, then take the square root: √(9 + 16) = 5.</span></label><label class="demo-option"><input type="radio" name="explanation" value="multiply"><span>Multiply the sides: 3 × 4 = 12.</span></label><button class="button" type="submit">Check my understanding</button></form>${teachFeedback}</div></section>${button('New practice','visualize','white wide')}<p class="small text-muted" style="text-align:center">Practice feedback uses the answer key for this sample.</p>`;
}
function review() {
  return `${heading('Your learning','Review')}<section class="card card-body stack"><h2 class="value">A little practice goes a long way</h2><p>Revisit a concept and see how much you remember.</p>${button('Practice right triangles','teach','wide')}</section><section class="card card-body"><h2 class="value" style="margin-bottom:8px">Recent sessions</h2>${state.sessions.length ? state.sessions.slice(0,20).map(s=>`<div class="session"><span class="tile">${icon(s.mode==='projectile'?'lab':'book',20)}</span><div class="grow"><p>${esc(s.topic)}</p><p class="eyebrow">${new Date(s.createdAt).toLocaleDateString('en',{month:'short',day:'numeric'})} · ${Math.floor(s.durationSeconds/60)} min</p></div><span class="tag">${s.score}%</span></div>`).join('') : '<div class="empty"><p>Your story starts here.</p><p class="small text-muted">Finish a lab or quiz to save your first session.</p></div>'}</section>`;
}
function me() {
  return `${heading('My little space','You')}<section class="card card-body stack"><div class="row"><div class="tile avatar">${icon('user',46)}</div><div><h2 class="value">${esc(state.profile.name)}</h2><p class="eyebrow">Curiosity looks good on you</p></div></div>${metrics([['XP',state.xp],['Coins',state.coins,true],['Sessions',state.sessions.length]])}<div class="row"><span class="eyebrow">Next level</span>${progress(Math.min(100,Math.round(state.xp/200*100)))}</div><p class="small text-muted">Keep exploring to reach Bloom at 200 XP.</p></section><section class="card card-body stack"><h2 class="value">Connected to your study server</h2><p class="small upload-name">${esc(location.origin)}</p><p class="small text-muted">Your photos and learning results are stored on this server. This prototype uses one shared learner profile.</p>${button('Refresh my progress','reconnect','white wide')}</section>${button('See my sessions','review','wide')}`;
}
function render() {
  cancelAnimationFrame(animationId); firing = false;
  const pages = {home,snap,analyzing,pick,play,result:resultScreen,visualize,teach,review,me};
  app.innerHTML = pages[route()](); nav();
  document.title = `${({home:'Home',snap:'Snap it',analyzing:'Set it up',pick:'Labs',play:'Projectile Lab',result:'Result',visualize:'Triangle Lab',teach:'Teach-back',review:'Review',me:'My space'})[route()]} · Study Buddy`;
  drawScene(route()==='result' ? 1 : 0);
}
async function uploadPhoto(file) {
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) return toast('Choose a JPEG, PNG or WebP photo.');
  if (file.size > 10*1024*1024) return toast('Choose an image smaller than 10 MB.');
  const revision = ++photoRevision;
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = URL.createObjectURL(file); upload = null; uploadBusy = true; uploadError = ''; go('snap');
  const body = new FormData(); body.append('image',file);
  try { const saved = await api('/uploads',{method:'POST',body}); if (revision===photoRevision) upload=saved; }
  catch (error) { if (revision===photoRevision) uploadError=`Upload failed: ${error.message}`; }
  finally { if (revision===photoRevision) { uploadBusy=false; if(route()==='snap')render(); } }
}
function sessionId() { return globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
async function saveResult() {
  if (!result || result.saved || saveBusy) return;
  const current = result; saveBusy=true; saveError=false;
  if(route()==='result')render();
  try {
    const response = await api('/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(current.session)});
    current.saved=true; current.rewards=response.session.rewards; state=response.state; stateLoaded=true;
  } catch { saveError=true; }
  finally { saveBusy=false; if(route()==='result')render(); }
}
async function savePractice(mode,topic,score,id) {
  try {
    const response=await api('/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientSessionId:id,mode,topic,score,durationSeconds:Math.min(86400,Math.max(0,Math.round((Date.now()-sessionStart)/1000)))})});
    state=response.state;stateLoaded=true;return true;
  } catch { return false; }
}
function fire() {
  if (firing) return;
  if (!$('#guess').reportValidity()) return;
  guess=Number($('#guess').value); if(!Number.isFinite(guess))return;
  firing=true;
  app.querySelectorAll('button,input').forEach(el=>el.disabled=true);
  const p=physics(), started=performance.now();
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finish=()=>{
    result={guess,params:{...params},physics:p,saved:false,session:{clientSessionId:sessionId(),topic:'Projectile motion',mode:'projectile',score:Math.max(0,Math.round(100-Math.abs(guess-p.range)/Math.max(p.range,1)*100)),durationSeconds:Math.min(86400,Math.max(0,Math.round((Date.now()-sessionStart)/1000)))}};
    firing=false;go('result');saveResult();
  };
  const frame=(now)=>{const fraction=Math.min(1,(now-started)/1200);drawScene(fraction);if(fraction<1)animationId=requestAnimationFrame(frame);else finish();};
  if(reduced)finish();else animationId=requestAnimationFrame(frame);
}

document.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');if(!target)return;
  const action=target.dataset.action;
  if(validRoutes.includes(action)){go(action);return;}
  if(action==='prev-week'){weekOffset--;render();}
  else if(action==='next-week'){weekOffset++;render();}
  else if(action==='back')go({analyzing:'snap',pick:'analyzing',result:'play'}[route()]||'home');
  else if(action==='gallery')$('#photo-input').click();
  else if(action==='camera')$('#camera-input').click();
  else if(action==='sample'){photoRevision++;if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;upload=null;uploadBusy=false;uploadError='';params={speed:20,angle:40,height:2};go('analyzing');}
  else if(action==='start-play'){if(saveBusy)return toast('Please wait while your previous result is saved.');sessionStart=Date.now();go('play');}
  else if(action==='reset'){params={speed:20,angle:40,height:2};guess=36;view='path';render();}
  else if(action==='fire')fire();
  else if(action==='retry-save')saveResult();
  else if(action==='reconnect'){refreshState();}
  else if(action==='close-dialog')$('#dialog').close();
  else if(action.startsWith('view-')){view=action.slice(5);document.querySelectorAll('[data-action^="view-"]').forEach(el=>el.setAttribute('aria-selected',el.dataset.action===action));drawScene();}
  else if(action.startsWith('triangle-')){triangleView=action.slice(9);render();}
});
document.addEventListener('input',event=>{
  const key=event.target.id;
  if(route()!=='play'||!['speed','angle','height','guess'].includes(key))return;
  if(key==='guess'){guess=Math.min(250,Math.max(0,Number(event.target.value)||0));}
  else {params[key]=Number(event.target.value);$(`#${key}-value`).textContent=`${params[key]}${{speed:' m/s',angle:'°',height:' m'}[key]}`;event.target.style.setProperty('--progress',`${(params[key]-Number(event.target.min))/(Number(event.target.max)-Number(event.target.min))*100}%`);}
  drawScene();
});
document.addEventListener('change',event=>{if(['photo-input','camera-input'].includes(event.target.id)){uploadPhoto(event.target.files[0]);event.target.value='';}});
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target;
  if(form.id==='parameters-form'){const data=new FormData(form);params={speed:Number(data.get('speed')),angle:Number(data.get('angle')),height:Number(data.get('height'))};go('pick');}
  else if(form.id==='teach-form'||form.id==='triangle-quiz'){
    const isTeach=form.id==='teach-form', data=new FormData(form);
    const correct=isTeach ? data.get('explanation')==='squares' : Number(data.get('answer'))===10;
    const feedback=correct ? (isTeach ? 'You’ve got it! 3² + 4² = 25, and √25 = 5.' : 'Exactly! 6² + 8² = 100, and √100 = 10.') : (isTeach ? 'Try the squares. 3² + 4² = 9 + 16 = 25. Which explanation gives √25?' : 'Try again: 6² + 8² = 36 + 64 = 100. What is √100?');
    if(isTeach){teachFeedback=`<div class="feedback ${correct?'':'incorrect'}" role="status">${feedback}</div>`;let old=form.parentElement.querySelector('.feedback');if(old)old.remove();form.insertAdjacentHTML('afterend',teachFeedback);}
    else $('#triangle-feedback').innerHTML=`<div class="feedback ${correct?'':'incorrect'}">${feedback}</div>`;
    if(correct){
      const submit=form.querySelector('button');submit.disabled=true;submit.textContent='Saving…';
      const id=form.dataset.sessionId||(form.dataset.sessionId=sessionId());
      const saved=await savePractice(isTeach?'teach':'triangle',isTeach?'Teach-back: Pythagoras':'Right triangle quiz',100,id);
      submit.disabled=saved;submit.textContent=saved?'Saved on server ✓':'Retry saving';
      if(!saved)toast('Could not save. Check your connection and retry.');
    }
  }
});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);app.focus({preventScroll:true});});
window.addEventListener('online',refreshState);
render();refreshState();
