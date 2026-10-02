const fs = require('fs');
const source = fs.readFileSync('outputs/script.js', 'utf8');
const vocab = JSON.parse(fs.readFileSync('outputs/vocabulary.json', 'utf8'));
const start = source.indexOf('  function group(w)');
const end = source.indexOf('  function shuffle(a)', start);
if (start < 0 || end < 0) throw new Error('Could not locate quiz choice generator');
const core = source.slice(start, end);
const norm = s => String(s || '').trim().toLowerCase().replace(/[\s.,!?·•]/g, '');
const meanings = w => Array.isArray(w.ru) ? w.ru : [w.ru || w.en || ''];
const harness = `
const vocab = ${JSON.stringify(vocab)};
const norm = ${norm.toString()};
const meanings = ${meanings.toString()};
const meaning = w => meanings(w).join(' · ');
${core}
const shares = (a,b) => sharesMeaning(a,b);
const result = vocab.map(w => {
  const wrong = distractors(w,3), options=[w,...wrong];
  const noOverlap=options.every((a,i)=>options.slice(i+1).every(b=>!shares(a,b)));
  return {id:w.id,ko:w.ko,topic:group(w),pos:posFamilies(w),wrong:wrong.length,choices:wrong.map(x=>({ko:x.ko,ru:meanings(x),en:x.en})),noOverlap,labelsUnique:new Set(options.map(x=>norm(meaning(x)))).size===options.length};
});
return JSON.stringify({count:result.length,zeroDistractors:result.filter(x=>x.wrong===0),oneDistractor:result.filter(x=>x.wrong===1),twoDistractors:result.filter(x=>x.wrong===2),duplicateMeaningChoices:result.filter(x=>!x.noOverlap),duplicateLabels:result.filter(x=>!x.labelsUnique),price:result.find(x=>x.ko==='가격')});
`;
const result = (new Function(harness))();
const report = JSON.parse(result);
console.log(JSON.stringify({count:report.count,zeroDistractors:report.zeroDistractors.length,oneDistractor:report.oneDistractor.length,twoDistractors:report.twoDistractors.length,duplicateMeaningChoices:report.duplicateMeaningChoices.length,duplicateLabels:report.duplicateLabels.length,price:report.price,zeroSample:report.zeroDistractors.slice(0,3),oneSample:report.oneDistractor.slice(0,4)},null,2));
