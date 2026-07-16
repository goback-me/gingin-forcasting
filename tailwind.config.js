/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F5F4EF",
        surface: "#FFFFFF",
        surface2: "#FBFAF6",
        ink: "#1E2A20",
        inksoft: "#57614F",
        inkfaint: "#8B9182",
        border: "#E1DFD3",
        borderstrong: "#CBC8B8",
        green: { DEFAULT: "#3F6B4A", soft: "#E7EFE5", strong: "#26452F" },
        amber: { DEFAULT: "#B8842B", soft: "#F7EDD8", strong: "#7A5518" },
        brick: { DEFAULT: "#A6432C", soft: "#F5E3DD", strong: "#732B1B" },
        slate: { DEFAULT: "#4A5568", soft: "#E9ECEF" },
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      borderRadius: { lg: "16px" },
    },
  },
  plugins: [],
};
