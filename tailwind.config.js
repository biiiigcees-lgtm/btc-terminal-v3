/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
        display: ["'Syne'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
      },
      colors: {
        bg: "#080b10",
        surface: "#0d1117",
        panel: "#111720",
        border: "#1e2d40",
        accent: "#00e5ff",
        gold: "#f5c542",
        green: "#00ff88",
        red: "#ff3b5c",
        amber: "#ffaa00",
        muted: "#4a5568",
        text: "#e2e8f0",
        dim: "#7a8899",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-in": "fadeIn 0.4s ease forwards",
        "slide-up": "slideUp 0.3s ease forwards",
        "glow-green": "glowGreen 2s ease-in-out infinite",
        "glow-red": "glowRed 2s ease-in-out infinite",
        "scan": "scan 3s linear infinite",
        "ticker": "ticker 20s linear infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        glowGreen: { "0%,100%": { boxShadow: "0 0 8px #00ff8855" }, "50%": { boxShadow: "0 0 24px #00ff8899" } },
        glowRed: { "0%,100%": { boxShadow: "0 0 8px #ff3b5c55" }, "50%": { boxShadow: "0 0 24px #ff3b5c99" } },
        scan: { "0%": { backgroundPosition: "0 0" }, "100%": { backgroundPosition: "0 100%" } },
        ticker: { from: { transform: "translateX(100%)" }, to: { transform: "translateX(-100%)" } },
      },
    },
  },
  plugins: [],
};
