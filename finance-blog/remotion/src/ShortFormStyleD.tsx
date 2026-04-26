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
import { TOP5, FONT_FAMILY, type Bank } from './data';
import { FontLoader } from './FontLoader';
import { CountUp, StaggerText } from './motion';

const SLUG = 'day-01-may-high-rate-savings-top10';

// Style D 매거진 팔레트
const D = {
  bg: '#FAF6EE',          // off-white beige
  bgAccent: '#1A1A1A',    // 짙은 검정
  text: '#1A1A1A',
  muted: '#6B6557',       // 따뜻한 회색
  red: '#C8503E',         // 클래식 매거진 레드
  redSoft: '#F4DCD2',
  divider: '#1A1A1A',
};

// ─────────────────────────────────────────────────────────────────
// 매거진 가이드 라인 (상하 가는 라인)
// ─────────────────────────────────────────────────────────────────
const MagLines: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 180 } });
  return (
    <>
      <div style={{ position: 'absolute', top: 90, left: 70, right: 70, height: 3, background: D.divider, transformOrigin: 'left', transform: `scaleX(${grow})` }} />
      <div style={{ position: 'absolute', bottom: 90, left: 70, right: 70, height: 3, background: D.divider, transformOrigin: 'right', transform: `scaleX(${grow})` }} />
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────
const StyleDHook: React.FC = () => {
  const frame = useCurrentFrame();
  const dividerGrow = spring({ frame: frame - 30, fps: 30, config: { damping: 22, stiffness: 180 } });
  const ratePulse = 1 + Math.sin(frame / 5) * 0.04;

  return (
    <AbsoluteFill style={{ background: D.bg, fontFamily: FONT_FAMILY, color: D.text }}>
      <MagLines />

      <AbsoluteFill style={{ padding: '130px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 900, fontSize: 200, letterSpacing: -10, lineHeight: 0.9 }}>01</div>
          <div style={{ fontWeight: 500, fontSize: 28, color: D.muted, letterSpacing: 6, fontStyle: 'italic' }}>MAY · 2026</div>
        </div>

        <div>
          <div style={{ fontWeight: 500, fontSize: 36, color: D.red, letterSpacing: 8, fontStyle: 'italic', marginBottom: 14 }}>EDITOR'S PICK</div>
          <div style={{ fontWeight: 900, fontSize: 180, letterSpacing: -8, lineHeight: 0.95 }}>
            <StaggerText text="5월 적금" startFrame={0} staggerFrames={2} damping={20} stiffness={150} />
          </div>
          <div style={{ fontWeight: 900, fontSize: 280, letterSpacing: -14, lineHeight: 0.95, color: D.red, marginTop: 14 }}>
            <StaggerText text="TOP 5" startFrame={20} staggerFrames={3} damping={20} stiffness={150} />
          </div>

          <div style={{ width: 240, height: 2, background: D.divider, margin: '50px 0 30px', transformOrigin: 'left', transform: `scaleX(${dividerGrow})` }} />

          <div style={{ fontWeight: 500, fontSize: 36, color: D.muted, letterSpacing: -1, fontStyle: 'italic' }}>
            1위는 무려 <span style={{ fontWeight: 900, fontStyle: 'normal', color: D.red, transform: `scale(${ratePulse})`, display: 'inline-block' }}>5.50%</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 700, fontSize: 24, color: D.muted, letterSpacing: 4, fontStyle: 'italic' }}>월급쟁이 재테크</div>
          <div style={{ fontWeight: 700, fontSize: 24, color: D.text }}>— 박재은</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// RANK (매거진 톤)
// ─────────────────────────────────────────────────────────────────
const StyleDRank: React.FC<{ data: Bank }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isFirst = data.rank === 1;
  const numScale = spring({ frame, fps, config: { damping: 13 } });
  const dividerGrow = spring({ frame: frame - 14, fps, config: { damping: 22, stiffness: 180 } });
  const fadeIn = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp' });
  const rateScale = interpolate(frame, [30, 60], [0.4, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: D.bg, fontFamily: FONT_FAMILY, color: D.text }}>
      <MagLines />

      <AbsoluteFill style={{ padding: '130px 70px', display: 'flex', flexDirection: 'column' }}>
        {/* Top: huge index */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 900, fontSize: isFirst ? 280 : 220, letterSpacing: -12, lineHeight: 0.9, color: isFirst ? D.red : D.text, transform: `scale(${numScale})` }}>
            {String(data.rank).padStart(2, '0')}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 500, fontSize: 26, color: D.muted, letterSpacing: 6, fontStyle: 'italic' }}>RANK / 5</div>
            {isFirst && <div style={{ fontWeight: 700, fontSize: 30, color: D.red, marginTop: 4, fontStyle: 'italic' }}>EDITOR'S PICK ★</div>}
          </div>
        </div>

        {/* Center */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30, opacity: fadeIn }}>
          <div style={{ fontWeight: 500, fontSize: 30, color: D.red, letterSpacing: 8, fontStyle: 'italic' }}>
            {data.bank.toUpperCase().slice(0, 4)} · BANK
          </div>
          <div style={{ fontWeight: 900, fontSize: 130, letterSpacing: -5, lineHeight: 1.05 }}>
            {data.bank}
          </div>
          <div style={{ fontWeight: 500, fontSize: 50, color: D.muted, letterSpacing: -1, fontStyle: 'italic' }}>
            {data.product}
          </div>

          <div style={{ width: 200, height: 2, background: D.divider, margin: '20px 0', transformOrigin: 'left', transform: `scaleX(${dividerGrow})` }} />

          <div style={{ fontWeight: 900, fontSize: 280, letterSpacing: -14, lineHeight: 1, color: D.red, transform: `scale(${rateScale})`, transformOrigin: 'left' }}>
            <CountUp to={parseFloat(data.rate)} startFrame={30} durationFrames={32} decimals={2} suffix="" />
            <span style={{ fontSize: 150 }}>%</span>
          </div>
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: `2px solid ${D.divider}`, paddingTop: 20, opacity: interpolate(frame, [55, 80], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 22, color: D.muted, letterSpacing: 4, fontStyle: 'italic' }}>한도</div>
            <div style={{ fontWeight: 700, fontSize: 38, marginTop: 2 }}>{data.limit}</div>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 22, color: D.muted, letterSpacing: 4, fontStyle: 'italic' }}>우대</div>
            <div style={{ fontWeight: 700, fontSize: 38, marginTop: 2 }}>{data.condition}</div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// CTA
// ─────────────────────────────────────────────────────────────────
const StyleDCta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const dividerGrow = spring({ frame: frame - 30, fps, config: { damping: 22, stiffness: 180 } });
  const arrow = Math.sin(frame / 5) * 12;

  return (
    <AbsoluteFill style={{ background: D.bg, fontFamily: FONT_FAMILY, color: D.text, opacity: op }}>
      <MagLines />
      <AbsoluteFill style={{ padding: '130px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 500, fontSize: 28, color: D.red, letterSpacing: 8, fontStyle: 'italic' }}>CONTINUE READING</div>

        <div>
          <div style={{ fontWeight: 900, fontSize: 130, letterSpacing: -5, lineHeight: 1.05 }}>
            전체 <span style={{ color: D.red, fontStyle: 'italic' }}>TOP 10</span>은
          </div>
          <div style={{ fontWeight: 900, fontSize: 130, letterSpacing: -5, marginTop: 4 }}>
            블로그에서
          </div>

          <div style={{ width: 240, height: 2, background: D.divider, margin: '50px 0', transformOrigin: 'left', transform: `scaleX(${dividerGrow})` }} />

          <div style={{ fontWeight: 700, fontSize: 36, color: D.muted, fontStyle: 'italic', letterSpacing: -1 }}>
            매월 1일, 갱신되는 매거진
          </div>
          <div style={{ fontWeight: 900, fontSize: 200, marginTop: 30, color: D.red, transform: `translateX(${arrow}px)`, letterSpacing: -10 }}>
            →
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 700, fontSize: 26, color: D.muted, letterSpacing: 4, fontStyle: 'italic' }}>월급쟁이 재테크</div>
          <div style={{ fontWeight: 700, fontSize: 26, color: D.text }}>— 박재은</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────
// Composition (30s = 900 frames)
// Hook 90 + 5 Rank × 144 + CTA 90 = 900
// ─────────────────────────────────────────────────────────────────
export const ShortFormStyleD: React.FC = () => {
  const top5Reversed = [...TOP5].reverse();
  return (
    <AbsoluteFill style={{ background: D.bg }}>
      <FontLoader />
      <Audio src={staticFile(`audio/${SLUG}-short.wav`)} />
      <Sequence from={0} durationInFrames={90}>
        <StyleDHook />
      </Sequence>
      {top5Reversed.map((bank, i) => (
        <Sequence key={bank.rank} from={90 + i * 144} durationInFrames={144}>
          <StyleDRank data={bank} />
        </Sequence>
      ))}
      <Sequence from={810} durationInFrames={90}>
        <StyleDCta />
      </Sequence>
    </AbsoluteFill>
  );
};
