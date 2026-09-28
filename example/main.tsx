import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './example.css';
import { App } from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
