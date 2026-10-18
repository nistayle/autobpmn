import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import LoadingState from './components/LoadingState';
import './startup.css';

const App = lazy(() => import('./App'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense
      fallback={
        <LoadingState
          variant="startup"
          label="Menyiapkan AutoBPMN..."
          description="Memuat workspace dan komponen yang diperlukan."
        />
      }
    >
      <App />
    </Suspense>
  </React.StrictMode>
);
