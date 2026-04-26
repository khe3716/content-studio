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
import { DAY03_GUIDE, type GuideData, type GuideItem } from './data-guide';
import { FontLoader } from './FontLoader';
import {
  StaggerText,
  ColorWipe,
  SubtleGrid,
  Sparkles,
  useShake,
  Checkmark,
  XMark,
  ProgressBar,
  useGlowPulse,
  useBounceIn,
  Flash,
  CoinStack,
} from './motion';
import audioMeta from '../public/audio/day-03-cheong-do-account-guide-meta.json';

// ─────────────────────────────────────────────────────────────────
// 타이밍: 각 scene = 자기 wav 길이 + 마진
// ─────────────────────────────────────────────────────────────────
const MARGIN = 10;
const dur = (id: string): number => {
  const m = (audioMeta as any)[id];
  return m ? m.durationFrames + MARGIN : 60;
};

// ─────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────
const GuideHook: React.FC<{ data: GuideData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lineGrow = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 200 } });
  const giantNum = useBounceIn(40, 8);
  const numShake = useShake(4, 40, 16);
  const subOp = interpolate(frame, [60, 100], [0, 1], { extrapolateRight: 'clamp' });
  const subSlide = interpolate(frame, [60, 100], [40, 0], { extrapolateRight: 'clamp' });
  const sparkleScale = spring({ frame: frame - 30, fps, config: { damping: 11 } });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
      <SubtleGrid size={100} />
      <Flash color={COLORS.primary} startFrame={40} durationFrames={8} />

      <AbsoluteFill style={{ padding: '110px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 56, height: 6, background: COLORS.primary, transformOrigin: 'left', transform: `scaleX(${lineGrow})` }} />
          <div style={{ fontWeight: 700, fontSize: 26, color: COLORS.muted, letterSpacing: 5 }}>
            {data.hookHashtag}
          </div>
          <div style={{ fontSize: 50, transform: `scale(${sparkleScale})`, marginLeft: 'auto' }}>✨</div>
        </div>

        <div>
          <div style={{ fontWeight: 900, fontSize: 100, lineHeight: 1.05, letterSpacing: -4, color: COLORS.text }}>
            <StaggerText text="청년이면 무조건" startFrame={0} staggerFrames={2} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 150, lineHeight: 0.95, letterSpacing: -7, marginTop: 18, color: COLORS.primary }}>
            <StaggerText text="청년도약계좌" startFrame={20} staggerFrames={2} />
          </div>
          <div
            style={{
              marginTop: 40,
              padding: '24px 30px',
              background: COLORS.dataSoft,
              border: `3px solid ${COLORS.data}`,
              borderRadius: 20,
              transform: `scale(${giantNum}) translate(${numShake.x}px, ${numShake.y}px)`,
              transformOrigin: 'left center',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 18,
            }}
          >
            <div style={{ fontSize: 90 }}>💰</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 36, color: COLORS.muted, letterSpacing: 4 }}>5년 후 최대</div>
              <div style={{ fontWeight: 900, fontSize: 130, color: COLORS.data, letterSpacing: -5, lineHeight: 1 }}>
                5천만원
              </div>
            </div>
          </div>
        </div>

        <div style={{ opacity: subOp, transform: `translateY(${subSlide}px)` }}>
          <div style={{ fontWeight: 700, fontSize: 44, letterSpacing: -2 }}>
            가입 자격 5가지
          </div>
          <div style={{ fontWeight: 500, fontSize: 28, color: COLORS.muted, marginTop: 6, letterSpacing: -1 }}>
            한 번에 정리해드릴게요
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// BRIDGE — "가입 자격 5가지"
// ─────────────────────────────────────────────────────────────────
const GuideBridge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleScale = spring({ frame, fps, config: { damping: 11 } });
  const bigNumScale = spring({ frame: frame - 12, fps, config: { damping: 8, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ background: COLORS.primary, fontFamily: FONT_FAMILY, color: COLORS.textInverse }}>
      <ColorWipe color={COLORS.primary} startFrame={0} durationFrames={14} direction="right" />
      <SubtleGrid size={100} color="rgba(255,255,255,0.12)" />
      <Sparkles count={10} color={COLORS.accent} />

      <AbsoluteFill style={{ padding: '0 70px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 30 }}>
        <div style={{ fontWeight: 700, fontSize: 32, color: 'rgba(255,255,255,0.7)', letterSpacing: 8, transform: `scale(${titleScale})` }}>
          ELIGIBILITY · 가입 자격
        </div>
        <div
          style={{
            fontWeight: 900,
            fontSize: 480,
            lineHeight: 0.9,
            letterSpacing: -22,
            color: COLORS.accent,
            transform: `scale(${bigNumScale})`,
            textShadow: '0 0 80px rgba(255,184,0,0.4)',
          }}
        >
          5
        </div>
        <div style={{ fontWeight: 900, fontSize: 110, letterSpacing: -3 }}>
          가지
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// ITEM SCENE — 각 scene의 wav 길이에 동적 매칭
// ─────────────────────────────────────────────────────────────────
// 각 자격별 하단 시각 메타포 (하단 빈 공간 채움)
const ItemVisualMetaphor: React.FC<{ index: number; startFrame: number }> = ({ index, startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - startFrame;
  const op = interpolate(local, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  if (index === 1) {
    // 나이 게이지 19 ━━━━━●━━━ 34
    const dot = interpolate(local, [0, 30], [0, 0.55], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return (
      <div style={{ width: '100%', opacity: op }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 32, fontWeight: 700, color: COLORS.muted, marginBottom: 16, letterSpacing: -1 }}>
          <span>만 19세</span><span>34세</span>
        </div>
        <div style={{ height: 14, background: COLORS.line, borderRadius: 8, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '100%', background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.data})`, borderRadius: 8, opacity: 0.25 }} />
          <div style={{ position: 'absolute', left: `${dot * 100}%`, top: '50%', width: 36, height: 36, borderRadius: '50%', background: COLORS.primary, transform: 'translate(-50%, -50%)', boxShadow: '0 0 24px rgba(27,100,218,0.4)' }} />
        </div>
      </div>
    );
  }

  if (index === 2) {
    // 막대 그래프 7500만원 강조
    const heights = [0.4, 0.6, 0.8, 1.0];
    const labels = ['3천', '5천', '7.5천', '이상'];
    return (
      <div style={{ width: '100%', opacity: op, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 180, gap: 20 }}>
        {heights.map((h, i) => {
          const isTarget = i === 2;
          const barOp = interpolate(local, [i * 5, i * 5 + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ height: 130 * h, width: '100%', background: isTarget ? COLORS.primary : COLORS.line, borderRadius: '8px 8px 0 0', opacity: barOp, boxShadow: isTarget ? `0 0 20px ${COLORS.primary}44` : 'none' }} />
              <div style={{ fontSize: 24, fontWeight: isTarget ? 800 : 500, color: isTarget ? COLORS.primary : COLORS.muted }}>
                {labels[i]}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (index === 3) {
    // 가구 아이콘 행 (250%까지 OK)
    const figures = [0, 1, 2, 3];
    return (
      <div style={{ width: '100%', opacity: op, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 30 }}>
        {figures.map(i => {
          const itemOp = interpolate(local, [i * 5, i * 5 + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{ fontSize: 90, opacity: itemOp }}>
              👤
            </div>
          );
        })}
        <div style={{ fontSize: 42, fontWeight: 800, color: COLORS.primary, marginLeft: 14 }}>
          250% 이하 ✓
        </div>
      </div>
    );
  }

  if (index === 4) {
    // 종합과세 비대상 — 차트 + X
    return (
      <div style={{ width: '100%', opacity: op, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 36 }}>
        <div style={{ fontSize: 120 }}>📊</div>
        <div style={{ fontSize: 80, fontWeight: 900, color: COLORS.muted, letterSpacing: -2 }}>=</div>
        <XMark size={120} color="#ef4444" startFrame={startFrame + 8} />
        <div style={{ fontWeight: 800, fontSize: 42, color: '#ef4444', letterSpacing: -1 }}>
          비대상
        </div>
      </div>
    );
  }

  if (index === 5) {
    // 한 은행 — 박스 1개 강조
    return (
      <div style={{ width: '100%', opacity: op, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
        {[0, 1, 2].map(i => {
          const isOnly = i === 1;
          const itemOp = interpolate(local, [i * 5, i * 5 + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div
              key={i}
              style={{
                width: 130,
                height: 130,
                borderRadius: 16,
                background: isOnly ? COLORS.primary : COLORS.line,
                color: isOnly ? '#fff' : COLORS.muted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isOnly ? 70 : 60,
                fontWeight: 900,
                opacity: itemOp,
                boxShadow: isOnly ? `0 0 30px ${COLORS.primary}55` : 'none',
                transform: isOnly ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {isOnly ? '🏦' : '🏛️'}
            </div>
          );
        })}
      </div>
    );
  }

  return null;
};

const GuideItem: React.FC<{ item: GuideItem; total: number }> = ({ item, total }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const numScale = spring({ frame, fps, config: { damping: 11, stiffness: 130 } });
  const iconScale = spring({ frame: frame - 8, fps, config: { damping: 10 } });
  const slideIn = interpolate(frame, [4, 20], [60, 0], { extrapolateRight: 'clamp' });
  const fadeIn = interpolate(frame, [4, 18], [0, 1], { extrapolateRight: 'clamp' });

  // 각 자격별 다른 배경 톤
  const tints = [
    'rgba(27,100,218,0.04)',
    'rgba(255,184,0,0.05)',
    'rgba(0,200,150,0.05)',
    'rgba(27,100,218,0.05)',
    'rgba(255,184,0,0.04)',
  ];
  const tint = tints[(item.index - 1) % tints.length];

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
      <SubtleGrid size={100} />
      <AbsoluteFill style={{ background: tint }} />

      <AbsoluteFill style={{ padding: '70px 70px', display: 'flex', flexDirection: 'column' }}>
        {/* Top: progress (작게) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 6, background: COLORS.primary }} />
            <div style={{ fontWeight: 700, fontSize: 24, color: COLORS.muted, letterSpacing: 5 }}>
              {item.index} / {total}
            </div>
          </div>
          <ProgressBar current={item.index} total={total} width={180} height={6} startFrame={0} durationFrames={20} />
        </div>

        {/* CENTER 그룹 — 화면 중앙에 모두 모음 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 40 }}>
          {/* Hero: index + icon */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 50 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 380,
                color: COLORS.primary,
                lineHeight: 0.85,
                letterSpacing: -20,
                transform: `scale(${numScale})`,
                textShadow: '0 0 40px rgba(27,100,218,0.2)',
              }}
            >
              {item.index}
            </div>
            <div style={{ fontSize: 260, transform: `scale(${iconScale})` }}>
              {item.icon}
            </div>
          </div>

          {/* Main text — 가운데 정렬, 크게 */}
          <div style={{ textAlign: 'center', opacity: fadeIn, transform: `translateY(${-slideIn}px)` }}>
            <div style={{ fontWeight: 700, fontSize: 34, color: COLORS.muted, letterSpacing: 6, marginBottom: 14 }}>
              {item.label.toUpperCase()}
            </div>
            <div
              style={{
                fontWeight: 900,
                fontSize: 130,
                letterSpacing: -5,
                lineHeight: 1.05,
                color: COLORS.text,
              }}
            >
              {item.text}
            </div>
            {item.detail && (
              <div style={{ fontWeight: 500, fontSize: 32, color: COLORS.muted, marginTop: 14, letterSpacing: -1, opacity: interpolate(frame, [22, 40], [0, 1], { extrapolateRight: 'clamp' }) }}>
                {item.detail}
              </div>
            )}
          </div>

          {/* 시각 메타포 — 크게 가운데 */}
          <div style={{
            background: '#fff',
            borderRadius: 24,
            padding: '36px 40px',
            border: `2px solid ${COLORS.line}`,
            minHeight: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ItemVisualMetaphor index={item.index} startFrame={20} />
          </div>
        </div>

        {/* Bottom: 작은 충족 표시 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          opacity: interpolate(frame, [38, 58], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          <Checkmark size={60} color={COLORS.data} startFrame={42} />
          <div style={{ fontWeight: 800, fontSize: 32, color: COLORS.data, letterSpacing: -1 }}>
            자격 충족
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// BENEFIT
// ─────────────────────────────────────────────────────────────────
const GuideBenefit: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const cardBounce = useBounceIn(16);
  const glow = useGlowPulse(COLORS.accent, 16, 1.2);

  return (
    <AbsoluteFill style={{ background: COLORS.bgDark, fontFamily: FONT_FAMILY, color: COLORS.textInverse }}>
      <ColorWipe color={COLORS.primary} startFrame={0} durationFrames={14} direction="bottom" />
      <SubtleGrid size={100} color="rgba(255,255,255,0.06)" />
      <Sparkles count={20} color={COLORS.accent} />

      <AbsoluteFill style={{ padding: '90px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30 }}>
        <div style={{ opacity: titleOp, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 50, height: 6, background: COLORS.accent }} />
          <div style={{ fontWeight: 700, fontSize: 32, color: COLORS.accent, letterSpacing: 8 }}>
            BENEFIT · 핵심 혜택
          </div>
          <div style={{ width: 50, height: 6, background: COLORS.accent }} />
        </div>

        <div
          style={{
            padding: '40px 36px',
            borderRadius: 24,
            border: `3px solid ${COLORS.accent}`,
            background: 'rgba(255,184,0,0.1)',
            transform: `scale(${0.85 + 0.15 * cardBounce})`,
            boxShadow: glow,
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', gap: 30, marginBottom: 16 }}>
            <div style={{ fontSize: 90 }}>🏛️</div>
            <div style={{ fontSize: 90 }}>💸</div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 38, color: COLORS.accent, letterSpacing: 2 }}>정부 매월 매칭</div>
          <div style={{ fontWeight: 900, fontSize: 200, color: '#fff', letterSpacing: -8, lineHeight: 1, marginTop: 8 }}>
            +4.2만
          </div>
          <div style={{ width: 80, height: 4, background: COLORS.accent, margin: '24px auto', opacity: 0.5 }} />
          <div style={{ fontWeight: 700, fontSize: 50, color: 'rgba(255,255,255,0.95)', letterSpacing: -1 }}>
            이자도 <span style={{ color: COLORS.accent }}>비과세</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// WARNING
// ─────────────────────────────────────────────────────────────────
const GuideWarning: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleOp = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: 'clamp' });
  const xMarkScale = spring({ frame, fps, config: { damping: 8 } });
  const xMarkRot = interpolate(xMarkScale, [0, 1], [-30, 0]);
  const shake = useShake(4, 6, 14);
  const tipOp = interpolate(frame, [50, 75], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text }}>
      <SubtleGrid size={100} />

      <AbsoluteFill style={{ padding: '110px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30, transform: `translate(${shake.x}px, ${shake.y}px)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: titleOp }}>
          <div style={{ width: 44, height: 6, background: '#ef4444' }} />
          <div style={{ fontWeight: 700, fontSize: 30, color: '#ef4444', letterSpacing: 8 }}>
            WARNING · 주의
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 200, transform: `scale(${xMarkScale}) rotate(${xMarkRot}deg)` }}>⏰</div>
            <div style={{ position: 'absolute', top: 10, right: -30 }}>
              <XMark size={120} color="#ef4444" startFrame={20} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 110, color: COLORS.text, letterSpacing: -4, lineHeight: 1.05 }}>
              <span style={{ color: '#ef4444' }}>5년</span><br />못 채우면
            </div>
            <div style={{ fontWeight: 900, fontSize: 88, color: '#ef4444', marginTop: 14, letterSpacing: -3 }}>
              혜택 회수 ❌
            </div>
          </div>
        </div>

        <div
          style={{
            background: COLORS.dataSoft,
            borderRadius: 16,
            padding: '20px 28px',
            borderLeft: `6px solid ${COLORS.data}`,
            opacity: tipOp,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div style={{ fontSize: 60 }}>💡</div>
          <div style={{ fontWeight: 700, fontSize: 38, color: COLORS.text, letterSpacing: -1, lineHeight: 1.2 }}>
            비상금은 <span style={{ color: COLORS.data, fontWeight: 900 }}>파킹통장</span>에 따로!
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// CTA
// ─────────────────────────────────────────────────────────────────
const GuideCta: React.FC<{ data: GuideData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: 'clamp' });
  const arrow = Math.sin(frame / 5) * 14;
  const dotPositions = [0, 1, 2].map(i => Math.sin((frame + i * 12) / 6) * 8);

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily: FONT_FAMILY, color: COLORS.text, opacity: op }}>
      <SubtleGrid size={100} />
      <AbsoluteFill style={{ padding: '110px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
          <div style={{ width: 50, height: 6, background: COLORS.primary }} />
          <div style={{ fontWeight: 700, fontSize: 26, color: COLORS.muted, letterSpacing: 6 }}>FULL ARTICLE</div>
          <div style={{ width: 50, height: 6, background: COLORS.primary }} />
        </div>

        <div>
          <div style={{ fontSize: 90, marginBottom: 16 }}>📖</div>
          <div style={{ fontWeight: 900, fontSize: 110, letterSpacing: -5, lineHeight: 1.1 }}>
            <span style={{ color: COLORS.primary }}>{data.ctaTopline}</span>
          </div>
          <div style={{ fontWeight: 900, fontSize: 110, letterSpacing: -5, marginTop: 6 }}>
            <span style={{ color: COLORS.data }}>{data.ctaBottom}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 30 }}>
            {dotPositions.map((p, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS.primary, transform: `translateY(${p}px)`, opacity: 0.8 }} />
            ))}
          </div>
          <div style={{ fontWeight: 900, fontSize: 180, marginTop: 30, color: COLORS.primary, transform: `translateY(${arrow}px)`, letterSpacing: -8 }}>
            ↗
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 500, fontSize: 22, color: COLORS.muted, letterSpacing: 4 }}>EDITOR</div>
          <div style={{ fontWeight: 900, fontSize: 56, marginTop: 6, letterSpacing: -2 }}>박재은</div>
          <div style={{ fontWeight: 700, fontSize: 28, color: COLORS.primary, marginTop: 8 }}>월급쟁이 재테크</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// LAYOUT — wav 길이 기반 동적 timeline
// ─────────────────────────────────────────────────────────────────
const data = DAY03_GUIDE;

const SCENES: Array<{ id: string; render: () => React.ReactNode }> = [
  { id: 'hook',    render: () => <GuideHook data={data} /> },
  { id: 'intro',   render: () => <GuideBridge /> },
  { id: 'item-1',  render: () => <GuideItem item={data.items[0]} total={data.items.length} /> },
  { id: 'item-2',  render: () => <GuideItem item={data.items[1]} total={data.items.length} /> },
  { id: 'item-3',  render: () => <GuideItem item={data.items[2]} total={data.items.length} /> },
  { id: 'item-4',  render: () => <GuideItem item={data.items[3]} total={data.items.length} /> },
  { id: 'item-5',  render: () => <GuideItem item={data.items[4]} total={data.items.length} /> },
  { id: 'benefit', render: () => <GuideBenefit /> },
  { id: 'warning', render: () => <GuideWarning /> },
  { id: 'cta',     render: () => <GuideCta data={data} /> },
];

let cursor = 0;
const layout = SCENES.map(s => {
  const sceneDur = dur(s.id);
  // CTA는 음성 끝나도 화면 1초 더 유지
  const finalDur = s.id === 'cta' ? sceneDur + 30 : sceneDur;
  const placement = { ...s, from: cursor, dur: finalDur };
  cursor += finalDur;
  return placement;
});

export const SHORT_GUIDE_TOTAL_FRAMES = cursor;

export const ShortFormGuide: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.bg }}>
    <FontLoader />
    {layout.map(s => (
      <Sequence key={s.id} from={s.from} durationInFrames={s.dur}>
        <Audio src={staticFile(`audio/${data.slug}-${s.id}.wav`)} />
        {s.render()}
      </Sequence>
    ))}
  </AbsoluteFill>
);
