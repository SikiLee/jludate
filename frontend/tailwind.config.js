/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        szured: '#8A1538', // Lichee red
        szuredDark: '#670A25',
        roseLight: '#F5E6EA',
        roseTint: '#E8C5CF',
        pagePink: '#F5EAE7',
        /** Primary CTA — 偏粉玫瑰，与 pagePink / roseTint 更一体 */
        ctaRose: '#E09AAD',
        ctaRoseHover: '#D4899E',
        /** 首页页脚 — 浅粉灰，与 pagePink 同系 */
        footerPink: '#CBB0B6',
        cardIvory: '#F7F5F0',
      },
      fontFamily: {
        ysong: ['"方正雅宋"', 'FZYaSong', 'STSong', 'Songti SC', 'serif'],
        xihei: ['"华文细黑"', 'STXihei', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', 'sans-serif'],
        shserif: ['"Source Han Serif SC"', '"Noto Serif SC"', 'Songti SC', 'STSong', 'serif'],
        shsans: ['"Source Han Sans SC"', '"Noto Sans SC"', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
