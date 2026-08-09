'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { type AgentState, useTrackVolume, useVoiceAssistant } from '@livekit/components-react';
import { cn } from '@/lib/shadcn/utils';

export type OrbVariant = 'idle' | 'connecting' | 'listening' | 'speaking';

export function getVoiceOrbStatus(agentState?: AgentState) {
  switch (agentState) {
    case 'connecting':
    case 'pre-connect-buffering':
    case 'initializing':
      return { label: 'Connecting to Sahaya…', variant: 'connecting' as const };
    case 'listening':
      return { label: 'Sahaya is listening', variant: 'listening' as const };
    case 'speaking':
      return { label: 'Sahaya is speaking', variant: 'speaking' as const };
    default:
      return { label: 'Sahaya is ready', variant: 'idle' as const };
  }
}

interface VoiceOrbProps {
  className?: string;
  stateOverride?: AgentState | OrbVariant;
  showLabel?: boolean;
  labelClassName?: string;
}

type Particle = {
  theta: number;
  phi: number;
  radius: number;
  speed: number;
  seed: number;
  size: number;
  alpha: number;
  hue: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function VoiceOrb({
  className,
  stateOverride,
  showLabel = true,
  labelClassName,
}: VoiceOrbProps) {
  const { state, audioTrack } = useVoiceAssistant();
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);

  const resolvedState = (stateOverride ?? state ?? 'idle') as AgentState | OrbVariant;
  const { label, variant } = getVoiceOrbStatus(resolvedState);
  const volume = useTrackVolume(audioTrack as never, {
    fftSize: 512,
    smoothingTimeConstant: 0.5,
  });

  const isSpeaking = variant === 'speaking';
  const isListening = variant === 'listening';
  const isConnecting = variant === 'connecting';
  const audioLevel = clamp(Number(volume) || 0, 0, 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const buildParticles = () => {
      const count = 220;
      const nextParticles: Particle[] = [];

      for (let index = 0; index < count; index += 1) {
        const theta = Math.acos(2 * Math.random() - 1);
        const phi = Math.random() * Math.PI * 2;
        const edgeBias = 0.9 + Math.random() * 0.15;
        const radius = 0.94 + edgeBias * 0.08;

        nextParticles.push({
          theta,
          phi,
          radius,
          speed: 0.55 + Math.random() * 1.2,
          seed: Math.random() * Math.PI * 2,
          size: 0.22 + Math.random() * 0.4,
          alpha: 0.48 + Math.random() * 0.38,
          hue: Math.random() > 0.8 ? 1 : 0,
        });
      }

      particlesRef.current = nextParticles;
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(220, rect.width * dpr);
      canvas.height = Math.max(220, rect.height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    buildParticles();
    resizeCanvas();

    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(canvas);

    let frameId = 0;

    const render = (time: number) => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.43;
      const baseBoost = isSpeaking ? 1.05 : isListening ? 1.08 : isConnecting ? 0.9 : 0.75;
      const voiceBoost = reducedMotion ? 0.35 : 0.34 + audioLevel * 0.22;
      const motionScale = reducedMotion ? 0.4 : 1;
      const breath =
        1 + Math.sin(time * 0.0012) * 0.04 * (isSpeaking ? 1.1 : isListening ? 1.15 : 0.7);

      context.clearRect(0, 0, width, height);

      const bloom = context.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius * 1.8);
      bloom.addColorStop(0, `rgba(186, 230, 253, ${0.16 + voiceBoost * 0.18})`);
      bloom.addColorStop(0.32, `rgba(34, 211, 238, ${0.2 + voiceBoost * 0.14})`);
      bloom.addColorStop(0.7, `rgba(59, 130, 246, ${0.1 + voiceBoost * 0.08})`);
      bloom.addColorStop(1, 'rgba(2, 6, 23, 0)');
      context.fillStyle = bloom;
      context.fillRect(0, 0, width, height);

      context.beginPath();
      context.fillStyle = 'rgba(2, 8, 18, 0.78)';
      context.arc(cx, cy, radius * 0.16, 0, Math.PI * 2);
      context.fill();

      for (let ring = 0; ring < 3; ring += 1) {
        const ringRadius = radius * (0.72 + ring * 0.18 + (voiceBoost - 0.5) * 0.12);
        context.beginPath();
        context.strokeStyle = `rgba(103, 232, 249, ${0.4 + ring * 0.12})`;
        context.lineWidth = 1 + ring * 0.3;
        context.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        context.stroke();
      }

      for (let index = 0; index < particlesRef.current.length; index += 1) {
        const particle = particlesRef.current[index];
        const drift = time * 0.00032 * particle.speed * motionScale;
        const wave =
          Math.sin(time * 0.001 + particle.seed + particle.theta * 7) +
          Math.cos(time * 0.0012 + particle.phi * 4 + particle.seed * 1.8);
        const theta = particle.theta + drift + wave * 0.012;
        const phi = particle.phi + drift * 1.1 + particle.seed * 0.6;
        const radialNoise =
          particle.radius *
          (1 + Math.sin(time * 0.0012 + particle.seed) * 0.04 + (voiceBoost - 0.4) * 0.12);

        const x = Math.sin(theta) * Math.cos(phi) * radius * radialNoise * breath;
        const y =
          Math.cos(theta) *
          radius *
          radialNoise *
          (1 + Math.cos(time * 0.001 + particle.seed) * 0.03);
        const z = Math.sin(theta) * Math.sin(phi) * radius * radialNoise * (1 + wave * 0.03);

        const perspective = 1.4 / (1.82 - z / (radius * 1.3));
        const px = cx + x * perspective;
        const py = cy + y * perspective;
        const depth = clamp((z + radius) / (radius * 2), 0, 1);
        const alpha = clamp(
          (particle.alpha + depth * 0.22 + (voiceBoost + baseBoost) * 0.12) * (0.82 + depth * 0.28),
          0.2,
          1
        );
        const particleSize = particle.size * (0.72 + depth * 0.42 + (voiceBoost - 0.4) * 0.5);

        const r = particle.hue > 0.5 ? 110 : 105;
        const g = particle.hue > 0.5 ? 220 : 220;
        const b = particle.hue > 0.5 ? 255 : 255;

        context.beginPath();
        context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        context.shadowBlur = 8 + voiceBoost * 10;
        context.shadowColor = 'rgba(34, 211, 238, 0.9)';
        context.arc(px, py, particleSize, 0, Math.PI * 2);
        context.fill();
      }

      context.shadowBlur = 0;
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [audioLevel, isConnecting, isListening, isSpeaking, reducedMotion]);

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <motion.div
        aria-label="Sahaya orb"
        className="relative flex items-center justify-center"
        animate={
          reducedMotion
            ? { scale: 1 }
            : {
                scale: isSpeaking
                  ? [1, 1.06, 1]
                  : isListening
                    ? [1, 1.04, 1]
                    : isConnecting
                      ? [1, 1.02, 1]
                      : [1, 1.015, 1],
              }
        }
        transition={{
          duration: reducedMotion ? 0 : isSpeaking ? 1.2 : isListening ? 2.4 : 3.2,
          ease: 'easeInOut',
          repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY,
        }}
      >
        <div
          className="pointer-events-none absolute inset-[-16%] rounded-full bg-cyan-400/18 blur-3xl"
          style={{
            opacity: isSpeaking ? 1 : isListening ? 0.8 : isConnecting ? 0.55 : 0.6,
            transform: `scale(${isSpeaking ? 1.3 : isListening ? 1.18 : 1.12})`,
            boxShadow: '0 0 50px rgba(34, 211, 238, 0.35)',
          }}
        />

        <canvas
          ref={canvasRef}
          aria-label="Sahaya orb visualization"
          className="block h-[min(23vw,12rem)] w-[min(23vw,12rem)] rounded-full bg-transparent md:h-[min(26vw,14rem)] md:w-[min(26vw,14rem)]"
        />
      </motion.div>

      {showLabel && (
        <motion.p
          className={cn(
            'mt-6 text-base font-medium tracking-[0.08em] text-slate-100/85 uppercase md:text-lg',
            labelClassName
          )}
          animate={
            reducedMotion
              ? { opacity: 1 }
              : {
                  opacity:
                    isSpeaking || isListening || isConnecting ? [0.7, 1, 0.8] : [0.8, 1, 0.9],
                }
          }
          transition={{
            duration: reducedMotion ? 0 : 2,
            ease: 'easeInOut',
            repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY,
          }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );
}
