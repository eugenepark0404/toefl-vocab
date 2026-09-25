import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        star: '#f5a623',
      },
    },
  },
  plugins: [],
};
export default config;
