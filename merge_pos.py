import io,json,tarfile,urllib.request
from collections import Counter,defaultdict
from pathlib import Path

root=Path(__file__).resolve().parents[1]
p=root/'outputs'/'vocabulary.json'
url='https://api.korwid.com/opendata/dict-dump.tar.gz'
req=urllib.request.Request(url,headers={'User-Agent':'HangeulSteps/1.0'})
archive=tarfile.open(fileobj=io.BytesIO(urllib.request.urlopen(req,timeout=40).read()),mode='r:gz')
parts=defaultdict(Counter)
for line in archive.extractfile('krdict_entries.jsonl'):
    w=json.loads(line)
    parts[w['word']][w['pos']]+=1
map_pos={'명사':'существительное','의존 명사':'существительное','대명사':'местоимение','수사':'числительное','동사':'глагол','형용사':'прилагательное','부사':'наречие','관형사':'определительное слово','감탄사':'междометие','조사':'частица','접사':'аффикс','어미':'окончание','보조 동사':'вспомогательный глагол','보조 형용사':'вспомогательное прилагательное'}
data=json.loads(p.read_text(encoding='utf8')); matched=0
for w in data:
    choices=parts.get(w['ko'])
    if choices:
        mapped=Counter()
        for ko,n in choices.items():
            if ko in map_pos:mapped[map_pos[ko]]+=n
        if mapped:
            ordered=[x for x,n in mapped.most_common() if n>0]
            w['pos']=' / '.join(ordered[:2]);matched+=1
    if w['ko'] in ('갈아타다','걸다','걸리다','감다','닫다','낫다'):w['pos']='глагол'
    if w['ko'] in ('같다','고프다','곱다','건강하다'):w['pos']='прилагательное'
    if w['ko']=='적다':w['pos']='прилагательное / глагол'
p.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
print(f'POS matched to NIKL-derived Korean dictionary: {matched}/{len(data)}')
