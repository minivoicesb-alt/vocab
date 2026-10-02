import json
from pathlib import Path

p=Path(__file__).resolve().parents[1]/'outputs'/'vocabulary.json'
words=json.loads(p.read_text(encoding='utf-8'))
frames=[
  ("오늘 수업에서 ‘{ko}’{topic} 단어를 배웠어요.","Сегодня на уроке я выучил(а) слово «{ru}»."),
  ("친구가 ‘{ko}’{topic} 단어를 써서 사전에서 찾아봤어요.","Друг употребил слово «{ru}», и я посмотрел(а) его в словаре."),
  ("선생님이 칠판에 ‘{ko}’{topic} 단어를 썼어요.","Учитель написал на доске слово «{ru}»."),
  ("새 단어 ‘{ko}’{object} 공책에 적었어요.","Я записал(а) новое слово «{ru}» в тетрадь."),
]
def has_batchim(word):
    return bool(word and '가' <= word[-1] <= '힣' and (ord(word[-1])-0xAC00)%28)
for i,w in enumerate(words):
    w['lesson']=i*50//len(words)+1
    ru=w.get('ru') or []
    sample=ru[0] if ru else w.get('en','')
    ko,ru_sentence=frames[i%len(frames)]
    topic='이라는' if has_batchim(w['ko']) else '라는'
    obj='을' if has_batchim(w['ko']) else '를'
    w['exampleKo']=ko.format(ko=w['ko'],topic=topic,object=obj)
    w['exampleRu']=ru_sentence.format(ru=sample)
p.write_text(json.dumps(words,ensure_ascii=False,indent=2),encoding='utf-8')
print('lessons',min(w['lesson'] for w in words),max(w['lesson'] for w in words),
      'sizes',[sum(w['lesson']==i for w in words) for i in range(1,51)][:5],
      'fallback English glosses',sum(w.get('ru')==[w.get('en')] for w in words))
