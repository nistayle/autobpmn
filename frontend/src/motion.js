let gsapLoadPromise;

function loadGsapAfterPaint() {
  if (window.gsap) return Promise.resolve(window.gsap);
  if (gsapLoadPromise) return gsapLoadPromise;

  gsapLoadPromise = new Promise((resolve) => {
    const loadScript = () => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js';
      script.async = true;
      script.onload = () => resolve(window.gsap || null);
      script.onerror = () => {
        console.warn('GSAP gagal dimuat; transisi CSS tetap digunakan.');
        resolve(null);
      };
      document.head.append(script);
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.setTimeout(loadScript, 0));
    });
  });

  return gsapLoadPromise;
}

export function animateWorkspaceEntrance() {
  let cancelled = false;
  let mediaContext;
  let animatedTargets = [];

  loadGsapAfterPaint().then((gsap) => {
    if (cancelled || !gsap) return;

    mediaContext = gsap.matchMedia();
    mediaContext.add(
      {
        motion: '(prefers-reduced-motion: no-preference)',
        compact: '(max-width: 640px)',
      },
      ({ conditions }) => {
        if (!conditions.motion) return undefined;

        const lowPower = Number(navigator.hardwareConcurrency || 8) <= 4;
        const compact = conditions.compact || lowPower;
        const shell = document.querySelector('.app-shell--entered');
        const topbar = shell?.querySelector('.app-header');
        const panels = [
          shell?.querySelector('#source-panel'),
          shell?.querySelector('#copilot-panel'),
        ].filter(Boolean);
        const stage = shell?.querySelector('.stage-heading');
        const dock = shell?.querySelector('.canvas-toolbar');
        animatedTargets = [topbar, ...panels, stage, dock].filter(Boolean);

        const duration = compact ? 0.24 : 0.4;
        const stagger = compact ? 0.035 : 0.08;
        const timeline = gsap.timeline();
        if (topbar) {
          timeline.from(topbar, {
            opacity: 0,
            y: 8,
            duration,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          });
        }
        if (panels.length) {
          timeline.from(panels, {
            opacity: 0,
            y: 8,
            duration,
            stagger,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          }, '-=0.28');
        }
        if (stage) {
          timeline.from(stage, {
            opacity: 0,
            y: 8,
            duration,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          }, '-=0.24');
        }
        if (dock) {
          timeline.from(dock, {
            opacity: 0,
            y: 12,
            duration: compact ? 0.2 : 0.32,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          }, '-=0.16');
        }

        return () => {
          gsap.killTweensOf(animatedTargets);
          timeline.kill();
        };
      }
    );
  });

  return () => {
    cancelled = true;
    mediaContext?.revert();
  };
}
