/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f8fafc",
        panel: "#ffffff",
        ink: "#0f172a",
        muted: "#475569",
        line: "#e2e8f0",
        accent: "#1e293b",
      },
      boxShadow: {
        "panel": "0 20px 50px -20px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.04)",
        "panel-soft": "0 10px 30px -15px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(15, 23, 42, 0.03)",
      },
      backgroundImage: {
        "paper-grid":
          "radial-gradient(circle at top, rgba(255,255,255,0.95), rgba(248,250,252,0.98) 45%, rgba(241,245,249,0.9))",
      },
    },
  },
  plugins: [],
};
