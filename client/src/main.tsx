import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { SimulationProvider } from './contexts/SimulationContext';
import './index.css';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <AuthProvider>
        <SimulationProvider>
          <App />
        </SimulationProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);