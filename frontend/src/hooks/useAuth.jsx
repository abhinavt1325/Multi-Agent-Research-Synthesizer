import { createContext, useContext, useMemo, useState } from "react";

const AUTH_TOKEN_KEY = "token";
const AUTH_NAME_KEY = "user_name";
const AUTH_EMAIL_KEY = "user_email";

class AuthConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

const AuthContext = createContext(null);

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function readStoredName() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_NAME_KEY) || "";
}

function readStoredEmail() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_EMAIL_KEY) || "";
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredSession());
  const [userName, setUserName] = useState(() => readStoredName());
  const [userEmail, setUserEmail] = useState(() => readStoredEmail());

  const value = useMemo(
    () => ({
      isAuthenticated: !!token,
      token,
      userName,
      userEmail,
      async login() {
        throw new AuthConfigurationError(
          "Login is not connected yet. Add the authentication backend to enable access.",
        );
      },
      async signup() {
        throw new AuthConfigurationError(
          "Signup is not connected yet. Add the authentication backend to create accounts.",
        );
      },
      async signInWithGoogle() {
        throw new AuthConfigurationError(
          "Google sign-in is not connected yet. Configure OAuth on the backend to enable it.",
        );
      },
      async requestPasswordReset() {
        throw new AuthConfigurationError(
          "Password reset is not connected yet. Add the authentication backend to enable it.",
        );
      },
      restoreAuthenticatedSession(newToken, name = "", email = "") {
        if (typeof window === "undefined") {
          return;
        }
        const t = newToken || "demo-token";
        window.localStorage.setItem(AUTH_TOKEN_KEY, t);
        window.localStorage.setItem(AUTH_NAME_KEY, name);
        window.localStorage.setItem(AUTH_EMAIL_KEY, email);
        setToken(t);
        setUserName(name);
        setUserEmail(email);
      },
      clearSession() {
        if (typeof window === "undefined") {
          return;
        }
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        window.localStorage.removeItem(AUTH_NAME_KEY);
        window.localStorage.removeItem(AUTH_EMAIL_KEY);
        setToken(null);
        setUserName("");
        setUserEmail("");
      },
    }),
    [token, userName, userEmail],
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
