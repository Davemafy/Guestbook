#!/usr/bin/env python3
import base64, hashlib, io, json, math, re, unicodedata
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "candidate-model"
OUT.mkdir(exist_ok=True)

LABELS = [
    "PRAISE_EXPERIENCE","WANT_PRODUCT","WANT_ACTIVITY","WANT_BOOKING",
    "ASK_ACCESS","ASK_PRICE","ASK_PAYMENT","FRICTION_ACCESS","FRICTION_VALUE",
    "FRICTION_EXPECTATION","REQUIREMENT_ACCESSIBILITY","REQUIREMENT_DIETARY_SAFETY",
    "COMMUNICATION_GAP","RETURN_REFERRAL","UNKNOWN"
]
DIM = 4096
EPOCHS = 28
LR0 = 0.22
L2 = 1e-5
THRESHOLD = 0.60
SEED = 42

INTENTS = [
    'datetime_query','iot_hue_lightchange','transport_ticket','takeaway_query','qa_stock',
    'general_greet','recommendation_events','music_dislikeness','iot_wemo_off','cooking_recipe',
    'qa_currency','transport_traffic','general_quirky','weather_query','audio_volume_up',
    'email_addcontact','takeaway_order','email_querycontact','iot_hue_lightup',
    'recommendation_locations','play_audiobook','lists_createoradd','news_query',
    'alarm_query','iot_wemo_on','general_joke','qa_definition','social_query',
    'music_settings','audio_volume_other','calendar_remove','iot_hue_lightdim',
    'calendar_query','email_sendemail','iot_cleaning','audio_volume_down',
    'play_radio','cooking_query','datetime_convert','qa_maths','iot_hue_lightoff',
    'iot_hue_lighton','transport_query','music_likeness','email_query','play_music',
    'audio_volume_mute','social_post','alarm_set','qa_factoid','calendar_set',
    'play_game','alarm_remove','lists_remove','transport_taxi','recommendation_movies',
    'iot_coffee','music_query','play_podcasts','lists_query'
]
MASSIVE_MAP = {
    "transport_query": "ASK_ACCESS",
    "transport_taxi": "ASK_ACCESS",
    "calendar_set": "WANT_BOOKING",
    "takeaway_order": "WANT_PRODUCT",
}

ANCHORS = {
    "PRAISE_EXPERIENCE": re.compile(r"\b(amazing|excellent|wonderful|beautiful|lovely|fantastic|great|exceptional|awesome)\b", re.I),
    "FRICTION_VALUE": re.compile(r"\b(overpriced|too expensive|not worth|pricey|expensive for|poor value)\b", re.I),
    "RETURN_REFERRAL": re.compile(r"\b(highly recommend|would recommend|recommend this|stay again|come back|return again|visit again)\b", re.I),
    "FRICTION_ACCESS": re.compile(r"\b(hard to find|difficult to find|rough road|bad road|got lost|difficult to reach)\b", re.I),
    "FRICTION_EXPECTATION": re.compile(r"\b(not as advertised|different from the listing|not like the photos|not as described|expected .* but|promised .* but)\b", re.I),
}

def get(url):
    r = requests.get(url, timeout=120, headers={"User-Agent":"Guestbook-Hackathon-Training/1.0"})
    r.raise_for_status()
    return r.content

def normalise(text):
    text = unicodedata.normalize("NFKD", str(text).lower())
    return "".join(ch for ch in text if not unicodedata.combining(ch))

def fnv1a(text):
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h

def vectorize(text):
    words = re.findall(r"[\w']+", normalise(text), flags=re.UNICODE)
    counts = {}
    for word in words:
        padded = " " + word + " "
        for n in (3,4,5):
            for i in range(max(0, len(padded)-n+1)):
                idx = fnv1a(padded[i:i+n]) % DIM
                counts[idx] = counts.get(idx,0) + 1
    if not counts:
        return np.asarray([],dtype=np.int32), np.asarray([],dtype=np.float32)
    idxs, vals, norm_sq = [], [], 0.0
    for idx,count in counts.items():
        value = 1.0 + math.log(count)
        idxs.append(idx); vals.append(value); norm_sq += value*value
    norm = math.sqrt(norm_sq) or 1.0
    return np.asarray(idxs,dtype=np.int32), np.asarray([v/norm for v in vals],dtype=np.float32)

def intent_name(value):
    if isinstance(value,str) and not value.isdigit():
        return value
    return INTENTS[int(value)]

def bucket(text):
    return int(hashlib.sha256(text.encode("utf-8","ignore")).hexdigest()[:8],16) % 5

def split_sentences(text):
    text = re.sub(r"\s+"," ",str(text)).strip()
    parts = re.split(r"(?<=[.!?])\s+",text)
    return [part.strip() for part in parts if 20 <= len(part.strip()) <= 260]

def load_sources():
    exported = json.loads((ROOT/"/tmp/guestbook-training.json").read_text()) if False else None

def load_synthetic():
    return json.loads(Path("/tmp/guestbook-training.json").read_text(encoding="utf-8"))

def add_massive(train):
    commit = "0b01ec1b46b6deb5dc5ad4c916f62c7d9c41a06f"
    base = "https://huggingface.co/datasets/AmazonScience/massive/resolve/" + commit
    eval_frames = {}
    counts = defaultdict(int)
    for locale in ("en-US","sw-KE"):
        for split in ("train","validation","test"):
            raw = get(base + "/" + locale + "/massive-" + split + ".parquet")
            df = pd.read_parquet(io.BytesIO(raw))
            df["intent_name"] = df["intent"].apply(intent_name)
            df = df[df["intent_name"].isin(MASSIVE_MAP)].copy()
            if split == "train":
                for intent, part in df.groupby("intent_name"):
                    label = MASSIVE_MAP[intent]
                    ordered = part.assign(_h=part["utt"].astype(str).apply(lambda x: hashlib.sha256(x.encode()).hexdigest())).sort_values("_h")
                    for text in ordered["utt"].astype(str).head(220):
                        train.append({"text":text,"labels":[label],"origin":"massive-"+locale})
                        counts[label] += 1
            else:
                eval_frames[(locale,split)] = df
    return eval_frames, dict(counts)

def add_nairobi(train):
    url = "https://data.insideairbnb.com/kenya/nairobi/nairobi/2026-06-15/data/reviews.csv.gz"
    raw = get(url)
    df = pd.read_csv(io.BytesIO(raw),compression="gzip",usecols=["comments"],dtype={"comments":"string"})
    train_by_label = defaultdict(list)
    heldout_by_label = defaultdict(list)
    seen = set()
    for review in df["comments"].dropna():
        for sentence in split_sentences(review):
            key = sentence.lower()
            if key in seen: continue
            seen.add(key)
            labels = [label for label,pattern in ANCHORS.items() if pattern.search(sentence)]
            if not labels: continue
            if bucket(sentence) == 0:
                for label in labels: heldout_by_label[label].append(sentence)
            else:
                for label in labels: train_by_label[label].append(sentence)
    added = {}
    for label,rows in train_by_label.items():
        rows = sorted(rows,key=lambda x:hashlib.sha256(x.encode()).hexdigest())[:320]
        for text in rows:
            labels = [name for name,pattern in ANCHORS.items() if pattern.search(text)]
            train.append({"text":text,"labels":labels,"origin":"nairobi-weak"})
        added[label]=len(rows)
    heldout = {label: sorted(rows,key=lambda x:hashlib.sha256(x.encode()).hexdigest())[:500] for label,rows in heldout_by_label.items()}
    return heldout, added, int(len(df))

def train_model(cases):
    rng = np.random.default_rng(SEED)
    features = [vectorize(case["text"]) for case in cases]
    label_index = {label:i for i,label in enumerate(LABELS)}
    positives = np.zeros(len(LABELS),dtype=np.float32)
    for case in cases:
        for label in case["labels"]:
            positives[label_index[label]] += 1
    total = len(cases)
    weights = np.zeros((len(LABELS),DIM),dtype=np.float32)
    bias = np.zeros(len(LABELS),dtype=np.float32)
    order = np.arange(total)

    for epoch in range(EPOCHS):
        rng.shuffle(order)
        lr = LR0/(1+0.08*epoch)
        for row in order:
            idxs,vals = features[row]
            if len(idxs):
                z = bias + (weights[:,idxs]*vals).sum(axis=1)
            else:
                z = bias.copy()
            probs = 1/(1+np.exp(-np.clip(z,-30,30)))
            y = np.zeros(len(LABELS),dtype=np.float32)
            for label in cases[row]["labels"]:
                y[label_index[label]]=1
            neg = np.maximum(1,total-positives)
            pos = np.maximum(1,positives)
            sample_weight = np.where(y>0,total/(2*pos),total/(2*neg))
            grad = (probs-y)*sample_weight
            if len(idxs):
                weights[:,idxs] -= lr*(grad[:,None]*vals[None,:] + L2*weights[:,idxs])
            bias -= lr*grad
    return weights,bias

def predict(weights,bias,text,threshold=THRESHOLD):
    idxs,vals=vectorize(text)
    z=bias.copy()
    if len(idxs): z += (weights[:,idxs]*vals).sum(axis=1)
    scores=1/(1+np.exp(-np.clip(z,-30,30)))
    accepted=[LABELS[i] for i,s in enumerate(scores) if LABELS[i]!="UNKNOWN" and s>=threshold]
    return accepted or ["UNKNOWN"]

def multilabel_metrics(weights,bias,cases):
    tp=fp=fn=exact=0
    for case in cases:
        pred=set(predict(weights,bias,case["text"]))
        expected=set(case["labels"])
        exact += pred==expected
        for label in LABELS:
            p=label in pred; y=label in expected
            tp += p and y; fp += p and not y; fn += (not p) and y
    precision=tp/max(1,tp+fp); recall=tp/max(1,tp+fn)
    f1=2*precision*recall/max(1e-9,precision+recall)
    return {"cases":len(cases),"precision":precision,"recall":recall,"f1":f1,"exact_match":exact/max(1,len(cases))}

def eval_nairobi(weights,bias,heldout):
    result={}
    all_hits=all_cases=0
    for label,rows in heldout.items():
        hits=sum(label in predict(weights,bias,text) for text in rows)
        result[label]={"cases":len(rows),"hit_rate":hits/max(1,len(rows))}
        all_hits+=hits; all_cases+=len(rows)
    result["overall"]={"cases":all_cases,"hit_rate":all_hits/max(1,all_cases)}
    return result

def eval_massive(weights,bias,frames):
    out={}
    for (locale,split),df in frames.items():
        if split!="test": continue
        hits=0; total=0; by={}
        for intent,part in df.groupby("intent_name"):
            label=MASSIVE_MAP[intent]
            part_hits=sum(label in predict(weights,bias,text) for text in part["utt"].astype(str))
            by[intent]={"mapped_label":label,"cases":int(len(part)),"hit_rate":part_hits/max(1,len(part))}
            hits+=part_hits; total+=len(part)
        out[locale]={"cases":int(total),"mapped_label_hit_rate":hits/max(1,total),"by_intent":by}
    return out

def main():
    synthetic=load_synthetic()
    cases=[{"text":c["text"],"labels":c["labels"],"origin":"synthetic"} for c in synthetic["TRAINING_CASES"]]
    massive_frames,massive_added=add_massive(cases)
    nairobi_heldout,nairobi_added,nairobi_rows=add_nairobi(cases)
    weights,bias=train_model(cases)

    report={
        "dimensions":DIM,"epochs":EPOCHS,"threshold":THRESHOLD,
        "train_cases":len(cases),
        "training_mix":{
            "synthetic":len(synthetic["TRAINING_CASES"]),
            "massive_added_by_label":massive_added,
            "nairobi_weak_added_by_label":nairobi_added,
        },
        "synthetic_frozen":multilabel_metrics(weights,bias,synthetic["FROZEN_TEST_CASES"]),
        "massive_test":eval_massive(weights,bias,massive_frames),
        "nairobi_weak_heldout":eval_nairobi(weights,bias,nairobi_heldout),
        "nairobi_source_rows":nairobi_rows,
    }

    flat=np.concatenate([weights.astype("<f4").reshape(-1),bias.astype("<f4")])
    raw=flat.tobytes()
    b64=base64.b64encode(raw).decode("ascii")
    ts=(
        'export const MODEL_BASE64 = "'+b64+'";\n'
        'export const MODEL_DIM = '+str(DIM)+';\n'
        'export const MODEL_THRESHOLD = '+str(THRESHOLD)+';\n'
        'export const MODEL_TRAINING_CASES = '+str(len(cases))+';\n'
        'export const MODEL_WEIGHT_BYTES = '+str(len(raw))+';\n'
    )
    (OUT/"pretrained-candidate.ts").write_text(ts,encoding="utf-8")
    (OUT/"candidate-report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")

    print(json.dumps(report,indent=2))
    print("candidate_bytes",len(raw))

if __name__=="__main__":
    main()
