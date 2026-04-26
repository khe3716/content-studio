import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { FONT_FAMILY } from './data';
import { FontLoader } from './FontLoader';
import { StaggerText, useShake, useGlowPulse, Sparkles, Flash, BouncyDampedText } from './motion';

const DEMO = {
  bank: '토스뱅크',
  product: '자유적금',
  rate: '5.50',
  label: 'MAY 2026 · NO. 01',
};

// ═════════════════════════════════════════════════════════════════
// Style A — Toss editorial + 추상 기하 도형 (라이트)
// 현재 시스템 + 옆에 도형 모션 추가
// ═════════════════════════════════════════════════════════════════
export const DemoStyleA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lineGrow = spring({ frame: frame - 5, fps, config: { damping: 18, stiffness: 200 } });
  const cardBounce = spring({ frame: frame - 30, fps, config: { damping: 11, stiffness: 130 } });

  // 추상 도형 위치·회전 (천천히 떠다님)
  const c1Y = Math.sin(frame / 30) * 30;
  const c2X = Math.cos(frame / 25) * 20;
  const sqRot = frame * 0.5;

  return (
    <AbsoluteFill style={{ background: '#FAFAFA', fontFamily: FONT_FAMILY, color: '#0B1B3D', overflow: 'hidden' }}>
      {/* 떠다니는 추상 도형 */}
      <div style={{ position: 'absolute', top: 200, left: -100, width: 320, height: 320, borderRadius: '50%', background: 'rgba(27,100,218,0.08)', transform: `translateY(${c1Y}px)` }} />
      <div style={{ position: 'absolute', top: 800, right: -80, width: 240, height: 240, borderRadius: 30, background: 'rgba(0,200,150,0.1)', transform: `rotate(${sqRot}deg)` }} />
      <div style={{ position: 'absolute', bottom: 300, left: 100, width: 180, height: 180, borderRadius: '50%', border: '8px solid rgba(255,184,0,0.3)', transform: `translateX(${c2X}px)` }} />

      <AbsoluteFill style={{ padding: '120px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 56, height: 6, background: '#1B64DA', transformOrigin: 'left', transform: `scaleX(${lineGrow})` }} />
          <div style={{ fontWeight: 700, fontSize: 26, color: '#6B7280', letterSpacing: 6 }}>STYLE A · TOSS</div>
        </div>

        <div>
          <div style={{ fontWeight: 500, fontSize: 30, color: '#6B7280', letterSpacing: 6 }}>{DEMO.label}</div>
          <div style={{ fontWeight: 900, fontSize: 130, lineHeight: 1, letterSpacing: -5, marginTop: 14, color: '#0B1B3D' }}>
            <StaggerText text={DEMO.bank} startFrame={0} staggerFrames={2} />
          </div>
          <div style={{ fontWeight: 500, fontSize: 50, color: '#6B7280', marginTop: 8, letterSpacing: -1 }}>
            {DEMO.product}
          </div>
          <div style={{ fontWeight: 900, fontSize: 280, color: '#00C896', letterSpacing: -14, lineHeight: 1, marginTop: 30, transform: `scale(${cardBounce})`, textShadow: '0 0 40px rgba(0,200,150,0.2)' }}>
            연 {DEMO.rate}<span style={{ fontSize: 160 }}>%</span>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 32, color: '#6B7280', letterSpacing: -1 }}>
          ━━ 라이트 에디토리얼 + 떠다니는 도형
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════
// Style B — Visa AI 스타일 (그라디언트 + 도형 모핑)
// ═════════════════════════════════════════════════════════════════
export const DemoStyleB: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 그라디언트 회전
  const gradAngle = 135 + frame * 0.5;

  // 큰 원 morphing → 사각 → 막대
  const morphT = interpolate(frame, [40, 80, 120], [0, 1, 0.5], { extrapolateRight: 'clamp' });
  const radius = interpolate(morphT, [0, 0.5, 1], [50, 8, 25]);
  const morphScale = spring({ frame: frame - 10, fps, config: { damping: 14 } });

  // 작은 입자들
  const particleCount = 12;
  const particles = Array.from({ length: particleCount }, (_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    const x = (seed / 233280) * 100;
    const y = ((seed * 7) % 233280) / 233280 * 100;
    const phase = (i * 13) % 100;
    const op = (Math.sin(((frame + phase) / 14) * Math.PI) + 1) / 2;
    return { x, y, op, size: 8 + (seed % 12) };
  });

  const titleOp = interpolate(frame, [50, 80], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [50, 80], [40, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${gradAngle}deg, #4338CA 0%, #7C3AED 35%, #DB2777 70%, #F59E0B 100%)`,
        fontFamily: FONT_FAMILY,
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* 입자 */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: '#fff',
            opacity: p.op * 0.7,
            boxShadow: `0 0 ${p.size * 3}px #fff`,
          }}
        />
      ))}

      <AbsoluteFill style={{ padding: '120px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 26, color: 'rgba(255,255,255,0.7)', letterSpacing: 8 }}>
          STYLE B · VISA AI
        </div>

        {/* 가운데 morphing shape + 큰 숫자 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
          <div
            style={{
              width: 320,
              height: 320,
              background: 'rgba(255,255,255,0.95)',
              borderRadius: `${radius}%`,
              transform: `scale(${morphScale})`,
              boxShadow: '0 30px 80px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 130,
              fontWeight: 900,
              color: '#7C3AED',
              letterSpacing: -4,
            }}
          >
            {DEMO.rate}%
          </div>

          <div style={{ textAlign: 'center', opacity: titleOp, transform: `translateY(${titleY}px)` }}>
            <div style={{ fontWeight: 900, fontSize: 100, letterSpacing: -4, lineHeight: 1 }}>
              {DEMO.bank}
            </div>
            <div style={{ fontWeight: 500, fontSize: 42, color: 'rgba(255,255,255,0.85)', marginTop: 8, letterSpacing: -1 }}>
              {DEMO.product}
            </div>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 30, color: 'rgba(255,255,255,0.85)', letterSpacing: -1, textAlign: 'center' }}>
          ━━ 그라디언트 + 도형 모핑 + 입자
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════
// Style C — Lottie급 풍부 모션 시뮬레이션 (3D 회전 + 파동 + 다중 레이어)
// ═════════════════════════════════════════════════════════════════
export const DemoStyleC: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 3D 회전 카드
  const cardRot = interpolate(frame, [0, 60], [-180, 0], { extrapolateRight: 'clamp' });
  const cardScale = spring({ frame, fps, config: { damping: 13 } });

  // 동심원 파동 (Lottie pulse 느낌)
  const wave1 = ((frame % 60) / 60);
  const wave2 = (((frame + 20) % 60) / 60);
  const wave3 = (((frame + 40) % 60) / 60);

  // 회전하는 외곽 링
  const ringRot = frame * 1.2;

  // 큰 숫자 카운트업 시뮬레이션
  const rateScale = spring({ frame: frame - 50, fps, config: { damping: 11 } });
  const titleStagger = interpolate(frame, [60, 100], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#0B1B3D', fontFamily: FONT_FAMILY, color: '#fff', overflow: 'hidden' }}>
      {/* 배경 그라디언트 글로우 */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(27,100,218,0.5) 0%, transparent 70%)', transform: 'translate(-50%, -50%)' }} />

      {/* 동심원 파동 */}
      {[wave1, wave2, wave3].map((w, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 300 + w * 600,
            height: 300 + w * 600,
            borderRadius: '50%',
            border: `3px solid rgba(0,200,150,${1 - w})`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}

      {/* 회전하는 외곽 링 */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 700,
          height: 700,
          borderRadius: '50%',
          border: '8px dashed rgba(255,184,0,0.4)',
          transform: `translate(-50%, -50%) rotate(${ringRot}deg)`,
        }}
      />

      <AbsoluteFill style={{ padding: '120px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 26, color: 'rgba(255,255,255,0.7)', letterSpacing: 8 }}>
          STYLE C · MOTION RICH
        </div>

        {/* 가운데 3D 카드 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, perspective: 1500 }}>
          <div
            style={{
              width: 480,
              height: 480,
              background: 'linear-gradient(135deg, #FFB800, #F59E0B)',
              borderRadius: 30,
              transform: `rotateY(${cardRot}deg) scale(${cardScale})`,
              boxShadow: '0 30px 80px rgba(255,184,0,0.4), 0 0 100px rgba(255,184,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transformStyle: 'preserve-3d',
              fontSize: 140,
              color: '#0B1B3D',
              fontWeight: 900,
              letterSpacing: -5,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 36, opacity: 0.7 }}>5월 1위</div>
            <div style={{ transform: `scale(${rateScale})` }}>{DEMO.rate}%</div>
          </div>

          <div style={{ textAlign: 'center', opacity: titleStagger }}>
            <div style={{ fontWeight: 900, fontSize: 90, letterSpacing: -3 }}>{DEMO.bank}</div>
            <div style={{ fontWeight: 500, fontSize: 38, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>{DEMO.product}</div>
          </div>
        </div>

        <div style={{ fontWeight: 700, fontSize: 30, color: 'rgba(255,255,255,0.85)', letterSpacing: -1, textAlign: 'center' }}>
          ━━ 3D 회전 + 동심원 파동 + 다중 레이어
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════
// AE-style Bouncy Damped — After Effects damped oscillation 재현
// ═════════════════════════════════════════════════════════════════
export const DemoBouncy: React.FC = () => {
  const frame = useCurrentFrame();
  const sub = interpolate(frame, [120, 150], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: '#FAFAFA', fontFamily: FONT_FAMILY, color: '#0B1B3D' }}>
      <AbsoluteFill style={{ padding: '120px 90px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 26, color: '#6B7280', letterSpacing: 6 }}>
          BOUNCY · AE EXPRESSION
        </div>

        <div>
          {/* 작은 라벨 — 정적 */}
          <div style={{ fontWeight: 500, fontSize: 30, color: '#6B7280', letterSpacing: 6, marginBottom: 14 }}>
            5월 적금 1위
          </div>
          {/* Bouncy: 회전 + 스케일 + 위치 진동 */}
          <div style={{ fontWeight: 900, fontSize: 180, lineHeight: 1, letterSpacing: -8 }}>
            <BouncyDampedText
              text="토스뱅크"
              startFrame={0}
              staggerDelay={0.04}
              amplitudePos={60}
              amplitudeRot={45}
              amplitudeScale={1}
              freq={3}
              decay={8}
            />
          </div>
          <div style={{ fontWeight: 900, fontSize: 320, lineHeight: 1, letterSpacing: -14, color: '#00C896', marginTop: 30 }}>
            <BouncyDampedText
              text="5.50%"
              startFrame={30}
              staggerDelay={0.05}
              amplitudePos={80}
              amplitudeRot={60}
              amplitudeScale={1}
              freq={3}
              decay={8}
            />
          </div>
        </div>

        <div style={{ opacity: sub, fontWeight: 700, fontSize: 30, color: '#6B7280', letterSpacing: -1, textAlign: 'center' }}>
          ━━ damped osc · freq 3 · decay 8 · stagger 0.04s
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═════════════════════════════════════════════════════════════════
// Style D — Wealthsimple 매거진 (베이지 + 클래식 레드 + 라인)
// ═════════════════════════════════════════════════════════════════
export const DemoStyleD: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lineGrow = spring({ frame: frame - 5, fps, config: { damping: 22, stiffness: 180 } });
  const titleStagger = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const numScale = spring({ frame: frame - 25, fps, config: { damping: 13 } });
  const dividerGrow = spring({ frame: frame - 60, fps, config: { damping: 22, stiffness: 180 } });

  return (
    <AbsoluteFill style={{ background: '#FAF6EE', fontFamily: FONT_FAMILY, color: '#1A1A1A' }}>
      {/* 매거진 가로 라인 */}
      <div style={{ position: 'absolute', top: 90, left: 70, right: 70, height: 3, background: '#1A1A1A', transformOrigin: 'left', transform: `scaleX(${lineGrow})` }} />
      <div style={{ position: 'absolute', bottom: 90, left: 70, right: 70, height: 3, background: '#1A1A1A', transformOrigin: 'right', transform: `scaleX(${lineGrow})` }} />

      <AbsoluteFill style={{ padding: '130px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Top: index */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Pretendard, serif', fontWeight: 900, fontSize: 200, letterSpacing: -10, lineHeight: 0.9, color: '#1A1A1A' }}>
            01
          </div>
          <div style={{ fontWeight: 500, fontSize: 28, color: '#6B6557', letterSpacing: 6, fontStyle: 'italic' }}>
            MAY · 2026
          </div>
        </div>

        {/* Center: editorial title + rate */}
        <div>
          <div style={{ fontWeight: 500, fontSize: 36, color: '#C8503E', letterSpacing: 8, fontStyle: 'italic', marginBottom: 14 }}>
            EDITOR'S PICK
          </div>
          <div style={{ fontFamily: 'Pretendard, serif', fontWeight: 900, fontSize: 110, letterSpacing: -3, lineHeight: 1.05, color: '#1A1A1A', opacity: titleStagger }}>
            <StaggerText text={DEMO.bank} startFrame={0} staggerFrames={3} damping={20} stiffness={150} />
          </div>
          <div style={{ fontWeight: 500, fontSize: 50, color: '#6B6557', marginTop: 14, letterSpacing: -1, fontStyle: 'italic' }}>
            {DEMO.product}
          </div>

          <div style={{ width: 240, height: 2, background: '#1A1A1A', margin: '60px 0 40px', transformOrigin: 'left', transform: `scaleX(${dividerGrow})` }} />

          <div
            style={{
              fontFamily: 'Pretendard, serif',
              fontWeight: 900,
              fontSize: 280,
              color: '#C8503E',
              letterSpacing: -16,
              lineHeight: 1,
              transform: `scale(${numScale})`,
            }}
          >
            {DEMO.rate}<span style={{ fontSize: 150 }}>%</span>
          </div>
          <div style={{ fontWeight: 500, fontSize: 32, color: '#6B6557', marginTop: 8, letterSpacing: -1, fontStyle: 'italic' }}>
            연 최고 우대금리 · 5월 기준
          </div>
        </div>

        {/* Bottom: editorial signature */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontStyle: 'italic' }}>
          <div style={{ fontWeight: 700, fontSize: 26, color: '#6B6557', letterSpacing: 4 }}>
            STYLE D · WEALTHSIMPLE EDITORIAL
          </div>
          <div style={{ fontWeight: 700, fontSize: 26, color: '#1A1A1A' }}>
            — 박재은
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
