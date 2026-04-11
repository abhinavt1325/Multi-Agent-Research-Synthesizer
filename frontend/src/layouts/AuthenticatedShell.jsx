import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// ─── Route → display label map ───────────────────────────────────────────────
const ROUTE_TITLES = {
  "/dashboard": "Dashboard",
  "/planner": "Planner",
  "/literature-hunter": "Literature Hunter",
  "/paper-reader": "Paper Reader",
  "/evidence-comparator": "Comparator",
  "/contradiction-detector": "Contradiction Detector",
  "/research-gap": "Research Gap",
  "/graph-explorer": "Graph Explorer",
};

// ─── Navigation items ─────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    group: "Overview",
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Agents",
    items: [
      {
        label: "Planner",
        path: "/planner",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        ),
      },
      {
        label: "Literature Hunter",
        path: "/literature-hunter",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        ),
      },
      {
        label: "Paper Reader",
        path: "/paper-reader",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
          </svg>
        ),
      },
      {
        label: "Comparator",
        path: "/evidence-comparator",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
          </svg>
        ),
      },
      {
        label: "Contradiction Detector",
        path: "/contradiction-detector",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ),
      },
      {
        label: "Research Gap",
        path: "/research-gap",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 110 20 10 10 0 010-20z" />
            <path d="M12 6v6l4 2" />
          </svg>
        ),
      },
    ],
  },
  {
    group: "Graph",
    items: [
      {
        label: "Graph Explorer",
        path: "/graph-explorer",
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        ),
      },
    ],
  },
];

// ─── Sidebar width constant ───────────────────────────────────────────────────
const SIDEBAR_W = 240;
const TOPBAR_H = 56;

// ─── Shell ────────────────────────────────────────────────────────────────────
function AuthenticatedShell() {
  const { clearSession, userName } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitle = ROUTE_TITLES[location.pathname] || "Workspace";
  const displayName = userName || "Researcher";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter', 'IBM Plex Sans', 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ── Fixed top title bar (Dark, premium) ───────────────────────── */}
      <header
        className="animate-slide-up"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: `${TOPBAR_H}px`,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          padding: "0 1.25rem 0 0",
          background: "#0f172a", // Dark neutral graphite/slate
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
        }}
      >
        {/* Left: brand wordmark in sidebar-width zone */}
        <div
          className="animate-fade-in"
          style={{
            flexShrink: 0,
            width: `${SIDEBAR_W}px`,
            height: "100%",
            display: "flex",
            alignItems: "center",
            paddingLeft: "1.25rem",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <img 
              src="/logo.jpg" 
              alt="AlgoVision" 
              style={{
                height: "32px",
                width: "auto",
                objectFit: "contain",
                borderRadius: "4px",
              }}
            />
            <span
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#f8fafc",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                fontFamily: "'Inter', 'IBM Plex Sans', sans-serif"
              }}
            >
              AlgoVision
            </span>
          </div>
        </div>

        {/* Center: dynamic page title */}
        <div style={{ flex: 1, paddingLeft: "1.5rem" }}>
          <h1
            id="page-title"
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "#f8fafc",
              letterSpacing: "-0.01em",
            }}
          >
            {pageTitle}
          </h1>
        </div>

        {/* Right: welcome + sign out */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
          {/* Avatar + name */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div
              aria-label={`Signed in as ${displayName}`}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.65rem",
                fontWeight: 700,
                color: "#c7d2fe",
                flexShrink: 0,
                letterSpacing: "0.02em",
              }}
            >
              {initials}
            </div>
            <span
              style={{
                fontSize: "0.8rem",
                color: "#94a3b8",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              Welcome,{" "}
              <span style={{ fontWeight: 600, color: "#f8fafc" }}>
                {displayName}
              </span>
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "18px", background: "rgba(255, 255, 255, 0.15)", flexShrink: 0 }} />

          {/* Sign out (Subtle outlined on dark) */}
          <button
            id="logout-button"
            type="button"
            onClick={handleLogout}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.35rem 0.8rem",
              fontSize: "0.78rem",
              fontWeight: 500,
              color: "#cbd5e1",
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
              e.currentTarget.style.color = "#f8fafc";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#cbd5e1";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15" />
              <path d="M18 12H9m0 0l3-3m-3 3l3 3" />
            </svg>
            Sign out
          </button>
        </div>
      </header>

      {/* ── Body: sidebar + content ──────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          paddingTop: `${TOPBAR_H}px`,
          flex: 1,
        }}
      >
        {/* ── Fixed left sidebar ─────────────────────────────────────────── */}
        <aside
          style={{
            position: "fixed",
            top: `${TOPBAR_H}px`,
            left: 0,
            bottom: 0,
            width: `${SIDEBAR_W}px`,
            zIndex: 40,
            display: "flex",
            flexDirection: "column",
            background: "#ffffff",
            borderRight: "1px solid #e8ecf0",
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "thin",
            scrollbarColor: "#e2e8f0 transparent",
          }}
        >
          <nav style={{ padding: "1.25rem 0.75rem", flex: 1 }} aria-label="Main navigation">
            {NAV_ITEMS.map((group) => (
              <div key={group.group} style={{ marginBottom: "1.5rem" }}>
                <p
                  style={{
                    margin: "0 0 0.5rem 0.5rem",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  {group.group}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      style={({ isActive }) => ({
                        display: "flex",
                        alignItems: "center",
                        gap: "0.65rem",
                        padding: "0.6rem 0.75rem",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? "#4f46e5" : "#475569",
                        background: isActive ? "#eef2ff" : "transparent",
                        textDecoration: "none",
                        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                        transform: "translateX(0)",
                      })}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateX(5px)";
                        if (!e.currentTarget.style.background.includes("eef2ff")) {
                          e.currentTarget.style.background = "#f8fafc";
                          e.currentTarget.style.color = "#1e293b";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateX(0)";
                        if (!e.currentTarget.style.background.includes("eef2ff")) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#475569";
                        }
                      }}
                    >
                      {({ isActive }) => (
                        <>
                          <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }}>
                            {item.icon}
                          </span>
                          <span style={{ truncate: true }}>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* ── Scrollable main content ────────────────────────────────────── */}
        <main
          style={{
            marginLeft: `${SIDEBAR_W}px`,
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ flex: 1, padding: "2.5rem 2.5rem" }}>
            <Outlet />
          </div>

          {/* ── Inline bottom footer ────────────────────────────────────────── */}
          <footer
            style={{
              borderTop: "1px solid #e2e8f0",
              padding: "1.5rem 2.5rem",
              marginTop: "auto", // Push to bottom if content is short
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                  fontWeight: 400,
                }}
              >
                © 2026 AlgoVision{" "}
                <span style={{ margin: "0 0.4rem", color: "#cbd5e1" }}>|</span>{" "}
                Research Intelligence Platform{" "}
                <span style={{ margin: "0 0.4rem", color: "#cbd5e1" }}>|</span>{" "}
                <a href="#" style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.15s" }} onMouseEnter={(e) => e.currentTarget.style.color = "#475569"} onMouseLeave={(e) => e.currentTarget.style.color = "#94a3b8"}>Privacy</a>{" "}
                <span style={{ margin: "0 0.4rem", color: "#cbd5e1" }}>|</span>{" "}
                <a href="#" style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.15s" }} onMouseEnter={(e) => e.currentTarget.style.color = "#475569"} onMouseLeave={(e) => e.currentTarget.style.color = "#94a3b8"}>Docs</a>{" "}
                <span style={{ margin: "0 0.4rem", color: "#cbd5e1" }}>|</span>{" "}
                <a href="#" style={{ color: "#94a3b8", textDecoration: "none", transition: "color 0.15s" }} onMouseEnter={(e) => e.currentTarget.style.color = "#475569"} onMouseLeave={(e) => e.currentTarget.style.color = "#94a3b8"}>Support</a>
              </p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default AuthenticatedShell;
