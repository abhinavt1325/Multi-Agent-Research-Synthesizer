import { useState } from "react";
import { Link } from "react-router-dom";
import AuthShell from "../layouts/AuthShell";
import { AuthConfigurationError, useAuth } from "../hooks/useAuth";

function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [focused, setFocused] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Enter your email address to continue.");
      return;
    }

    setStatus("submitting");

    try {
      await requestPasswordReset(email.trim());
      setMessage("Recovery email sent. Please check your inbox and spam folder.");
      setEmail("");
    } catch (submissionError) {
      if (submissionError instanceof AuthConfigurationError) {
        setMessage(submissionError.message);
      } else {
        setError(submissionError.message || "Unable to process the password reset request.");
      }
    } finally {
      setStatus("idle");
    }
  }

  return (
    <AuthShell
      footer={
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", fontFamily: "'Inter', 'IBM Plex Sans', sans-serif" }}>
          Remembered your password?{" "}
          <Link
            to="/login"
            style={{ fontWeight: 600, color: "#1e293b", textDecoration: "none" }}
          >
            Return to sign in →
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
            Password Recovery
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
            Reset your password
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              color: "#64748b",
              lineHeight: 1.65,
              fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
            }}
          >
            Enter the email linked to your workspace and we'll send a recovery link.
          </p>
        </div>

        {/* Envelope icon visual */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "1.75rem",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))",
              border: "1px solid rgba(99,102,241,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label
              htmlFor="forgot-email"
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "0.45rem",
                fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                letterSpacing: "0.01em",
              }}
            >
              Email address
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                display: "block",
                width: "100%",
                padding: "0.75rem 1rem",
                fontSize: "0.875rem",
                color: "#0f172a",
                background: "#ffffff",
                border: focused ? "1px solid #6366f1" : "1px solid #e2e8f0",
                borderRadius: "10px",
                outline: "none",
                transition: "border-color 0.18s, box-shadow 0.18s",
                fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                boxSizing: "border-box",
                boxShadow: focused ? "0 0 0 3px rgba(99,102,241,0.12)" : "none",
              }}
              placeholder="name@organization.com"
            />
          </div>

          <button
            id="forgot-submit-btn"
            type="submit"
            disabled={status === "submitting"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "0.8rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 700,
              color: "#ffffff",
              background: status === "submitting" ? "#5955ba" : "linear-gradient(135deg, #5955ba 0%, #6d6fc4 100%)",
              border: "none",
              borderRadius: "10px",
              cursor: status === "submitting" ? "not-allowed" : "pointer",
              opacity: status === "submitting" ? 0.75 : 1,
              transition: "opacity 0.15s",
              fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
              letterSpacing: "-0.01em",
              boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
            }}
            onMouseEnter={(e) => { if (status !== "submitting") e.currentTarget.style.opacity = "0.92"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            {status === "submitting" ? "Sending…" : "Send recovery link"}
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

export default ForgotPasswordPage;
