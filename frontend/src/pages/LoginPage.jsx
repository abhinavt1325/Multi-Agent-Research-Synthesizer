import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthShell from "../layouts/AuthShell";
import { AuthConfigurationError, useAuth } from "../hooks/useAuth";

const inputStyle = {
  display: "block",
  width: "100%",
  padding: "0.75rem 1rem",
  fontSize: "0.875rem",
  color: "#0f172a",
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  outline: "none",
  transition: "border-color 0.18s, box-shadow 0.18s",
  fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#374151",
  marginBottom: "0.45rem",
  fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
  letterSpacing: "0.01em",
};

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithGoogle, restoreAuthenticatedSession } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [focusedField, setFocusedField] = useState(null);

  const nextPath = location.state?.from || "/dashboard";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.email.trim() || !form.password.trim()) {
      setError("Enter both email and password to continue.");
      return;
    }

    setStatus("submitting");

    try {
      const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password
        })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        restoreAuthenticatedSession(data.token, data.name || "", data.email || "");
        navigate(nextPath, { replace: true });
      } else {
        setError(data.detail || "Invalid email or password.");
      }
    } catch (submissionError) {
      if (submissionError instanceof AuthConfigurationError) {
        setMessage(submissionError.message);
      } else {
        setError("Unable to process the login request.");
      }
    } finally {
      setStatus("idle");
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setMessage("");
    setStatus("google");

    try {
      await signInWithGoogle();
      navigate(nextPath, { replace: true });
    } catch (submissionError) {
      if (submissionError instanceof AuthConfigurationError) {
        setMessage(submissionError.message);
      } else {
        setError("Unable to start Google sign-in.");
      }
    } finally {
      setStatus("idle");
    }
  }

  return (
    <AuthShell
      footer={
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", fontFamily: "'Inter', 'IBM Plex Sans', sans-serif" }}>
          New here?{" "}
          <Link
            to="/signup"
            style={{ fontWeight: 600, color: "#1e293b", textDecoration: "none" }}
          >
            Create an account →
          </Link>
        </p>
      }
    >
      <div>
        {/* Heading */}
        <div style={{ marginBottom: "2rem" }}>
          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#6366f1",
              fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
            }}
          >
            Sign In
          </p>
          <h2
            style={{
              margin: "0 0 0.6rem",
              fontSize: "1.6rem",
              fontWeight: 700,
              letterSpacing: "-0.025em",
              color: "#0f172a",
              fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
              lineHeight: 1.25,
            }}
          >
            Access your research workspace
          </h2>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.65, fontFamily: "'Inter', 'IBM Plex Sans', sans-serif" }}>
            Use your email credentials or continue with Google.
          </p>
        </div>

        {/* Google button */}
        <button
          id="login-google-btn"
          type="button"
          onClick={handleGoogleSignIn}
          disabled={status === "google"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            width: "100%",
            padding: "0.75rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#1e293b",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            cursor: status === "google" ? "not-allowed" : "pointer",
            opacity: status === "google" ? 0.7 : 1,
            transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
            fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            marginBottom: "1.25rem",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {status === "google" ? "Connecting…" : "Continue with Google"}
        </button>

        {/* Divider */}
        <div style={{ position: "relative", marginBottom: "1.25rem" }}>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}>
            <div style={{ width: "100%", borderTop: "1px solid #e2e8f0" }} />
          </div>
          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <span
              style={{
                background: "#f8fafc",
                padding: "0 0.75rem",
                fontSize: "0.72rem",
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#94a3b8",
                fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
              }}
            >
              or email
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label htmlFor="login-email" style={labelStyle}>Email address</label>
            <input
              id="login-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              style={{
                ...inputStyle,
                borderColor: focusedField === "email" ? "#6366f1" : "#e2e8f0",
                boxShadow: focusedField === "email" ? "0 0 0 3px rgba(99,102,241,0.12)" : "none",
              }}
              placeholder="name@organization.com"
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
              <label htmlFor="login-password" style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
              <Link
                to="/forgot-password"
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  color: "#6366f1",
                  textDecoration: "none",
                  fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                }}
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              style={{
                ...inputStyle,
                borderColor: focusedField === "password" ? "#6366f1" : "#e2e8f0",
                boxShadow: focusedField === "password" ? "0 0 0 3px rgba(99,102,241,0.12)" : "none",
              }}
              placeholder="Enter your password"
            />
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={status === "submitting"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "0.8rem 1rem",
              marginTop: "0.25rem",
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "#ffffff",
              background: status === "submitting" ? "#4f46e5" : "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
              border: "none",
              borderRadius: "10px",
              cursor: status === "submitting" ? "not-allowed" : "pointer",
              opacity: status === "submitting" ? 0.75 : 1,
              transition: "opacity 0.15s, transform 0.1s",
              fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
              letterSpacing: "-0.01em",
              boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
            }}
            onMouseEnter={(e) => { if (status !== "submitting") e.currentTarget.style.opacity = "0.92"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            {status === "submitting" ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Feedback */}
        {message && (
          <p
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              fontSize: "0.82rem",
              color: "#1e40af",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "10px",
              fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
            }}
          >
            {message}
          </p>
        )}
        {error && (
          <p
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              fontSize: "0.82rem",
              color: "#b91c1c",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
            }}
          >
            {error}
          </p>
        )}
      </div>
    </AuthShell>
  );
}

export default LoginPage;
