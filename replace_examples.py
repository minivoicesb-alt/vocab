import json,re,time,urllib.parse,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
vp=root/'outputs'/'vocabulary.json';progress=root/'work'/'example_translation_progress.json'
words=json.loads(vp.read_text(encoding='utf8'))

def batchim(s):return bool(s and '가'<=s[-1]<='힣' and (ord(s[-1])-0xAC00)%28)
def particle(s,with_c='을',without_c='를'):return with_c if batchim(s) else without_c
def conjugate_adj(w):
    known={'좋다':'좋아요','많다':'많아요','작다':'작아요','크다':'커요','춥다':'추워요','덥다':'더워요','어렵다':'어려워요','쉽다':'쉬워요','가깝다':'가까워요','무겁다':'무거워요','가볍다':'가벼워요','맵다':'매워요','귀엽다':'귀여워요','아름답다':'아름다워요','바쁘다':'바빠요','예쁘다':'예뻐요','기쁘다':'기뻐요','나쁘다':'나빠요','아프다':'아파요','배고프다':'배고파요','고프다':'고파요','빠르다':'빨라요','다르다':'달라요','모르다':'몰라요','이르다':'일러요','푸르다':'푸르러요','쓰다':'써요','크다':'커요','높다':'높아요','낮다':'낮아요','좋아하다':'좋아해요','행복하다':'행복해요','건강하다':'건강해요','깨끗하다':'깨끗해요','친절하다':'친절해요','조용하다':'조용해요','시끄럽다':'시끄러워요','따뜻하다':'따뜻해요','시원하다':'시원해요','편하다':'편해요','불편하다':'불편해요','재미있다':'재미있어요','맛있다':'맛있어요','맛없다':'맛없어요','재미없다':'재미없어요','괜찮다':'괜찮아요','많다':'많아요'}
    if w in known:return known[w]
    stem=w[:-1]
    if stem.endswith('하'):return stem[:-1]+'해요'
    if not stem:return w
    syll=ord(stem[-1]); offset=syll-0xAC00
    if offset<0 or offset>11171:return stem+'어요'
    jong=offset%28; jung=(offset//28)%21
    # ㅂ adjectives commonly replace ㅂ with 워요/와요.
    if jong==17:
        base=chr(syll-17)
        return base+('와요' if jung in (0,8) else '워요')
    # ㅡ drops before 아/어요.
    if jung==18:
        prev=stem[-2] if len(stem)>1 else ''
        pv=((ord(prev)-0xAC00)//28)%21 if prev and '가'<=prev<='힣' else 0
        vowel='ㅏ' if pv in (0,8) else 'ㅓ'
        return stem[:-1]+chr(0xAC00+(offset//588)*588+(0 if vowel=='ㅏ' else 4)*28)+('요')
    if jung==8 and jong==0:return stem[:-1]+chr(syll+8)+'요' # 오 -> 와
    if jung==20 and jong==0:return stem[:-1]+chr(syll-15*28)+'요' # ㅣ + 어요 contracts to ㅕ요
    suffix='아요' if jung in (0,8) else '어요'
    return stem+suffix

food_words=('food','eat','rice','bread','fruit','apple','orange','banana','vegetable','meat','fish','coffee','tea','snack','soup','potato','egg','drink','water','noodle','meal','dish','cook','restaurant')
place_words=('place','store','shop','school','station','airport','room','house','home','building','park','street','city','country','office','hotel','hospital','library','bank','church','classroom','university','village','market','mountain','river','sea','beach','museum','theater','theatre')
people_words=('person','people','friend','mother','father','parent','brother','sister','grandmother','grandfather','aunt','uncle','child','baby','son','daughter','wife','husband','teacher','student','doctor','nurse','police','employee','professor','singer','artist','customer','guest','neighbor','man','woman','family')
def make_ko(w):
    ko=w['ko'];en=(w.get('en')or'').lower();pos=w.get('pos','')
    if any(x in pos for x in ('глагол','прилагательное')) and ko.endswith('다'):
        if pos.startswith('прилагательное') or pos=='прилагательное / глагол':
            adj=conjugate_adj(ko); first=(en.split(',')[0])
            if any(x in en for x in ('weather','cloudy','sunny','rainy')) or any(x in first for x in ('cold','hot','warm','cool','cloudy','clear')):return f'오늘 날씨가 {adj}.'
            if any(x in first for x in ('hungry','thirsty','tired','sick','happy','sad','angry','busy')):return f'저는 오늘 정말 {adj}.'
            return f'이곳은 정말 {adj}.'
        return f'저는 오늘 {ko[:-1]}고 싶어요.'
    if 'наречие' in pos:
        return f'저는 {ko} 한국어를 공부해요.'
    if 'числительное' in pos or 'местоимение' in pos or 'частица' in pos or 'определительное слово' in pos:
        return f'오늘 수업에서 ‘{ko}’라는 단어를 배웠어요.'
    if any(x in en for x in food_words):
        verb='마셨어요' if any(x in en for x in ('coffee','tea','drink','water')) else '먹었어요'
        return f'저는 어제 {ko}{particle(ko)} {verb}.'
    if any(x in en for x in place_words):
        return f'저는 지난 주말에 {ko}에 갔어요.'
    if any(x in en for x in people_words):
        return f'저는 어제 {ko}{particle(ko)} 만났어요.'
    if ko.endswith('다'):
        return f'저는 오늘 {ko[:-1]}고 싶어요.'
    if any(x in en for x in ('travel','trip','journey','vacation','holiday')):
        return f'저는 다음 주에 {ko}을 계획하고 있어요.'
    if any(x in en for x in ('book','phone','computer','bag','car','clothes','shoes','ticket','camera','notebook','textbook','tool','furniture','umbrella')):
        return f'저는 매일 {ko}{particle(ko)} 사용해요.'
    return f'오늘 수업에서 {ko}에 대해 이야기했어요.'

def translate(sentences):
    q=urllib.parse.urlencode({'client':'dict-chrome-ex','sl':'ko','tl':'ru','q':'\n'.join(sentences)})
    req=urllib.request.Request('https://clients5.google.com/translate_a/t?'+q,headers={'User-Agent':'Mozilla/5.0'})
    raw=json.loads(urllib.request.urlopen(req,timeout=25).read().decode('utf8'))[0]
    rows=re.split(r'\\n|\r?\n',raw)
    return [x.strip() for x in rows]

for w in words:w['exampleKo']=make_ko(w)
special={
  '걸리다':('집에서 학교까지 가는 데 30분 걸려요.','Дорога из дома до школы занимает 30 минут.'),
  '갈아타다':('서울역에서 지하철을 갈아탔어요.','На станции Сеул я пересел(а) на другую линию метро.'),
  '걸다':('친구에게 전화를 걸었어요.','Я позвонил(а) другу.'),
  '감다':('저는 눈을 감았어요.','Я закрыл(а) глаза.'),
  '같다':('이것은 저것과 같아요.','Это такое же, как то.'),
  '적다':('새 단어를 공책에 적었어요.','Я записал(а) новое слово в тетрадь.'),
  '감사하다':('도와줘서 정말 감사해요.','Большое спасибо за помощь.'),
  '사과':('저는 어제 사과를 먹었어요.','Вчера я съел(а) яблоко.'),
  '가볍다':('이 가방은 아주 가벼워요.','Эта сумка очень лёгкая.'),
  '감자':('감자로 맛있는 음식을 만들었어요.','Я приготовил(а) вкусное блюдо из картофеля.'),
}
done={}
if progress.exists():done=json.loads(progress.read_text(encoding='utf8'))
todo=[w for w in words if str(w['id']) not in done]
print(f'translating examples {len(todo)}',flush=True)
for start in range(0,len(todo),30):
    batch=todo[start:start+30]
    try:
        out=translate([w['exampleKo'] for w in batch])
        if len(out)==len(batch):
            for w,s in zip(batch,out):done[str(w['id'])]=s
    except Exception as e:print(f'batch {start+1}: {e}',flush=True)
    progress.write_text(json.dumps(done,ensure_ascii=False),encoding='utf8')
    if start%150==0:print(f'translated examples {len(done)}/{len(words)}',flush=True)
    time.sleep(.1)
for w in words:w['exampleRu']=done.get(str(w['id']),'')
for w in words:
    if w['ko'] in special:w['exampleKo'],w['exampleRu']=special[w['ko']]
vp.write_text(json.dumps(words,ensure_ascii=False,indent=2),encoding='utf8')
print('example translations',sum(bool(w['exampleRu']) for w in words),'/',len(words),flush=True)
