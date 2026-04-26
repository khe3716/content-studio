import {
  AbsoluteFill,
  Audio,
  Easing,
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
  StaggerTextRich,
  BouncyDampedText,
  CountUp,
  ColorWipe,
  SubtleGrid,
  Sparkles,
  useShake,
  easeIn,
  easeOut,
  easeInOut,
} from './motion';

const SLUG = 'day-01-may-high-rate-savings-top10';

// 좌우 안전 마진: padding 90px (= 70 기본 + 20 안전)
const SIDE_PAD = 90;

// ─────────────────────────────────────────────────────────────────
// Floating shapes — 루프 모션 (sin/cos) 그대로
// ─────────────────────────────────────────────────────────────────
const FloatingShapes: React.FC<{ tone?: 'blue' | 'gold' | 'mint' | 'mix' }> = ({ tone = 'mix' }) => {
  const frame = useCurrentFrame();
  const c1Y = Math.sin(frame / 30) * 30;
  const c2X = Math.cos(frame / 25) * 24;
  const sqRot = frame * 0.4;
  const t1 = frame * 0.6;

  const palette = tone === 'mix'
    ? { circle: 'rgba(27,100,218,0.08)', square: 'rgba(0,200,150,0.10)', ring: 'rgba(255,184,0,0.35)' }
    : tone === 'gold'
      ? { circle: 'rgba(255,184,0,0.12)', square: 'rgba(27,100,218,0.08)', ring: 'rgba(0,200,150,0.35)' }
      : { circle: 'rgba(0,200,150,0.10)', square: 'rgba(27,100,218,0.08)', ring: 'rgba(255,184,0,0.35)' };

  return (
    <>
      <div style={{ position: 'absolute', top: 100, left: -120, width: 320, height: 320, borderRadius: '50%', background: palette.circle, transform: `translateY(${c1Y}px)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 720, right: -90, width: 240, height: 240, borderRadius: 30, background: palette.square, transform: `rotate(${sqRot}deg)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 280, left: 80, width: 180, height: 180, borderRadius: '50%', border: `8px solid ${palette.ring}`, transform: `translateX(${c2X}px) rotate(${-t1}deg)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 1200, right: 200, width: 100, height: 100, borderRadius: 20, background: 'rgba(27,100,218,0.06)', transform: `rotate(${-sqRot * 0.7}deg)`, pointerEvents: 'none' }} />
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
// HOOK — 위계 차별화: 작은 라벨 정적 / 중간 ease-out / 큰 hero ease-in
// ─────────────────────────────────────────────────────────────────
const StyleAHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 라인 grow — ease-out (자연스러운 도착)
  const lineGrow = interpolate(frame, [5, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });

  // 부제 ("1위는 무려") — spring 살짝 (부드럽게 자연스럽게)
  const subSpring = spring({ frame: frame - 50, fps, config: { damping: 18, stiffness: 110 } });
  const subOp = subSpring;
  const subY = (1 - subSpring) * 30;

  // 5.50% 큰 데이터 — spring (살짝 bounce, hero급)
  const rateSpring = spring({ frame: frame - 60, fps, config: { damping: 11, stiffness: 110 } });
  const rateScale = interpolate(rateSpring, [0, 1], [0.55, 1]);
  const ratePulse = 1 + Math.sin(frame / 5) * 0.04;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
      <SubtleGrid size={100} />
      <FloatingShapes tone="mix" />

      <AbsoluteFill style={{ padding: `120px ${SIDE_PAD}px`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Top label — 정적 (작은 글씨, 모션 X) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 56, height: 6, background: COLORS.primary, transformOrigin: 'left', transform: `scaleX(${lineGrow})` }} />
          <div style={{ fontWeight: 700, fontSize: 26, color: COLORS.muted, letterSpacing: 6 }}>MAY · NO. 01</div>
        </div>

        {/* Hero typography — AE damped oscillation (회전·튀어오름·스케일 진동, blur 없음) */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 180, lineHeight: 0.95, letterSpacing: -8 }}>
            <BouncyDampedText
              text="5월 적금"
              startFrame={0}
              staggerDelay={0.04}
              amplitudePos={60}
              amplitudeRot={45}
              amplitudeScale={1}
              freq={3}
              decay={8}
            />
          </div>
          <div style={{ fontWeight: 900, fontSize: 320, lineHeight: 0.95, letterSpacing: -14, color: COLORS.primary, marginTop: 14 }}>
            <BouncyDampedText
              text="TOP 5"
              startFrame={20}
              staggerDelay={0.05}
              amplitudePos={80}
              amplitudeRot={60}
              amplitudeScale={1}
              freq={3}
              decay={8}
            />
          </div>
        </div>

        {/* 부제 + 큰 데이터 — 부제는 부드러운 spring, 데이터는 spring bounce */}
        <div>
          <div style={{ fontWeight: 500, fontSize: 36, color: COLORS.muted, letterSpacing: -1, opacity: subOp, transform: `translateY(${subY}px)` }}>
            1위는 무려
          </div>
          <div style={{ fontWeight: 900, fontSize: 170, color: COLORS.data, letterSpacing: -7, transform: `scale(${rateScale}) scale(${ratePulse})`, transformOrigin: 'left', marginTop: 4 }}>
            5.50%
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// RANK — ease-in + StaggerTextRich
// ─────────────────────────────────────────────────────────────────
const StyleARank: React.FC<{ data: Bank }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isFirst = data.rank === 1;

  // 큰 인덱스 숫자 — 부드러운 spring scale만 (진동·blur·회전 모두 제거)
  const numSpring = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const numScale = interpolate(numSpring, [0, 1], [0.55, 1]);

  // Rate 큰 데이터 — spring (자연스러운 도착)
  const rateSpring = spring({ frame: frame - 25, fps, config: { damping: 12, stiffness: 110 } });
  const rateScaleEnter = interpolate(rateSpring, [0, 1], [0.5, 1]);
  const rateOp = rateSpring;
  const rateBlur = interpolate(rateSpring, [0, 1], [10, 0]);
  const ratePulse = isFirst ? 1 + Math.sin(frame / 6) * 0.04 : 1;

  // 메타 (작은 글씨) — 짧고 부드러운 ease-out fade (정적에 가깝게)
  const metaOp = interpolate(frame, [60, 75], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut });

  const bg = isFirst ? COLORS.bgDark : COLORS.bg;
  const fg = isFirst ? COLORS.textInverse : COLORS.text;
  const accent = isFirst ? COLORS.accent : COLORS.primary;
  const dataColor = isFirst ? COLORS.accent : COLORS.data;
  const muted = isFirst ? 'rgba(255,255,255,0.55)' : COLORS.muted;

  return (
    <AbsoluteFill style={{ background: bg, fontFamily: FONT_FAMILY, color: fg }}>
      {isFirst && <ColorWipe color={COLORS.primary} startFrame={0} durationFrames={18} direction="bottom" />}
      <SubtleGrid size={100} color={isFirst ? 'rgba(255,255,255,0.06)' : COLORS.line} />
      {!isFirst && <FloatingShapes tone={data.rank === 2 ? 'blue' : data.rank === 3 ? 'mint' : 'gold'} />}
      {isFirst && <Sparkles count={16} color={COLORS.accent} />}

      <AbsoluteFill style={{ padding: `110px ${SIDE_PAD}px`, display: 'flex', flexDirection: 'column' }}>
        {/* Top — 작은 글씨, 정적 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 6, background: accent }} />
          <div style={{ fontWeight: 700, fontSize: 28, color: muted, letterSpacing: 6 }}>RANK {data.rank} / 5</div>
        </div>

        {/* Center group */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 28 }}>
          {isFirst && (
            <div style={{ fontSize: 160, transform: `scale(${numScale}) rotate(${Math.sin(frame / 10) * 4}deg)` }}>🏆</div>
          )}

          {/* 큰 인덱스 숫자 — 부드러운 scale (진동·blur·회전 X) */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 440,
                color: accent,
                lineHeight: 0.85,
                letterSpacing: -22,
                transform: `scale(${numScale})`,
                textShadow: isFirst ? '0 0 80px rgba(255,184,0,0.4)' : 'none',
              }}
            >
              {data.rank}
            </div>
            <div style={{ fontWeight: 900, fontSize: 130, color: accent, letterSpacing: -5, transform: `scale(${numScale})` }}>위</div>
          </div>

          <div>
            {/* 작은 라벨 — 정적 */}
            <div style={{ fontWeight: 500, fontSize: 26, color: muted, letterSpacing: 6 }}>
              {data.bank.toUpperCase().slice(0, 4)} · BANK
            </div>
            {/* 은행명 (큰 텍스트) — AE damped oscillation (회전·튀어오름) */}
            <div style={{ fontWeight: 900, fontSize: 90, marginTop: 8, letterSpacing: -3 }}>
              <BouncyDampedText
                text={data.bank}
                startFrame={20}
                staggerDelay={0.04}
                amplitudePos={50}
                amplitudeRot={40}
                amplitudeScale={1}
                freq={3}
                decay={8}
              />
            </div>
            {/* 상품명 (중간) — 부드러운 ease-out fade */}
            <div
              style={{
                fontWeight: 500,
                fontSize: 38,
                color: muted,
                marginTop: 4,
                letterSpacing: -1,
                opacity: interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOut }),
              }}
            >
              {data.product}
            </div>
          </div>

          {/* Rate 큰 데이터 — spring (자연스러운 도착) */}
          <div
            style={{
              fontWeight: 900,
              fontSize: 260,
              color: dataColor,
              letterSpacing: -13,
              lineHeight: 1,
              transform: `scale(${rateScaleEnter}) scale(${ratePulse})`,
              opacity: rateOp,
              filter: `blur(${rateBlur}px)`,
              textShadow: isFirst ? '0 0 100px rgba(255,184,0,0.5)' : 'none',
            }}
          >
            <CountUp to={parseFloat(data.rate)} startFrame={28} durationFrames={28} decimals={2} suffix="" />
            <span style={{ fontSize: 150 }}>%</span>
          </div>
        </div>

        {/* Bottom meta — 작은 글씨, 짧은 fade */}
        <div style={{ display: 'flex', justifyContent: 'space-around', opacity: metaOp }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 500, fontSize: 22, color: muted, letterSpacing: 4 }}>한도</div>
            <div style={{ fontWeight: 700, fontSize: 36, marginTop: 4 }}>{data.limit}</div>
          </div>
          <div style={{ width: 2, background: isFirst ? 'rgba(255,255,255,0.2)' : COLORS.line }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 500, fontSize: 22, color: muted, letterSpacing: 4 }}>우대</div>
            <div style={{ fontWeight: 700, fontSize: 36, marginTop: 4 }}>{data.condition}</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// CTA
// ─────────────────────────────────────────────────────────────────
const StyleACta: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 22], [0, 1], { extrapolateRight: 'clamp', easing: easeOut });
  const arrowFloat = Math.sin(frame / 5) * 14;

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text, opacity: op }}>
      <SubtleGrid size={100} />
      <FloatingShapes tone="mix" />

      <AbsoluteFill style={{ padding: `120px ${SIDE_PAD}px`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, justifyContent: 'center' }}>
          <div style={{ width: 56, height: 6, background: COLORS.primary }} />
          <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.muted, letterSpacing: 6 }}>FULL ARTICLE</div>
        </div>

        <div>
          <div style={{ fontWeight: 900, fontSize: 120, letterSpacing: -5, lineHeight: 1.05 }}>
            <StaggerTextRich text="전체 TOP 10은" startFrame={0} staggerFrames={3} duration={22} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 120, letterSpacing: -5, marginTop: 10 }}>
            <StaggerTextRich text="블로그에서" startFrame={20} staggerFrames={3} duration={22} style={{ color: COLORS.data }} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 200, marginTop: 50, color: COLORS.primary, transform: `translateY(${arrowFloat}px)`, letterSpacing: -8 }}>↗</div>
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
// Composition
// ─────────────────────────────────────────────────────────────────
export const ShortFormStyleA: React.FC = () => {
  const top5Reversed = [...TOP5].reverse();
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <FontLoader />
      <Audio src={staticFile(`audio/${SLUG}-short.wav`)} />
      <Sequence from={0} durationInFrames={90}>
        <StyleAHook />
      </Sequence>
      {top5Reversed.map((bank, i) => (
        <Sequence key={bank.rank} from={90 + i * 144} durationInFrames={144}>
          <StyleARank data={bank} />
        </Sequence>
      ))}
      <Sequence from={810} durationInFrames={90}>
        <StyleACta />
      </Sequence>
    </AbsoluteFill>
  );
};
