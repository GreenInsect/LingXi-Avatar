"""
训练数据生成：TTS 合成音频 → 规则系统标注嘴型 → 保存 Mel + 标签
"""
import os
import io
import wave
import contextlib
import numpy as np

import dashscope
from app.core.config import settings
from app.services.mouth_shape import analyze_mouth_shapes

# 景区问答样本（覆盖不同口型韵母）
SAMPLE_TEXTS = [
    # 开口音多 (a/ao/ang)
    "灵山大佛高达八十八米，非常壮观，您看到一定会赞叹不已",
    "大佛脚下就是祥符禅寺，千年古刹，香火绵延不断",
    "九龙灌浴表演每天上午十点、十一点半，下午一点半和三点都有",
    "梵宫建筑面积七万两千平方米，最高处六十六点五米",
    # 闭口/展唇音多 (i/in/ing)
    "您知道吗，灵山胜境是国家五A级旅游景区",
    "今天的天气真好，非常适合出游呢",
    "请跟我一起近距离欣赏灵山大佛的庄严与美丽",
    "五印坛城位于香水海中央的独立圆岛上，被称为小布达拉宫",
    # 圆唇音多 (u/ü)
    "如果您需要帮助，随时可以找我，我很乐意为您服务",
    "游客您好，欢迎来到灵山胜境，祝您旅途愉快",
    "出门在外要注意安全，保管好随身物品哦",
    "从南门入园后，可以先去佛手广场，然后参观祥符禅寺",
    # 混合
    "历史文化爱好者路线大约需要六小时深度游",
    "灵山精舍的素斋环境优雅，菜品精致，值得品尝",
    "拈花湾禅意小镇与灵山胜境比邻，以禅意慢生活为核心",
    "一百零八个纯铜转经筒，顺时针转动寓意祈福消灾",
    "百子戏弥勒是九吨青铜群雕，弥勒佛身上有百名孩童",
    "灵山大照壁是华夏第一壁，由赵朴初先生题字",
    "夕阳时分金光普照，登上灵山大佛俯瞰太湖全景",
    "景区内有三处素斋餐厅，提供中式简餐，价格公道",
]

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "training_data")


def gen_one(text: str, voice: str = "Cherry", idx: int = 0):
    """生成一条训练样本"""
    print(f"[{idx}] TTS: {text[:30]}...")
    response = dashscope.MultiModalConversation.call(
        model="qwen3-tts-flash",
        text=text,
        voice=voice,
        api_key=settings.DASHSCOPE_API_KEY,
    )
    if response.status_code != 200:
        print(f"  TTS failed: {response.message}")
        return

    import httpx
    with httpx.Client(timeout=30) as c:
        r = c.get(response.output.audio.url)
        audio_data = r.content

    # WAV 参数
    sample_rate = 16000
    with contextlib.closing(wave.open(io.BytesIO(audio_data), 'rb')) as f:
        orig_rate = f.getframerate()
        orig_frames = f.getnframes()
        audio_raw = np.frombuffer(
            f.readframes(orig_frames), dtype=np.int16
        )

    # 重采样到 16kHz
    if orig_rate != sample_rate:
        import librosa
        audio_raw = audio_raw.astype(np.float32) / 32768.0
        audio_raw = librosa.resample(audio_raw, orig_sr=orig_rate, target_sr=sample_rate)
        audio_raw = (audio_raw * 32768.0).astype(np.int16)

    # 规则系统标注嘴型
    shapes = analyze_mouth_shapes(text)

    # Mel spectrogram (80 bins, 25ms window, 10ms hop)
    audio_float = audio_raw.astype(np.float32) / 32768.0
    n_fft = int(sample_rate * 0.025)  # 400
    hop_len = int(sample_rate * 0.01)  # 160

    import librosa
    mel = librosa.feature.melspectrogram(
        y=audio_float, sr=sample_rate, n_fft=n_fft,
        hop_length=hop_len, n_mels=80, fmin=80, fmax=7600,
    )
    mel_db = librosa.power_to_db(mel, ref=np.max)  # (80, T)

    # 对齐：每 10ms 一帧 Mel，每字约 300ms → 30 帧/字
    total_mel_frames = mel_db.shape[1]
    total_chars = len(shapes) if shapes else 1
    frames_per_char = max(1, total_mel_frames / total_chars)

    # 生成标签（上采样嘴型序列到 mel 帧率）
    labels = np.zeros((total_mel_frames, 2), dtype=np.float32)
    for i in range(total_mel_frames):
        char_idx = min(int(i / frames_per_char), len(shapes) - 1) if shapes else 0
        if shapes and char_idx < len(shapes):
            labels[i, 0] = shapes[char_idx]["mouthOpenY"]
            labels[i, 1] = shapes[char_idx]["mouthForm"]
        else:
            labels[i, 0] = 0.06
            labels[i, 1] = 0.0

    # 堆叠 5 帧为输入（上下文窗口 ~50ms）
    CONTEXT = 5
    X = np.zeros((total_mel_frames - CONTEXT + 1, CONTEXT * 80), dtype=np.float32)
    Y = labels[CONTEXT // 2: total_mel_frames - CONTEXT // 2]

    for i in range(X.shape[0]):
        X[i] = mel_db[:, i:i + CONTEXT].T.flatten()

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    np.savez(os.path.join(OUTPUT_DIR, f"sample_{idx:04d}.npz"), X=X, Y=Y)
    print(f"  saved: {X.shape[0]} frames, X={X.shape}, Y={Y.shape}")
    return X.shape[0]


def main():
    total_frames = 0
    for i, text in enumerate(SAMPLE_TEXTS):
        try:
            frames = gen_one(text, idx=i)
            if frames:
                total_frames += frames
        except Exception as e:
            print(f"  ERROR: {e}")

    # 数据增强：用同文本不同语速再生成几轮
    print(f"\n总计: {total_frames} 帧训练数据 → {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
