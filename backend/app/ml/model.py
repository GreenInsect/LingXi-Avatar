"""
轻量 MLP 嘴型预测模型
输入: 5帧堆叠 Mel Spectrogram (5×80=400维)
输出: (mouthOpenY, mouthForm)
"""
import torch
import torch.nn as nn


class MouthMLP(nn.Module):
    def __init__(self, input_dim=400, hidden1=128, hidden2=64, output_dim=2, dropout=0.1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden1),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden1, hidden2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden2, output_dim),
            nn.Sigmoid(),
        )

    def forward(self, x):
        """
        x: (batch, input_dim) 堆叠的 mel 帧
        returns: (batch, 2) → [mouthOpenY, mouthForm]
        """
        return self.net(x)


def count_parameters(model):
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


if __name__ == "__main__":
    model = MouthMLP()
    print(f"参数量: {count_parameters(model):,}")
    x = torch.randn(1, 400)
    y = model(x)
    print(f"输入: {x.shape}, 输出: {y.shape}, 值: {y[0].tolist()}")
