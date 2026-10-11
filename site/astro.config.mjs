import { defineConfig } from 'astro/config';

// เผยแพร่ที่ https://teerapab149.github.io/skillbench/ (GitHub Pages ใช้ main:/docs)
// build ออกที่ site/dist แล้ว scripts/publish.mjs คัดลอกไป docs/ โดยไม่แตะ docs/progress2/
export default defineConfig({
  site: 'https://teerapab149.github.io',
  base: '/skillbench',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
