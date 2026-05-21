"""
MLP 嘴型推理服务 —— 从 WAV 音频直接预测嘴型参数
"""
import io
import os
import wave
import contextlib
from typing import List

import numpy as np

_MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "ml", "mouth_mlp.onnx"
)
_sess = None  # ONNX session 懒加载


def _get_session():
    global _sess
    if _sess is None:
        import onnxruntime as ort
        _sess = ort.InferenceSession(
            _MODEL_PATH,
            providers=["CPUExecutionProvider"],
        )
    return _sess


def _extract_mel(audio_bytes: bytes, sample_rate=16000):
    """提取 Mel spectrogram，返回 shape (80, T)"""
    import librosa

    # 读取 WAV
    with contextlib.closing(wave.open(io.BytesIO(audio_bytes), "rb")) as f:
        orig_rate = f.getframerate()
        n_frames = f.getnframes()
        audio_raw = np.frombuffer(f.readframes(n_frames), dtype=np.int16)

    audio_float = audio_raw.astype(np.float32) / 32768.0
    if orig_rate != sample_rate:
        audio_float = librosa.resample(audio_float, orig_sr=orig_rate, target_sr=sample_rate)

    n_fft = int(sample_rate * 0.025)
    hop_len = int(sample_rate * 0.01)
    mel = librosa.feature.melspectrogram(
        y=audio_float, sr=sample_rate, n_fft=n_fft,
        hop_length=hop_len, n_mels=80, fmin=80, fmax=7600,
    )
    mel_db = librosa.power_to_db(mel, ref=np.max)
    return mel_db


def analyze_mouth_shapes_ml(audio_bytes: bytes, target_fps=30) -> List[dict]:
    """
    从 WAV 音频预测嘴型序列，帧率 ~30fps

    Returns:
        [{"mouthOpenY": 0.45, "mouthForm": -0.12}, ...]
    """
    try:
        mel = _extract_mel(audio_bytes)
    except Exception as e:
        print(f"[mouth_ml] mel extraction failed: {e}")
        return []

    total_mel_frames = mel.shape[1]
    if total_mel_frames < 5:
        return []

    CONTEXT = 5
    sess = _get_session()

    # 标准化（与训练时一致：min-max 归一化）
    mel_norm = (mel - mel.min()) / (mel.max() - mel.min() + 1e-8)

    # 滑动窗口推理
    results = []
    for i in range(total_mel_frames - CONTEXT + 1):
        window = mel_norm[:, i:i + CONTEXT].T.flatten().astype(np.float32)  # (400,)
        out = sess.run(None, {"mel_stack": window[np.newaxis, :]})
        results.append({
            "mouthOpenY": float(out[0][0, 0]),
            "mouthForm": float(out[0][0, 1]),
        })

    # 下采样到目标帧率
    hop_ms = 10  # mel 帧间隔 10ms
    target_ms = 1000 / target_fps  # 约 33ms
    step = max(1, int(target_ms / hop_ms))

    mouth_shapes = []
    for i in range(0, len(results), step):
        r = results[i]
        mouth_shapes.append({
            "mouthOpenY": round(r["mouthOpenY"], 3),
            "mouthForm": round(r["mouthForm"], 3),
        })

    return mouth_shapes
