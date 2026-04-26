import { Composition } from 'remotion';
import { LongForm } from './LongForm';
import { ShortForm } from './ShortForm';
import { LongFormVS } from './LongFormVS';
import { ShortFormVS } from './ShortFormVS';
import { ShortFormGuide, SHORT_GUIDE_TOTAL_FRAMES } from './ShortFormGuide';
import { DemoStyleA, DemoStyleB, DemoStyleC, DemoStyleD, DemoBouncy } from './DemoStyles';
import { ShortFormStyleA } from './ShortFormStyleA';
import { ShortFormStyleD } from './ShortFormStyleD';
import { FontLoader } from './FontLoader';

const DemoWrapper = (Comp: React.FC) => {
  const Wrapped: React.FC = () => (
    <>
      <FontLoader />
      <Comp />
    </>
  );
  return Wrapped;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Day 1 — Ranking */}
      <Composition id="LongForm"  component={LongForm}  durationInFrames={1800} fps={30} width={1920} height={1080} />
      <Composition id="ShortForm" component={ShortForm} durationInFrames={900}  fps={30} width={1080} height={1920} />

      {/* Day 2 — VS */}
      <Composition id="LongFormVS"  component={LongFormVS}  durationInFrames={1800} fps={30} width={1920} height={1080} />
      <Composition id="ShortFormVS" component={ShortFormVS} durationInFrames={900}  fps={30} width={1080} height={1920} />

      {/* Day 3 — Guide (per-scene sync) */}
      <Composition
        id="ShortFormGuide"
        component={ShortFormGuide}
        durationInFrames={SHORT_GUIDE_TOTAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />

      {/* 4-Style Demos (8s each) */}
      <Composition id="DemoStyleA" component={DemoWrapper(DemoStyleA)} durationInFrames={240} fps={30} width={1080} height={1920} />
      <Composition id="DemoStyleB" component={DemoWrapper(DemoStyleB)} durationInFrames={240} fps={30} width={1080} height={1920} />
      <Composition id="DemoStyleC" component={DemoWrapper(DemoStyleC)} durationInFrames={240} fps={30} width={1080} height={1920} />
      <Composition id="DemoStyleD" component={DemoWrapper(DemoStyleD)} durationInFrames={240} fps={30} width={1080} height={1920} />
      <Composition id="DemoBouncy" component={DemoWrapper(DemoBouncy)} durationInFrames={180} fps={30} width={1080} height={1920} />

      {/* Style A·D Full 30s (Day 1 데이터·음성 사용) */}
      <Composition id="ShortFormStyleA" component={ShortFormStyleA} durationInFrames={900} fps={30} width={1080} height={1920} />
      <Composition id="ShortFormStyleD" component={ShortFormStyleD} durationInFrames={900} fps={30} width={1080} height={1920} />
    </>
  );
};
