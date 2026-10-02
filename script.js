(() => {
  'use strict';
  const KEYS = { progress: 'hangeulStepsProgressV1', data: 'hangeulStepsVocabV6', theme: 'hangeulStepsThemeV1' };
  const app = document.getElementById('app');
  const dialog = document.getElementById('word-dialog');
  const picker = document.getElementById('offline-picker');
  let vocab = [];
  let view = 'home';
  let lessonId = 1;
  let stage = 'study';
  let cursor = 0;
  let quiz = null;
  let toastTimer;
  let state = loadState();

  function initialState() { return { words: {}, completedLessons: [], stages: {}, favorites: [], errors: 0, streak: 0, bestStreak: 0, startedAt: 0, totalSeconds: 0, lastDay: '', learnedIds: [], correctTotal: 0, openedLessons: [1], session: null }; }
  function validSession() { const s=state.session;return !!(s&&s.lessonId>=1&&s.lessonId<=50&&['study','cards','practice','spelling','reading'].includes(s.stage)); }
  function sessionLabel() { const s=state.session;if(!validSession())return '';const names={study:'Изучение',cards:'Карточки',practice:'Практика',spelling:'Написание',reading:'Мини-текст'};return `Урок ${s.lessonId} · ${names[s.stage]}`; }
  function loadState() { try { const s={ ...initialState(), ...JSON.parse(localStorage.getItem(KEYS.progress) || '{}') }; s.startedAt=0; return s; } catch { return initialState(); } }
  function save() { try { if(view==='lesson'&&vocab.length)state.session={lessonId,stage,cursor,quiz};localStorage.setItem(KEYS.progress, JSON.stringify(state)); } catch { toast('Хранилище браузера заполнено'); } }
  function toast(message) { const el = document.getElementById('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2300); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function meanings(w) { return Array.isArray(w.ru) ? w.ru : [w.ru || w.en || '']; }
  function meaning(w) { return meanings(w).join(' · '); }
  function getWord(id) { return vocab.find(w => w.id === Number(id)); }
  function lessonWords(id) { return vocab.filter(w => w.lesson === Number(id)); }
  function wordState(id) { return state.words[id] || { reps: 0, attempts: 0, lapses: 0, streak: 0, interval: 0, due: 0, ease: 2.5, status: 'new' }; }
  function setWordState(id, next) { state.words[id] = { ...wordState(id), ...next }; }
  function dueWords() { const now = Date.now(); return vocab.filter(w => { const s = wordState(w.id); return s.attempts > 0 && s.due <= now; }); }
  function getLevel(lesson) { return lesson <= 10 ? 'Начальный' : lesson <= 30 ? 'Базовый' : 'TOPIK I'; }
  function selectedLevel(w) { return `Урок ${w.lesson} · ${getLevel(w.lesson)}`; }
  function startClock() { if (!state.startedAt) state.startedAt = Date.now(); }
  function fmtTime(sec) { const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60); return h ? `${h} ч ${m} мин` : `${m} мин`; }
  function activeSeconds() { return state.totalSeconds + (state.startedAt ? Math.floor((Date.now()-state.startedAt)/1000) : 0); }
  function percent() { return vocab.length ? Math.round(state.learnedIds.length/vocab.length*100) : 0; }
  function achievements() { return [
    {icon:'🌱',name:'Первые 10 слов',desc:'Познакомиться с 10 словами',ok:state.learnedIds.length>=10},
    {icon:'📚',name:'Первый урок',desc:'Завершить первый урок',ok:state.completedLessons.includes(1)},
    {icon:'🔥',name:'Серия 50',desc:'50 верных ответов подряд',ok:state.bestStreak>=50},
    {icon:'🏆',name:'500 слов',desc:'Изучить 500 слов',ok:state.learnedIds.length>=500},
    {icon:'👑',name:'Весь словарь',desc:`Изучить все ${vocab.length} слов`,ok:state.learnedIds.length>=vocab.length}
  ]; }
  function header(title, sub='') { return `<div class="section-heading"><div><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div></div>`; }
  function renderHome() {
    const done=state.completedLessons.length, current=Math.min(50,done+1), earned=achievements();
    app.innerHTML = `<section class="hero"><div class="hero-copy"><div class="eyebrow">ТВОЙ ПУТЬ К TOPIK I</div><h1>Слово за словом.<br>Уверенно к цели.</h1><p>Короткие уроки, активное вспоминание и повторение в нужный момент.</p>${validSession()?`<div class="study-tip">Сохранено: ${esc(sessionLabel())}</div>`:''}<button class="primary-btn" data-action="continue">${validSession()?'Продолжить с сохранённого места':done?'Продолжить обучение':'Начать первый урок'} <span>→</span></button></div><div class="hero-art"><span>한</span></div></section>
      ${header('Твоя статистика','У каждого слова свой ритм повторения.')}
      <div class="stats-grid"><div class="stat-card"><span class="stat-icon tint-purple">◉</span><div><strong>${state.learnedIds.length}</strong><small>изучено слов</small></div></div><div class="stat-card"><span class="stat-icon tint-mint">✓</span><div><strong>${Object.values(state.words).filter(s=>s.status==='mastered').length}</strong><small>выучено</small></div></div><div class="stat-card"><span class="stat-icon tint-coral">⌛</span><div><strong>${Math.max(0,vocab.length-state.learnedIds.length)}</strong><small>осталось</small></div></div><div class="stat-card"><span class="stat-icon tint-yellow">◷</span><div><strong>${fmtTime(activeSeconds())}</strong><small>время обучения</small></div></div><div class="stat-card"><span class="stat-icon tint-coral">!</span><div><strong>${state.errors}</strong><small>ошибок</small></div></div><div class="stat-card"><span class="stat-icon tint-yellow">🔥</span><div><strong>${state.streak}</strong><small>верных ответов подряд</small></div></div></div>
      <div class="dashboard-grid"><section class="panel"><h3 class="panel-title">Мой курс</h3><div class="progress-head"><span>Общий прогресс</span><b>${percent()}%</b></div><div class="progress-track"><div class="progress-fill" style="width:${percent()}%"></div></div><div class="course-foot"><span>${done} из 50 уроков завершено</span><span>${vocab.length} слов</span></div><div class="lesson-next"><div><b>Урок ${current} · ${getLevel(current)}</b><small>${lessonWords(current).length} новых слов · 5 этапов</small></div><button class="round-arrow" data-action="continue">→</button></div></section>
      <section class="panel"><h3 class="panel-title">Мои достижения</h3><div class="achievement-list">${earned.map(a=>`<div class="achievement-row ${a.ok?'earned':''}"><span class="achievement-icon">${a.icon}</span><span class="achievement-copy"><b>${a.name}</b><small>${a.desc}</small></span>${a.ok?'<span class="earned-check">✓</span>':''}</div>`).join('')}</div></section></div>
      ${dueWords().length?`<section class="panel" style="margin-top:16px;display:flex;align-items:center;justify-content:space-between"><div><b>Пора повторить ${dueWords().length} слов</b><div class="study-tip">Повторение закрепит их в памяти.</div></div><button class="secondary-btn" data-view="review">К повторению →</button></section>`:''}`;
  }
  function renderCourse() {
    const done=new Set(state.completedLessons), current=Math.min(50,done.size+1);
    app.innerHTML = `${header('Курс TOPIK I','50 последовательных уроков · примерно 33–34 слова в каждом')}
      <section class="panel" style="margin-bottom:17px"><div class="progress-head"><span>Пройдено уроков</span><b>${done.size} / 50</b></div><div class="progress-track"><div class="progress-fill" style="width:${done.size*2}%"></div></div><div class="course-foot"><span>Урок ${current} открыт</span><span>${percent()}% слов изучено</span></div></section>
      <div class="lesson-grid">${Array.from({length:50},(_,i)=>{const n=i+1, words=lessonWords(n), completed=done.has(n), unlocked=n===1||done.has(n-1), studied=words.filter(w=>state.learnedIds.includes(w.id)).length;return `<article class="lesson-card ${completed?'completed':''} ${unlocked?'unlocked':'locked'}" ${unlocked?`data-lesson="${n}"`:''}><span class="lesson-num">${completed?'✓':n}</span><span class="lesson-status">${completed?'✓':unlocked?'→':'🔒'}</span><h3>Урок ${n}</h3><p>${words.length} слов · ${getLevel(n)}</p><div class="lesson-progress"><span style="width:${words.length?Math.round(studied/words.length*100):0}%"></span></div></article>`}).join('')}</div>`;
  }
  function renderLesson() {
    const steps=[['study','Изучение'],['cards','Карточки'],['practice','Практика'],['spelling','Написание'],['reading','Мини-текст']];
    const sw=lessonWords(lessonId); if(!sw.length){app.innerHTML='<div class="empty-state">Урок не найден.</div>';return;}
    const stageIndex=steps.findIndex(x=>x[0]===stage);
    const stageContent=renderStage(sw);save();
    app.innerHTML=`<div class="lesson-header"><button class="back-btn" data-view="course">←</button><div class="lesson-title"><h1>Урок ${lessonId}</h1><p>${sw.length} новых слов · ${getLevel(lessonId)}</p></div></div><div class="stepper">${steps.map((s,i)=>`<div class="step-chip ${stage===s[0]?'active':''} ${i<stageIndex?'done':''}"><span>${i<stageIndex?'✓':i+1}</span>${s[1]}</div>`).join('')}</div><div class="lesson-work">${stageContent}</div>`;
  }
  function speak(text) { if(!('speechSynthesis' in window)){toast('Озвучка недоступна в этом браузере');return;} speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=.82;speechSynthesis.speak(u); }
  function renderStage(sw) {
    const w=sw[cursor%sw.length];
    if(stage==='study') return `<section class="panel study-card"><div class="study-index">СЛОВО ${cursor+1} ИЗ ${sw.length}</div><div class="study-word">${esc(w.ko)}</div><span class="study-pos">${esc(w.pos)}</span><div class="study-meaning">${esc(meaning(w))}</div><button class="audio-btn" data-speak="${esc(w.ko)}" aria-label="Озвучить">🔊</button><p class="study-example">${esc(w.exampleKo)}</p><div class="study-translation">${esc(w.exampleRu)}</div></section><div class="stage-footer"><button class="outline-btn" data-action="previous-word" ${cursor===0?'disabled':''}>← Назад к слову</button><span class="stage-counter">${cursor+1} / ${sw.length}</span><button class="primary-btn" data-action="next-study">${cursor+1===sw.length?'К карточкам':'Дальше'} →</button></div>`;
    if(stage==='cards') return renderCards(sw);
    if(stage==='practice') return renderQuiz(sw,'practice');
    if(stage==='spelling') return renderQuiz(sw,'spelling');
    return renderReading(sw);
  }
  function group(w) { const s=(w.en||'').toLowerCase();const groups=[['деньги и цены',/price|cost|fee|fare|charge|money|cash|bill|salary|wage|discount|payment|pay|expensive|cheap|receipt|coin/],['еда',/food|eat|drink|meal|rice|bread|fruit|vegetable|meat|fish|coffee|tea|restaurant|cook|taste|menu|snack|soup|potato|egg|water|noodle|dish|sauce|soy|persimmon/],['одежда',/clothes|clothing|shirt|pants|skirt|dress|coat|jacket|shoes|socks|hat|wear|put on|take off|fashion/],['тело и здоровье',/body|head|face|eye|ear|nose|mouth|hand|arm|foot|leg|hair|tooth|stomach|chest|breast|health|sick|ill|pain|hospital|medicine|doctor|nurse/],['семья и люди',/family|mother|father|parent|brother|sister|grandmother|grandfather|aunt|uncle|child|baby|son|daughter|wife|husband|person|people|friend|teacher|student|police|employee|professor|singer|artist|customer|guest|neighbor|man|woman/],['дом и вещи',/furniture|house|home|room|kitchen|bathroom|bedroom|door|window|table|chair|desk|bed|sofa|lamp|mirror|refrigerator|building|key|bag|umbrella|computer|phone|camera|notebook|ticket/],['инструменты и предметы',/scissors|knife|tool|equipment|instrument|machine|device|bottle|cup|glass|plate|spoon|fork|box|paper|pen|pencil/],['цвета',/color|colour|black|white|red|blue|brown|yellow|green|gray|grey|pink|purple/],['места',/place|store|shop|school|station|airport|room|house|home|building|park|street|city|country|office|hotel|library|church|classroom|university|village|market|museum|theater|theatre/],['передвижение',/\bgo\b|\bcome\b|walk|run|travel|bus|train|subway|taxi|car|airplane|bicycle|road|traffic|trip|transfer|arrive|leave|ride|drive|transport|move/],['учёба и речь',/study|school|university|student|teacher|book|class|lesson|language|word|exam|test|write|read|learn|teach|homework|textbook|speak|say|talk|listen|hear|ask|answer|explain/],['время и сезоны',/time|day|week|month|year|today|tomorrow|yesterday|morning|afternoon|evening|night|hour|minute|season|holiday|weekend|date|autumn|fall|winter|spring|summer/],['количество и положение',/most|least|each|every|all|whole|many|much|few|little|middle|center|centre|side|left|right|front|back|inside|outside|near|far/],['природа',/weather|rain|snow|sun|cloud|wind|hot|cold|warm|cool|mountain|river|sea|beach|tree|branch|flower|animal|plant|leaf|garden|forest/],['чувства и свойства',/happy|glad|sad|angry|lonely|afraid|scary|funny|interesting|boring|kind|friendly|busy|tired|hungry|thirsty|beautiful|pretty|cute|clean|dirty|quiet|noisy|easy|difficult|simple|complicated|comfortable|convenient|strong|weak|bright|dark|fast|slow|long|short|wide|narrow|heavy|light|soft|hard|anxiety|worry|thank|gratitude|impressed|impression|like|love|hope|concern|surprise/]];return groups.find(x=>new RegExp(`\\b(?:${x[1].source})\\b`,'i').test(s))?.[0]||''; }
  function posFamilies(w) {
    const p=String(w.pos||'').toLowerCase(),families=[];
    if(p.includes('существительн'))families.push('существительное');if(p.includes('глагол'))families.push('глагол');if(p.includes('прилагательн'))families.push('прилагательное');if(p.includes('нареч'))families.push('наречие');if(p.includes('частиц'))families.push('частица');if(p.includes('местоимен'))families.push('местоимение');if(p.includes('междомет'))families.push('междометие');
    if(!families.length)families.push(p.split(/[ /]/)[0]);return families;
  }
  function meaningKeys(w) { return meanings(w).map(x=>norm(x).replace(/ё/g,'е')).filter(Boolean); }
  function sharesMeaning(a,b) { const keys=new Set(meaningKeys(a));return meaningKeys(b).some(x=>keys.has(x)); }
  function distractors(target, count=3) {
    const topic=group(target),targetPos=posFamilies(target),pool=vocab.filter(x=>x.id!==target.id&&targetPos.some(p=>posFamilies(x).includes(p))&&!sharesMeaning(target,x));
    const scored=pool.map(x=>({word:x,score:scoreDistractor(target,x)+(topic&&group(x)===topic?8:0)+(targetPos.some(p=>posFamilies(x).includes(p))?5:0)+(x.lesson===target.lesson?1:0)}));
    scored.sort((a,b)=>b.score-a.score||Math.abs(a.word.id-target.id)-Math.abs(b.word.id-target.id)||a.word.id-b.word.id);
    const out=[],labels=new Set([norm(meaning(target))]);
    for(const {word} of scored){const label=norm(meaning(word));if(out.length>=count)break;if(!label||labels.has(label)||out.some(y=>sharesMeaning(y,word)))continue;out.push(word);labels.add(label);}
    return out;
  }
  function scoreDistractor(a,b) {
    const stop=new Set(['that','this','with','from','have','been','very','much','some','there','their','about','make','made','take','give','person','thing','kind','для','быть','этот','эта','это','как','или','при','из','на','по']);
    const tokens=(s,re)=>String(s||'').toLowerCase().split(re).filter(v=>v.length>2&&!stop.has(v));
    const ax=tokens(a.en,/[^a-z]+/),by=new Set(tokens(b.en,/[^a-z]+/)),ar=tokens(meaning(a),/[^а-яёa-z]+/u),br=new Set(tokens(meaning(b),/[^а-яёa-z]+/u));
    return ax.filter(v=>by.has(v)).length*4+ar.filter(v=>br.has(v)).length*3;
  }
  function shuffle(a) { return [...a].sort(()=>Math.random()-.5); }
  function questionType(i) { return ['kor-ru','ru-ko','blank'][i%3]; }
  function newQuiz(sw,kind) {
    const candidates=kind==='review'?dueWords():sw;
    if(!candidates.length)return null;
    const targets=shuffle(kind==='review'?candidates.slice(0,8):candidates);
    return {kind,allIds:targets.map(w=>w.id),targets,index:0,passedIds:[],correct:0,round:1,answered:false,choice:null,feedback:'',input:'',spellMode:'blocks',blockPool:[],blockPick:[],blockTargetId:null};
  }
  function currentQuestion(q) { return q.targets[q.index]; }
  function passedCount(q) { return q.passedIds?.length||0; }
  function quizProgress(q) { return `${passedCount(q)} / ${q.allIds?.length||q.targets.length} слов вспомнено`; }
  function advanceQuiz(q) {
    q.index++;q.answered=false;q.choice=null;q.feedback='';q.input='';q.blockPick=[];q.blockTargetId=null;q.choiceOptions=null;q.choiceTargetId=null;
    if(q.index>=q.targets.length){
      const passed=new Set(q.passedIds||[]), missing=(q.allIds||[]).filter(id=>!passed.has(id));
      if(missing.length){q.targets=shuffle(missing.map(getWord).filter(Boolean));q.index=0;q.round++;}
    }
  }
  function recordQuizAnswer(q,w,ok) {
    q.answered=true;q.correct+=ok?1:0;
    q.feedback=q.kind==='cards'?'':ok?'Верно! Отлично вспомнила.':`Пока не получилось. Ответ: ${w.ko} — ${meaning(w)}`;
    if(ok&&!q.passedIds.includes(w.id))q.passedIds.push(w.id);
    updateLearning(w,ok);
  }
  function renderCards(sw) {
    if(!quiz||quiz.kind!=='cards')quiz=newQuiz(sw,'cards');
    if(quiz.index>=quiz.targets.length)return `<section class="panel" style="text-align:center;padding:36px"><div class="quiz-type">КАРТОЧКИ ЗАВЕРШЕНЫ</div><h2>Все слова вспомнены</h2><p style="color:var(--muted)">${quizProgress(quiz)}</p><button class="primary-btn" data-action="finish-stage">К практике →</button></section>`;
    const q=quiz,w=currentQuestion(q),revealed=!!q.revealed;
    return `<div class="quiz-progress"><span>КАРТОЧКИ · круг ${q.round}</span><b>${quizProgress(q)}</b></div><div class="study-tip" style="margin:0 0 10px">Сначала попробуй вспомнить перевод, затем открой ответ.</div><section class="panel card-flip ${revealed?'revealed':''}" id="flash-card" data-action="flip"><div class="card-front">${esc(w.ko)}</div><div class="card-back">${esc(meaning(w))}<small>${esc(w.exampleKo)}<br>${esc(w.exampleRu)}</small></div><span class="flip-hint">${revealed?'Ответ открыт':'Нажми, чтобы увидеть значение'}</span></section><div class="stage-footer"><span class="stage-counter">${quizProgress(q)}</span><div class="recall-buttons"><button class="answer-btn again-btn" data-action="recall-again" ${revealed?'':'disabled'}>↻ Не знаю</button><button class="answer-btn know-btn" data-action="recall-know" ${revealed?'':'disabled'}>✓ Знаю</button></div></div>`;
  }
  function syllableChoices(w) {
    const answer=Array.from(w.ko).filter(ch=>/[가-힣]/.test(ch));
    const distractorsPool=vocab.filter(x=>x.id!==w.id&&x.lesson===w.lesson).flatMap(x=>Array.from(x.ko).filter(ch=>/[가-힣]/.test(ch)));
    const extras=shuffle([...new Set(distractorsPool.filter(ch=>!answer.includes(ch)))]).slice(0,Math.min(3,Math.max(2,answer.length)));
    return shuffle([...answer,...extras].map((text,index)=>({text,index})));
  }
  function renderSyllableBuilder(q,w) {
    if(q.blockTargetId!==w.id){q.blockTargetId=w.id;q.blockPool=syllableChoices(w);q.blockPick=[];}
    const picked=new Set(q.blockPick),built=q.blockPick.map(i=>q.blockPool.find(x=>x.index===i)).filter(Boolean);
    return `<div class="syllable-builder"><div class="syllable-answer" aria-label="Собранное слово">${built.length?built.map((x,i)=>`<button class="syllable-tile selected" data-block-remove="${i}" ${q.answered?'disabled':''}>${esc(x.text)}</button>`).join(''):'<span>Нажимай на блоки, чтобы собрать слово</span>'}</div><div class="syllable-bank">${q.blockPool.map(x=>`<button class="syllable-tile" data-syllable="${x.index}" ${q.answered||picked.has(x.index)?'disabled':''}>${esc(x.text)}</button>`).join('')}</div></div>`;
  }
  function optionsFor(q,w) {
    const old=q.choiceOptions,invalid=!Array.isArray(old)||old.length!==4||!old.some(x=>x.id===w.id)||old.some(x=>x.id!==w.id&&sharesMeaning(w,x))||(Array.isArray(old)&&old.some((x,i)=>old.slice(i+1).some(y=>sharesMeaning(x,y)||norm(meaning(x))===norm(meaning(y)))));
    if(q.choiceTargetId!==w.id||invalid){q.choiceTargetId=w.id;q.choiceOptions=shuffle([w,...distractors(w,3)]);}
    return q.choiceOptions;
  }
  function blankSentence(w) {
    const sentence=w.exampleKo||'';
    if(!sentence)return '';
    if(sentence.includes(w.ko))return sentence.replace(w.ko,'＿＿＿');
    if(w.ko.endsWith('다')){
      const stem=w.ko.slice(0,-1);
      const endings='(?:고|서|면|며|면서|러|려고|니까|니|지만|자|게|세요|아요|어요|았|었|는다|는|ㄴ|는지|지|도록|는데|다가|고서)';
      const match=sentence.match(new RegExp(`${stem}(?=${endings})`));
      if(match)return sentence.replace(match[0],'＿＿＿');
    }
    return '';
  }
  function quizQuestionHtml(q) {
    const w=currentQuestion(q);if(!w)return '';
    let type=q.kind==='spelling'?'spelling':q.kind==='review'?'kor-ru':questionType(q.index);
    if(type==='blank'&&(!blankSentence(w)||String(w.pos||'').includes('вспомогательное')))type='kor-ru';
    const opts=optionsFor(q,w);
    if(q.kind==='spelling'||type==='spelling') return `<div class="quiz-progress"><span>НАПИСАНИЕ · круг ${q.round}</span><b>${quizProgress(q)}</b></div><div class="quiz-question"><div class="quiz-prompt">${esc(meaning(w))}</div><div class="quiz-sub">Вспомни и напиши корейское слово</div></div><div class="spell-mode"><button class="${q.spellMode==='blocks'?'active':''}" data-action="spell-mode" data-mode="blocks">Собрать из слогов</button><button class="${q.spellMode==='keyboard'?'active':''}" data-action="spell-mode" data-mode="keyboard">Печатать</button></div>${q.spellMode==='keyboard'?`<input class="fill-input" id="spelling-input" value="${esc(q.input)}" placeholder="Введи корейское слово" autocomplete="off" lang="ko" ${q.answered?'disabled':''}>`:`${renderSyllableBuilder(q,w)}<div class="spell-preview">Твой ответ: <b>${esc(q.blockPick.map(i=>q.blockPool.find(x=>x.index===i)?.text||'').join(''))||'—'}</b></div>`}<div class="answer-feedback ${q.feedback.startsWith('Верно')?'good':q.feedback?'bad':''}">${esc(q.feedback)}</div><div class="stage-footer"><span class="stage-counter">${quizProgress(q)}</span>${q.answered?'<button class="primary-btn" data-action="quiz-next">Дальше →</button>':'<button class="primary-btn" data-action="submit-spelling">Проверить →</button>'}</div>`;
    let prompt='',sub='',choices=[];
    if(type==='kor-ru'){prompt=esc(w.ko);sub='Выбери значение на русском';choices=opts.map(x=>({text:meaning(x),id:x.id}));}
    if(type==='ru-ko'){prompt=esc(meaning(w));sub='Выбери корейское слово';choices=opts.map(x=>({text:x.ko,id:x.id}));}
    if(type==='blank'){const blank=blankSentence(w);prompt=esc(blank);sub='Выбери корейское слово, которое подходит в пропуск';choices=opts.map(x=>({text:x.ko,id:x.id}));}
    return `<div class="quiz-progress"><span>ПРАКТИКА · круг ${q.round}</span><b>${quizProgress(q)}</b></div><div class="quiz-question"><div class="quiz-prompt">${prompt}</div><div class="quiz-sub">${sub}</div></div><div class="option-list">${choices.map(c=>`<button class="option-btn ${q.answered?(c.id===w.id?'correct':q.choice===c.id?'wrong':''):''}" data-choice="${c.id}" ${q.answered?'disabled':''}>${esc(c.text)}</button>`).join('')}</div><div class="answer-feedback ${q.feedback.startsWith('Верно')?'good':q.feedback?'bad':''}">${esc(q.feedback)}</div><div class="stage-footer"><span class="stage-counter">${quizProgress(q)}</span>${q.answered?`<button class="primary-btn" data-action="quiz-next">Дальше →</button>`:''}</div>`;
  }
  function renderQuiz(sw,kind) {
    if(!quiz||quiz.kind!==kind)quiz=newQuiz(sw,kind);
    if(!quiz)return `<div class="empty-state"><b>Пока нечего повторять</b>Когда у слов появится дата повтора, они будут здесь.</div><div class="stage-footer"><button class="primary-btn" data-action="finish-stage">Дальше →</button></div>`;
    if(quiz.index>=quiz.targets.length)return `<section class="panel" style="text-align:center;padding:38px"><div style="font-size:39px">🎉</div><h2>${kind==='practice'?'Все слова урока проверены':'Все слова написаны'}</h2><p style="color:var(--muted)">${quizProgress(quiz)} · кругов повторения: ${quiz.round}</p><button class="primary-btn" data-action="finish-stage">${kind==='practice'?'К написанию →':'К мини-тексту →'}</button></section>`;
    return quizQuestionHtml(quiz);
  }
  function norm(s) { return String(s||'').trim().toLowerCase().replace(/[\s.,!?·•]/g,''); }
  function updateLearning(w,correct) {
    const s=wordState(w.id); const now=Date.now();
    if(correct){
      if(!state.learnedIds.includes(w.id))state.learnedIds.push(w.id);
      const streak=s.streak+1, reps=s.reps+1, ease=Math.min(3.1,s.ease+.08), interval=streak<=1?1:streak===2?3:Math.max(1,Math.round((s.interval||3)*ease));
      setWordState(w.id,{reps,attempts:s.attempts+1,streak,ease,interval,due:now+interval*86400000,status:streak>=5?'mastered':'learning'});
      state.streak++;state.bestStreak=Math.max(state.bestStreak,state.streak);state.correctTotal++;
    }else{setWordState(w.id,{reps:s.reps,attempts:s.attempts+1,lapses:s.lapses+1,streak:0,ease:Math.max(1.3,s.ease-.2),interval:1,due:now+10*60*1000,status:'problem'});state.errors++;state.streak=0;}
    save();updateBadges();
  }
  function updateBadges() { const s=state.streak;document.getElementById('sidebar-streak').textContent=`${s} ответов`;document.getElementById('top-streak').textContent=s;document.getElementById('due-count').textContent=dueWords().length; }
  function answerChoice(id) { if(!quiz||quiz.answered)return;const w=currentQuestion(quiz);quiz.choice=Number(id);recordQuizAnswer(quiz,w,Number(id)===w.id);renderLesson(); }
  function submitSpelling() { if(!quiz||quiz.answered)return;const w=currentQuestion(quiz);const input=quiz.spellMode==='keyboard'?(document.getElementById('spelling-input')?.value||''):quiz.blockPick.map(i=>quiz.blockPool.find(x=>x.index===i)?.text||'').join('');quiz.input=input;if(!input){toast('Сначала составь или напечатай слово');return;}recordQuizAnswer(quiz,w,norm(input)===norm(w.ko));renderLesson(); }
  function readingOptions(q,target,groupWords) {
    if(q.readingTargetId!==target.id||!Array.isArray(q.readingOptions)||q.readingOptions.length!==4){
      const seen=new Set([norm(target.exampleRu)]),candidates=groupWords.filter(w=>w.id!==target.id&&w.exampleRu&&w.exampleKo).sort((a,b)=>Math.abs(a.exampleRu.length-target.exampleRu.length)-Math.abs(b.exampleRu.length-target.exampleRu.length)||Math.abs(a.exampleKo.length-target.exampleKo.length)-Math.abs(b.exampleKo.length-target.exampleKo.length));
      const options=[target];for(const w of candidates){const key=norm(w.exampleRu);if(!key||seen.has(key))continue;options.push(w);seen.add(key);if(options.length===4)break;}
      q.readingTargetId=target.id;q.readingOptions=shuffle(options);
    }
    return q.readingOptions;
  }
  function renderReading(sw) {
    if(!quiz||quiz.kind!=='reading')quiz={kind:'reading',group:0,targets:[],allIds:[],passedIds:[],index:0,round:1,correct:0,answered:false,choice:null,feedback:'',input:'',readingTargetId:null,readingOptions:null};
    const groups=Math.ceil(sw.length/7);
    if(quiz.group>=groups)return `<section class="panel" style="text-align:center;padding:38px"><div style="font-size:39px">📖</div><h2>Все мини-тексты прочитаны!</h2><p style="color:var(--muted)">Тексты после каждых 5–7 слов · верных ответов: ${quiz.correct}</p><button class="primary-btn" data-action="finish-stage">Завершить урок →</button></section>`;
    const groupWords=sw.slice(quiz.group*7,quiz.group*7+7);
    if(!quiz.targets.length){quiz.targets=[...groupWords];quiz.allIds=groupWords.map(w=>w.id);quiz.passedIds=[];quiz.index=0;quiz.round=1;}
    const target=quiz.targets[quiz.index],choices=readingOptions(quiz,target,groupWords);
    return `<section class="panel"><div class="quiz-progress"><span>МИНИ-ТЕКСТ ${quiz.group+1} / ${groups} · круг ${quiz.round}</span><b>${quizProgress(quiz)}</b></div><h3 class="panel-title" style="margin-top:10px">Прочитай мини-текст</h3><p class="reading-instruction">Вопрос относится к выделенному предложению. Все варианты — переводы фраз из текста.</p><div class="text-box">${groupWords.map(w=>`<p class="reading-line ${w.id===target.id?'reading-line-active':''}">${esc(w.exampleKo)}</p>`).join('')}</div><details class="study-tip reading-translations"><summary>Перевод текста</summary><div>${groupWords.map(w=>`<p class="reading-translation-line ${w.id===target.id?'reading-line-active':''}">${esc(w.exampleRu)}</p>`).join('')}</div></details><div class="text-questions"><div class="text-q"><h3>Какой перевод точнее всего передаёт выделенное предложение?</h3><div class="text-options">${choices.map(x=>`<button class="${quiz.answered?(x.id===target.id?'correct':quiz.choice===x.id?'wrong':''):''}" data-reading-choice="${x.id}" ${quiz.answered?'disabled':''}>${esc(x.exampleRu)}</button>`).join('')}</div><div class="answer-feedback ${quiz.feedback.startsWith('Верно')?'good':quiz.feedback?'bad':''}">${esc(quiz.feedback)}</div></div></div><div class="stage-footer"><span class="stage-counter">Вопрос ${quiz.index+1} / ${quiz.targets.length}</span>${quiz.answered?'<button class="primary-btn" data-action="reading-next">Следующее предложение →</button>':''}</div></section>`;
  }
  function renderReview() {
    const due=dueWords(); if(!quiz||quiz.kind!=='review')quiz=newQuiz([], 'review');
    if(!quiz)return `${header('Повторение','Повторение по расписанию')}<div class="empty-state"><div style="font-size:35px">🌿</div><b>Все слова на сегодня повторены</b>Загляни снова позже или продолжи курс.</div>`;
    app.innerHTML=`${header('Повторение',`${due.length} слов ожидают повторения`)}<div class="lesson-work"><section class="panel">${quizQuestionHtml(quiz)}</section></div>`;
  }
  function renderDictionary(favoritesOnly=false) {
    const query=document.getElementById('dict-search')?.value||'';const filter=document.getElementById('dict-filter')?.value||'all';
    const q=query.toLowerCase().trim();let words=favoritesOnly?vocab.filter(w=>state.favorites.includes(w.id)):vocab;
    if(q)words=words.filter(w=>w.ko.toLowerCase().includes(q)||meanings(w).join(' ').toLowerCase().includes(q));
    if(filter==='favorites')words=words.filter(w=>state.favorites.includes(w.id));
    if(filter==='new')words=words.filter(w=>wordState(w.id).status==='new');
    if(filter==='learning')words=words.filter(w=>wordState(w.id).status==='learning');
    if(filter==='mastered')words=words.filter(w=>wordState(w.id).status==='mastered');
    if(filter==='problem')words=words.filter(w=>wordState(w.id).status==='problem');
    const page=Number(document.getElementById('dict-page')?.value||1),size=30, totalPages=Math.ceil(words.length/size)||1, slice=words.slice((page-1)*size,page*size);
    const title=favoritesOnly?'Избранное':'Словарь';
    app.innerHTML=`${header(title,`${words.length} слов найдено · поиск по корейскому и русскому`)}<div class="search-row"><div class="search-box"><input id="dict-search" type="search" placeholder="Например: 가게 или магазин" value="${esc(query)}"></div><select id="dict-filter" class="filter-select"><option value="all" ${filter==='all'?'selected':''}>Все слова</option><option value="new" ${filter==='new'?'selected':''}>Новые</option><option value="learning" ${filter==='learning'?'selected':''}>Изучаемые</option><option value="mastered" ${filter==='mastered'?'selected':''}>Выученные</option><option value="problem" ${filter==='problem'?'selected':''}>Проблемные</option><option value="favorites" ${filter==='favorites'?'selected':''}>Избранные</option></select>${favoritesOnly?'<button class="secondary-btn" data-action="practice-favorites">Повторить избранное</button>':''}</div>${slice.length?`<div class="word-list">${slice.map(w=>`<div class="word-row" data-word="${w.id}"><span class="word-row-ko">${esc(w.ko)}</span><span class="word-row-ru">${esc(meaning(w))}</span><span class="word-row-pos">${esc(w.pos)}</span><button class="favorite-btn ${state.favorites.includes(w.id)?'is-fav':''}" data-favorite="${w.id}" aria-label="Избранное">${state.favorites.includes(w.id)?'♥':'♡'}</button></div>`).join('')}</div><input id="dict-page" type="hidden" value="${page}"><div class="pagination">${Array.from({length:Math.min(totalPages,7)},(_,i)=>{const n=Math.max(1,Math.min(totalPages-6,page-3))+i;return `<button class="${n===page?'active':''}" data-page="${n}">${n}</button>`}).join('')}</div>`:`<div class="empty-state"><div style="font-size:32px">${favoritesOnly?'♡':'⌕'}</div><b>${favoritesOnly?'Пока нет избранных слов':'Ничего не найдено'}</b>${favoritesOnly?'Отмечай слова сердечком, чтобы быстро возвращаться к ним.':'Попробуй другой запрос.'}</div>`}`;
    document.getElementById('dict-search')?.addEventListener('input',()=>{const v=document.getElementById('dict-search').value;renderDictionary(favoritesOnly);document.getElementById('dict-search').value=v;document.getElementById('dict-search').focus();});
  }
  function toggleFavorite(id) { const n=Number(id);state.favorites=state.favorites.includes(n)?state.favorites.filter(x=>x!==n):[...state.favorites,n];save();render(); }
  function showWord(id) { const w=getWord(id);if(!w)return;const s=wordState(w.id);dialog.innerHTML=`<div class="dialog-inner"><button class="dialog-close" data-dialog-close>×</button><div class="study-pos">${esc(w.pos)}</div><div class="dialog-word">${esc(w.ko)}</div><div class="dialog-meanings">${meanings(w).map(x=>`<div>• ${esc(x)}</div>`).join('')}</div><button class="audio-btn" data-speak="${esc(w.ko)}">🔊</button><div class="dialog-example">${esc(w.exampleKo)}</div><div class="dialog-example-ru">${esc(w.exampleRu)}</div><div class="dialog-meta">${selectedLevel(w)} · успешных повторений: ${s.reps} · подряд: ${s.streak}</div><div class="stage-footer"><button class="secondary-btn" data-favorite="${w.id}">${state.favorites.includes(w.id)?'♥ В избранном':'♡ В избранное'}</button><button class="primary-btn" data-dialog-close>Закрыть</button></div></div>`;dialog.showModal(); }
  function render() { document.querySelectorAll('.nav-item[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view)); updateBadges();if(view==='home')renderHome();else if(view==='course')renderCourse();else if(view==='lesson')renderLesson();else if(view==='review')renderReview();else if(view==='dictionary')renderDictionary(false);else if(view==='favorites')renderDictionary(true); }
  function startLesson(id) { id=Number(id);if(validSession()&&state.session.lessonId===id){lessonId=id;stage=state.session.stage;cursor=Math.max(0,Number(state.session.cursor)||0);quiz=state.session.quiz||null;}else{lessonId=id;stage='study';cursor=0;quiz=null;}view='lesson';state.openedLessons=[...new Set([...state.openedLessons,lessonId])];startClock();render(); }
  function nextStage(sw) { const seq=['study','cards','practice','spelling','reading'];const i=seq.indexOf(stage);if(i<seq.length-1){stage=seq[i+1];cursor=0;quiz=null;render();}else finishLesson(sw); }
  function finishLesson(sw) { state.completedLessons=[...new Set([...state.completedLessons,lessonId])];if(lessonId<50)state.openedLessons=[...new Set([...state.openedLessons,lessonId+1])];state.session=null;view='course';save();toast(`Урок ${lessonId} завершён! Новый урок открыт.`);render(); }
  function finishStage() { if(stage==='cards'){nextStage(lessonWords(lessonId));return;}if(stage==='practice')stage='spelling';else if(stage==='spelling')stage='reading';else if(stage==='reading'){finishLesson(lessonWords(lessonId));return;}quiz=null;cursor=0;render(); }
  function finishReview() { quiz=null;view='review';render(); }
  async function initialize(data) {
    if(!Array.isArray(data)||!data.length)throw new Error('JSON не содержит списка слов.');
    vocab=data.map((w,i)=>({...w,lesson:Math.floor(i*50/data.length)+1,ru:Array.isArray(w.ru)?w.ru:[w.ru||w.en||'']}));
    try{localStorage.setItem(KEYS.data,JSON.stringify(vocab));}catch{}
    picker.hidden=true;
    const saved=state.session;
    if(validSession()){
      lessonId=saved.lessonId;stage=saved.stage;cursor=Math.max(0,Number(saved.cursor)||0);quiz=saved.quiz||null;view='lesson';startClock();render();toast('Продолжили с сохранённого места');
    }else{view='home';render();}
  }
  async function loadVocab() {
    // Prefer the bundled JSON on every server launch so vocabulary edits are not
    // hidden behind a stale localStorage copy. Keep the cache for file:// fallback.
    try {const r=await fetch('vocabulary.json',{cache:'no-store'});if(!r.ok)throw new Error('');await initialize(await r.json());return;}
    catch {
      try {const cached=localStorage.getItem(KEYS.data);if(cached){await initialize(JSON.parse(cached));return;}}catch{}
      if(location.protocol==='file:')picker.hidden=false;else app.innerHTML='<div class="empty-state"><b>Не удалось загрузить словарь</b>Проверь, что vocabulary.json лежит рядом с index.html.</div>';
    }
  }

  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-view]');if(target){view=target.dataset.view;if(view==='lesson')startLesson(Math.min(50,state.completedLessons.length+1));else if(view==='review')quiz=null;render();return;}
    const lesson=e.target.closest('[data-lesson]');if(lesson){const n=Number(lesson.dataset.lesson);if(n===1||state.completedLessons.includes(n-1))startLesson(n);return;}
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action){
      if(action==='continue')startLesson(validSession()?state.session.lessonId:Math.min(50,state.completedLessons.length+1));
      else if(action==='previous-word'&&cursor>0){cursor--;render();}
      else if(action==='next-study'){const sw=lessonWords(lessonId);if(cursor<sw.length-1){cursor++;render();}else nextStage(sw);}
      else if(action==='flip'&&quiz?.kind==='cards'){quiz.revealed=true;renderLesson();}
      else if(action==='recall-again'||action==='recall-know'){if(quiz?.kind!=='cards'||quiz.answered||!quiz.revealed)return;const w=currentQuestion(quiz),ok=action==='recall-know';recordQuizAnswer(quiz,w,ok);quiz.revealed=false;advanceQuiz(quiz);renderLesson();}
      else if(action==='quiz-next'){advanceQuiz(quiz);if(quiz.kind==='review'&&quiz.index>=quiz.targets.length){finishReview();return;}render();}
      else if(action==='spell-mode'){if(quiz&&!quiz.answered){quiz.spellMode=e.target.closest('[data-mode]').dataset.mode;quiz.blockTargetId=null;renderLesson();}}
      else if(action==='reading-next'){quiz.index++;quiz.answered=false;quiz.choice=null;quiz.feedback='';quiz.readingTargetId=null;quiz.readingOptions=null;if(quiz.index>=quiz.targets.length){const passed=new Set(quiz.passedIds),missing=quiz.allIds.filter(id=>!passed.has(id));if(missing.length){quiz.targets=shuffle(missing.map(getWord).filter(Boolean));quiz.index=0;quiz.round++;}else{quiz.group++;quiz.index=0;quiz.targets=[];quiz.allIds=[];quiz.passedIds=[];}}render();}
      else if(action==='submit-spelling')submitSpelling();
      else if(action==='finish-stage')finishStage();
      else if(action==='practice-favorites'){const items=vocab.filter(w=>state.favorites.includes(w.id));if(!items.length){toast('Добавь в избранное хотя бы одно слово');return;}view='review';quiz=newQuiz(items,'review');render();}
      else if(action==='theme'){document.body.classList.toggle('dark');localStorage.setItem(KEYS.theme,document.body.classList.contains('dark')?'dark':'light');document.getElementById('theme-label').textContent=document.body.classList.contains('dark')?'тёмная':'светлая';}
      else if(action==='menu')document.getElementById('sidebar').classList.toggle('open');
      return;
    }
    if(e.target.closest('[data-syllable]')){if(quiz?.kind==='spelling'&&!quiz.answered){const idx=Number(e.target.closest('[data-syllable]').dataset.syllable);if(!quiz.blockPick.includes(idx))quiz.blockPick.push(idx);renderLesson();}return;}
    if(e.target.closest('[data-block-remove]')){if(quiz?.kind==='spelling'&&!quiz.answered){quiz.blockPick.splice(Number(e.target.closest('[data-block-remove]').dataset.blockRemove),1);renderLesson();}return;}
    if(e.target.closest('[data-choice]')){answerChoice(e.target.closest('[data-choice]').dataset.choice);return;}
    if(e.target.closest('[data-reading-choice]')){if(!quiz||quiz.answered)return;const id=Number(e.target.closest('[data-reading-choice]').dataset.readingChoice),w=quiz.targets[quiz.index];quiz.choice=id;recordQuizAnswer(quiz,w,id===w.id);render();return;}
    if(e.target.closest('[data-favorite]')){const id=e.target.closest('[data-favorite]').dataset.favorite;toggleFavorite(id);if(dialog.open)showWord(id);return;}
    if(e.target.closest('[data-word]')){showWord(e.target.closest('[data-word]').dataset.word);return;}
    if(e.target.closest('[data-speak]')){speak(e.target.closest('[data-speak]').dataset.speak);return;}
    if(e.target.closest('[data-page]')){const val=e.target.closest('[data-page]').dataset.page;renderDictionary(view==='favorites');document.getElementById('dict-page').value=val;renderDictionary(view==='favorites');return;}
    if(e.target.closest('[data-dialog-close]'))dialog.close();
  });
  document.addEventListener('change',e=>{if(e.target.id==='dict-filter')renderDictionary(view==='favorites');});
  document.addEventListener('input',e=>{if(e.target.id==='spelling-input'&&quiz){quiz.input=e.target.value;save();}});
  document.addEventListener('keydown',e=>{if(e.target.id==='spelling-input'&&e.key==='Enter')submitSpelling();if(e.key==='Escape')document.getElementById('sidebar').classList.remove('open');});
  window.addEventListener('pagehide',()=>{if(state.startedAt){state.totalSeconds=activeSeconds();state.startedAt=0;}save();});
  document.getElementById('theme-toggle').addEventListener('click',()=>{document.body.classList.toggle('dark');const dark=document.body.classList.contains('dark');localStorage.setItem(KEYS.theme,dark?'dark':'light');document.getElementById('theme-label').textContent=dark?'тёмная':'светлая';});
  document.getElementById('menu-toggle').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
  document.getElementById('vocabulary-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{await initialize(JSON.parse(await file.text()));toast('Словарь загружен — интернет не нужен');}catch(err){toast('Не удалось прочитать JSON: '+err.message);}});
  const savedTheme=localStorage.getItem(KEYS.theme);if(savedTheme==='dark')document.body.classList.add('dark');document.getElementById('theme-label').textContent=savedTheme==='dark'?'тёмная':'светлая';
  setInterval(()=>{if(state.startedAt){state.totalSeconds=activeSeconds();state.startedAt=Date.now();save();}},60000);
  loadVocab();
})();
