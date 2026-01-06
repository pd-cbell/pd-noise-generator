import React, { createContext, useContext, useState, useEffect } from 'react';

export enum UserRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: UserRole;
  agentEnabled?: boolean;
}

interface Credentials {
  apiToken: string | null;
  globalRoutingKey: string | null;
  fromEmail: string | null;
}

interface AuthContextType {
  user: User | null;
  credentials: Credentials | null;
  isLoading: boolean;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginAsDev: () => Promise<void>;
  logout: () => Promise<void>;
  updateCredentials: (creds: Partial<Credentials>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const fetchSession = async (baseUrl: string, setter: {
  setUser: (u: User | null) => void;
  setCredentials: (c: Credentials | null) => void;
}) => {
  try {
    const res = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      setter.setUser(data.user);
      setter.setCredentials(data.credentials);
      return true;
    }
  } catch (_e) {
    // ignore and fall through
  }
  setter.setUser(null);
  setter.setCredentials(null);
  return false;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      setIsLoading(true);
      await fetchSession(API_BASE, { setUser, setCredentials });
      setIsLoading(false);
    };
    checkSession();
  }, []);

  const loginWithGoogle = async (idToken: string) => {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      credentials: 'include'
    });
    
    if (!res.ok) throw new Error('Login failed');
    
    const data = await res.json();
    setUser(data.user);
    await fetchSession(API_BASE, { setUser, setCredentials });
  };

  const loginAsDev = async () => {
    const res = await fetch(`${API_BASE}/auth/dev-login`, {
        method: 'POST',
        credentials: 'include'
    });
    if (!res.ok) throw new Error('Dev Login failed');
    const data = await res.json();
    setUser(data.user);
    await fetchSession(API_BASE, { setUser, setCredentials });
  };

  const logout = async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
    setCredentials(null);
  };

  const updateCredentials = async (creds: Partial<Credentials>) => {
      const res = await fetch(`${API_BASE}/auth/credentials`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(creds),
          credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to update credentials');
      
      setCredentials(prev => ({ ...prev, ...creds } as Credentials));
  };

  return (
    <AuthContext.Provider value={{ user, credentials, isLoading, loginWithGoogle, loginAsDev, logout, updateCredentials }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
