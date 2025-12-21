// Use the new Tailwind PostCSS plugin per Tailwind v4+ guidance
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

export default {
  plugins: [tailwindcss(), autoprefixer()],
};
