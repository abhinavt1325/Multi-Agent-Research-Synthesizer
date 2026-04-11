/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f5f5f4",
        panel: "#fafaf9",
        ink: "#111827",
        muted: "#6b7280",
        line: "#e7e5e4",
        accent: "#1f2937",
      },
      boxShadow: {
        "panel": "0 16px 45px -24px rgba(15, 23, 42, 0.26)",
        "panel-soft": "0 10px 30px -22px rgba(15, 23, 42, 0.22)",
      },
      backgroundImage: {
        "paper-grid":
          "radial-gradient(circle at top, rgba(255,255,255,0.82), rgba(245,245,244,0.92) 42%, rgba(231,229,228,0.84))",
      },
    },
  },
  plugins: [],
};
