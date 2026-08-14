# ต้นฉบับของภาพสไลด์

ภาพใน `slides-images/` ที่มีไฟล์ `.html` ชื่อเดียวกันในโฟลเดอร์นี้ สร้างซ้ำได้ด้วย headless Chrome:

```bash
"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu \
  --screenshot=../04-five-arms.png --window-size=1600,690 \
  --default-background-color=141519FF --hide-scrollbars \
  "file:///E:/Seminar/skillbench/slides-images/src/04-five-arms.html"
```

| ไฟล์ | ขนาดหน้าต่างที่ใช้ render |
|---|---|
| `04-five-arms.html` | 1600 × 690 |

ภาพที่เหลือ (01–03, 05–15) สร้างไว้ก่อนหน้าโดยไม่มีต้นฉบับเก็บไว้ —
ถ้าจะแก้ภาพไหน ให้สร้าง `.html` ใหม่ตามสไตล์ของ `04-five-arms.html`
(พื้น `#141519` · ฟอนต์ Leelawadee UI + Cascadia Mono · กว้าง 1600px)
