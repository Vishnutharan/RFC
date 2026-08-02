import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-800.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/global.css';
import './styles/animations.css';
import './styles/main.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary title="RFC Watford failed">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
