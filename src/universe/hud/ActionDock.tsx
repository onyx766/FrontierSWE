'use client';

import { hudCopy } from '@/data/universe';
import { useUniverse } from '../state/store';
import { SpeakerIcon } from './icons';
import { useVoiceAvailable } from './useVoice';

/** Overview, the guided tour and the voice: the three things that are not walking. */
export function ActionDock() {
  const touring = useUniverse((state) => state.touring);
  const voice = useUniverse((state) => state.voice);
  const voiceAvailable = useVoiceAvailable();

  const toggleTour = () => {
    const { startTour, stopTour } = useUniverse.getState();
    if (touring) stopTour();
    else startTour();
  };

  return (
    <div className="uh-dock">
      <button
        type="button"
        className="uh-pill-button"
        onClick={() => useUniverse.getState().overview()}
      >
        {hudCopy.actions.overview}
      </button>
      <button
        type="button"
        className="uh-pill-button"
        aria-pressed={touring}
        onClick={toggleTour}
      >
        {touring ? hudCopy.actions.stopTour : hudCopy.actions.tour}
      </button>
      {voiceAvailable ? (
        <button
          type="button"
          className="uh-pill-button uh-pill-button-icon"
          aria-pressed={voice}
          aria-label={voice ? hudCopy.actions.voiceOn : hudCopy.actions.voiceOff}
          title={hudCopy.actions.voice}
          onClick={() => useUniverse.getState().toggleVoice()}
        >
          <SpeakerIcon muted={!voice} className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
