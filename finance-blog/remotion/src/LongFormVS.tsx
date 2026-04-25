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
  InfinitySymbol,
  useBounceIn,
  useCardFlip,
  Flash,
} from './motion';

// ─────────────────────────────────────────────────────────────────
// HOOK (0~5s, 150 frames) — VS 충돌
// ─────────────────────────────────────────────────────────────────
const VsHookScene: React.FC<{ data: VsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lineGrow = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 200 } });

  // A name slides in from left
  const aSlide = spring({ frame: frame - 0, fps, config: { damping: 14, stiffness: 130 } });
  const aX = interpolate(aSlide, [0, 1], [-300, 0]);
  // B name slides in from right
  const bSlide = spring({ frame: frame - 18, fps, config: { damping: 14, stiffness: 130 } });
  const bX = interpolate(bSlide, [0, 1], [300, 0]);

  // VS impact at frame 50
  const vsScale = spring({ frame: frame - 50, fps, config: { damping: 7, stiffness: 110 } });
  const vsImpact = useShake(6, 50, 18);
  const vsRot = interpolate(vsScale, [0, 1], [-180, 0]);

  const subOp = interpolate(frame, [80, 110], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
      <SubtleGrid size={120} />
      <Flash color={COLORS.primary} startFrame={50} durationFrames={10} />

      <AbsoluteFill style={{ padding: '110px 140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 56, height: 6, background: COLORS.primary, transformOrigin: 'left', transform: `scaleX(${lineGrow})` }} />
          <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, letterSpacing: 8 }}>
            MONEY · NO. 02 · COMPARE
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 60, transform: `translate(${vsImpact.x}px, ${vsImpact.y}px)` }}>
          <div style={{ flex: 1, textAlign: 'center', transform: `translateX(${aX}px)` }}>
            <div style={{ fontWeight: 500, fontSize: 28, color: COLORS.muted, letterSpacing: 6 }}>
              {data.optionA.label}
            </div>
            <div style={{ fontWeight: 900, fontSize: 160, lineHeight: 1, letterSpacing: -8, marginTop: 16, color: COLORS.text }}>
              {data.optionA.name}
            </div>
          </div>

          <div
            style={{
              fontWeight: 900,
              fontSize: 240,
              color: COLORS.primary,
              letterSpacing: -10,
              transform: `scale(${vsScale}) rotate(${vsRot}deg)`,
              textShadow: '0 0 60px rgba(27,100,218,0.4)',
            }}
          >
            VS
          </div>

          <div style={{ flex: 1, textAlign: 'center', transform: `translateX(${bX}px)` }}>
            <div style={{ fontWeight: 500, fontSize: 28, color: COLORS.muted, letterSpacing: 6 }}>
              {data.optionB.label}
            </div>
            <div style={{ fontWeight: 900, fontSize: 160, lineHeight: 1, letterSpacing: -8, marginTop: 16, color: COLORS.primary }}>
              {data.optionB.name}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', opacity: subOp }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 50, letterSpacing: -2 }}>
              월급쟁이는 어느 쪽?
            </div>
            <div style={{ fontWeight: 500, fontSize: 28, color: COLORS.muted, marginTop: 10 }}>
              4라운드로 끝내드립니다
            </div>
          </div>
          <div style={{ fontWeight: 500, fontSize: 22, color: COLORS.muted, textAlign: 'right' }}>
            월급쟁이 재테크<br />박재은
          </div>
        </div>
      </AbsoluteFill>

      <Sequence from={130} durationInFrames={20}>
        <ColorWipe color={COLORS.primary} startFrame={0} durationFrames={20} direction="right" />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// INTRO (5~12s, 210 frames) — 카드 플립 등장
// ─────────────────────────────────────────────────────────────────
const VsIntroScene: React.FC<{ data: VsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const titleSlide = interpolate(frame, [0, 16], [40, 0], { extrapolateRight: 'clamp' });

  const cardA = useCardFlip(20);
  const cardB = useCardFlip(40);

  return (
    <AbsoluteFill style={{ background: COLORS.primary, fontFamily: FONT_FAMILY, color: COLORS.textInverse }}>
      <SubtleGrid size={100} color="rgba(255,255,255,0.1)" />

      <AbsoluteFill style={{ padding: '90px 100px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ opacity: titleOp, transform: `translateY(${titleSlide}px)` }}>
          <div style={{ fontWeight: 500, fontSize: 26, color: 'rgba(255,255,255,0.7)', letterSpacing: 6 }}>
            CONTENDERS · 도전자 소개
          </div>
          <div style={{ fontWeight: 900, fontSize: 90, letterSpacing: -4, marginTop: 12 }}>
            한 명씩 만나볼게요
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 60, marginTop: 40, perspective: 1500 }}>
          {/* Card A */}
          <div
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.95)',
              color: COLORS.text,
              padding: 60,
              borderRadius: 20,
              transform: `rotateY(${cardA.rotY}deg)`,
              opacity: cardA.op,
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              transformStyle: 'preserve-3d',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 30, color: COLORS.muted, letterSpacing: 6 }}>
              A · {data.optionA.label}
            </div>
            <div style={{ fontWeight: 900, fontSize: 130, letterSpacing: -5, lineHeight: 1, marginTop: 20 }}>
              {data.optionA.name}
            </div>
            <div style={{ width: '100%', height: 3, background: COLORS.line, marginTop: 30 }} />
            <div style={{ fontWeight: 500, fontSize: 32, marginTop: 24, color: COLORS.muted, letterSpacing: -1 }}>
              입출금 자유 · 비상금 통장
            </div>
            <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 14, opacity: interpolate(frame, [50, 80], [0, 1], { extrapolateRight: 'clamp' }) }}>
              <div style={{ fontSize: 60 }}>💰</div>
              <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, letterSpacing: -1 }}>꺼내쓰기 자유</div>
            </div>
          </div>

          {/* Card B */}
          <div
            style={{
              flex: 1,
              background: COLORS.bgDark,
              color: COLORS.textInverse,
              padding: 60,
              borderRadius: 20,
              transform: `rotateY(${cardB.rotY}deg)`,
              opacity: cardB.op,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              transformStyle: 'preserve-3d',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 30, color: COLORS.accent, letterSpacing: 6 }}>
              B · {data.optionB.label}
            </div>
            <div style={{ fontWeight: 900, fontSize: 130, letterSpacing: -5, lineHeight: 1, marginTop: 20 }}>
              {data.optionB.name}
            </div>
            <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.2)', marginTop: 30 }} />
            <div style={{ fontWeight: 500, fontSize: 32, marginTop: 24, color: 'rgba(255,255,255,0.7)', letterSpacing: -1 }}>
              매월 정기 납입 · 목돈 모으기
            </div>
            <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 14, opacity: interpolate(frame, [70, 100], [0, 1], { extrapolateRight: 'clamp' }) }}>
              <div style={{ fontSize: 60 }}>🔒</div>
              <div style={{ fontWeight: 700, fontSize: 28, color: 'rgba(255,255,255,0.7)', letterSpacing: -1 }}>금리 우위</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// ROUND SCENE (각 10초, 300 frames) — 라운드별 시그니처 모션
// ─────────────────────────────────────────────────────────────────
const VsRoundScene: React.FC<{ round: VsRound; data: VsData; totalRounds: number }> = ({ round, data, totalRounds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const winnerIsA = round.winner === 'A';

  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const titleSlide = interpolate(frame, [0, 16], [50, 0], { extrapolateRight: 'clamp' });
  const aOp = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const bOp = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' });

  const winnerStart = 90;
  const aPush = useWinnerPush(winnerIsA, winnerStart, 'left');
  const bPush = useWinnerPush(!winnerIsA, winnerStart, 'right');
  const winLabelOp = interpolate(frame, [winnerStart, winnerStart + 18], [0, 1], { extrapolateRight: 'clamp' });
  const winnerGlow = useGlowPulse(COLORS.data, winnerStart);

  const winnerShake = useShake(3, winnerStart, 14);

  // 라운드별 시그니처 컨텐츠 (Round 1만 막대 차트, 나머지는 체크/X)
  const renderSideContent = (
    side: 'A' | 'B',
    value: string,
    isWinner: boolean,
  ) => {
    if (round.index === 1) {
      // 금리: 카운트업 + 막대 차트
      const num = parseFloat(value.replace(/[^0-9.]/g, ''));
      const ratio = num / 5.5;
      return (
        <>
          <div
            style={{
              fontWeight: 900,
              fontSize: 130,
              color: isWinner ? COLORS.data : COLORS.text,
              letterSpacing: -4,
              marginTop: 20,
              lineHeight: 1,
            }}
          >
            연 <CountUp to={num} startFrame={50} durationFrames={32} decimals={2} suffix="" />
            <span style={{ fontSize: 70 }}>%</span>
          </div>
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'flex-end', height: 100 }}>
            <BarRise
              width={420}
              maxHeight={100}
              ratio={ratio}
              color={isWinner ? COLORS.data : COLORS.muted}
              startFrame={55}
              durationFrames={30}
              radius={6}
            />
          </div>
        </>
      );
    }
    // Round 2~4: 체크 / X 마크
    return (
      <>
        <div
          style={{
            fontWeight: 900,
            fontSize: 80,
            color: isWinner ? COLORS.data : COLORS.text,
            letterSpacing: -2,
            marginTop: 28,
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        <div style={{ marginTop: 30 }}>
          {isWinner
            ? <Checkmark size={120} color={COLORS.data} startFrame={55} />
            : <XMark size={120} color="#94A3B8" startFrame={55} />}
        </div>
      </>
    );
  };

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
      <SubtleGrid size={120} />
      <Flash color={COLORS.data} startFrame={winnerStart} durationFrames={6} />

      <AbsoluteFill style={{ padding: '90px 120px', display: 'flex', flexDirection: 'column', transform: `translate(${winnerShake.x}px, ${winnerShake.y}px)` }}>
        {/* Top: ROUND label + Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: titleOp, transform: `translateY(${titleSlide}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 48, height: 6, background: COLORS.primary }} />
            <div style={{ fontWeight: 700, fontSize: 30, color: COLORS.muted, letterSpacing: 8 }}>
              ROUND {round.index} / {totalRounds}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontWeight: 500, fontSize: 26, color: COLORS.muted, letterSpacing: 6 }}>
              {round.metricEng}
            </div>
            <ProgressBar current={round.index} total={totalRounds} width={260} height={8} startFrame={5} durationFrames={28} />
          </div>
        </div>

        {/* Metric title huge */}
        <div style={{ fontWeight: 900, fontSize: 180, letterSpacing: -8, lineHeight: 1, marginTop: 30, opacity: titleOp }}>
          <StaggerText text={round.metric} startFrame={5} staggerFrames={2} />
        </div>

        {/* Compare */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, marginTop: 30 }}>
          {/* Side A */}
          <div
            style={{
              flex: 1,
              padding: 40,
              opacity: aOp,
              borderRadius: 16,
              background: winnerIsA ? COLORS.dataSoft : 'transparent',
              border: winnerIsA ? `3px solid ${COLORS.data}` : `2px solid ${COLORS.line}`,
              transform: `translateX(${aPush.offset}px)`,
              boxShadow: winnerIsA ? winnerGlow : 'none',
              transition: 'box-shadow 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 26, color: COLORS.muted, letterSpacing: 6 }}>
                  A · {data.optionA.label}
                </div>
                <div style={{ fontWeight: 900, fontSize: 60, marginTop: 8, letterSpacing: -2 }}>
                  {data.optionA.name}
                </div>
              </div>
              {winnerIsA && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: winLabelOp }}>
                  <div style={{ fontSize: 80 }}>🏆</div>
                  <div style={{ fontWeight: 900, fontSize: 50, color: COLORS.data, letterSpacing: -1, marginTop: 4 }}>WIN</div>
                </div>
              )}
            </div>
            {renderSideContent('A', round.aValue, winnerIsA)}
          </div>

          {/* VS divider */}
          <div style={{ padding: '0 40px', fontWeight: 900, fontSize: 90, color: COLORS.muted, letterSpacing: -3 }}>
            VS
          </div>

          {/* Side B */}
          <div
            style={{
              flex: 1,
              padding: 40,
              opacity: bOp,
              borderRadius: 16,
              background: !winnerIsA ? COLORS.dataSoft : 'transparent',
              border: !winnerIsA ? `3px solid ${COLORS.data}` : `2px solid ${COLORS.line}`,
              transform: `translateX(${bPush.offset}px)`,
              boxShadow: !winnerIsA ? winnerGlow : 'none',
              transition: 'box-shadow 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 26, color: COLORS.muted, letterSpacing: 6 }}>
                  B · {data.optionB.label}
                </div>
                <div style={{ fontWeight: 900, fontSize: 60, marginTop: 8, letterSpacing: -2 }}>
                  {data.optionB.name}
                </div>
              </div>
              {!winnerIsA && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: winLabelOp }}>
                  <div style={{ fontSize: 80 }}>🏆</div>
                  <div style={{ fontWeight: 900, fontSize: 50, color: COLORS.data, letterSpacing: -1, marginTop: 4 }}>WIN</div>
                </div>
              )}
            </div>
            {renderSideContent('B', round.bValue, !winnerIsA)}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// VERDICT (150 frames = 5s) — Trophy bounce + 화살표
// ─────────────────────────────────────────────────────────────────
const VsVerdictScene: React.FC<{ data: VsData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleSlide = interpolate(frame, [0, 18], [40, 0], { extrapolateRight: 'clamp' });
  const titleOp = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const aRowOp = interpolate(frame, [25, 50], [0, 1], { extrapolateRight: 'clamp' });
  const bRowOp = interpolate(frame, [40, 65], [0, 1], { extrapolateRight: 'clamp' });
  const aBounce = useBounceIn(25);
  const bBounce = useBounceIn(40);
  const shake = useShake(2, 0, 14);
  const aGlow = useGlowPulse(COLORS.accent, 60, 1.2);
  const bGlow = useGlowPulse(COLORS.accent, 75, 1.2);

  return (
    <AbsoluteFill style={{ background: COLORS.bgDark, fontFamily: FONT_FAMILY, color: COLORS.textInverse }}>
      <ColorWipe color={COLORS.primary} startFrame={0} durationFrames={18} direction="bottom" />
      <SubtleGrid size={100} color="rgba(255,255,255,0.06)" />
      <Sparkles count={18} color={COLORS.accent} />

      <AbsoluteFill style={{ padding: '80px 120px', display: 'flex', flexDirection: 'column', transform: `translate(${shake.x}px, ${shake.y}px)` }}>
        <div style={{ opacity: titleOp, transform: `translateY(${titleSlide}px)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 56, height: 6, background: COLORS.accent }} />
            <div style={{ fontWeight: 700, fontSize: 30, color: COLORS.accent, letterSpacing: 8 }}>
              VERDICT · 결론
            </div>
          </div>
          <div style={{ fontWeight: 900, fontSize: 130, letterSpacing: -6, marginTop: 16 }}>
            목적별로 다 써요
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30 }}>
          {/* Row A */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 40,
              padding: '36px 50px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 20,
              opacity: aRowOp,
              border: `2px solid ${COLORS.accent}`,
              transform: `scale(${0.85 + 0.15 * aBounce})`,
              boxShadow: aGlow,
            }}
          >
            <div style={{ fontSize: 80 }}>💰</div>
            <div style={{ fontWeight: 900, fontSize: 100, color: COLORS.accent, letterSpacing: -3 }}>
              {data.verdict.aFor}
            </div>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.4)', position: 'relative' }}>
              <div style={{ position: 'absolute', right: -2, top: -8, fontSize: 30, color: 'rgba(255,255,255,0.8)' }}>▶</div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 100, letterSpacing: -3 }}>
              {data.optionA.name}
            </div>
          </div>

          {/* Row B */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 40,
              padding: '36px 50px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 20,
              opacity: bRowOp,
              border: `2px solid ${COLORS.accent}`,
              transform: `scale(${0.85 + 0.15 * bBounce})`,
              boxShadow: bGlow,
            }}
          >
            <div style={{ fontSize: 80 }}>🔒</div>
            <div style={{ fontWeight: 900, fontSize: 100, color: COLORS.accent, letterSpacing: -3 }}>
              {data.verdict.bFor}
            </div>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.4)', position: 'relative' }}>
              <div style={{ position: 'absolute', right: -2, top: -8, fontSize: 30, color: 'rgba(255,255,255,0.8)' }}>▶</div>
            </div>
            <div style={{ fontWeight: 900, fontSize: 100, letterSpacing: -3 }}>
              {data.optionB.name}
            </div>
          </div>
        </div>

        <div style={{ fontWeight: 500, fontSize: 36, color: 'rgba(255,255,255,0.6)', textAlign: 'center', letterSpacing: -1 }}>
          통장 쪼개기는 재테크 기본이에요
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// CTA (90 frames)
// ─────────────────────────────────────────────────────────────────
const VsCtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const { fps } = useVideoConfig();
  const dotScale = spring({ frame: frame - 30, fps, config: { damping: 12 } });
  const arrowFloat = Math.sin(frame / 4) * 8;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text, opacity: op }}>
      <SubtleGrid size={120} />
      <AbsoluteFill style={{ padding: '100px 140px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: COLORS.data, transform: `scale(${dotScale})` }} />
          <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, letterSpacing: 8 }}>NEXT EPISODE</div>
        </div>

        <div>
          <div style={{ fontWeight: 900, fontSize: 200, letterSpacing: -10, lineHeight: 1, color: COLORS.text }}>
            다음 회는<br /><span style={{ color: COLORS.primary, transform: `translateX(${arrowFloat}px)`, display: 'inline-block' }}>청년도약계좌</span>
          </div>
          <div style={{ fontWeight: 500, fontSize: 38, color: COLORS.muted, marginTop: 30, letterSpacing: -1 }}>
            매월 1일 갱신 · 이웃 추가하면 자동 알림
          </div>
        </div>

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
// LongFormVS Composition
// ─────────────────────────────────────────────────────────────────
export const LongFormVS: React.FC = () => {
  const data = DAY02_VS;
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <FontLoader />
      <Audio src={staticFile(`audio/${data.slug}-long.wav`)} />
      <Sequence from={0} durationInFrames={150}>
        <VsHookScene data={data} />
      </Sequence>
      <Sequence from={150} durationInFrames={210}>
        <VsIntroScene data={data} />
      </Sequence>
      {data.rounds.map((r, i) => (
        <Sequence key={r.index} from={360 + i * 300} durationInFrames={300}>
          <VsRoundScene round={r} data={data} totalRounds={data.rounds.length} />
        </Sequence>
      ))}
      <Sequence from={1560} durationInFrames={150}>
        <VsVerdictScene data={data} />
      </Sequence>
      <Sequence from={1710} durationInFrames={90}>
        <VsCtaScene />
      </Sequence>
    </AbsoluteFill>
  );
};
