// Must stay first: it reads the URL before the Supabase client can change it.
import './utils/initialUrlError';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthProvider';
import './styles/tokens.css';
import './styles/base.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root was not found in index.html.');

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
