import { motion, useReducedMotion } from 'motion/react';
import { VoiceOrb } from '@/components/agents-ui/voice-orb';

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
  agentName?: string;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  agentName = 'Sahaya',
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const reducedMotion = useReducedMotion();

  return (
    <div ref={ref}>
      <section className="bg-background flex min-h-svh flex-col items-center justify-center px-6 pt-8 pb-10 text-center">
        <div className="w-full max-w-3xl">
          <div className="mb-4 text-center">
            <p className="text-[0.64rem] font-semibold tracking-[0.34em] text-cyan-300/90 uppercase">
              disaster response voice assistant
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-white md:text-5xl">
              {agentName}
            </h1>
          </div>

          <p className="mx-auto max-w-xl text-sm leading-7 text-slate-300 md:text-base">
            Your voice assistant for disaster response, safety guidance, and emergency information.
          </p>

          <div className="relative mx-auto mt-8 flex w-full max-w-xl justify-center md:mt-12">
            <VoiceOrb className="scale-[0.82] md:scale-100" showLabel={false} />

            <motion.button
              type="button"
              onClick={onStartCall}
              aria-label={startButtonText}
              className="absolute bottom-[-0.55rem] left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border border-cyan-200/35 bg-slate-900/75 px-5 py-2.5 text-sm font-medium text-slate-100 shadow-[0_0_28px_rgba(34,211,238,0.28)] backdrop-blur-sm transition hover:border-cyan-300/50 hover:text-white md:px-6 md:py-3 md:text-base"
              animate={
                reducedMotion
                  ? { y: 0 }
                  : {
                      y: [0, -6, 0],
                      boxShadow: [
                        '0 0 18px rgba(34,211,238,0.24)',
                        '0 0 26px rgba(34,211,238,0.34)',
                        '0 0 18px rgba(34,211,238,0.24)',
                      ],
                    }
              }
              transition={{
                duration: reducedMotion ? 0 : 2.4,
                ease: 'easeInOut',
                repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY,
              }}
            >
              <span>Tap to speak</span>
            </motion.button>
          </div>
        </div>
      </section>
    </div>
  );
};
