#!/usr/bin/env python3
import base64, hashlib, io, json, math, re
from pathlib import Path
import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "external-evidence"
REPORT_DIR.mkdir(exist_ok=True)

LABELS = [
    "PRAISE_EXPERIENCE","WANT_PRODUCT","WANT_ACTIVITY","WANT_BOOKING",
    "ASK_ACCESS","ASK_PRICE","ASK_PAYMENT","FRICTION_ACCESS","FRICTION_VALUE",
    "FRICTION_EXPECTATION","REQUIREMENT_ACCESSIBILITY","REQUIREMENT_DIETARY_SAFETY",
    "COMMUNICATION_GAP","RETURN_REFERRAL","UNKNOWN"
]
DIM = None
THRESHOLD = None

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

MAPPING = {
    "transport_query": "ASK_ACCESS",
    "transport_taxi": "ASK_ACCESS",
    "calendar_set": "WANT_BOOKING",
    "takeaway_order": "WANT_PRODUCT",
}

def fnv1a(text):
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h

def vectorize(text):
    words = re.findall(r"[\w']+", str(text).lower(), flags=re.UNICODE)
    counts = {}
    for word in words:
        padded = " " + word + " "
        for n in (3, 4, 5):
            for i in range(max(0, len(padded) - n + 1)):
                idx = fnv1a(padded[i:i+n]) % DIM
                counts[idx] = counts.get(idx, 0) + 1
    if not counts:
        return np.asarray([], dtype=np.int32), np.asarray([], dtype=np.float32)
    idxs, vals, norm_sq = [], [], 0.0
    for idx, count in counts.items():
        value = 1.0 + math.log(count)
        idxs.append(idx)
        vals.append(value)
        norm_sq += value * value
    norm = math.sqrt(norm_sq) or 1.0
    return np.asarray(idxs, dtype=np.int32), np.asarray([v / norm for v in vals], dtype=np.float32)

def load_model():
    src = (ROOT / "src/ai/pretrained.ts").read_text(encoding="utf-8")
    b64 = re.search(r'MODEL_BASE64 = "([^"]+)"', src).group(1)
    dim = int(re.search(r"MODEL_DIM = (\d+)", src).group(1))
    threshold = float(re.search(r"MODEL_THRESHOLD = ([0-9.]+)", src).group(1))
    floats = np.frombuffer(base64.b64decode(b64), dtype="<f4")
    weight_count = len(LABELS) * dim
    weights = floats[:weight_count].reshape(len(LABELS), dim)
    bias = floats[weight_count:weight_count + len(LABELS)]
    return weights, bias, dim, threshold

WEIGHTS, BIAS, DIM, THRESHOLD = load_model()

def classify(text):
    idxs, vals = vectorize(text)
    z = BIAS.copy()
    if len(idxs):
        z += (WEIGHTS[:, idxs] * vals).sum(axis=1)
    scores = 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))
    accepted = [LABELS[i] for i, score in enumerate(scores) if LABELS[i] != "UNKNOWN" and score >= THRESHOLD]
    return accepted or ["UNKNOWN"]

# A deliberately transparent non-ML comparison. These are ordinary lexical
# rules a small operator could encode in a form or spreadsheet-like workflow.
# They are kept narrow and readable rather than tuned against the test set.
BASELINE_RULES = {
    "WANT_PRODUCT": [
        re.compile(r"\b(buy|purchase|take .*home|for sale|sell|order)\b", re.I),
        re.compile(r"\b(kununua|mnauza|nataka .*maharagwe)\b", re.I),
    ],
    "WANT_BOOKING": [
        re.compile(r"\b(book|reserve|reservation|schedule|available|space|room)\b", re.I),
        re.compile(r"\b(come|visit).{0,20}\b(saturday|sunday|friday|tomorrow|next)\b", re.I),
        re.compile(r"\b(kuja|kuweka nafasi|kuhifadhi|nafasi)\b", re.I),
    ],
    "ASK_ACCESS": [
        re.compile(r"\b(how (?:do|can|will) (?:we|i) (?:get|reach)|way to|get there|where (?:is|are)|directions?|route|transport|taxi|bus|pickup|located)\b", re.I),
        re.compile(r"\b(tutafikaje|wapi|usafiri|njia|iko mbali)\b", re.I),
    ],
    "ASK_PRICE": [
        re.compile(r"\b(how much|price|cost|fee|charge|pay per person|cheapest)\b", re.I),
        re.compile(r"\b(bei|gharama|kiingilio)\b", re.I),
    ],
    "ASK_PAYMENT": [
        re.compile(r"\b(card|cash|visa|mastercard|m-?pesa|mobile money|bank transfer|payment method|electronically|debit)\b", re.I),
        re.compile(r"\b(kadi|malipo|pesa taslimu|kulipa)\b", re.I),
    ],
}

def baseline_classify(text):
    hits = [
        label for label, patterns in BASELINE_RULES.items()
        if any(pattern.search(str(text)) for pattern in patterns)
    ]
    return hits or ["UNKNOWN"]

def get(url):
    response = requests.get(url, timeout=90, headers={"User-Agent": "Guestbook-Hackathon-Evaluation/1.0"})
    response.raise_for_status()
    return response.content

def stable_sample(items, n):
    return sorted(items, key=lambda x: hashlib.sha256(x.encode("utf-8", "ignore")).hexdigest())[:n]

def run_nairobi():
    url = "https://data.insideairbnb.com/kenya/nairobi/nairobi/2026-06-15/data/reviews.csv.gz"
    raw = get(url)
    df = pd.read_csv(io.BytesIO(raw), compression="gzip", usecols=["comments"], dtype={"comments": "string"})
    texts = []
    for value in df["comments"].dropna():
        text = re.sub(r"\s+", " ", str(value)).strip()
        if 20 <= len(text) <= 500:
            texts.append(text)
    sample = stable_sample(texts, min(5000, len(texts)))
    preds = [classify(text) for text in sample]
    coverage = sum(pred != ["UNKNOWN"] for pred in preds) / max(1, len(preds))
    multi = sum(len(pred) > 1 for pred in preds) / max(1, len(preds))

    anchors = {
        "explicit_praise": (re.compile(r"\b(amazing|excellent|wonderful|beautiful|lovely|fantastic|great)\b", re.I), "PRAISE_EXPERIENCE"),
        "explicit_value_friction": (re.compile(r"\b(overpriced|too expensive|not worth|pricey|expensive for)\b", re.I), "FRICTION_VALUE"),
        "explicit_return_referral": (re.compile(r"\b(highly recommend|would recommend|recommend this|stay again|come back|return again)\b", re.I), "RETURN_REFERRAL"),
        "explicit_access_friction": (re.compile(r"\b(hard to find|difficult to find|rough road|bad road|got lost)\b", re.I), "FRICTION_ACCESS"),
    }
    anchor_results = {}
    for name, pair in anchors.items():
        pattern, label = pair
        rows = [(text, pred) for text, pred in zip(sample, preds) if pattern.search(text)]
        anchor_results[name] = {
            "label": label,
            "cases": len(rows),
            "label_hit_rate": (sum(label in pred for _, pred in rows) / len(rows)) if rows else None,
        }

    distribution = {label: 0 for label in LABELS}
    for pred in preds:
        for label in pred:
            distribution[label] += 1

    return {
        "source_url": url,
        "source_rows": int(len(df)),
        "eligible_human_reviews": len(texts),
        "deterministic_sample": len(sample),
        "accepted_any_signal_rate": coverage,
        "unknown_rate": 1 - coverage,
        "multi_label_rate": multi,
        "label_counts": distribution,
        "anchor_slices": anchor_results,
        "note": "Unlabelled external human-written tourism/hospitality stress test. Anchor hit rates are transparent lexical probes, not accuracy.",
    }

def intent_name(value):
    if isinstance(value, str) and not value.isdigit():
        return value
    return INTENTS[int(value)]

def run_massive():
    commit = "0b01ec1b46b6deb5dc5ad4c916f62c7d9c41a06f"
    base = "https://huggingface.co/datasets/AmazonScience/massive/resolve/" + commit
    results, frames = {}, {}
    for locale in ("en-US", "sw-KE"):
        url = base + "/" + locale + "/massive-test.parquet"
        df = pd.read_parquet(io.BytesIO(get(url)))
        df["intent_name"] = df["intent"].apply(intent_name)
        df = df[df["intent_name"].isin(MAPPING)].copy()
        df["expected_guestbook_label"] = df["intent_name"].map(MAPPING)
        df["prediction"] = df["utt"].astype(str).apply(classify)
        df["baseline_prediction"] = df["utt"].astype(str).apply(baseline_classify)
        df["hit"] = [expected in pred for expected, pred in zip(df["expected_guestbook_label"], df["prediction"])]
        df["baseline_hit"] = [expected in pred for expected, pred in zip(df["expected_guestbook_label"], df["baseline_prediction"])]
        frames[locale] = df
        by_intent = {}
        for intent, part in df.groupby("intent_name"):
            by_intent[intent] = {
                "mapped_label": MAPPING[intent],
                "cases": int(len(part)),
                "mapped_label_hit_rate": float(part["hit"].mean()) if len(part) else None,
                "baseline_hit_rate": float(part["baseline_hit"].mean()) if len(part) else None,
            }
        results[locale] = {
            "cases": int(len(df)),
            "mapped_label_hit_rate": float(df["hit"].mean()) if len(df) else None,
            "baseline_hit_rate": float(df["baseline_hit"].mean()) if len(df) else None,
            "by_intent": by_intent,
            "source_url": url,
        }

    en, sw = frames["en-US"], frames["sw-KE"]
    joined = en[["id", "prediction"]].merge(sw[["id", "prediction"]], on="id", suffixes=("_en", "_sw"))
    if len(joined):
        exact = [set(a) == set(b) for a, b in zip(joined["prediction_en"], joined["prediction_sw"])]
        results["paired"] = {
            "pairs": int(len(joined)),
            "exact_prediction_consistency": float(sum(exact) / len(exact)),
        }
    results["note"] = "External CC BY 4.0 multilingual semantic-transfer probe. MASSIVE intents are mapped to nearest Guestbook signals; this is not a tourism field-accuracy benchmark."
    return results

def pct(value):
    return "n/a" if value is None else f"{value * 100:.1f}%"

def main():
    out = {"model_threshold": THRESHOLD, "nairobi": None, "massive": None, "errors": []}
    try:
        out["nairobi"] = run_nairobi()
    except Exception as exc:
        out["errors"].append("Nairobi: " + repr(exc))
    try:
        out["massive"] = run_massive()
    except Exception as exc:
        out["errors"].append("MASSIVE: " + repr(exc))

    (REPORT_DIR / "external-evidence-report.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    md = ["# Guestbook External Evidence Report", "", "Generated in GitHub Actions from external licensed datasets; not used to fit the frozen model.", ""]

    if out["nairobi"]:
        n = out["nairobi"]
        md += [
            "## Nairobi human-written review stress test", "",
            f"- Source rows: **{n['source_rows']:,}**",
            f"- Eligible human-written reviews: **{n['eligible_human_reviews']:,}**",
            f"- Deterministic stress sample: **{n['deterministic_sample']:,}**",
            f"- Any accepted signal: **{pct(n['accepted_any_signal_rate'])}**",
            f"- UNKNOWN / abstention: **{pct(n['unknown_rate'])}**",
            f"- Multi-label outputs: **{pct(n['multi_label_rate'])}**",
            "", "Transparent lexical anchor probes:", "",
            "| Probe | Cases | Target | Hit rate |",
            "|---|---:|---|---:|",
        ]
        for name, anchor in n["anchor_slices"].items():
            md.append(f"| {name} | {anchor['cases']} | {anchor['label']} | {pct(anchor['label_hit_rate'])} |")
        md += ["", n["note"], ""]

    if out["massive"]:
        m = out["massive"]
        md += ["## English / Kiswahili semantic-transfer probe", ""]
        for locale in ("en-US", "sw-KE"):
            x = m.get(locale, {})
            md += [
                f"### {locale}",
                f"- Cases: **{x.get('cases', 0)}**",
                f"- Guestbook Micro mapped-label hit: **{pct(x.get('mapped_label_hit_rate'))}**",
                f"- Transparent lexical baseline hit: **{pct(x.get('baseline_hit_rate'))}**",
                "",
            ]
            for intent, values in x.get("by_intent", {}).items():
                md.append(
                    f"- {intent} -> {values['mapped_label']}: {values['cases']} cases, "
                    f"Guestbook **{pct(values['mapped_label_hit_rate'])}**, "
                    f"lexical baseline **{pct(values['baseline_hit_rate'])}**"
                )
            md.append("")
        if "paired" in m:
            md += [
                f"- Paired cross-language examples: **{m['paired']['pairs']}**",
                f"- Exact prediction consistency EN to SW: **{pct(m['paired']['exact_prediction_consistency'])}**",
                "",
            ]
        md += [m["note"], ""]

    if out["errors"]:
        md += ["## Errors", ""] + ["- " + error for error in out["errors"]] + [""]

    md += [
        "## Source and licensing", "",
        "- Inside Airbnb Nairobi detailed reviews, 15 June 2026. Inside Airbnb publishes its download data under CC BY 4.0 and asks users to attribute it and avoid republishing raw data.",
        "- Amazon MASSIVE v1.1, English and Swahili (Kenya), CC BY 4.0.",
        "",
        "Raw external reviews are downloaded only inside the evaluation job and are not committed or republished by Guestbook.",
    ]
    report = "\n".join(md) + "\n"
    (REPORT_DIR / "external-evidence-report.md").write_text(report, encoding="utf-8")
    print(report)

if __name__ == "__main__":
    main()
