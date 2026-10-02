import concurrent.futures, gzip, html, json, re, threading, time, urllib.parse, urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
VOCAB=ROOT/'outputs'/'vocabulary.json'
CACHE=ROOT/'work'/'krdict_ru_cache.json'
lock=threading.Lock()

class ResultParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.dl=None; self.capture=None; self.blocks=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs); classes=a.get('class','').split()
        if tag=='dl': self.dl={'ko':'','pos':'','ru':[]}
        if self.dl is None:return
        if tag=='span' and any(c.startswith('word_type') for c in classes):self.capture=('ko','')
        elif tag=='span' and 'manyLang5' in classes and self.capture is None:self.capture=('pos','')
        elif tag=='dd' and 'manyLang5' in classes and 'ml20' not in classes:self.capture=('ru','')
    def handle_data(self, data):
        if self.capture:self.capture=(self.capture[0],self.capture[1]+data)
    def handle_endtag(self, tag):
        if self.capture and ((self.capture[0]=='ko' or self.capture[0]=='pos') and tag=='span' or self.capture[0]=='ru' and tag=='dd'):
            key,val=self.capture;val=' '.join(html.unescape(val).split())
            if self.dl is not None:
                if key=='ru' and val:self.dl['ru'].append(val)
                elif key in ('ko','pos') and val:self.dl[key]=val
            self.capture=None
        if tag=='dl' and self.dl is not None:
            if self.dl['ko']:
                self.dl['ko']=re.sub(r'\s+\d+$','',self.dl['ko']).strip()
                self.blocks.append(self.dl)
            self.dl=None

def lookup(w):
    params=urllib.parse.urlencode({'nation':'rus','nationCode':'5','ParaWordNo':'','mainSearchWord':w['ko']})
    url='https://krdict.korean.go.kr/rus/dicMarinerSearch/search?'+params
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; VocabularyResearch/1.0)','Referer':'https://krdict.korean.go.kr/rus','Accept-Encoding':'gzip'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req,timeout=28) as r:
                b=r.read()
                if r.headers.get('Content-Encoding')=='gzip':b=gzip.decompress(b)
            p=ResultParser();p.feed(b.decode('utf8','replace'))
            hits=[x for x in p.blocks if x['ko'].replace(' ','')==w['ko'].replace(' ','')]
            rus=[];pos=''
            for h in hits:
                if not pos:pos=h['pos']
                for phrase in h['ru']:
                    for item in re.split(r'\s*[;；]\s*',phrase):
                        item=item.strip(' .')
                        if item and item not in rus:rus.append(item)
            return w['id'], {'ru':rus,'pos':pos,'hit':len(hits)}
        except Exception:
            if attempt==3:return w['id'], {'ru':[],'pos':'','hit':0}
            time.sleep(.8*(attempt+1))

def pos_ru(pos):
    p=pos.lower()
    for keys,ru in [(['существитель','имя существительное'],'существительное'),(['глагол'],'глагол'),(['прилагатель','имя прилагательное'],'прилагательное'),(['нареч','наречие'],'наречие'),(['числитель'],'числительное'),(['местоим','местоимение'],'местоимение'),(['междомет'],'междометие'),(['частиц'],'частица'),(['союз'],'союз'),(['предлог'],'частица')]:
        if any(k in p for k in keys):return ru
    return ''

def main():
    vocab=json.loads(VOCAB.read_text(encoding='utf8'));cache={}
    if CACHE.exists():cache=json.loads(CACHE.read_text(encoding='utf8'))
    todo=[w for w in vocab if str(w['id']) not in cache]
    print(f'Lookup: {len(todo)} words; cached: {len(cache)}',flush=True)
    done=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures=[pool.submit(lookup,w) for w in todo]
        for f in concurrent.futures.as_completed(futures):
            k,v=f.result();cache[str(k)]=v;done+=1
            if done%60==0:
                CACHE.write_text(json.dumps(cache,ensure_ascii=False),encoding='utf8')
                print(f'checked {done}/{len(todo)} · exact entries {sum(bool(x.get("ru")) for x in cache.values())}',flush=True)
    CACHE.write_text(json.dumps(cache,ensure_ascii=False),encoding='utf8')
    exact=0;pos_count=0
    for w in vocab:
        hit=cache.get(str(w['id']),{})
        if hit.get('ru'):
            w['ru']=hit['ru'];w['ruSource']='NIKL Korean-Russian Learners’ Dictionary';exact+=1
        if hit.get('pos'):
            w['pos']=pos_ru(hit['pos']) or w['pos'];pos_count+=1
    VOCAB.write_text(json.dumps(vocab,ensure_ascii=False,indent=2),encoding='utf8')
    print(f'updated {exact}/{len(vocab)} Russian entries and {pos_count} parts of speech',flush=True)

if __name__=='__main__':main()
