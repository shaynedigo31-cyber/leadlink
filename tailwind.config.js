/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          deep: '#1E40AF',
          light: '#EFF6FF',
          soft: '#DBEAFE',
        },
        canvas: '#F8FAFC',
        ink: '#1E293B',
        muted: '#64748B',
        hairline: '#E2E8F0',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 10px rgb(0 0 0 / 0.03)',
      },
    },
  },
  plugins: [],
}
