import { createContext, useContext, useMemo, useState } from "react";
import { auth, googleProvider, signInWithPopup, sendPasswordResetEmail } from "../services/firebase";

const AUTH_TOKEN_KEY = "token";
const AUTH_NAME_KEY = "user_name";
const AUTH_EMAIL_KEY = "user_email";
const AUTH_PROVIDER_KEY = "auth_provider";

class AuthConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

const AuthContext = createContext(null);

function readStoredSession() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || window.sessionStorage.getItem(AUTH_TOKEN_KEY);
}

function readStoredName() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_NAME_KEY) || window.sessionStorage.getItem(AUTH_NAME_KEY) || "";
}

function readStoredEmail() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_EMAIL_KEY) || window.sessionStorage.getItem(AUTH_EMAIL_KEY) || "";
}

function readStoredProvider() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_PROVIDER_KEY) || window.sessionStorage.getItem(AUTH_PROVIDER_KEY) || "";
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredSession());
  const [userName, setUserName] = useState(() => readStoredName());
  const [userEmail, setUserEmail] = useState(() => readStoredEmail());
  const [provider, setProvider] = useState(() => readStoredProvider());

  const clearSession = () => {
    if (typeof window === "undefined") return;
    
    // Clear both localStorage and sessionStorage to prevent stale data
    [window.localStorage, window.sessionStorage].forEach(storage => {
      storage.removeItem(AUTH_TOKEN_KEY);
      storage.removeItem(AUTH_NAME_KEY);
      storage.removeItem(AUTH_EMAIL_KEY);
      storage.removeItem(AUTH_PROVIDER_KEY);
    });

    setToken(null);
    setUserName("");
    setUserEmail("");
    setProvider("");
  };

  const restoreAuthenticatedSession = (newToken, name = "", email = "", loginProvider = "local") => {
    if (typeof window === "undefined") return;
    
    // First, fully clear any existing session to prevent contamination
    clearSession();
    
    const t = newToken || "demo-token";
    
    // Write to BOTH storages as requested for maximum safety/redundancy
    [window.localStorage, window.sessionStorage].forEach(storage => {
      storage.setItem(AUTH_TOKEN_KEY, t);
      storage.setItem(AUTH_NAME_KEY, name);
      storage.setItem(AUTH_EMAIL_KEY, email);
      storage.setItem(AUTH_PROVIDER_KEY, loginProvider);
    });

    setToken(t);
    setUserName(name);
    setUserEmail(email);
    setProvider(loginProvider);
  };

  const login = async (email, password) => {
    const response = await fetch("http://localhost:8000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Login failed");
    
    restoreAuthenticatedSession(data.token, data.name, data.email, data.provider || "local");
    return data;
  };

  const signup = async (name, email, password) => {
    const response = await fetch("http://localhost:8000/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Signup failed");
    return data;
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const response = await fetch("http://localhost:8000/auth/google-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          token: await user.getIdToken()
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Backend synchronization failed");
      
      restoreAuthenticatedSession(data.token, data.name, data.email, "google");
      return data;
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      throw error;
    }
  };

  const requestPasswordReset = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Password reset error:", error);
      if (error.code === 'auth/user-not-found') {
        throw new Error("No user found with this email address.");
      }
      throw new Error("Failed to send recovery email. Please try again.");
    }
  };

  const value = useMemo(
    () => ({
      isAuthenticated: !!token,
      token,
      userName,
      userEmail,
      provider,
      login,
      signup,
      signInWithGoogle,
      requestPasswordReset,
      restoreAuthenticatedSession,
      clearSession,
    }),
    [token, userName, userEmail, provider],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}

export { AuthConfigurationError };
