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
import { SAVINGS_TOP10, COLORS, FONT_FAMILY, type Bank } from './data';
import { FontLoader } from './FontLoader';
import {
  StaggerText,
  CountUp,
  BarRise,
  ExpandCircle,
  ColorWipe,
  IndexLabel,
  CoinStack,
  SubtleGrid,
  Sparkles,
  useShake,
  gradientText,
} from './motion';

const MAX_RATE = 5.5;

// ─────────────────────────────────────────────────────────────────
// HOOK SCENE  (0~5s, 150 frames) — Light editorial
// ─────────────────────────────────────────────────────────────────
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lineGrow = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 200 } });
  const subOp = interpolate(frame, [70, 95], [0, 1], { extrapolateRight: 'clamp' });
  const subSlide = interpolate(frame, [70, 95], [30, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
      <SubtleGrid size={120} />

      <AbsoluteFill style={{ padding: '120px 160px', justifyContent: 'space-between' }}>
        {/* Top index label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 56, height: 6, background: COLORS.primary, transformOrigin: 'left', transform: `scaleX(${lineGrow})` }} />
          <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, letterSpacing: 8 }}>
            MONEY · NO. 01
          </div>
        </div>

        {/* Hero typography */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 180, lineHeight: 1.0, letterSpacing: -8, color: COLORS.text }}>
            <StaggerText text="이 적금" startFrame={0} staggerFrames={2} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 180, lineHeight: 1.0, letterSpacing: -8, marginTop: 6 }}>
            <StaggerText text="안 보면" startFrame={20} staggerFrames={2} style={{ color: COLORS.text }} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 220, lineHeight: 1.0, letterSpacing: -10, marginTop: 6, color: COLORS.primary }}>
            <StaggerText text="손해입니다." startFrame={45} staggerFrames={2} />
          </div>
        </div>

        {/* Bottom subtitle */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', opacity: subOp, transform: `translateY(${subSlide}px)` }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 26, color: COLORS.muted, letterSpacing: 4 }}>2026 · 5월호</div>
            <div style={{ fontWeight: 700, fontSize: 48, marginTop: 10, letterSpacing: -1 }}>
              고금리 적금 TOP <span style={{ color: COLORS.primary }}>10</span>
            </div>
          </div>
          <div style={{ fontWeight: 500, fontSize: 22, color: COLORS.muted, textAlign: 'right' }}>
            월급쟁이 재테크<br />박재은
          </div>
        </div>
      </AbsoluteFill>

      {/* Out: 다음 scene으로 wipe */}
      <Sequence from={130} durationInFrames={20}>
        <ColorWipe color={COLORS.primary} startFrame={0} durationFrames={20} direction="right" />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// INTRO PREVIEW SCENE  (5~10s, 150 frames) — bar chart preview
// ─────────────────────────────────────────────────────────────────
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleSlide = interpolate(frame, [0, 18], [40, 0], { extrapolateRight: 'clamp' });
  const titleOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLORS.primary, fontFamily: FONT_FAMILY, color: COLORS.textInverse }}>
      <SubtleGrid size={100} color="rgba(255,255,255,0.15)" />

      <AbsoluteFill style={{ padding: '90px 120px', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ opacity: titleOp, transform: `translateY(${titleSlide}px)` }}>
          <div style={{ fontWeight: 500, fontSize: 26, color: 'rgba(255,255,255,0.7)', letterSpacing: 6 }}>
            PREVIEW · ALL 10 BANKS
          </div>
          <div style={{ fontWeight: 900, fontSize: 100, letterSpacing: -4, marginTop: 12 }}>
            한 눈에 미리보기
          </div>
        </div>

        {/* Bar chart of all 10 banks */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 18, marginTop: 60, paddingBottom: 80 }}>
          {[...SAVINGS_TOP10].reverse().map((b, i) => {
            const isTop3 = b.rank <= 3;
            const start = 25 + i * 5;
            const labelOp = interpolate(frame, [start + 20, start + 35], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div key={b.rank} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontWeight: 800, fontSize: 38, color: 'rgba(255,255,255,0.95)', opacity: labelOp, letterSpacing: -1 }}>
                  {b.rate}<span style={{ fontSize: 22 }}>%</span>
                </div>
                <BarRise
                  width={80}
                  maxHeight={550}
                  ratio={parseFloat(b.rate) / MAX_RATE}
                  color={isTop3 ? COLORS.accent : 'rgba(255,255,255,0.85)'}
                  startFrame={start}
                  durationFrames={30}
                  radius={12}
                />
                <div style={{ fontWeight: 700, fontSize: 26, color: isTop3 ? COLORS.accent : 'rgba(255,255,255,0.7)', opacity: labelOp }}>
                  {b.rank}위
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// RANK SCENE  (각 4초, 120 frames) — 10위 ~ 2위
// ─────────────────────────────────────────────────────────────────
const RankScene: React.FC<{ data: Bank }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isTop3 = data.rank <= 3;

  const rankSlide = interpolate(frame, [0, 16], [-100, 0], { extrapolateRight: 'clamp' });
  const rankOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const lineSpan = spring({ frame: frame - 14, fps, config: { damping: 20, stiffness: 180 } });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
      <SubtleGrid size={120} />

      <AbsoluteFill style={{ padding: '100px 140px', display: 'flex', flexDirection: 'column' }}>
        {/* Top index label */}
        <IndexLabel index={data.rank} color={isTop3 ? COLORS.primary : COLORS.muted} startFrame={0} />

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 80, marginTop: 30 }}>
          {/* Left: massive rank number */}
          <div style={{ flex: '0 0 480px' }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 540,
                lineHeight: 0.85,
                letterSpacing: -28,
                color: isTop3 ? COLORS.primary : COLORS.text,
                opacity: rankOp,
                transform: `translateY(${rankSlide}px)`,
              }}
            >
              {data.rank}
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 80,
                color: isTop3 ? COLORS.primary : COLORS.text,
                opacity: rankOp,
                marginTop: -20,
                letterSpacing: -2,
              }}
            >
              위
            </div>
          </div>

          {/* Vertical divider */}
          <div style={{ width: 2, background: COLORS.line, alignSelf: 'stretch', transformOrigin: 'top', transform: `scaleY(${lineSpan})` }} />

          {/* Right: bank info */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 26, color: COLORS.muted, letterSpacing: 4 }}>
              {data.bank.toUpperCase().slice(0, 4)} · BANK
            </div>
            <div style={{ fontWeight: 900, fontSize: 96, marginTop: 12, letterSpacing: -3 }}>
              <StaggerText text={data.bank} startFrame={20} staggerFrames={2} />
            </div>
            <div style={{ fontWeight: 500, fontSize: 38, color: COLORS.muted, marginTop: 8, letterSpacing: -1 }}>
              <StaggerText text={data.product} startFrame={35} staggerFrames={1} />
            </div>

            {/* Rate big */}
            <div style={{ marginTop: 50, display: 'flex', alignItems: 'flex-end', gap: 24 }}>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 220,
                  color: COLORS.data,
                  letterSpacing: -10,
                  lineHeight: 1,
                }}
              >
                <CountUp to={parseFloat(data.rate)} startFrame={45} durationFrames={28} decimals={2} suffix="" />
                <span style={{ fontSize: 110 }}>%</span>
              </div>
            </div>

            {/* Meta */}
            <div style={{ display: 'flex', gap: 32, marginTop: 30, opacity: interpolate(frame, [60, 80], [0, 1], { extrapolateRight: 'clamp' }) }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 20, color: COLORS.muted, letterSpacing: 2 }}>한도</div>
                <div style={{ fontWeight: 700, fontSize: 32, marginTop: 4 }}>{data.limit}</div>
              </div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 20, color: COLORS.muted, letterSpacing: 2 }}>우대조건</div>
                <div style={{ fontWeight: 700, fontSize: 32, marginTop: 4 }}>{data.condition}</div>
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// CHAMPION SCENE (1380 ~ 1710, 330 frames = 11s)
// ─────────────────────────────────────────────────────────────────
const ChampionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = SAVINGS_TOP10[0];
  const shake = useShake(2, 60, 14);
  const ratePulse = 1 + Math.sin(frame / 7) * 0.025;

  return (
    <AbsoluteFill style={{ background: COLORS.bgDark, fontFamily: FONT_FAMILY, color: COLORS.textInverse }}>
      {/* Wipe in from top */}
      <ColorWipe color={COLORS.primary} startFrame={0} durationFrames={18} direction="bottom" />

      <SubtleGrid size={100} color="rgba(255,255,255,0.06)" />
      <Sparkles count={20} color={COLORS.accent} />

      <AbsoluteFill style={{ padding: '100px 140px', transform: `translate(${shake.x}px, ${shake.y}px)` }}>
        {/* TOP label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 60, height: 4, background: COLORS.accent }} />
          <div style={{ fontWeight: 700, fontSize: 30, color: COLORS.accent, letterSpacing: 8 }}>
            CHAMPION · NO. 01
          </div>
        </div>

        {/* Big "1위" with glow */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 30 }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 540,
              lineHeight: 0.85,
              letterSpacing: -28,
              color: COLORS.accent,
              textShadow: '0 0 80px rgba(255,184,0,0.4)',
            }}
          >
            <CountUp to={1} from={1} startFrame={20} durationFrames={1} decimals={0} suffix="" />
            1
          </div>
          <div style={{ fontWeight: 700, fontSize: 200, color: COLORS.accent, marginLeft: 10, marginBottom: 30, letterSpacing: -6 }}>
            위
          </div>
          <div style={{ flex: 1, marginLeft: 40, marginBottom: 60 }}>
            <div style={{ fontWeight: 500, fontSize: 28, color: 'rgba(255,255,255,0.7)', letterSpacing: 4 }}>
              KOREA · BANK
            </div>
            <div style={{ fontWeight: 900, fontSize: 90, marginTop: 10, letterSpacing: -3 }}>
              <StaggerText text={data.bank} startFrame={40} staggerFrames={2} />
            </div>
            <div style={{ fontWeight: 500, fontSize: 40, color: 'rgba(255,255,255,0.6)', marginTop: 4, letterSpacing: -1 }}>
              {data.product}
            </div>
          </div>
        </div>

        {/* Rate hero */}
        <div style={{ marginTop: 60, textAlign: 'center' }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 320,
              color: COLORS.accent,
              letterSpacing: -16,
              lineHeight: 1,
              transform: `scale(${ratePulse})`,
              textShadow: '0 0 100px rgba(255,184,0,0.5)',
            }}
          >
            연 <CountUp to={parseFloat(data.rate)} startFrame={60} durationFrames={50} decimals={2} suffix="" />
            <span style={{ fontSize: 180 }}>%</span>
          </div>
        </div>

        {/* Meta footer */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 50, opacity: interpolate(frame, [120, 150], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 500, fontSize: 24, color: 'rgba(255,255,255,0.5)', letterSpacing: 4 }}>한도</div>
            <div style={{ fontWeight: 700, fontSize: 44, marginTop: 6 }}>{data.limit}</div>
          </div>
          <div style={{ width: 2, background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 500, fontSize: 24, color: 'rgba(255,255,255,0.5)', letterSpacing: 4 }}>우대조건</div>
            <div style={{ fontWeight: 700, fontSize: 44, marginTop: 6 }}>{data.condition}</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// CTA SCENE (1710 ~ 1800, 90 frames)
// ─────────────────────────────────────────────────────────────────
const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const { fps } = useVideoConfig();
  const dotScale = spring({ frame: frame - 30, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text, opacity: op }}>
      <SubtleGrid size={120} />
      <AbsoluteFill style={{ padding: '100px 140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: COLORS.data, transform: `scale(${dotScale})` }} />
          <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, letterSpacing: 8 }}>UPDATED MONTHLY</div>
        </div>

        {/* Center */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 200, letterSpacing: -10, lineHeight: 1, color: COLORS.text }}>
            매달 1일,<br /><span style={{ color: COLORS.primary }}>새로 갱신</span>
          </div>
          <div style={{ fontWeight: 500, fontSize: 38, color: COLORS.muted, marginTop: 30, letterSpacing: -1 }}>
            이웃 추가하면 자동으로 받아보실 수 있어요.
          </div>
        </div>

        {/* Bottom — author */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 24, color: COLORS.muted, letterSpacing: 4 }}>EDITOR</div>
            <div style={{ fontWeight: 900, fontSize: 64, marginTop: 6, letterSpacing: -2 }}>박재은</div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 32, color: COLORS.primary, letterSpacing: -1 }}>
            월급쟁이 재테크
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// LongForm Composition
// ─────────────────────────────────────────────────────────────────
export const LongForm: React.FC = () => {
  const ranksReversed = [...SAVINGS_TOP10].reverse().slice(0, 9);
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <FontLoader />
      <Audio src={staticFile('audio/day-01-may-high-rate-savings-top10-long.wav')} />
      <Sequence from={0} durationInFrames={150}>
        <HookScene />
      </Sequence>
      <Sequence from={150} durationInFrames={150}>
        <IntroScene />
      </Sequence>
      {ranksReversed.map((bank, i) => (
        <Sequence key={bank.rank} from={300 + i * 120} durationInFrames={120}>
          <RankScene data={bank} />
        </Sequence>
      ))}
      <Sequence from={1380} durationInFrames={330}>
        <ChampionScene />
      </Sequence>
      <Sequence from={1710} durationInFrames={90}>
        <CtaScene />
      </Sequence>
    </AbsoluteFill>
  );
};
