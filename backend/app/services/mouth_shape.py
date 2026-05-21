"""
中文韵母 → Live2D 嘴型参数映射

按韵母开口度和唇形分组，驱动 ParamMouthOpenY（张嘴高度）和 ParamMouthForm（唇形）
"""
from __future__ import annotations
import re
from typing import List, Dict

# 韵母 → (category, mouth_open_y, mouth_form)
# category: open(大张) / half(半开) / round(圆唇) / spread(展唇) / closed(闭合)
# mouth_open_y: 0.0(闭) ~ 1.0(大张)
# mouth_form: -1.0(扁唇/笑) ~ 1.0(圆唇/嘟)

FINAL_TO_SHAPE: Dict[str, tuple] = {
    # ── 大开口 ──
    "a":   ("open",   0.85,  0.0),
    "ia":  ("open",   0.85,  0.0),
    "ua":  ("open",   0.85,  0.0),
    "ai":  ("open",   0.80,  0.0),
    "uai": ("open",   0.80,  0.0),
    "ao":  ("open",   0.90,  0.0),
    "iao": ("open",   0.90,  0.0),
    "an":  ("open",   0.75,  0.0),
    "uan": ("open",   0.75,  0.0),
    "ang": ("open",   0.90,  0.0),
    "iang":("open",   0.90,  0.0),
    "uang":("open",   0.90,  0.0),

    # ── 半开 ──
    "o":   ("half",   0.50,  0.15),
    "uo":  ("half",   0.50,  0.15),
    "e":   ("half",   0.48,  0.0),
    "ie":  ("half",   0.45, -0.10),
    "ue":  ("half",   0.50,  0.10),
    "üe":  ("half",   0.50,  0.10),
    "ei":  ("half",   0.42,  0.0),
    "ui":  ("half",   0.42,  0.15),
    "ou":  ("half",   0.50,  0.20),
    "iu":  ("half",   0.42,  0.20),
    "en":  ("half",   0.38,  0.0),
    "un":  ("half",   0.40,  0.10),
    "eng": ("half",   0.48,  0.0),
    "ong": ("half",   0.52,  0.15),
    "iong":("half",   0.52,  0.15),

    # ── 圆唇（嘟嘴）──
    "u":   ("round",  0.22,  0.50),
    "ü":   ("round",  0.22,  0.55),
    "v":   ("round",  0.22,  0.55),

    # ── 展唇（微笑/咧嘴）──
    "i":   ("spread", 0.18, -0.40),
    "in":  ("spread", 0.20, -0.35),
    "ing": ("spread", 0.22, -0.35),
    "ian": ("spread", 0.35, -0.20),

    # ── 特殊 ──
    "er":  ("half",   0.42,  0.0),
}

# 无声母/零声母时的默认
DEFAULT_SHAPE = ("closed", 0.06, 0.0)

# 标点对应静音
PUNCTUATION_SHAPE = ("closed", 0.04, 0.0)


def _extract_final(pinyin: str) -> str:
    """从拼音中提取韵母，如 'zhong' → 'ong', 'ni' → 'i'"""
    # 去掉声母，保留韵母部分
    initials = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l",
                "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w"]
    for init in sorted(initials, key=len, reverse=True):
        if pinyin.startswith(init):
            return pinyin[len(init):]
    return pinyin  # 零声母，整个就是韵母


def analyze_mouth_shapes(text: str) -> List[dict]:
    """
    分析中文文本，返回嘴型事件序列。每个字符约 150ms。

    Returns:
        [{"char": "灵", "pinyin": "ling", "final": "ing",
          "category": "spread", "mouthOpenY": 0.22, "mouthForm": -0.35},
         ...]
    """
    try:
        from pypinyin import lazy_pinyin, Style
    except ImportError:
        # 无 pypinyin 时返回空
        return []

    # 先用正则洗掉所有非中文/标点的内容（[emotion]标签等）
    clean = re.sub(r"\[(\w+)\]\s*", "", text)

    shapes = []
    pinyins = lazy_pinyin(clean, style=Style.TONE3, neutral_tone_with_five=True)

    for char, py in zip(clean, pinyins):
        if not ('一' <= char <= '鿿'):
            # 标点/空格 → 闭口
            shapes.append({
                "char": char, "pinyin": "", "final": "",
                "category": "closed", "mouthOpenY": PUNCTUATION_SHAPE[1],
                "mouthForm": PUNCTUATION_SHAPE[2],
            })
            continue

        # 去掉声调数字
        py_clean = re.sub(r'\d+', '', py).lower()
        if not py_clean:
            continue

        final = _extract_final(py_clean)
        cat, open_y, form = FINAL_TO_SHAPE.get(final, DEFAULT_SHAPE)

        shapes.append({
            "char": char, "pinyin": py_clean, "final": final,
            "category": cat, "mouthOpenY": open_y, "mouthForm": form,
        })

    return shapes
