import json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
PDF = Path(r"C:\Users\miniv\Downloads\TOPIK-I-1671.pdf")
OUT = ROOT / "outputs" / "vocabulary.json"

def extract():
    found = {}
    with pdfplumber.open(PDF) as pdf:
        for page in pdf.pages:
            for line in (page.extract_text() or "").splitlines():
                # Both columns share one line. Locate each number+Hangul pair.
                matches = list(re.finditer(r"(?<!\S)(\d{1,4})\s+([가-힣?]+)\s+", line))
                for i, m in enumerate(matches):
                    n, ko = int(m.group(1)), m.group(2).rstrip("?")
                    end = matches[i+1].start() if i + 1 < len(matches) else len(line)
                    en = line[m.end():end].strip()
                    if 1 <= n <= 1671 and en:
                        found[n] = (ko, en)
    missing = sorted(set(range(1,1672)) - set(found))
    if missing:
        raise RuntimeError(f"Missing numbered rows: {missing[:30]} ({len(missing)} total)")
    return [(n, *found[n]) for n in range(1,1672)]

def translate_batch(text):
    url = "https://api.mymemory.translated.net/get?" + urllib.parse.urlencode({"q":text, "langpair":"en|ru"})
    req = urllib.request.Request(url, headers={"User-Agent":"TOPIK-Offline-Study/1.0"})
    data = json.loads(urllib.request.urlopen(req, timeout=25).read().decode("utf-8"))
    return data.get("responseData", {}).get("translatedText", "")

def pos_guess(ko, en):
    e = en.lower()
    if ko.endswith("다") and any(w in e for w in (" be ","be ","have ","get ","go ","come ","do ","make ","take ","put ","look ","walk", "eat", "drink", "wear", "study", "work", "call", "say", "speak", "listen", "read", "write", "play", "sleep", "buy", "sell", "open", "close", "find", "meet", "learn", "teach", "wait", "help", "live", "like", "love", "want", "need", "know", "think", "use", "change", "start", "finish", "stop", "arrive", "leave", "travel", "worry", "thank", "clean", "wash", "prepare", "exercise", "sing", "dance", "borrow", "lend", "choose", "decide", "remember", "forget", "happen", "rain", "snow", "blow", "cross", "transfer", "fix", "confirm", "check", "welcome", "angry", "marry", "calculate", "continue", "impressed", "healthy", "cloudy", "hungry", "beautiful", "simple", "easy", "difficult", "busy", "free", "expensive", "cheap", "cold", "hot", "warm", "cool", "small", "big", "long", "short", "fast", "slow", "good", "bad", "same", "different", "quiet", "loud", "clean", "dirty", "tall", "low", "high", "early", "late", "happy", "sad", "tired", "kind", "funny", "interesting", "convenient", "necessary", "possible", "impossible", "famous", "important", "safe", "dangerous", "strong", "weak", "bright", "dark")):
        if any(w in e for w in (" be ","be ","healthy","hungry","beautiful","simple","easy","difficult","busy","expensive","cheap","cold","hot","warm","cool","small","big","long","short","fast","slow","good","bad","same","different","quiet","loud","clean","dirty","tall","low","high","early","late","happy","sad","tired","kind","funny","interesting","convenient","necessary","possible","impossible","famous","important","safe","dangerous","strong","weak","bright","dark","cloudy")):
            return "прилагательное"
        return "глагол"
    if any(w in e for w in ("sometimes","together","almost","nearly","simply","suddenly","always","again","already","still","usually","often","quickly","slowly","well","very","too","also","only","first","most","here","there","outside","inside","away","soon","now","later","before","after","then","never","perhaps","maybe","really","not really")):
        return "наречие"
    if e in ("i","you","he","she","we","they","this","that","what","who","which","where","when","how","why"):
        return "местоимение"
    if e in ("one","two","three","four","five","six","seven","eight","nine","ten","0","1","2","3","4","5","6","7","8","9","10") or re.search(r"\b\d+\b",e):
        return "числительное"
    return "существительное"

def main():
    rows = extract()
    # Keep requests short and numbered so line alignment can be recovered.
    translations = {}
    for start in range(0, len(rows), 24):
        chunk = rows[start:start+24]
        prompt = "\n".join(f"{i+1}. {en}" for i,(_,_,en) in enumerate(chunk))
        try:
            result = translate_batch(prompt)
            # The service preserves the explicit line numbers; remove its HTML wrappers.
            lines = re.split(r"\\n|\r?\n", result.replace("<br>", "\n"))
            by_num = {}
            for line in lines:
                m = re.match(r"\s*(\d+)\s*[.)-]?\s*(.*)", line)
                if m and m.group(2).strip(): by_num[int(m.group(1))] = re.sub(r"<[^>]+>","",m.group(2)).strip()
            for j, row in enumerate(chunk):
                tr = by_num.get(j+1, "")
                if not tr or tr.lower() == row[2].lower():
                    translations[row[0]] = ""
                else:
                    translations[row[0]] = tr
        except Exception as e:
            print(f"Translation batch {start+1}: {e}", file=sys.stderr)
            for row in chunk: translations[row[0]] = ""
        if start % 120 == 0: print(f"translated candidates {min(start+24,len(rows))}/{len(rows)}", flush=True)
        time.sleep(.12)

    vocab=[]; seen=set()
    for n,ko,en in rows:
        if ko in seen: continue
        seen.add(ko)
        ru=translations.get(n, "")
        if not ru: ru=en # conservative fallback is annotated for easy review.
        meanings=[x.strip(" .;,") for x in re.split(r"[,;]",ru) if x.strip(" .;,")]
        if not meanings: meanings=[ru]
        pos=pos_guess(ko,en)
        vocab.append({"id":n,"ko":ko,"en":en,"ru":meanings,"pos":pos,"exampleKo":"","exampleRu":"","lesson":0})
    if len(vocab)!=len(set(v["ko"] for v in vocab)):
        raise RuntimeError("Duplicate removal failed")
    OUT.write_text(json.dumps(vocab,ensure_ascii=False,indent=2),encoding="utf-8")
    print(f"saved {len(vocab)} unique entries; missing Russian glosses: {sum(1 for v in vocab if v['ru']==[v['en']])}")

if __name__=="__main__": main()
