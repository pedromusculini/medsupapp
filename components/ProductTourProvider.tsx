'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useCustomSession } from '@/lib/useSession';
import { useClinicaTitular } from '@/lib/useClinicaTitular';
import {
  completeProductTour,
  dismissProductTour,
  getFilteredSteps,
  getStepRoute,
  getTourState,
  routeMatches,
  setTourState,
  shouldAutoStartTour,
  startProductTour,
  TOUR_VERSION,
  type TourStep,
} from '@/lib/productTour';

function waitForElement(selector: string, timeoutMs = 4000): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeoutMs);
  });
}

export function useProductTourActions() {
  return {
    startTour: () => startProductTour(0),
    dismissTour: dismissProductTour,
  };
}

export default function ProductTourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useCustomSession();
  const clinicaTitular = useClinicaTitular();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const runningRef = useRef(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [tourTick, setTourTick] = useState(0);

  const steps = getFilteredSteps(clinicaTitular);

  const bump = useCallback(() => setTourTick((n) => n + 1), []);

  useEffect(() => {
    const onStart = () => bump();
    window.addEventListener('medsup-tour-start', onStart);
    return () => window.removeEventListener('medsup-tour-start', onStart);
  }, [bump]);

  useEffect(() => {
    if (status !== 'authenticated') {
      setEmailVerified(false);
      return;
    }
    fetch('/api/auth/google-access/status')
      .then((r) => r.json())
      .then((d) => setEmailVerified(d.accessVerified === true))
      .catch(() => setEmailVerified(false));
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated' || !emailVerified) return;
    if (pathname.startsWith('/onboarding') || pathname.startsWith('/auth/')) return;

    const state = getTourState();
    if (!state && shouldAutoStartTour()) {
      startProductTour(0);
      bump();
      return;
    }
    if (state?.status === 'active' && state.version !== TOUR_VERSION) {
      startProductTour(0);
      bump();
    }
  }, [status, emailVerified, pathname, bump]);

  const showStep = useCallback(
    async (stepIndex: number, step: TourStep) => {
      if (runningRef.current) return;
      runningRef.current = true;

      driverRef.current?.destroy();
      driverRef.current = null;

      const isLast = stepIndex >= steps.length - 1;
      const drv = driver({
        showProgress: true,
        progressText: `${stepIndex + 1} de ${steps.length}`,
        nextBtnText: isLast ? 'Concluir' : 'Próximo',
        prevBtnText: 'Anterior',
        doneBtnText: 'Concluir',
        showButtons: ['next', 'previous', 'close'],
        steps: [
          {
            element: step.element ?? undefined,
            popover: {
              title: step.title,
              description: step.description,
              side: step.side ?? 'bottom',
              align: 'center',
            },
          },
        ],
        onCloseClick: () => {
          dismissProductTour();
          driverRef.current?.destroy();
          runningRef.current = false;
          bump();
        },
        onDestroyStarted: () => {
          driverRef.current?.destroy();
        },
        onNextClick: () => {
          driverRef.current?.destroy();
          runningRef.current = false;
          if (isLast) {
            completeProductTour();
            bump();
            return;
          }
          const nextIndex = stepIndex + 1;
          setTourState({
            version: TOUR_VERSION,
            stepIndex: nextIndex,
            status: 'active',
          });
          bump();
        },
        onPrevClick: () => {
          driverRef.current?.destroy();
          runningRef.current = false;
          const prevIndex = Math.max(0, stepIndex - 1);
          setTourState({
            version: TOUR_VERSION,
            stepIndex: prevIndex,
            status: 'active',
          });
          const prevStep = steps[prevIndex];
          const prevRoute = getStepRoute(prevStep);
          if (!routeMatches(prevRoute, pathname, window.location.search)) {
            router.push(prevRoute);
          }
          bump();
        },
      });

      driverRef.current = drv;

      if (step.element) {
        const el = await waitForElement(step.element);
        if (!el) {
          runningRef.current = false;
          const nextIndex = stepIndex + 1;
          if (nextIndex < steps.length) {
            setTourState({ version: TOUR_VERSION, stepIndex: nextIndex, status: 'active' });
            bump();
          }
          return;
        }
      }

      drv.drive();
      runningRef.current = false;
    },
    [steps, pathname, router, bump],
  );

  useEffect(() => {
    const state = getTourState();
    if (!state || state.status !== 'active') return;
    if (status !== 'authenticated' || !emailVerified) return;

    const stepIndex = Math.min(state.stepIndex, steps.length - 1);
    const step = steps[stepIndex];
    if (!step) return;

    const targetRoute = getStepRoute(step);
    const search = typeof window !== 'undefined' ? window.location.search : '';

    if (!routeMatches(targetRoute, pathname, search)) {
      router.push(targetRoute);
      return;
    }

    const timer = setTimeout(() => {
      void showStep(stepIndex, step);
    }, 400);

    return () => clearTimeout(timer);
  }, [pathname, status, emailVerified, steps, showStep, router, tourTick]);

  return <>{children}</>;
}
