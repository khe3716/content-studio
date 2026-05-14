import { useCurrentFrame, useVideoConfig, spring, interpolate, AbsoluteFill, Easing } from 'remotion';
import React from 'react';
import { COLORS } from './data';

// ─────────────────────────────────────────────────────────────────
// Easing presets — 메인 텍스트는 ease-in, 보조는 spring·linear
// ─────────────────────────────────────────────────────────────────
export const easeIn = Easing.in(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.cubic);
export const easeOut = Easing.out(Easing.cubic);

// ─────────────────────────────────────────────────────────────────
// StaggerTextRich — 풍부한 글자 등장 (blur + scale + slide + rotate + ease-in)
// ─────────────────────────────────────────────────────────────────
export const StaggerTextRich: React.FC<{
  text: string;
  startFrame?: number;
  staggerFrames?: number;
  duration?: number;
  style?: React.CSSProperties;
  axis?: 'y' | 'x';
}> = ({ text, startFrame = 0, staggerFrames = 3, duration = 22, style, axis = 'y' }) => {
  const frame = useCurrentFrame();
  return (
    <span style={{ display: 'inline-block', whiteSpace: 'pre', ...style }}>
      {[...text].map((ch, i) => {
        const local = frame - startFrame - i * staggerFrames;
        // ease-in 곡선 (cubic): 천천히 시작 → 빠르게 끝
        const t = interpolate(local, [0, duration], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: easeIn,
        });
        const op = t;
        const slide = (1 - t) * 80;
        const sc = 0.55 + t * 0.45;
        const blur = (1 - t) * 18;
        const rot = (1 - t) * (i % 2 === 0 ? -8 : 8);
        const transform = axis === 'y'
          ? `translateY(${slide}px) scale(${sc}) rotate(${rot}deg)`
          : `translateX(${slide}px) scale(${sc}) rotate(${rot}deg)`;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform,
              opacity: op,
              filter: `blur(${blur}px)`,
            }}
          >
            {ch === ' ' ? ' ' : ch}
          </span>
        );
      })}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────
// BouncyDampedText — After Effects damped oscillation expression 그대로
// 원본 AE expression:
//   delay = .04;
//   myDelay = delay * textIndex;
//   t = (time - inPoint) - myDelay;
//   if (t >= 0) {
//     freq = 3; amplitude = 30; decay = 8.0;
//     s = amplitude * Math.cos(freq*t*2*Math.PI) / Math.exp(decay*t);
//     [s, s];
//   } else { value }
// ─────────────────────────────────────────────────────────────────
export const BouncyDampedText: React.FC<{
  text: string;
  startFrame?: number;
  staggerDelay?: number;       // 글자별 지연 (sec) — AE의 delay
  amplitudePos?: number;       // y축 진동 폭 (px)
  amplitudeRot?: number;       // 회전 진동 폭 (deg)
  amplitudeScale?: number;     // 스케일 진동 폭 (0~1)
  freq?: number;               // Hz
  decay?: number;              // 감쇠
  style?: React.CSSProperties;
}> = ({
  text,
  startFrame = 0,
  staggerDelay = 0.04,
  amplitudePos = 90,
  amplitudeRot = 90,
  amplitudeScale = 1,
  freq = 3,
  decay = 8,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <span style={{ display: 'inline-block', whiteSpace: 'pre', ...style }}>
      {[...text].map((ch, i) => {
        // AE: t = (time - inPoint) - myDelay
        const t = (frame - startFrame) / fps - staggerDelay * i;

        // before inPoint — 화면 밖 (opacity 0)
        if (t < 0) {
          return (
            <span key={i} style={{ display: 'inline-block', opacity: 0 }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          );
        }

        // damped oscillation: cos(freq * t * 2π) / exp(decay * t)
        // t=0일 때 1, 시간 지나며 진동하다 0으로 수렴
        const osc = Math.cos(freq * t * 2 * Math.PI) / Math.exp(decay * t);

        const posY = amplitudePos * osc;        // 90px 진동 → 0
        const rot = amplitudeRot * osc;          // 90deg 진동 → 0
        const sc = 1 - amplitudeScale * osc;     // 0에서 시작 → 1로 수렴

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${posY}px) rotate(${rot}deg) scale(${Math.max(0, sc)})`,
              transformOrigin: 'center',
            }}
          >
            {ch === ' ' ? ' ' : ch}
          </span>
        );
      })}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────
// useEaseIn — 단일 값 ease-in 보간
// ─────────────────────────────────────────────────────────────────
export const useEaseIn = (
  startFrame: number,
  duration: number,
  from: number,
  to: number,
): number => {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + duration], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeIn,
  });
};

// ─────────────────────────────────────────────────────────────────
// StaggerText — 글자 단위 등장 (절제된 모션)
// ─────────────────────────────────────────────────────────────────
interface StaggerTextProps {
  text: string;
  startFrame?: number;
  staggerFrames?: number;
  style?: React.CSSProperties;
  damping?: number;
  stiffness?: number;
}

export const StaggerText: React.FC<StaggerTextProps> = ({
  text,
  startFrame = 0,
  staggerFrames = 2,
  style,
  damping = 16,
  stiffness = 180,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <span style={{ display: 'inline-block', whiteSpace: 'pre', ...style }}>
      {[...text].map((ch, i) => {
        const local = frame - startFrame - i * staggerFrames;
        const sp = spring({ frame: local, fps, config: { damping, stiffness } });
        const op = interpolate(local, [0, 6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const ty = interpolate(sp, [0, 1], [40, 0]);
        return (
          <span key={i} style={{ display: 'inline-block', transform: `translateY(${ty}px)`, opacity: op }}>
            {ch === ' ' ? ' ' : ch}
          </span>
        );
      })}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────
// CountUp — 숫자 카운트업
// ─────────────────────────────────────────────────────────────────
interface CountUpProps {
  to: number;
  from?: number;
  startFrame?: number;
  durationFrames?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  style?: React.CSSProperties;
}

export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  startFrame = 0,
  durationFrames = 25,
  decimals = 2,
  suffix = '%',
  prefix = '',
  style,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const t = interpolate(local, [0, durationFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - t, 3);
  const value = (from + (to - from) * eased).toFixed(decimals);
  return <span style={style}>{prefix}{value}{suffix}</span>;
};

// ─────────────────────────────────────────────────────────────────
// BarRise — 막대 차트 위로 자라남
// ─────────────────────────────────────────────────────────────────
export const BarRise: React.FC<{
  width: number;
  maxHeight: number;
  ratio: number;       // 0~1
  color: string;
  startFrame?: number;
  durationFrames?: number;
  radius?: number;
  style?: React.CSSProperties;
}> = ({ width, maxHeight, ratio, color, startFrame = 0, durationFrames = 25, radius = 8, style }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const t = interpolate(local, [0, durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const eased = 1 - Math.pow(1 - t, 3);
  const h = ratio * maxHeight * eased;
  return (
    <div
      style={{
        width,
        height: h,
        background: color,
        borderRadius: `${radius}px ${radius}px 0 0`,
        alignSelf: 'flex-end',
        ...style,
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────
// ExpandCircle — 화면을 채우는 확장 원 (트랜지션·1위 폭발)
// ─────────────────────────────────────────────────────────────────
export const ExpandCircle: React.FC<{
  color: string;
  startFrame?: number;
  durationFrames?: number;
  fromSize?: number;
  centerX?: string;
  centerY?: string;
}> = ({ color, startFrame = 0, durationFrames = 25, fromSize = 0, centerX = '50%', centerY = '50%' }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const { width, height } = useVideoConfig();
  const maxR = Math.hypot(width, height) * 1.1;
  const t = interpolate(local, [0, durationFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - t, 3);
  const r = fromSize + (maxR - fromSize) * eased;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: centerX,
          top: centerY,
          width: r,
          height: r,
          borderRadius: '50%',
          background: color,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// ColorWipe — 면이 좌→우 또는 다음 색으로 wipe
// ─────────────────────────────────────────────────────────────────
export const ColorWipe: React.FC<{
  color: string;
  startFrame?: number;
  durationFrames?: number;
  direction?: 'left' | 'right' | 'top' | 'bottom';
}> = ({ color, startFrame = 0, durationFrames = 18, direction = 'right' }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const t = interpolate(local, [0, durationFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - t, 3);
  const insetMap: Record<string, string> = {
    right:  `inset(0 ${(1 - eased) * 100}% 0 0)`,
    left:   `inset(0 0 0 ${(1 - eased) * 100}%)`,
    bottom: `inset(0 0 ${(1 - eased) * 100}% 0)`,
    top:    `inset(${(1 - eased) * 100}% 0 0 0)`,
  };
  return (
    <AbsoluteFill style={{ background: color, clipPath: insetMap[direction], pointerEvents: 'none' }} />
  );
};

// ─────────────────────────────────────────────────────────────────
// ConnectionLine — SVG 라인이 그려지는 stroke 애니메이션
// ─────────────────────────────────────────────────────────────────
export const ConnectionLine: React.FC<{
  x1: number; y1: number; x2: number; y2: number;
  color?: string; strokeWidth?: number;
  startFrame?: number; durationFrames?: number;
  width: number; height: number;
}> = ({ x1, y1, x2, y2, color, strokeWidth = 3, startFrame = 0, durationFrames = 20, width, height }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const t = interpolate(local, [0, durationFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - t, 3);
  const length = Math.hypot(x2 - x1, y2 - y1);
  const offset = length * (1 - eased);
  return (
    <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color || COLORS.primary} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={offset}
      />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────
// CoinStack — 동전이 쌓이는 애니메이션 (메타포)
// ─────────────────────────────────────────────────────────────────
export const CoinStack: React.FC<{
  count: number; coinSize?: number; startFrame?: number; staggerFrames?: number; color?: string; baseY?: number;
}> = ({ count, coinSize = 80, startFrame = 0, staggerFrames = 4, color, baseY = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: 'relative', width: coinSize, height: coinSize * count }}>
      {Array.from({ length: count }, (_, i) => {
        const local = frame - startFrame - i * staggerFrames;
        const sp = spring({ frame: local, fps, config: { damping: 12, stiffness: 140 } });
        const ty = interpolate(sp, [0, 1], [-300, 0]);
        const op = interpolate(local, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              bottom: baseY + i * (coinSize * 0.25),
              width: coinSize,
              height: coinSize * 0.3,
              borderRadius: '50%',
              background: color || COLORS.accent,
              boxShadow: `inset 0 -8px 0 rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.08)`,
              transform: `translateY(${ty}px)`,
              opacity: op,
            }}
          />
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// SubtleGrid — 옅은 격자 (Swiss style guide grid)
// ─────────────────────────────────────────────────────────────────
export const SubtleGrid: React.FC<{ size?: number; color?: string }> = ({
  size = 80,
  color = COLORS.line,
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        opacity: 0.3,
        pointerEvents: 'none',
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────
// IndexLabel — "No. 01" 같은 인덱스 라벨 (에디토리얼)
// ─────────────────────────────────────────────────────────────────
export const IndexLabel: React.FC<{ index: number; color?: string; startFrame?: number; style?: React.CSSProperties }> = ({
  index, color, startFrame = 0, style,
}) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame - startFrame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tx = interpolate(frame - startFrame, [0, 12], [-30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontSize: 28,
        fontWeight: 700,
        color: color || COLORS.muted,
        letterSpacing: 6,
        opacity: op,
        transform: `translateX(${tx}px)`,
        ...style,
      }}
    >
      <div style={{ width: 36, height: 3, background: color || COLORS.muted }} />
      NO. {String(index).padStart(2, '0')}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// ShapeMorph — 원·사각·바 사이 모핑 (border-radius 변화)
// ─────────────────────────────────────────────────────────────────
export const ShapeMorph: React.FC<{
  size: number; color: string; startFrame?: number; style?: React.CSSProperties;
}> = ({ size, color, startFrame = 0, style }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const t = interpolate(local, [0, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const radius = interpolate(t, [0, 0.5, 1], [50, 8, 50]);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: color,
        borderRadius: `${radius}%`,
        ...style,
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────
// gradient/stroke text helpers
// ─────────────────────────────────────────────────────────────────
export const gradientText = (from: string, to: string): React.CSSProperties => ({
  background: `linear-gradient(135deg, ${from}, ${to})`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  color: 'transparent',
});

export const strokeText = (color: string, width = 4): React.CSSProperties => ({
  WebkitTextStrokeColor: color,
  WebkitTextStrokeWidth: width,
  color: 'transparent',
});

// ─────────────────────────────────────────────────────────────────
// Shake / Sparkles / BgGlow / Camera / Flash / BgGrid
// (v1 호환 유지 — 1위 모먼트에만 사용)
// ─────────────────────────────────────────────────────────────────
export const useShake = (intensity = 4, startFrame = 0, durationFrames = 30) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0 || local > durationFrames) return { x: 0, y: 0 };
  const decay = 1 - local / durationFrames;
  return {
    x: Math.sin(local * 1.7) * intensity * decay,
    y: Math.cos(local * 2.3) * intensity * decay,
  };
};

export const Sparkles: React.FC<{ count?: number; color?: string }> = ({ count = 16, color = '#fff' }) => {
  const frame = useCurrentFrame();
  const items = Array.from({ length: count }, (_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    const xBase = (seed / 233280) * 100;
    const yBase = ((seed * 7) % 233280) / 233280 * 100;
    const phase = (i * 13) % 60;
    const op = (Math.sin(((frame + phase) / 18) * Math.PI) + 1) / 2;
    const size = 4 + (seed % 6);
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${xBase}%`,
          top: `${yBase}%`,
          width: size, height: size, borderRadius: '50%',
          background: color, opacity: op * 0.9,
          boxShadow: `0 0 ${size * 3}px ${color}`,
        }}
      />
    );
  });
  return <AbsoluteFill style={{ pointerEvents: 'none' }}>{items}</AbsoluteFill>;
};

export const BgGlow: React.FC<{ color?: string; pulseFps?: number }> = ({ color = COLORS.primary, pulseFps = 30 }) => {
  const frame = useCurrentFrame();
  const pulse = Math.sin((frame / pulseFps) * Math.PI) * 0.15 + 0.85;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, ${color}22 0%, transparent 60%)`,
        opacity: pulse, pointerEvents: 'none',
      }}
    />
  );
};

export const Camera: React.FC<{ children: React.ReactNode; zoomPerFrame?: number }> = ({ children, zoomPerFrame = 0.0003 }) => {
  const frame = useCurrentFrame();
  const scale = 1 + frame * zoomPerFrame;
  return <AbsoluteFill style={{ transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
};

export const Flash: React.FC<{ color?: string; durationFrames?: number; startFrame?: number }> = ({
  color = '#fff', durationFrames = 8, startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const op = interpolate(local, [0, durationFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (local < 0 || local > durationFrames) return null;
  return <AbsoluteFill style={{ background: color, opacity: op, pointerEvents: 'none' }} />;
};

// ─────────────────────────────────────────────────────────────────
// Checkmark — SVG 체크 표시가 그려지는 stroke 애니메이션
// ─────────────────────────────────────────────────────────────────
export const Checkmark: React.FC<{
  size?: number; color?: string; startFrame?: number; durationFrames?: number; strokeWidth?: number;
}> = ({ size = 120, color = COLORS.data, startFrame = 0, durationFrames = 18, strokeWidth = 14 }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const t = interpolate(local, [0, durationFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - t, 3);
  const pathLength = 140;
  const offset = pathLength * (1 - eased);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
      <circle cx="50" cy="50" r="44" fill={color} opacity={interpolate(local, [0, 8], [0, 0.15], { extrapolateRight: 'clamp' })} />
      <path
        d="M 28 52 L 44 68 L 74 36"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={pathLength}
        strokeDashoffset={offset}
      />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────
// XMark — SVG X 표시
// ─────────────────────────────────────────────────────────────────
export const XMark: React.FC<{
  size?: number; color?: string; startFrame?: number; durationFrames?: number; strokeWidth?: number;
}> = ({ size = 120, color = COLORS.warn || '#ef4444', startFrame = 0, durationFrames = 16, strokeWidth = 14 }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const t1 = interpolate(local, [0, durationFrames * 0.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const t2 = interpolate(local, [durationFrames * 0.4, durationFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const len = 80;
  const off1 = len * (1 - (1 - Math.pow(1 - t1, 3)));
  const off2 = len * (1 - (1 - Math.pow(1 - t2, 3)));
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
      <circle cx="50" cy="50" r="44" fill={color} opacity={interpolate(local, [0, 8], [0, 0.12], { extrapolateRight: 'clamp' })} />
      <line x1="30" y1="30" x2="70" y2="70" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={off1} />
      <line x1="70" y1="30" x2="30" y2="70" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={off2} />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────
// WinnerPush — 승자 박스가 살짝 밀어내는 효과 (좌·우)
// ─────────────────────────────────────────────────────────────────
export const useWinnerPush = (
  isWinner: boolean,
  startFrame: number,
  side: 'left' | 'right',
) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  const sp = spring({ frame: local, fps, config: { damping: 8, stiffness: 100 } });
  const pushBack = spring({ frame: local - 6, fps, config: { damping: 14, stiffness: 200 } });
  const dir = side === 'left' ? -1 : 1;
  const offset = isWinner ? 0 : (sp - pushBack) * 30 * dir;
  const winnerOffset = isWinner ? -(sp - pushBack) * 18 * dir : 0;
  return { offset: offset + winnerOffset };
};

// ─────────────────────────────────────────────────────────────────
// GlowPulse — 지속적 글로우 펄스
// ─────────────────────────────────────────────────────────────────
export const useGlowPulse = (color: string, startFrame: number = 0, intensity = 1) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  if (local < 0) return 'none';
  const pulse = (Math.sin(local / 8) + 1) / 2; // 0~1
  const blur = 30 + pulse * 30 * intensity;
  const spread = 0 + pulse * 8 * intensity;
  return `0 0 ${blur}px ${spread}px ${color}`;
};

// ─────────────────────────────────────────────────────────────────
// ProgressBar — 라운드 진행도
// ─────────────────────────────────────────────────────────────────
export const ProgressBar: React.FC<{
  current: number; total: number; width?: number; height?: number; color?: string; trackColor?: string; startFrame?: number; durationFrames?: number;
}> = ({ current, total, width = 320, height = 6, color, trackColor, startFrame = 0, durationFrames = 30 }) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;
  const targetRatio = current / total;
  const t = interpolate(local, [0, durationFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - t, 3);
  const ratio = ((current - 1) / total) + (1 / total) * eased;
  const fill = Math.min(ratio, targetRatio);
  return (
    <div style={{ width, height, background: trackColor || COLORS.line, borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{ width: `${fill * 100}%`, height: '100%', background: color || COLORS.primary, borderRadius: height / 2 }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// InfinitySymbol — 무한대 기호 등장
// ─────────────────────────────────────────────────────────────────
export const InfinitySymbol: React.FC<{ size?: number; color?: string; startFrame?: number }> = ({
  size = 200, color = COLORS.data, startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  const sp = spring({ frame: local, fps, config: { damping: 10, stiffness: 110 } });
  return (
    <div
      style={{
        fontSize: size,
        color,
        fontWeight: 900,
        transform: `scale(${sp}) rotate(${(1 - sp) * -180}deg)`,
        lineHeight: 1,
      }}
    >
      ∞
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// BounceIn — 스프링 바운스 등장
// ─────────────────────────────────────────────────────────────────
export const useBounceIn = (startFrame: number = 0, damping = 7) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - startFrame, fps, config: { damping, stiffness: 120 } });
};

// ─────────────────────────────────────────────────────────────────
// CardFlip — 3D Y축 회전 카드 등장
// ─────────────────────────────────────────────────────────────────
export const useCardFlip = (startFrame: number = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame: frame - startFrame, fps, config: { damping: 13, stiffness: 100 } });
  const rotY = interpolate(sp, [0, 1], [-90, 0]);
  const op = interpolate(sp, [0, 0.5, 1], [0, 0.3, 1]);
  return { rotY, op };
};

// ─────────────────────────────────────────────────────────────────
// NumberRoulette — 숫자가 룰렛처럼 빠르게 변하다 정착 (모션그래픽 핵심)
// ─────────────────────────────────────────────────────────────────
export const NumberRoulette: React.FC<{
  value: number;
  startFrame?: number;
  durationFrames?: number;
  format?: (n: number) => string;
  style?: React.CSSProperties;
}> = ({ value, startFrame = 0, durationFrames = 36, format = n => Math.round(n).toLocaleString('ko-KR'), style }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - startFrame);

  if (f >= durationFrames) {
    return <span style={style}>{format(value)}</span>;
  }

  const progress = f / durationFrames;
  // 룰렛 페이즈: 처음엔 무작위에 가깝게, 뒤로 갈수록 정답에 수렴
  const noise = (1 - progress) * value * 0.6;
  const oscillation = Math.sin(f * 0.9) * noise;
  const current = value * Math.min(progress * 1.3, 1) + oscillation;

  return <span style={style}>{format(Math.max(0, current))}</span>;
};

// ─────────────────────────────────────────────────────────────────
// StickerPop — 스티커가 회전하면서 톡 튀어나오는 강조 모션
// ─────────────────────────────────────────────────────────────────
export const StickerPop: React.FC<{
  children: React.ReactNode;
  startFrame?: number;
  rotateDeg?: number;
  bouncePeak?: number;
  style?: React.CSSProperties;
  wobble?: boolean;
}> = ({ children, startFrame = 0, rotateDeg = -8, bouncePeak = 1.18, style, wobble = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - startFrame;
  const sp = spring({ frame: f, fps, config: { damping: 9, stiffness: 140, mass: 0.6 } });

  // 스케일: 0 → 1.18 → 1.0 (오버슈트)
  const sc = interpolate(sp, [0, 0.55, 1], [0, bouncePeak, 1], { extrapolateRight: 'clamp' });
  // 회전: 처음엔 더 강한 각도에서 정착 각도로
  const rot = interpolate(sp, [0, 1], [rotateDeg * 2.5, rotateDeg], { extrapolateRight: 'clamp' });
  // 이후 살짝 흔들림 (sticker가 살아있는 느낌)
  const wob = wobble && f > 30 ? Math.sin((f - 30) / 8) * 1.2 : 0;

  return (
    <div style={{
      display: 'inline-block',
      transform: `scale(${sc}) rotate(${rot + wob}deg)`,
      transformOrigin: 'center',
      ...style,
    }}>
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// ColorCycleBg — 30초 동안 배경 컬러 부드럽게 사이클
// ─────────────────────────────────────────────────────────────────
export const ColorCycleBg: React.FC<{
  colors: string[];     // 거쳐갈 컬러들
  totalFrames: number;  // 전체 사이클 길이
  children?: React.ReactNode;
}> = ({ colors, totalFrames, children }) => {
  const frame = useCurrentFrame();
  if (colors.length === 0) return <AbsoluteFill>{children}</AbsoluteFill>;

  const segLength = totalFrames / colors.length;
  const idx = Math.min(Math.floor(frame / segLength), colors.length - 1);
  const nextIdx = (idx + 1) % colors.length;
  const local = (frame - idx * segLength) / segLength;

  // 두 컬러 사이 hex 보간 (rgb 평균)
  const blend = (a: string, b: string, t: number) => {
    const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
    const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `rgb(${r}, ${g}, ${bl})`;
  };

  const bg = blend(colors[idx], colors[nextIdx], local);
  return <AbsoluteFill style={{ background: bg }}>{children}</AbsoluteFill>;
};

// ─────────────────────────────────────────────────────────────────
// StampPop — 도장 찍히는 무빙 (위에서 빠르게 내려와 임팩트 후 정착)
// ─────────────────────────────────────────────────────────────────
export const StampPop: React.FC<{
  children: React.ReactNode;
  startFrame?: number;
  finalRotateDeg?: number;
  dropFromY?: number;     // 시작 높이 offset
  impactFrames?: number;  // 떨어지는 프레임 수
  style?: React.CSSProperties;
}> = ({ children, startFrame = 0, finalRotateDeg = -8, dropFromY = -260, impactFrames = 7, style }) => {
  const frame = useCurrentFrame();
  const f = frame - startFrame;

  if (f < 0) {
    return <div style={{ display: 'inline-block', opacity: 0, ...style }}>{children}</div>;
  }

  // Phase 1: 떨어지는 단계 (0 → impactFrames). ease-in으로 가속.
  // Phase 2: 임팩트 직후 살짝 튐 (impactFrames ~ impactFrames+8)
  // Phase 3: 정착

  const dropProgress = Math.min(1, f / impactFrames);
  const dropEased = dropProgress * dropProgress;  // ease-in (가속해서 떨어짐)
  const y = dropFromY * (1 - dropEased);

  // 임팩트 직후 1~2프레임 살짝 짓눌림 (squash) → 다시 늘어남
  const postImpact = f - impactFrames;
  let scaleX = 1;
  let scaleY = 1;
  if (postImpact >= 0 && postImpact < 8) {
    // 짓눌림 그래프: 0 → -0.08 → 0
    const sq = Math.sin((postImpact / 8) * Math.PI) * 0.08;
    scaleX = 1 + sq;
    scaleY = 1 - sq;
  }

  // 떨어지는 동안엔 살짝 큰 스케일에서 시작
  const baseScale = interpolate(dropProgress, [0, 1], [1.15, 1]);

  // 회전: 떨어지는 동안 더 강한 각도 → 정착
  const rot = interpolate(dropProgress, [0, 1], [finalRotateDeg * 1.8, finalRotateDeg]);

  // 임팩트 순간 살짝 흔들림 (1~2프레임만)
  const shakeF = postImpact;
  const shake = shakeF >= 0 && shakeF < 4 ? Math.sin(shakeF * 4) * 3 : 0;

  return (
    <div style={{
      display: 'inline-block',
      transform: `translate(${shake}px, ${y}px) scale(${baseScale * scaleX}, ${baseScale * scaleY}) rotate(${rot}deg)`,
      transformOrigin: 'center',
      ...style,
    }}>
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// StampImpactDust — 도장 임팩트 순간 잉크 튀김 (12개 작은 점이 방사형으로 튀어나감)
// ─────────────────────────────────────────────────────────────────
export const StampImpactDust: React.FC<{
  startFrame?: number;
  count?: number;
  color?: string;
  spread?: number;
  size?: number;
}> = ({ startFrame = 0, count = 14, color = '#1A1A1A', spread = 220, size = 12 }) => {
  const frame = useCurrentFrame();
  const f = frame - startFrame;
  if (f < 0 || f > 24) return null;

  const progress = Math.min(1, f / 24);
  const eased = 1 - Math.pow(1 - progress, 3);

  return (
    <div style={{ position: 'absolute', top: '50%', left: '50%', pointerEvents: 'none' }}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const dist = spread * eased;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const op = 1 - progress;
        const sc = (1 - progress * 0.6) * (i % 2 === 0 ? 1 : 0.7);
        return (
          <div key={i} style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: '50%',
            background: color,
            transform: `translate(${x - size / 2}px, ${y - size / 2}px) scale(${sc})`,
            opacity: op,
          }} />
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// GlitchFlash — 1프레임 RGB split 충격 (Hook 강조)
// ─────────────────────────────────────────────────────────────────
export const GlitchFlash: React.FC<{
  children: React.ReactNode;
  triggerFrames: number[];   // 글리치 발생할 프레임 배열
  splitX?: number;
}> = ({ children, triggerFrames, splitX = 14 }) => {
  const frame = useCurrentFrame();
  const isGlitch = triggerFrames.includes(frame);

  if (!isGlitch) {
    return <div style={{ display: 'inline-block' }}>{children}</div>;
  }

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: -splitX, color: '#FF005C', mixBlendMode: 'multiply', opacity: 0.9 }}>
        {children}
      </div>
      <div style={{ position: 'absolute', top: 0, left: splitX, color: '#00C896', mixBlendMode: 'multiply', opacity: 0.9 }}>
        {children}
      </div>
      <div style={{ position: 'relative', filter: 'contrast(1.3)' }}>{children}</div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// ScribbleCircle — 핸드드로잉 원 (강조 표시)
// stroke-dasharray로 점진적으로 그려짐
// ─────────────────────────────────────────────────────────────────
export const ScribbleCircle: React.FC<{
  startFrame?: number;
  durationFrames?: number;
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}> = ({ startFrame = 0, durationFrames = 24, width = 280, height = 110, color = '#C8341A', strokeWidth = 5, style }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, Math.min(1, (frame - startFrame) / durationFrames));
  // 타원 둘레 근사
  const a = width / 2, b = height / 2;
  const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  const dashOffset = perimeter * (1 - t);
  // 살짝 손그림 느낌: 시작 각도 -30도 + 스트로크 끝부분 살짝 오버랩 (110% 그려짐)
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', ...style }}>
      <ellipse
        cx={width / 2}
        cy={height / 2}
        rx={a - strokeWidth / 2 - 2}
        ry={b - strokeWidth / 2 - 2}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={perimeter * 1.05}
        strokeDashoffset={dashOffset}
        transform={`rotate(-30 ${width / 2} ${height / 2})`}
      />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────
// BarChartGrow — 여러 막대 동시 차오름 + 정착 후 라벨 페이드인
// ─────────────────────────────────────────────────────────────────
export const BarChartGrow: React.FC<{
  bars: Array<{ value: number; max: number; color: string; label: string; tail?: string }>;
  startFrame?: number;
  growFrames?: number;
  barWidth?: number;
  gap?: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({ bars, startFrame = 0, growFrames = 24, barWidth = 110, gap = 30, height = 460, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap, ...style }}>
      {bars.map((b, i) => {
        const sp = spring({
          frame: frame - startFrame - i * 5,
          fps,
          config: { damping: 14, stiffness: 100, mass: 0.9 },
        });
        const ratio = b.value / b.max;
        const h = height * ratio * sp;
        const labelOp = interpolate(frame - startFrame - i * 5, [growFrames, growFrames + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: barWidth,
              height: h,
              background: b.color,
              borderRadius: '14px 14px 4px 4px',
              boxShadow: '0 6px 20px rgba(26,26,26,0.18)',
              opacity: Math.max(0.15, sp),
            }} />
            <div style={{ opacity: labelOp, textAlign: 'center', fontWeight: 700, fontSize: 22, color: '#1A1A1A' }}>
              {b.label}
              {b.tail && <div style={{ fontSize: 16, color: b.color, fontWeight: 800, marginTop: 4 }}>{b.tail}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};
