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
import { COLORS, FONT_FAMILY } from './data';
import { DAY02_VS, type VsData, type VsRound } from './data-vs';
import { FontLoader } from './FontLoader';
import {
  StaggerText,
  CountUp,
  BarRise,
  ColorWipe,
  SubtleGrid,
  Sparkles,
  useShake,
  Checkmark,
  XMark,
  useWinnerPush,
  useGlowPulse,
  ProgressBar,
  useBounceIn,
  Flash,
} from './motion';

// ─────────────────────────────────────────────────────────────────
// HOOK (0~3s, 90 frames) — VS 충돌 (9:16)
// ─────────────────────────────────────────────────────────────────
const VsShortHook: React.FC<{ data: VsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lineGrow = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 200 } });

  const aSlide = spring({ frame, fps, config: { damping: 14, stiffness: 130 } });
  const aY = interpolate(aSlide, [0, 1], [-200, 0]);
  const bSlide = spring({ frame: frame - 14, fps, config: { damping: 14, stiffness: 130 } });
  const bY = interpolate(bSlide, [0, 1], [200, 0]);

  const vsScale = spring({ frame: frame - 30, fps, config: { damping: 7, stiffness: 110 } });
  const vsRot = interpolate(vsScale, [0, 1], [-180, 0]);
  const vsImpact = useShake(8, 30, 18);

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
      <SubtleGrid size={100} />
      <Flash color={COLORS.primary} startFrame={30} durationFrames={10} />

      <AbsoluteFill style={{ padding: '120px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 56, height: 6, background: COLORS.primary, transformOrigin: 'left', transform: `scaleX(${lineGrow})` }} />
          <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, letterSpacing: 6 }}>
            COMPARE · 4 ROUNDS
          </div>
        </div>

        <div style={{ textAlign: 'center', transform: `translate(${vsImpact.x}px, ${vsImpact.y}px)` }}>
          <div style={{ fontWeight: 900, fontSize: 220, lineHeight: 1, letterSpacing: -10, transform: `translateY(${aY}px)` }}>
            {data.optionA.name}
          </div>
          <div
            style={{
              fontWeight: 900,
              fontSize: 280,
              color: COLORS.primary,
              letterSpacing: -12,
              transform: `scale(${vsScale}) rotate(${vsRot}deg)`,
              margin: '20px 0',
              textShadow: '0 0 60px rgba(27,100,218,0.4)',
            }}
          >
            VS
          </div>
          <div style={{ fontWeight: 900, fontSize: 220, lineHeight: 1, letterSpacing: -10, color: COLORS.primary, transform: `translateY(${bY}px)` }}>
            {data.optionB.name}
          </div>
        </div>

        <div style={{ textAlign: 'center', fontWeight: 500, fontSize: 38, color: COLORS.muted, letterSpacing: -1 }}>
          월급쟁이는 어느 쪽?
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// ROUND (각 144 frames = 4.8s) — 라운드별 시그니처 모션
// ─────────────────────────────────────────────────────────────────
const VsShortRound: React.FC<{ round: VsRound; data: VsData; totalRounds: number }> = ({ round, data, totalRounds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const winnerIsA = round.winner === 'A';

  const titleOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const titleSlide = interpolate(frame, [0, 14], [40, 0], { extrapolateRight: 'clamp' });
  const aOp = interpolate(frame, [16, 35], [0, 1], { extrapolateRight: 'clamp' });
  const bOp = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: 'clamp' });

  const winStart = 60;
  const aPush = useWinnerPush(winnerIsA, winStart, 'left');
  const bPush = useWinnerPush(!winnerIsA, winStart, 'right');
  const winLabelOp = interpolate(frame, [winStart, winStart + 18], [0, 1], { extrapolateRight: 'clamp' });
  const winnerGlow = useGlowPulse(COLORS.data, winStart);
  const winnerShake = useShake(3, winStart, 14);

  const renderValue = (value: string, isWinner: boolean) => {
    if (round.index === 1) {
      const num = parseFloat(value.replace(/[^0-9.]/g, ''));
      const ratio = num / 5.5;
      return (
        <>
          <div style={{ fontWeight: 900, fontSize: 100, color: isWinner ? COLORS.data : COLORS.text, letterSpacing: -3, marginTop: 12, lineHeight: 1 }}>
            연 <CountUp to={num} startFrame={35} durationFrames={28} decimals={2} suffix="" />
            <span style={{ fontSize: 56 }}>%</span>
          </div>
          <div style={{ marginTop: 14 }}>
            <BarRise width={500} maxHeight={36} ratio={ratio} color={isWinner ? COLORS.data : COLORS.muted} startFrame={40} durationFrames={28} radius={4} />
          </div>
        </>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <div style={{ fontWeight: 900, fontSize: 70, color: isWinner ? COLORS.data : COLORS.text, letterSpacing: -2, lineHeight: 1.1, flex: 1 }}>
          {value}
        </div>
        <div>
          {isWinner
            ? <Checkmark size={90} color={COLORS.data} startFrame={40} />
            : <XMark size={90} color="#94A3B8" startFrame={40} />}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
      <SubtleGrid size={100} />
      <Flash color={COLORS.data} startFrame={winStart} durationFrames={5} />

      <AbsoluteFill style={{ padding: '110px 80px', display: 'flex', flexDirection: 'column', transform: `translate(${winnerShake.x}px, ${winnerShake.y}px)` }}>
        {/* Top */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: titleOp, transform: `translateY(${titleSlide}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 6, background: COLORS.primary }} />
            <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, letterSpacing: 6 }}>
              ROUND {round.index} / {totalRounds}
            </div>
          </div>
          <ProgressBar current={round.index} total={totalRounds} width={200} height={6} startFrame={5} durationFrames={26} />
        </div>

        {/* Metric title */}
        <div style={{ fontWeight: 900, fontSize: 180, letterSpacing: -8, marginTop: 24, lineHeight: 1, opacity: titleOp, textAlign: 'center' }}>
          <StaggerText text={round.metric} startFrame={5} staggerFrames={2} />
        </div>

        {/* A row */}
        <div
          style={{
            marginTop: 30,
            padding: 26,
            borderRadius: 20,
            background: winnerIsA ? COLORS.dataSoft : 'transparent',
            border: winnerIsA ? `3px solid ${COLORS.data}` : `2px solid ${COLORS.line}`,
            opacity: aOp,
            transform: `translateX(${aPush.offset}px)`,
            boxShadow: winnerIsA ? winnerGlow : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 24, color: COLORS.muted, letterSpacing: 4 }}>A · {data.optionA.label}</div>
              <div style={{ fontWeight: 900, fontSize: 56, marginTop: 4, letterSpacing: -2 }}>{data.optionA.name}</div>
            </div>
            {winnerIsA && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: winLabelOp }}>
                <div style={{ fontSize: 60 }}>🏆</div>
                <div style={{ fontWeight: 900, fontSize: 36, color: COLORS.data, letterSpacing: -1 }}>WIN</div>
              </div>
            )}
          </div>
          {renderValue(round.aValue, winnerIsA)}
        </div>

        {/* VS divider */}
        <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 70, color: COLORS.muted, margin: '12px 0', letterSpacing: -2 }}>
          VS
        </div>

        {/* B row */}
        <div
          style={{
            padding: 26,
            borderRadius: 20,
            background: !winnerIsA ? COLORS.dataSoft : 'transparent',
            border: !winnerIsA ? `3px solid ${COLORS.data}` : `2px solid ${COLORS.line}`,
            opacity: bOp,
            transform: `translateX(${bPush.offset}px)`,
            boxShadow: !winnerIsA ? winnerGlow : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 24, color: COLORS.muted, letterSpacing: 4 }}>B · {data.optionB.label}</div>
              <div style={{ fontWeight: 900, fontSize: 56, marginTop: 4, letterSpacing: -2 }}>{data.optionB.name}</div>
            </div>
            {!winnerIsA && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: winLabelOp }}>
                <div style={{ fontSize: 60 }}>🏆</div>
                <div style={{ fontWeight: 900, fontSize: 36, color: COLORS.data, letterSpacing: -1 }}>WIN</div>
              </div>
            )}
          </div>
          {renderValue(round.bValue, !winnerIsA)}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// VERDICT (90 frames = 3s)
// ─────────────────────────────────────────────────────────────────
const VsShortVerdict: React.FC<{ data: VsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const aBounce = useBounceIn(20);
  const bBounce = useBounceIn(35);
  const aOp = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: 'clamp' });
  const bOp = interpolate(frame, [35, 60], [0, 1], { extrapolateRight: 'clamp' });
  const aGlow = useGlowPulse(COLORS.accent, 50, 1.2);
  const bGlow = useGlowPulse(COLORS.accent, 65, 1.2);

  return (
    <AbsoluteFill style={{ background: COLORS.bgDark, fontFamily: FONT_FAMILY, color: COLORS.textInverse, opacity: op }}>
      <ColorWipe color={COLORS.primary} startFrame={0} durationFrames={18} direction="bottom" />
      <SubtleGrid size={100} color="rgba(255,255,255,0.06)" />
      <Sparkles count={14} color={COLORS.accent} />

      <AbsoluteFill style={{ padding: '120px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 36 }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 36, color: COLORS.accent, letterSpacing: 8 }}>
          VERDICT · 결론
        </div>

        <div
          style={{
            padding: '30px 36px',
            borderRadius: 20,
            border: `2px solid ${COLORS.accent}`,
            opacity: aOp,
            transform: `scale(${0.85 + 0.15 * aBounce})`,
            boxShadow: aGlow,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div style={{ fontSize: 70 }}>💰</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 80, color: COLORS.accent, letterSpacing: -3, lineHeight: 1 }}>{data.verdict.aFor}</div>
            <div style={{ fontWeight: 700, fontSize: 56, marginTop: 6, letterSpacing: -2, lineHeight: 1 }}>= {data.optionA.name}</div>
          </div>
        </div>

        <div
          style={{
            padding: '30px 36px',
            borderRadius: 20,
            border: `2px solid ${COLORS.accent}`,
            opacity: bOp,
            transform: `scale(${0.85 + 0.15 * bBounce})`,
            boxShadow: bGlow,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div style={{ fontSize: 70 }}>🔒</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 80, color: COLORS.accent, letterSpacing: -3, lineHeight: 1 }}>{data.verdict.bFor}</div>
            <div style={{ fontWeight: 700, fontSize: 56, marginTop: 6, letterSpacing: -2, lineHeight: 1 }}>= {data.optionB.name}</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// CTA (90 frames)
// ─────────────────────────────────────────────────────────────────
const VsShortCta: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const arrow = Math.sin(frame / 5) * 14;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text, opacity: op }}>
      <SubtleGrid size={100} />
      <AbsoluteFill style={{ padding: '120px 80px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, justifyContent: 'center' }}>
          <div style={{ width: 56, height: 6, background: COLORS.primary }} />
          <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, letterSpacing: 6 }}>FULL ARTICLE</div>
        </div>

        <div>
          <div style={{ fontWeight: 900, fontSize: 130, letterSpacing: -6, lineHeight: 1.05 }}>
            시나리오별<br /><span style={{ color: COLORS.primary }}>추천</span>은
          </div>
          <div style={{ fontWeight: 900, fontSize: 130, letterSpacing: -6, marginTop: 10 }}>
            <span style={{ color: COLORS.data }}>블로그</span>에서
          </div>
          <div style={{ fontWeight: 900, fontSize: 200, marginTop: 50, color: COLORS.primary, transform: `translateY(${arrow}px)`, letterSpacing: -8 }}>
            ↗
          </div>
        </div>

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
// ShortFormVS Composition (30s = 900 frames)
// Hook 90 + 4 Round × 144 + Verdict 90 + CTA 144 = 900
// ─────────────────────────────────────────────────────────────────
export const ShortFormVS: React.FC = () => {
  const data = DAY02_VS;
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <FontLoader />
      <Audio src={staticFile(`audio/${data.slug}-short.wav`)} />
      <Sequence from={0} durationInFrames={90}>
        <VsShortHook data={data} />
      </Sequence>
      {data.rounds.map((r, i) => (
        <Sequence key={r.index} from={90 + i * 144} durationInFrames={144}>
          <VsShortRound round={r} data={data} totalRounds={data.rounds.length} />
        </Sequence>
      ))}
      <Sequence from={666} durationInFrames={90}>
        <VsShortVerdict data={data} />
      </Sequence>
      <Sequence from={756} durationInFrames={144}>
        <VsShortCta />
      </Sequence>
    </AbsoluteFill>
  );
};
