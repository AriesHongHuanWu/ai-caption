"""人聲混音建議庫(Vocal Mixing Advice Library)—— 依「這首歌的實際分析」給具體、可照做的
人聲處理建議:高通、減法/加法 EQ、De-ess、壓縮、飽和、空間(殘響/延遲,依 BPM 對拍)、寬度、
音量。**規則式、離線、可重現**(不呼叫任何雲端/模型),雙語(zh/en)。

設計:每個曲風有一組「人聲基底鏈」,再依偵測到的特性(渾濁 / 偏暗 / 偏亮 / 齒音 / 動態 / 響度 /
大小調 / 速度 / 齒音實際頻率)做條件式調整。延遲時間直接用 BPM 換算對拍(1/8、附點 1/8、1/4),
殘響衰減依速度縮放 —— 這就是「依不同情況給不同建議」的大型知識庫。
"""

from __future__ import annotations

from typing import Any


# 每個曲風的人聲基底鏈(數值是起點,之後依分析微調)。
_GENRE_BASE: dict[str, dict] = {
    "pop": {
        "hpf": 90, "presence": (4000, 2.5), "air": (12000, 2.0),
        "comp": {"ratio": 4.0, "attack": 8, "release": 90, "gr": 5},
        "deess": 0.6, "reverb": ("plate", 1.6), "delay": "1/8", "sat": "tape-light", "width": 1.0,
        "note_zh": "流行人聲:乾淨、靠前、亮。兩段壓縮(慢抓穩 + 快抓控峰)很常見。",
        "note_en": "Pop vocal: clean, up-front, bright. Serial compression (slow leveler + fast peak) is common.",
    },
    "rnb": {
        "hpf": 80, "presence": (3500, 2.0), "air": (13000, 2.5),
        "comp": {"ratio": 3.5, "attack": 12, "release": 120, "gr": 4},
        "deess": 0.7, "reverb": ("plate", 2.0), "delay": "1/4", "sat": "tube", "width": 1.05,
        "note_zh": "R&B 人聲:絲滑、溫暖、有空間。可疊細緻和聲、長一點的殘響/延遲。",
        "note_en": "R&B vocal: silky, warm, spacious. Layer harmonies; longer reverb/delay tails.",
    },
    "hiphop": {
        "hpf": 100, "presence": (4500, 3.0), "air": (11000, 1.5),
        "comp": {"ratio": 6.0, "attack": 5, "release": 70, "gr": 7},
        "deess": 0.6, "reverb": ("room", 0.9), "delay": "1/8", "sat": "saturated", "width": 0.9,
        "note_zh": "Hip-Hop/Rap 人聲:壓得很實、靠前、咬字清楚。少殘響、用短延遲/throw 製造律動。",
        "note_en": "Hip-hop/rap vocal: hard-compressed, up-front, intelligible. Little reverb; short delays/throws for groove.",
    },
    "edm": {
        "hpf": 110, "presence": (4000, 2.5), "air": (14000, 3.0),
        "comp": {"ratio": 5.0, "attack": 6, "release": 80, "gr": 6},
        "deess": 0.7, "reverb": ("hall", 2.4), "delay": "1/4", "sat": "saturated", "width": 1.15,
        "note_zh": "EDM/Dance 人聲:亮、寬、效果重。drop 用大殘響+對拍延遲做空間;主歌收乾一點。",
        "note_en": "EDM/dance vocal: bright, wide, FX-heavy. Big reverb + synced delay in drops; drier in verses.",
    },
    "rock": {
        "hpf": 100, "presence": (3000, 2.5), "air": (10000, 1.0),
        "comp": {"ratio": 4.5, "attack": 10, "release": 100, "gr": 6},
        "deess": 0.5, "reverb": ("room", 1.2), "delay": "1/8", "sat": "tube-driven", "width": 0.95,
        "note_zh": "搖滾人聲:有能量、咬得住吉他牆。中頻 1–3 kHz 推一點讓人聲穿透。",
        "note_en": "Rock vocal: energetic, cuts through the guitar wall. Push 1–3 kHz so it punches through.",
    },
    "acoustic": {
        "hpf": 75, "presence": (3000, 1.5), "air": (12000, 1.5),
        "comp": {"ratio": 2.5, "attack": 15, "release": 150, "gr": 3},
        "deess": 0.5, "reverb": ("hall", 1.8), "delay": "none", "sat": "tape-light", "width": 1.0,
        "note_zh": "原聲/木吉他人聲:自然、保留動態。輕壓即可,別把空氣感壓掉。",
        "note_en": "Acoustic vocal: natural, keep dynamics. Light compression; don't squash the air.",
    },
    "ballad": {
        "hpf": 80, "presence": (3200, 2.0), "air": (13000, 2.0),
        "comp": {"ratio": 3.0, "attack": 15, "release": 140, "gr": 4},
        "deess": 0.6, "reverb": ("hall", 2.6), "delay": "1/4", "sat": "tube", "width": 1.0,
        "note_zh": "抒情/慢歌人聲:情感、空間大。長殘響 + 長延遲;高潮再加層次。",
        "note_en": "Ballad vocal: emotional, spacious. Long reverb + delay; build layers into the climax.",
    },
    "lofi": {
        "hpf": 90, "presence": (3000, 1.0), "air": (9000, -1.0),
        "comp": {"ratio": 3.0, "attack": 20, "release": 130, "gr": 4},
        "deess": 0.5, "reverb": ("room", 1.4), "delay": "1/8", "sat": "saturated", "width": 0.85,
        "note_zh": "Lo-fi 人聲:溫暖、霧面、不刺。高頻收掉、加飽和與底噪質感。",
        "note_en": "Lo-fi vocal: warm, hazy, never harsh. Roll off highs; add saturation and texture.",
    },
}

_REVERB_ZH = {"plate": "板式 Plate", "hall": "廳堂 Hall", "room": "房間 Room"}
_NOTE_SYNC_ZH = {"1/4": "四分音符 1/4", "1/8": "八分音符 1/8", "1/8d": "附點八分 1/8 dotted",
                 "1/16": "十六分音符 1/16", "1/4": "四分音符 1/4", "none": "不用延遲", "1/2": "二分音符 1/2"}


def _ms_for(note: str, bpm: float) -> int:
    if bpm <= 0:
        return 0
    q = 60000.0 / bpm  # 四分音符 ms
    table = {"1/2": q * 2, "1/4": q, "1/8": q / 2, "1/8d": q * 0.75, "1/16": q / 4}
    return int(round(table.get(note, q / 2)))


def build_advice(a: dict) -> dict:
    """從 analyze_song 的結果產生人聲混音建議(雙語)。"""
    genre = (a.get("genre") or {}).get("top", "pop")
    base = _GENRE_BASE.get(genre, _GENRE_BASE["pop"])
    key = a.get("key") or {}
    tempo = a.get("tempo") or {}
    eq = a.get("eq") or {}
    loud = a.get("loudness") or {}
    bands = {b["name"]: b["db"] for b in eq.get("bands", [])}
    tilt = float(eq.get("tiltDbOct", -3.2))
    crest = float(loud.get("crestDb", 9.0))
    bpm = float(tempo.get("bpm", 0) or 0)
    sib = a.get("sibilantHz") or [6000, 9000]
    elem_ids = {e["id"] for e in a.get("elements", [])}

    groups: list[dict] = []

    def grp(gid, zh, en, items):
        groups.append({"id": gid, "title": zh, "titleEn": en, "items": items})

    def it(zh, en, spec=""):
        return {"text": zh, "textEn": en, "spec": spec}

    # 1) 高通
    hpf = base["hpf"]
    if "subheavy" in elem_ids or "bassheavy" in elem_ids:
        hpf += 15
    grp("highpass", "① 高通濾波(清掉低頻泥巴)", "① High-pass (clear low-end mud)", [
        it(f"人聲高通設 ~{hpf} Hz,12–18 dB/oct,清掉麥克風隆隆聲與噴麥。",
           f"High-pass the vocal at ~{hpf} Hz, 12–18 dB/oct, to remove rumble and plosives.",
           f"{hpf} Hz"),
        it("男低音可再低一點(70–80 Hz),女高音/說唱可高一點(100–120 Hz)。",
           "Go lower for deep male voices (70–80 Hz); higher for sopranos/rap (100–120 Hz)."),
    ])

    # 2) 減法 EQ(依偵測的問題)
    cuts = []
    if "boxy" in elem_ids or bands.get("low_mid", 0) > 1.5:
        cuts.append(it("250–450 Hz 渾濁/箱音 → 用窄帶 −2~−4 dB(Q≈1.5)掃出最濁的點再衰減。",
                       "Boxy/muddy 250–450 Hz → narrow cut −2 to −4 dB (Q≈1.5); sweep to find the worst spot.",
                       "250–450 Hz · −3 dB"))
    if "bright" in elem_ids or tilt > -2.5 or "sibilant" in elem_ids:
        cuts.append(it("2–4 kHz 若太刺,動態 EQ −2 dB(只在尖的時候作動,保留清晰度)。",
                       "If 2–4 kHz is harsh, use a dynamic EQ −2 dB (acts only on peaks; keeps clarity).",
                       "2–4 kHz · dyn −2 dB"))
    cuts.append(it("500–800 Hz 有「鼻音/紙箱感」時小幅 −1~−2 dB;沒問題就別動。",
                   "If 500–800 Hz sounds nasal/cardboard, dip −1 to −2 dB; otherwise leave it.",
                   "500–800 Hz"))
    grp("eq_cut", "② 減法 EQ(先清乾淨)", "② Subtractive EQ (clean first)", cuts)

    # 3) 加法 EQ
    pf, pg = base["presence"]
    af, ag = base["air"]
    boosts = [
        it(f"臨場感:{pf} Hz +{pg:.1f} dB(寬 Q≈0.8)讓咬字與情緒往前。",
           f"Presence: {pf} Hz +{pg:.1f} dB (wide Q≈0.8) to bring articulation forward.",
           f"{pf} Hz · +{pg:.1f} dB"),
    ]
    if ag >= 0:
        boosts.append(it(f"空氣感:{af} Hz 高棚 +{ag:.1f} dB,開放、現代感(用 linear-phase 高棚更乾淨)。",
                         f"Air: high-shelf {af} Hz +{ag:.1f} dB for an open, modern top (linear-phase shelf is cleaner).",
                         f"{af} Hz · +{ag:.1f} dB"))
    else:
        boosts.append(it(f"高頻收斂:{af} Hz 高棚 {ag:.1f} dB,做出 lo-fi 的霧面溫暖。",
                         f"Roll off highs: high-shelf {af} Hz {ag:.1f} dB for that warm, hazy lo-fi top.",
                         f"{af} Hz · {ag:.1f} dB"))
    if "dark" in elem_ids:
        boosts.append(it("整體偏暗 → 可在 5–8 kHz 再 +1~2 dB 補清晰度。",
                         "Track is dark → add +1 to +2 dB around 5–8 kHz for clarity.", "5–8 kHz"))
    if genre in ("rnb", "ballad", "lofi") or key.get("mode") == "minor":
        boosts.append(it("溫暖底:150–250 Hz +1 dB(寬 Q)給胸腔感,別過量以免糊。",
                         "Warmth: +1 dB around 150–250 Hz (wide Q) for chest body — don't overdo it.",
                         "150–250 Hz · +1 dB"))
    grp("eq_boost", "③ 加法 EQ(塑形)", "③ Additive EQ (shaping)", boosts)

    # 4) De-ess(用實際偵測到的齒音頻率)
    sc = int(round((sib[0] * sib[1]) ** 0.5))
    deamt = "較重" if base["deess"] >= 0.65 or "sibilant" in elem_ids else "適中"
    deamt_en = "stronger" if base["deess"] >= 0.65 or "sibilant" in elem_ids else "moderate"
    grp("deess", "④ De-ess(齒音)", "④ De-ess (sibilance)", [
        it(f"齒音集中在 {sib[0]}–{sib[1]} Hz(中心 ~{sc} Hz)→ De-esser 設在這帶,{deamt}量,"
           f"目標只削 2–4 dB、別把咬字也吃掉。",
           f"Sibilance sits at {sib[0]}–{sib[1]} Hz (center ~{sc} Hz) → set the de-esser there, {deamt_en} amount; "
           f"aim to shave 2–4 dB only — don't kill consonants.",
           f"{sib[0]}–{sib[1]} Hz"),
        it("用 split/分頻式 de-esser 比寬帶更自然;高音域歌手可分兩段(齒音 + 高擦音)。",
           "A split-band de-esser sounds more natural than wideband; for high voices use two bands (sibilance + high fricatives)."),
    ])

    # 5) 壓縮(依動態調整)
    comp = dict(base["comp"])
    if crest >= 12:
        comp["ratio"] += 1.0; comp["gr"] += 2
        dyn_zh = "動態很大 → 壓多一點、或串兩段壓縮把音量坐穩。"
        dyn_en = "Wide dynamics → compress more, or chain two compressors to seat the level."
    elif crest <= 7.5:
        comp["ratio"] = max(2.0, comp["ratio"] - 1.0); comp["gr"] = max(2, comp["gr"] - 2)
        dyn_zh = "素材已經很平/很響 → 壓少一點,避免抽吸與失去生命力。"
        dyn_en = "Source is already flat/loud → compress less to avoid pumping and lifelessness."
    else:
        dyn_zh = "動態適中 → 用下列設定坐穩主音。"
        dyn_en = "Moderate dynamics → seat the lead with the settings below."
    grp("compression", "⑤ 壓縮", "⑤ Compression", [
        it(f"比例 ~{comp['ratio']:.1f}:1、Attack ~{comp['attack']} ms、Release ~{comp['release']} ms,"
           f"平均減益 ~{comp['gr']} dB。{dyn_zh}",
           f"Ratio ~{comp['ratio']:.1f}:1, attack ~{comp['attack']} ms, release ~{comp['release']} ms, "
           f"~{comp['gr']} dB gain reduction. {dyn_en}",
           f"{comp['ratio']:.1f}:1 · {comp['attack']}ms / {comp['release']}ms"),
        it("串接:慢抓 leveler(LA-2A 型,3 dB)→ 快抓 peak(FET/1176 型,3–4 dB),比單段更透明。",
           "Serial: slow leveler (LA-2A style, ~3 dB) → fast peak (FET/1176 style, 3–4 dB) — more transparent than one stage."),
        it("Attack 太快會吃掉咬字的衝擊;Release 跟著歌的律動調(慢歌長、快歌短)。",
           "Too-fast attack dulls consonant transients; set release to the song's groove (longer for ballads, shorter for fast tracks)."),
    ])

    # 6) 飽和 / 溫暖
    grp("saturation", "⑥ 飽和 / 溫暖", "⑥ Saturation / warmth", [
        it(f"加一點 {base['sat']} 飽和,增加諧波讓人聲在小喇叭/手機上也聽得到、更黏耳。",
           f"Add a touch of {base['sat']} saturation — harmonics help the vocal translate on phones/laptops and feel glued.",
           base["sat"]),
        it("並聯(parallel)飽和最安全:乾訊號保清晰,旁鏈加重的飽和混回 10–30%。",
           "Parallel saturation is safest: keep the dry signal clean, blend in 10–30% of a heavily driven copy."),
    ])

    # 7) 空間:殘響(依速度縮放)+ 對拍延遲
    rv_type, rv_decay = base["reverb"]
    if bpm > 0:
        rv_decay = round(rv_decay * (120.0 / max(70.0, min(160.0, bpm))), 1)  # 快歌短、慢歌長
    predelay = _ms_for("1/16", bpm) if bpm > 0 else 25
    predelay = max(15, min(60, predelay))
    delay_note = base["delay"]
    delay_items = []
    if delay_note != "none" and bpm > 0:
        d8 = _ms_for("1/8", bpm); d8d = _ms_for("1/8d", bpm); d4 = _ms_for("1/4", bpm)
        delay_items.append(it(
            f"對拍延遲(BPM {round(bpm)}):1/8 = {d8} ms、附點 1/8 = {d8d} ms、1/4 = {d4} ms。"
            f"主音用附點 1/8 slap(回授低)製造律動;ad-lib 用 1/4 做呼應。",
            f"Tempo-synced delay (BPM {round(bpm)}): 1/8 = {d8} ms, dotted-1/8 = {d8d} ms, 1/4 = {d4} ms. "
            f"Use a dotted-1/8 slap (low feedback) on the lead; 1/4 throws on ad-libs.",
            f"1/8={d8}ms · 1/8d={d8d}ms · 1/4={d4}ms"))
    elif delay_note == "none":
        delay_items.append(it("這類曲風人聲通常不太用延遲,保乾淨即可(需要時用很短的 slap)。",
                              "This style usually keeps the vocal dry — use only a very short slap if needed."))
    grp("space", "⑦ 空間:殘響 + 延遲", "⑦ Space: reverb + delay", [
        it(f"殘響用 {_REVERB_ZH.get(rv_type, rv_type)},衰減 ~{rv_decay} s、Pre-delay ~{predelay} ms"
           f"(pre-delay 讓字頭乾淨、人聲不糊)。",
           f"Use a {rv_type} reverb, ~{rv_decay} s decay, pre-delay ~{predelay} ms "
           f"(pre-delay keeps word onsets clean so the vocal stays intelligible).",
           f"{rv_type} · {rv_decay}s · pre {predelay}ms"),
        it("殘響/延遲回送都做高通(~300 Hz)+ 低通(~8 kHz),效果不吃掉低頻、也不刺耳。",
           "High-pass (~300 Hz) and low-pass (~8 kHz) the reverb/delay returns so FX don't muddy lows or add harsh highs."),
    ] + delay_items)

    # 8) 寬度 / 定位
    width = base["width"]
    width_items = [
        it("主音(lead)保持單聲道置中 → 穩、聚焦;不要用立體聲擴展器處理主音。",
           "Keep the lead vocal mono and centered → stable and focused; don't stereo-widen the lead."),
        it(f"和聲/雙軌(double)往兩側鋪(寬度 ~{width:.2f}),營造寬度而不動到主音。",
           f"Pan harmonies/doubles out (width ~{width:.2f}) for stereo width without touching the lead."),
    ]
    if "wide" in elem_ids:
        width_items.append(it("伴奏已經很寬 → 人聲置中會更突出,別再加寬。",
                              "The track is already wide → a centered vocal will pop; don't widen further."))
    grp("width", "⑧ 寬度 / 定位", "⑧ Width / placement", width_items)

    # 9) 音量(相對 mix)
    grp("level", "⑨ 音量平衡", "⑨ Level balance", [
        it("流行/嘻哈人聲通常壓過伴奏 1–3 dB(很靠前);搖滾/EDM 可以咬在伴奏裡一點。",
           "Pop/hip-hop vocals usually sit 1–3 dB above the track (very forward); rock/EDM can tuck in a bit more."),
        it("用自動化(automation)而不是只靠壓縮把每句都坐在對的音量;副歌主音再 +0.5~1 dB。",
           "Ride the level with automation (not just compression) so every line sits right; push the chorus lead +0.5 to +1 dB."),
    ])

    # 10) 自動化(用結構段)
    sec_labels = sorted({s["label"] for s in a.get("sections", [])})
    auto_items = [
        it("主歌乾一點(少殘響/延遲)、副歌濕一點(空間打開)→ 用自動化在段落間切換。",
           "Drier verses (less reverb/delay), wetter choruses (open the space) → automate the switch between sections."),
    ]
    if "chorus" in sec_labels:
        auto_items.append(it("進副歌前 1 拍把延遲回授/殘響送出量自動拉高,做出「擴張」的入口感。",
                            "One beat before the chorus, automate the delay feedback/reverb send up for an expanding lift into it."))
    grp("automation", "⑩ 依曲式自動化", "⑩ Automate by section", auto_items)

    # 摘要
    bright_zh = "偏亮" if tilt > -2.5 else "偏暗" if tilt < -4.2 else "平衡"
    bright_en = "bright" if tilt > -2.5 else "dark" if tilt < -4.2 else "balanced"
    dyn_word_zh = "動態大" if crest >= 12 else "壓得響" if crest <= 7.5 else "動態適中"
    dyn_word_en = "dynamic" if crest >= 12 else "loud/compressed" if crest <= 7.5 else "moderate dynamics"
    summary_zh = (f"{base['note_zh']} 這首偵測為 {genre}、{key.get('name','?')}"
                  f"{'('+key['camelot']+')' if key.get('camelot') else ''}、"
                  f"{round(bpm) if bpm else '?'} BPM,音色{bright_zh}、{dyn_word_zh}。"
                  f"建議流程:先減法清乾淨 → 加法塑形 → De-ess → 壓縮坐穩 → 飽和 → 空間 → 自動化。")
    summary_en = (f"{base['note_en']} Detected: {genre}, {key.get('name','?')}"
                  f"{' ('+key['camelot']+')' if key.get('camelot') else ''}, "
                  f"{round(bpm) if bpm else '?'} BPM, {bright_en} tone, {dyn_word_en}. "
                  f"Workflow: subtractive clean-up → additive shaping → de-ess → compress → saturate → space → automate.")

    return {
        "summary": {"zh": summary_zh, "en": summary_en},
        "context": [
            {"label": "曲風", "labelEn": "Genre", "value": genre},
            {"label": "調性", "labelEn": "Key", "value": key.get("name", "—")
                + (f" · {key['camelot']}" if key.get("camelot") else "")},
            {"label": "速度", "labelEn": "Tempo", "value": f"{round(bpm)} BPM" if bpm else "—"},
            {"label": "音色", "labelEn": "Tone", "value": bright_zh},
            {"label": "動態", "labelEn": "Dynamics", "value": dyn_word_zh},
        ],
        "groups": groups,
    }
