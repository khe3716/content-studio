import { Composition } from 'remotion';
import { LongForm } from './LongForm';
import { ShortForm } from './ShortForm';
import { LongFormVS } from './LongFormVS';
import { ShortFormVS } from './ShortFormVS';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Day 1 — Ranking pattern */}
      <Composition id="LongForm" component={LongForm} durationInFrames={1800} fps={30} width={1920} height={1080} />
      <Composition id="ShortForm" component={ShortForm} durationInFrames={900} fps={30} width={1080} height={1920} />

      {/* Day 2 — VS pattern */}
      <Composition id="LongFormVS" component={LongFormVS} durationInFrames={1800} fps={30} width={1920} height={1080} />
      <Composition id="ShortFormVS" component={ShortFormVS} durationInFrames={900} fps={30} width={1080} height={1920} />
    </>
  );
};
