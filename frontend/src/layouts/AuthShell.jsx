import { Link } from "react-router-dom";

const CAPABILITIES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    label: "6 Research Agents",
    detail: "Planner · Hunter · Reader · Comparator · Contradiction · Gap",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
    label: "Graph Knowledge Memory",
    detail: "Neo4j-powered semantic graph for persistent research context",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    label: "Export PDF / DOCX",
    detail: "One-click export of synthesized reports in publication format",
  },
];

function AuthShell({ children, footer }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "stretch",
        background: "linear-gradient(135deg, #0c0f1a 0%, #111827 55%, #0d1525 100%)",
      }}
    >
      {/* Left panel — product identity */}
      <section
        style={{
          flex: "0 0 42%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "3rem 3.5rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle background glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-120px",
            left: "-80px",
            width: "480px",
            height: "480px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: "-80px",
            right: "-60px",
            width: "320px",
            height: "320px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Logo mark */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.45rem 0.9rem",
              borderRadius: "10px",
              border: "1px solid rgba(99,102,241,0.35)",
              background: "rgba(99,102,241,0.1)",
              backdropFilter: "blur(8px)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(165,180,252,1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(165,180,252,0.9)",
                fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
              }}
            >
              Beta
            </span>
          </div>
        </div>

        {/* Product name */}
        <h1
          style={{
            margin: "0 0 1rem",
            fontSize: "clamp(1.65rem, 2.4vw, 2.1rem)",
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
            color: "#ffffff",
            fontFamily: "'Inter', 'IBM Plex Sans', 'Segoe UI', sans-serif",
          }}
        >
          Multi-Agent<br />Research Synthesizer
        </h1>

        {/* Tagline */}
        <p
          style={{
            margin: "0 0 2.75rem",
            fontSize: "0.9rem",
            lineHeight: 1.75,
            color: "rgba(148,163,184,0.9)",
            maxWidth: "340px",
            fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
          }}
        >
          AI-powered research intelligence for planning, reading, comparing, contradiction detection, and gap discovery.
        </p>

        {/* Capability highlights */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.label}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.875rem",
                padding: "0.85rem 1rem",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.035)",
                backdropFilter: "blur(8px)",
                transition: "border-color 0.2s",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  marginTop: "1px",
                  color: "rgba(129,140,248,0.85)",
                }}
              >
                {cap.icon}
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "rgba(241,245,249,0.95)",
                    fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {cap.label}
                </p>
                <p
                  style={{
                    margin: "0.2rem 0 0",
                    fontSize: "0.73rem",
                    lineHeight: 1.55,
                    color: "rgba(148,163,184,0.75)",
                    fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
                  }}
                >
                  {cap.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom copyright */}
        <p
          style={{
            marginTop: "auto",
            paddingTop: "2.5rem",
            fontSize: "0.7rem",
            color: "rgba(100,116,139,0.7)",
            fontFamily: "'Inter', 'IBM Plex Sans', sans-serif",
          }}
        >
          © {new Date().getFullYear()} Multi-Agent Research Synthesizer. All rights reserved.
        </p>
      </section>

      {/* Right panel — form */}
      <section
        style={{
          flex: "1 1 58%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2.5rem 2rem",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
          }}
        >
          {children}
          {footer ? (
            <div
              style={{
                marginTop: "2rem",
                paddingTop: "1.5rem",
                borderTop: "1px solid #e2e8f0",
                textAlign: "center",
              }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default AuthShell;
