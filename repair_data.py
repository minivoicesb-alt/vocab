import json,re
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'outputs'/'vocabulary.json'
data=json.loads(p.read_text(encoding='utf8'))
adj_terms=['close','light','simple','easy','same','beautiful','hungry','okay','fine','clean','clear','far','expensive','cheap','fast','slow','busy','possible','impossible','complicated','tall','short','long','heavy','empty','full','bored','boring','good','bad','delicious','tasty','cold','hot','warm','cool','small','big','large','quiet','loud','dirty','interesting','convenient','necessary','famous','important','safe','dangerous','strong','weak','bright','dark','cloudy','happy','sad','tired','kind','funny','pretty','cute','young','old','new','old-fashioned','early','late','comfortable','uncomfortable','healthy','sick','sore','thirsty','free','available','similar','different','correct','wrong','right','wrong','fun','friendly','strange','normal','special','same','low','high','wide','narrow','thick','thin','soft','hard','sweet','salty','spicy','bitter','sour','fresh','stale','wet','dry','warm','cool','hot','cold','quiet','noisy','convenient','inconvenient','clean','messy','lazy','diligent','careful','careless','polite','impolite','familiar','unfamiliar','comfortable','uncomfortable','simple','complicated','easy','difficult','hard','heavy','light','strong','weak','healthy','sick','beautiful','ugly','handsome','pretty','cute']
verb_terms=['go','come','do','make','take','put','give','get','have','be at','be in','be located','exist','eat','drink','walk','run','read','write','speak','say','listen','hear','see','watch','look','meet','learn','study','teach','work','play','sing','dance','sleep','wake','buy','sell','open','close','find','wait','help','live','like','love','want','need','know','think','use','change','start','begin','finish','end','stop','arrive','leave','travel','worry','thank','clean','wash','prepare','exercise','borrow','lend','choose','decide','remember','forget','happen','rain','snow','blow','cross','transfer','fix','confirm','check','welcome','get married','marry','calculate','continue','call','bet','hang','wear','carry','drive','ride','bring','send','receive','move','return','sit','stand','ask','answer','wait','rest','sell','cost','mean','become','turn','grow','be born','die','pass','fail','pass by','leave','enter','exit','use','need','believe','think','hope','plan','promise','begin','finish','practice','repeat','show','introduce','invite','celebrate','connect','disconnect','cut','fold','wrap','close','cover','catch','get caught','take time']
def new_pos(w):
    en=(w.get('en') or '').lower().strip(); first=re.split(r'[,;]',en)[0].strip()
    if w['ko'].endswith('다'):
        if first.startswith('be ') and any(t in first for t in ['be healthy','be happy','be kind','be beautiful','be hungry','be okay','be busy','be quiet','be careful','be possible','be necessary','be similar','be different','be famous','be safe','be dangerous','be strong','be weak','be late','be early']):return 'прилагательное'
        if any(t in first for t in adj_terms) or first in adj_terms:return 'прилагательное'
        if first.startswith('be ') and any(t in first for t in ['be good','be bad','be fine','be clean','be clear','be expensive','be cheap','be difficult','be easy','be comfortable','be tired','be cold','be hot']):return 'прилагательное'
        if any(t in first for t in verb_terms):return 'глагол'
        if re.match(r'^(to\s+)',first):return 'глагол'
        # Korean citation forms ending in 다 are predicates; an unmarked gloss is
        # more often an adjective than a noun, so keep it out of the noun class.
        return 'прилагательное'
    return w.get('pos') or 'существительное'

overrides={
 '갈아타다':['пересаживаться (на другой автобус, поезд)'],
 '걸리다':['попадаться','занимать время','быть подвешенным','быть подключённым'],
 '걸다':['вешать','делать ставку','звонить'],
 '감동':['волнение','сильное впечатление','растроганность'],
 '감사':['благодарность','признательность'],
 '감다':['закрывать (глаза)','обматывать'],
 '가지':['ветка','разновидность','баклажан'],
 '같다':['быть таким же','быть похожим'],
 '건강하다':['быть здоровым'],
 '걱정':['беспокойство','тревога'],
 '걱정하다':['беспокоиться','волноваться'],
 '계시다':['находиться','быть (вежливая форма)'],
 '고프다':['быть голодным'],
 '곱다':['красивый','миловидный'],
 '낫다':['выздоравливать','становиться лучше'],
 '적다':['быть малочисленным','записывать'],
 '힘':['сила','энергия','влияние']
}
for w in data:
    w['pos']=new_pos(w)
    if w['ko']=='감다':w['pos']='глагол'
    if w['ko']=='낫다':w['pos']='глагол'
    if w['ko']=='적다':w['pos']='прилагательное / глагол'
    if w['ko'] in overrides:
        w['ru']=overrides[w['ko']];w['ruSource']='Editorial correction to the source gloss'
p.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
print('updated POS for citation forms and curated key glosses')
