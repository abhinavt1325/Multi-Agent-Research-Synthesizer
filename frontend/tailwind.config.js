/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0B1220",
        panel: "#111827",
        ink: "#f8fafc",
        muted: "#94a3b8",
        line: "#1e293b",
        accent: "#ec4899",
      },
      boxShadow: {
        "panel": "0 20px 50px -20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
        "panel-soft": "0 10px 30px -15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03)",
      },
      backgroundImage: {
        "paper-grid":
          "radial-gradient(circle at top, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.8) 45%, rgba(11, 18, 32, 1))",
      },
    },
  },
  plugins: [],
};
