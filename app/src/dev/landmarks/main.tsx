import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LandmarkPicker } from './LandmarkPicker';
import '../../ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LandmarkPicker />
  </StrictMode>,
);
