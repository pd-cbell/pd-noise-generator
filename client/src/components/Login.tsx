import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const { loginWithGoogle, loginAsDev } = useAuth();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">PD Noise Simulator</h1>
        <p className="text-gray-500 mb-8">Sign in to manage simulations and profiles.</p>
        
        <div className="flex justify-center flex-col gap-4 items-center">
            <GoogleLogin
              onSuccess={credentialResponse => {
                if (credentialResponse.credential) {
                    loginWithGoogle(credentialResponse.credential);
                }
              }}
              onError={() => {
                console.log('Login Failed');
              }}
            />
            
            {import.meta.env.DEV && (
                <button 
                    onClick={() => loginAsDev()}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                    Dev Login (Bypass)
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
