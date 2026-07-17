"""
中文韵母 → Live2D 嘴型参数映射

按韵母开口度和唇形分组，驱动 ParamMouthOpenY（张嘴高度）和 ParamMouthForm（唇形）
"""
from __future__ import annotations
import re
from typing import List, Dict

from app.core.logging import get_logger

logger = get_logger(__name__)

# 韵母 → (category, mouth_open_y, mouth_form)
# category: open(大张) / half(半开) / round(圆唇) / spread(展唇) / closed(闭合)
# mouth_open_y:
#   0.04      闭口，标点、停顿、无声辅音
#   0.18      微张，i/in/ing 等展唇韵母
#   0.22      小张，u/ü 等圆唇韵母
#   0.38~0.52 半开，o/e/en/eng/ou/ong 等
#   0.75~1.0  大张，a/ai/ao/an/ang 等
# mouth_form:
#   -1~0 展唇/微笑，i/in/ing
#    0   中性，a/o/e/en/eng 等
#    0~1 圆唇/嘟嘴，u/ü/ou/ong 等

FINAL_TO_SHAPE: Dict[str, tuple] = {
    # ── 大开口 ──
    "a":   ("open",   0.82,  0.0),
    "ia":  ("open",   0.82,  0.0),
    "ua":  ("open",   0.82,  0.0),
    "ai":  ("open",   0.78,  0.0),
    "uai": ("open",   0.78,  0.0),
    "ao":  ("open",   0.96,  0.0),
    "iao": ("open",   0.96,  0.0),
    "an":  ("open",   0.76,  0.0),
    "ian": ("open",   0.75, -0.20),
    "uan": ("open",   0.76,  0.10),
    "ang": ("open",   0.96,  0.0),
    "iang":("open",   0.94, -0.10),
    "uang":("open",   0.94,  0.10),

    # ── 半开 ──
    "o":   ("half",   0.44,  0.0),
    "uo":  ("half",   0.44,  0.35),
    "e":   ("half",   0.42,  0.0),
    "ie":  ("half",   0.38, -0.30),
    "ue":  ("half",   0.40,  0.45),
    "üe":  ("half",   0.40,  0.45),
    "ei":  ("half",   0.38, -0.15),
    "ui":  ("half",   0.38,  0.35),
    "ou":  ("half",   0.46,  0.55),
    "iu":  ("half",   0.38,  0.45),
    "en":  ("half",   0.38,  0.0),
    "un":  ("half",   0.38,  0.45),
    "eng": ("half",   0.46,  0.0),
    "ong": ("half",   0.52,  0.65),
    "iong":("half",   0.52,  0.60),

    # ── 圆唇（嘟嘴）──
    "u":   ("round",  0.22,  0.72),
    "ü":   ("round",  0.22,  0.82),
    "v":   ("round",  0.22,  0.82),

    # ── 展唇（微笑/咧嘴）──
    "i":   ("spread", 0.18, -0.70),
    "in":  ("spread", 0.18, -0.60),
    "ing": ("spread", 0.18, -0.55),

    # ── 特殊 ──
    "er":  ("half",   0.40,  0.0),
    "":    ("closed", 0.04,  0.0),
}

# 无声母/零声母时的默认
DEFAULT_SHAPE = ("closed", 0.04, 0.0)

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
          "category": "spread", "mouthOpenY": 0.18, "mouthForm": -0.55},
         ...]
    """
    try:
        from pypinyin import lazy_pinyin, Style
    except ImportError as exc:
        logger.warning("mouth rule analysis skipped missing_dependency=pypinyin error=%s", exc)
        return []

    # 先用正则洗掉所有非中文/标点的内容（[emotion]标签等）
    clean = re.sub(r"\[(\w+)\]\s*", "", text)

    shapes = []

    for char in clean:
        if not ('一' <= char <= '鿿'):
            # 标点/空格 → 闭口
            shapes.append({
                "char": char, "pinyin": "", "final": "",
                "category": "closed", "mouthOpenY": PUNCTUATION_SHAPE[1],
                "mouthForm": PUNCTUATION_SHAPE[2],
            })
            continue

        pinyins = lazy_pinyin(char, style=Style.TONE3, neutral_tone_with_five=True)
        py = pinyins[0] if pinyins else ""

        # 去掉声调数字
        py_clean = re.sub(r'\d+', '', py).lower()
        if not py_clean:
            shapes.append({
                "char": char, "pinyin": "", "final": "",
                "category": DEFAULT_SHAPE[0], "mouthOpenY": DEFAULT_SHAPE[1],
                "mouthForm": DEFAULT_SHAPE[2],
            })
            continue

        final = _extract_final(py_clean)
        cat, open_y, form = FINAL_TO_SHAPE.get(final, DEFAULT_SHAPE)

        shapes.append({
            "char": char, "pinyin": py_clean, "final": final,
            "category": cat, "mouthOpenY": open_y, "mouthForm": form,
        })

    return shapes
