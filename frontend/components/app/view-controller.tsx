'use client';

import { useCallback, useState } from 'react';
import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { WelcomeView } from '@/components/app/welcome-view';
import { Button } from '@/components/ui/button';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(AgentSessionView_01);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: { opacity: 1 },
    hidden: { opacity: 0 },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: { duration: 0.45, ease: 'linear' },
};

interface ViewControllerProps {
  appConfig: AppConfig;
}

export function ViewController({ appConfig }: ViewControllerProps) {
  const { isConnected, start, end } = useSessionContext();
  const { resolvedTheme } = useTheme();
  const [showEndedState, setShowEndedState] = useState(false);

  const handleStartCall = useCallback(async () => {
    setShowEndedState(false);
    await start();
  }, [start]);

  const handleEndCall = useCallback(async () => {
    await end();
    setShowEndedState(true);
  }, [end]);

  return (
    <AnimatePresence mode="wait">
      {!isConnected && !showEndedState && (
        <MotionWelcomeView
          key="welcome"
          {...VIEW_MOTION_PROPS}
          agentName={appConfig.companyName}
          startButtonText={appConfig.startButtonText}
          onStartCall={handleStartCall}
        />
      )}

      {showEndedState && !isConnected && (
        <motion.div
          key="call-ended"
          {...VIEW_MOTION_PROPS}
          className="flex min-h-svh items-center justify-center px-6"
        >
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white/80 p-8 text-center shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-rose-100 text-3xl font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
              ✓
            </div>
            <p className="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase dark:text-slate-400">
              Call ended
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
              The conversation is over
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Thanks for speaking with {appConfig.companyName}. You can start again whenever you are
              ready.
            </p>
            <Button
              size="lg"
              onClick={handleStartCall}
              className="mt-8 h-12 w-full rounded-full bg-sky-500 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 hover:bg-sky-400 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300"
            >
              Start again
            </Button>
          </div>
        </motion.div>
      )}

      {isConnected && (
        <MotionSessionView
          key="session-view"
          {...VIEW_MOTION_PROPS}
          supportsChatInput={appConfig.supportsChatInput}
          supportsVideoInput={appConfig.supportsVideoInput}
          supportsScreenShare={appConfig.supportsScreenShare}
          isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
          audioVisualizerType={appConfig.audioVisualizerType}
          audioVisualizerColor={
            resolvedTheme === 'dark'
              ? appConfig.audioVisualizerColorDark
              : appConfig.audioVisualizerColor
          }
          audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
          audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
          audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
          audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
          audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
          audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
          audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
          onDisconnect={handleEndCall}
          className="fixed inset-0"
        />
      )}
    </AnimatePresence>
  );
}
