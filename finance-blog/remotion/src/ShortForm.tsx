import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { TOP5, COLORS, FONT_FAMILY, type Bank } from './data';
import { FontLoader } from './FontLoader';
import {
  StaggerText,
  CountUp,
  BarRise,
  ColorWipe,
  IndexLabel,
  SubtleGrid,
  Sparkles,
  useShake,
} from './motion';

const MAX_RATE = 5.5;

// ─────────────────────────────────────────────────────────────────
// HOOK (0~3s, 90 frames) — 9:16
// ─────────────────────────────────────────────────────────────────
const ShortHookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lineGrow = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 200 } });
  const subOp = interpolate(frame, [50, 75], [0, 1], { extrapolateRight: 'clamp' });
  const subSlide = interpolate(frame, [50, 75], [40, 0], { extrapolateRight: 'clamp' });
  const ratePulse = 1 + Math.sin(frame / 5) * 0.04;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
      <SubtleGrid size={100} />

      <AbsoluteFill style={{ padding: '120px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 56, height: 6, background: COLORS.primary, transformOrigin: 'left', transform: `scaleX(${lineGrow})` }} />
          <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, letterSpacing: 6 }}>
            MONEY · NO. 01
          </div>
        </div>

        {/* Center hero */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 220, lineHeight: 0.95, letterSpacing: -10, color: COLORS.text }}>
            <StaggerText text="5월 적금" startFrame={0} staggerFrames={2} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 380, lineHeight: 0.95, letterSpacing: -16, marginTop: 20, color: COLORS.primary }}>
            <StaggerText text="TOP 5" startFrame={20} staggerFrames={3} />
          </div>
        </div>

        {/* Bottom subtitle */}
        <div style={{ opacity: subOp, transform: `translateY(${subSlide}px)` }}>
          <div style={{ fontWeight: 500, fontSize: 36, color: COLORS.muted, letterSpacing: -1 }}>
            1위는 무려
          </div>
          <div
            style={{
              fontWeight: 900,
              fontSize: 200,
              color: COLORS.data,
              letterSpacing: -8,
              transform: `scale(${ratePulse})`,
              transformOrigin: 'left',
              marginTop: 10,
            }}
          >
            5.50%
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// RANK SCENE (각 4.8초, 144 frames)
// ─────────────────────────────────────────────────────────────────
const ShortRankScene: React.FC<{ data: Bank }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isFirst = data.rank === 1;
  const shake = useShake(isFirst ? 4 : 0, 70, 12);
  const ratePulse = isFirst ? 1 + Math.sin(frame / 6) * 0.04 : 1;

  const bg = isFirst ? COLORS.bgDark : COLORS.bg;
  const fg = isFirst ? COLORS.textInverse : COLORS.text;
  const accentColor = isFirst ? COLORS.accent : COLORS.primary;
  const dataColor = isFirst ? COLORS.accent : COLORS.data;
  const mutedColor = isFirst ? 'rgba(255,255,255,0.55)' : COLORS.muted;

  const rankSlide = interpolate(frame, [0, 18], [-100, 0], { extrapolateRight: 'clamp' });
  const rankOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: bg, fontFamily: FONT_FAMILY, color: fg }}>
      {isFirst && <ColorWipe color={COLORS.primary} startFrame={0} durationFrames={18} direction="bottom" />}
      <SubtleGrid size={100} color={isFirst ? 'rgba(255,255,255,0.06)' : COLORS.line} />
      {isFirst && <Sparkles count={16} color={COLORS.accent} />}

      <AbsoluteFill style={{ padding: '120px 80px', display: 'flex', flexDirection: 'column', transform: `translate(${shake.x}px, ${shake.y}px)` }}>
        {/* Top index */}
        <IndexLabel index={data.rank} color={accentColor} startFrame={0} />

        {/* Big rank number */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginTop: 30 }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 700,
              lineHeight: 0.85,
              letterSpacing: -36,
              color: accentColor,
              opacity: rankOp,
              transform: `translateY(${rankSlide}px)`,
              textShadow: isFirst ? '0 0 80px rgba(255,184,0,0.4)' : 'none',
            }}
          >
            {data.rank}
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 220,
              color: accentColor,
              marginLeft: 14,
              marginBottom: 60,
              letterSpacing: -8,
              opacity: rankOp,
            }}
          >
            위
          </div>
        </div>

        {/* Bank info */}
        <div style={{ marginTop: 30, textAlign: 'center' }}>
          <div style={{ fontWeight: 500, fontSize: 28, color: mutedColor, letterSpacing: 6 }}>
            {data.bank.toUpperCase().slice(0, 4)} · BANK
          </div>
          <div style={{ fontWeight: 900, fontSize: 110, marginTop: 10, letterSpacing: -3 }}>
            <StaggerText text={data.bank} startFrame={20} staggerFrames={2} />
          </div>
          <div style={{ fontWeight: 500, fontSize: 44, color: mutedColor, marginTop: 6, letterSpacing: -1 }}>
            <StaggerText text={data.product} startFrame={35} staggerFrames={1} />
          </div>
        </div>

        {/* Rate */}
        <div style={{ marginTop: 50, textAlign: 'center' }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 320,
              color: dataColor,
              letterSpacing: -16,
              lineHeight: 1,
              transform: `scale(${ratePulse})`,
              textShadow: isFirst ? '0 0 100px rgba(255,184,0,0.5)' : 'none',
            }}
          >
            <CountUp to={parseFloat(data.rate)} startFrame={45} durationFrames={32} decimals={2} suffix="" />
            <span style={{ fontSize: 180 }}>%</span>
          </div>
        </div>

        {/* Meta footer */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-around',
            opacity: interpolate(frame, [70, 100], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 500, fontSize: 22, color: mutedColor, letterSpacing: 4 }}>한도</div>
            <div style={{ fontWeight: 700, fontSize: 38, marginTop: 4 }}>{data.limit}</div>
          </div>
          <div style={{ width: 2, background: isFirst ? 'rgba(255,255,255,0.2)' : COLORS.line }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 500, fontSize: 22, color: mutedColor, letterSpacing: 4 }}>우대</div>
            <div style={{ fontWeight: 700, fontSize: 38, marginTop: 4 }}>{data.condition}</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// CTA (810 ~ 900, 90 frames)
// ─────────────────────────────────────────────────────────────────
const ShortCtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const arrow = Math.sin(frame / 5) * 14;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text, opacity: op }}>
      <SubtleGrid size={100} />
      <AbsoluteFill style={{ padding: '120px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, justifyContent: 'center' }}>
          <div style={{ width: 56, height: 6, background: COLORS.primary }} />
          <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, letterSpacing: 6 }}>
            FULL LIST
          </div>
        </div>

        {/* Center */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 130, letterSpacing: -6, lineHeight: 1.05, color: COLORS.text }}>
            전체 <span style={{ color: COLORS.primary }}>TOP 10</span>은
          </div>
          <div style={{ fontWeight: 900, fontSize: 130, letterSpacing: -6, marginTop: 10, color: COLORS.text }}>
            <span style={{ color: COLORS.data }}>블로그</span>에서
          </div>
          <div
            style={{
              fontWeight: 900,
              fontSize: 200,
              marginTop: 60,
              color: COLORS.primary,
              transform: `translateY(${arrow}px)`,
              letterSpacing: -8,
            }}
          >
            ↗
          </div>
          <div style={{ fontWeight: 700, fontSize: 50, color: COLORS.muted, marginTop: 20, letterSpacing: -1 }}>
            프로필 링크
          </div>
        </div>

        {/* Bottom */}
        <div>
          <div style={{ fontWeight: 500, fontSize: 22, color: COLORS.muted, letterSpacing: 4 }}>EDITOR</div>
          <div style={{ fontWeight: 900, fontSize: 60, marginTop: 6, letterSpacing: -2 }}>박재은</div>
          <div style={{ fontWeight: 700, fontSize: 30, color: COLORS.primary, marginTop: 10 }}>월급쟁이 재테크</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// ShortForm Composition — 5위 → 1위
// ─────────────────────────────────────────────────────────────────
export const ShortForm: React.FC = () => {
  const top5Reversed = [...TOP5].reverse();
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <FontLoader />
      <Audio src={staticFile('audio/day-01-may-high-rate-savings-top10-short.wav')} />
      <Sequence from={0} durationInFrames={90}>
        <ShortHookScene />
      </Sequence>
      {top5Reversed.map((bank, i) => (
        <Sequence key={bank.rank} from={90 + i * 144} durationInFrames={144}>
          <ShortRankScene data={bank} />
        </Sequence>
      ))}
      <Sequence from={810} durationInFrames={90}>
        <ShortCtaScene />
      </Sequence>
    </AbsoluteFill>
  );
};
