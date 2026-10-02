import json, re, time, urllib.parse, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
VOCAB=ROOT/'outputs'/'vocabulary.json'
PROGRESS=ROOT/'work'/'google_translate_progress.json'

def translate(text):
    qs=urllib.parse.urlencode({'client':'dict-chrome-ex','sl':'en','tl':'ru','q':text})
    url='https://clients5.google.com/translate_a/t?'+qs
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; StudyDictionary/1.0)'})
    return json.loads(urllib.request.urlopen(req,timeout=25).read().decode('utf8'))

def split_result(s,n):
    # This endpoint encodes preserved newlines as either LF or the two chars \\n.
    rows=re.split(r'\\n|\r?\n',s)
    rows=[re.sub(r'<[^>]+>','',x).strip() for x in rows]
    if len(rows)!=n and len(rows)==1:
        rows=[x.strip() for x in s.split('\n')]
    return rows if len(rows)==n else []

def parts(s):
    out=[]
    for x in re.split(r'\s*[,;；]\s*',s):
        x=x.strip(' .')
        if x and x not in out:out.append(x)
    return out or [s.strip()]

def main():
    words=json.loads(VOCAB.read_text(encoding='utf8'))
    todo=[w for w in words if w.get('ruSource') not in ('Google Translate (English gloss from source PDF)','NIKL Korean-Russian Learners’ Dictionary')]
    done={}
    if PROGRESS.exists():done=json.loads(PROGRESS.read_text(encoding='utf8'))
    pending=[w for w in todo if str(w['id']) not in done]
    print(f'Need Russian translations: {len(pending)}',flush=True)
    for start in range(0,len(pending),28):
        batch=pending[start:start+28]
        text='\n'.join(w['en'] for w in batch)
        translated=[]
        for attempt in range(4):
            try:
                raw=translate(text)
                translated=split_result(raw[0] if isinstance(raw,list) else str(raw),len(batch))
                if not translated:raise ValueError('Translation response did not preserve row separators')
                break
            except Exception as e:
                if attempt==3:print(f'Batch {start+1}: {e}',flush=True)
                else:time.sleep(1.2*(attempt+1))
        if translated:
            for w,ru in zip(batch,translated):
                done[str(w['id'])]=parts(ru)
        PROGRESS.write_text(json.dumps(done,ensure_ascii=False),encoding='utf8')
        if start%140==0:print(f'translated {len(done)}/{len(todo)}',flush=True)
        time.sleep(.12)
    for w in words:
        ru=done.get(str(w['id']))
        if ru and w.get('ruSource') not in ('NIKL Korean-Russian Learners’ Dictionary',):
            w['ru']=ru;w['ruSource']='Google Translate (English gloss from source PDF)'
    VOCAB.write_text(json.dumps(words,ensure_ascii=False,indent=2),encoding='utf8')
    print(f'Russian meanings available: {sum(bool(w.get("ru")) and w["ru"]!=[w["en"]] for w in words)}/{len(words)}',flush=True)

if __name__=='__main__':main()
