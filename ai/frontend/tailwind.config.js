module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: "#7C7CFF",
        glass: "rgba(255,255,255,0.12)",
        panel: "#12172a",
      },
      boxShadow: {
        glow: "0 0 30px rgba(124,124,255,0.35)",
      },
      backdropBlur: {
        glass: "12px",
      },
    },
  },
  plugins: [],
};
