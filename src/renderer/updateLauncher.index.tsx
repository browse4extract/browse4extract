import React from 'react';
import { createRoot } from 'react-dom/client';
import UpdateLauncher from './UpdateLauncher';
import './tailwind.css';

const container = document.getElementById('update-launcher-root');
if (!container) {
  throw new Error('Update launcher root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <UpdateLauncher />
  </React.StrictMode>
);
