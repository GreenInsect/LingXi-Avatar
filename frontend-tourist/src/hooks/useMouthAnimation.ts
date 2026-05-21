import { useRef, useCallback, useEffect } from 'react';
import type { MouthShape } from '../types';

type MouthCallback = (params: { mouthOpenY: number; mouthForm: number }) => void;

export function useMouthAnimation() {
  const rafRef = useRef<number | null>(null);

  const start = useCallback((shapes: MouthShape[], durationSec: number, onMouth: MouthCallback) => {
    if (shapes.length === 0 || durationSec <= 0) return;

    const totalMs = durationSec * 1000;
    const startTime = performance.now();
    let lastPush = 0;
    const PUSH_MS = 20; // ~50fps，跟上快速语速

    function tick() {
      const elapsed = performance.now() - startTime;
      if (elapsed >= totalMs) {
        onMouth({ mouthOpenY: 0.04, mouthForm: 0 });
        rafRef.current = null;
        return;
      }

      if (elapsed - lastPush >= PUSH_MS || lastPush === 0) {
        lastPush = elapsed;

        const pos = (elapsed / totalMs) * (shapes.length - 1);

        // 小窗口 ±1 帧加权平均（~60ms），保留音节级嘴型变化
        let totalOpenY = 0, totalForm = 0, totalWeight = 0;
        const winStart = Math.max(0, Math.floor(pos - 1));
        const winEnd = Math.min(shapes.length - 1, Math.ceil(pos + 1));

        for (let i = winStart; i <= winEnd; i++) {
          const dist = Math.abs(i - pos);
          const weight = 1 / (1 + dist * dist);
          totalOpenY += shapes[i].mouthOpenY * weight;
          totalForm += shapes[i].mouthForm * weight;
          totalWeight += weight;
        }

        let openY = totalWeight > 0 ? totalOpenY / totalWeight : 0.04;
        const form = totalWeight > 0 ? totalForm / totalWeight : 0;

        // 闭嘴阈值：张嘴幅度 <0.15 时强制闭合，模拟音节间闭嘴
        if (openY < 0.15) openY = 0.04;

        onMouth({ mouthOpenY: openY, mouthForm: form });
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    if (shapes.length > 0) {
      onMouth({ mouthOpenY: shapes[0].mouthOpenY, mouthForm: shapes[0].mouthForm });
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { start, stop };
}
