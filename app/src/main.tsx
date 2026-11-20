import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker } from './ui/registerServiceWorker';
import { migrateStorage } from './ui/state/migrate';
import './ui/styles.css';

migrateStorage();
if (import.meta.env.PROD) registerServiceWorker(import.meta.env.BASE_URL);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
