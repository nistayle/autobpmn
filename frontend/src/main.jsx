import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import LoadingState from './components/LoadingState';
import './startup.css';

const App = lazy(() => import('./App'));

function StartupTransition() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [isWelcomeLeaving, setIsWelcomeLeaving] = useState(false);
  const welcomeTimerRef = useRef(null);

  const handleAppReady = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsWelcomeLeaving(true);
      setShowWelcome(false);
      return;
    }

    setIsWelcomeLeaving(true);
    welcomeTimerRef.current = window.setTimeout(() => {
      setShowWelcome(false);
    }, 280);
  }, []);

  useEffect(() => () => {
    if (welcomeTimerRef.current) {
      window.clearTimeout(welcomeTimerRef.current);
    }
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <App onReady={handleAppReady} />
      </Suspense>
      {showWelcome && (
        <div className={`startup-transition${isWelcomeLeaving ? ' startup-transition--leaving' : ''}`}>
          <LoadingState
            variant="startup"
            label="Menyiapkan AutoBPMN..."
            description="Memuat workspace dan komponen yang diperlukan."
          />
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StartupTransition />
  </React.StrictMode>
);
