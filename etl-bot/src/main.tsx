// src/main.tsx (or your entry point file)

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css'; // Import global styles

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Failed to find the root element");
}

// Ensure the root element itself can take full height
// This might already be handled by index.css setting height: 100% on #root
// but setting it explicitly doesn't hurt.
// rootElement.style.height = '100%'; // Optional: can be done via CSS

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);