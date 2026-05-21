"""
训练 MLP 嘴型模型 + 导出 ONNX
"""
import os
import glob
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from app.ml.model import MouthMLP

DATA_DIR = os.path.join(os.path.dirname(__file__), "training_data")
MODEL_OUT = os.path.join(os.path.dirname(__file__), "mouth_mlp.pth")
ONNX_OUT = os.path.join(os.path.dirname(__file__), "mouth_mlp.onnx")
BATCH_SIZE = 128
EPOCHS = 50
LR = 1e-3
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


def load_data():
    files = sorted(glob.glob(os.path.join(DATA_DIR, "*.npz")))
    X_list, Y_list = [], []
    for f in files:
        d = np.load(f)
        X_list.append(d["X"])
        Y_list.append(d["Y"])
    X = np.concatenate(X_list, axis=0).astype(np.float32)
    Y = np.concatenate(Y_list, axis=0).astype(np.float32)
    print(f"Loaded {len(files)} files, {X.shape[0]} frames")

    # 标准化输入（mel dB 通常 -80~0，归一化到 0~1）
    X = (X - X.min()) / (X.max() - X.min() + 1e-8)

    # 80/20 划分
    n = len(X)
    split = int(n * 0.8)
    idx = np.random.permutation(n)
    X_train, Y_train = X[idx[:split]], Y[idx[:split]]
    X_val, Y_val = X[idx[split:]], Y[idx[split:]]
    return X_train, Y_train, X_val, Y_val


def train():
    X_train, Y_train, X_val, Y_val = load_data()

    train_ds = TensorDataset(torch.from_numpy(X_train), torch.from_numpy(Y_train))
    val_ds = TensorDataset(torch.from_numpy(X_val), torch.from_numpy(Y_val))
    train_dl = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    val_dl = DataLoader(val_ds, batch_size=BATCH_SIZE)

    model = MouthMLP().to(DEVICE)
    print(f"Model params: {sum(p.numel() for p in model.parameters()):,}")
    print(f"Device: {DEVICE}")

    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    criterion = nn.MSELoss()
    best_val_loss = float("inf")
    patience_counter = 0

    for epoch in range(EPOCHS):
        model.train()
        train_loss = 0
        for xb, yb in train_dl:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * xb.size(0)
        train_loss /= len(train_ds)

        model.eval()
        val_loss = 0
        with torch.no_grad():
            for xb, yb in val_dl:
                xb, yb = xb.to(DEVICE), yb.to(DEVICE)
                pred = model(xb)
                val_loss += criterion(pred, yb).item() * xb.size(0)
        val_loss /= len(val_ds)

        print(f"Epoch {epoch+1:3d}/{EPOCHS}  train_loss={train_loss:.6f}  val_loss={val_loss:.6f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            torch.save(model.state_dict(), MODEL_OUT)
        else:
            patience_counter += 1
            if patience_counter >= 10:
                print(f"Early stopping at epoch {epoch+1}")
                break

    print(f"Best val_loss={best_val_loss:.6f}, saved to {MODEL_OUT}")

    # 导出 ONNX
    model.load_state_dict(torch.load(MODEL_OUT))
    model.eval()
    dummy = torch.randn(1, 400).to(DEVICE)
    torch.onnx.export(
        model, dummy, ONNX_OUT,
        input_names=["mel_stack"],
        output_names=["mouth_params"],
        dynamic_axes={"mel_stack": {0: "batch"}, "mouth_params": {0: "batch"}},
        opset_version=14,
    )
    print(f"ONNX exported to {ONNX_OUT}")

    # 验证 ONNX
    import onnx
    onnx_model = onnx.load(ONNX_OUT)
    onnx.checker.check_model(onnx_model)
    print("ONNX model validated OK")

    import onnxruntime as ort
    sess = ort.InferenceSession(ONNX_OUT)
    out = sess.run(None, {"mel_stack": dummy.cpu().numpy()})
    print(f"ONNX test output: {out[0][0]}")


if __name__ == "__main__":
    train()
