import type { Config } from 'tailwindcss';

/**
 * Design tokens — แหล่งความจริงเดียวของสีในระบบ
 * ห้าม hardcode ค่า hex ลงใน component โดยตรง
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eff6ff', 600: '#2563eb', 700: '#1d4ed8' },
        danger: { 600: '#dc2626', 700: '#b91c1c' },
        neutral: { 100: '#f5f5f5', 900: '#171717' },
      },
    },
  },
  plugins: [],
} satisfies Config;
