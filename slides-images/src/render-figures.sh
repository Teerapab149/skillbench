#!/usr/bin/env bash
# เรนเดอร์ภาพประกอบทั้งชุดลง slides-images/figures/
# ต้องรันจากรากโปรเจกต์ · ต้องใช้ path เต็ม ไม่งั้น Chrome ตอบ Access is denied
set -e
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
B="E:/Seminar/skillbench/slides-images"

node "$B/src/fig-runs.gen.mjs"

for spec in \
  "fig-arms 1560,590" \
  "fig-question 1470,410" \
  "fig-how-we-measure 1640,462" \
  "fig-same-rule 1500,738" \
  "fig-fixture 1460,516" \
  "fig-retro-impact 1400,482" \
  "fig-scenarios 1560,826" \
  "fig-scenario-diff 1180,570" \
  "fig-p-floor 1310,356" \
  "fig-tradeoff 1460,428" \
  "fig-impact-check 1430,576" \
  "fig-runs-map 1460,382" \
  "fig-effort 1380,152"
do
  set -- $spec
  "$CH" --headless --disable-gpu \
    "--screenshot=$B/figures/$1.png" \
    --window-size=$2 \
    --default-background-color=00000000 \
    --hide-scrollbars \
    "file:///$B/src/$1.html" 2>&1 | tail -1
done

# แผ่นรวมภาพ — ต้องเรนเดอร์ท้ายสุด เพราะมันฝังไฟล์ png ที่เพิ่งสร้างไป
"$CH" --headless --disable-gpu \
  "--screenshot=$B/figures/00-contact-sheet.png" \
  --window-size=1500,7700 \
  --default-background-color=F2F4F7FF \
  --hide-scrollbars \
  "file:///$B/src/fig-contact-sheet.html" 2>&1 | tail -1

# ชุด 2x สำหรับเด็คนำเสนอ — ภาพเดียวกัน แต่ละเอียดเป็นสองเท่า ไม่ให้แตกบนโปรเจกเตอร์
# แยกโฟลเดอร์ไว้ ไม่ให้ไปกระทบแผ่นรวมภาพกับเอกสารที่อ้างขนาดเดิม
mkdir -p "$B/figures/2x"
for spec in \
  "fig-scenario-diff 1180,570" \
  "fig-p-floor 1310,356" \
  "fig-tradeoff 1460,428" \
  "fig-impact-check 1430,576" \
  "fig-runs-map 1460,382"
do
  set -- $spec
  "$CH" --headless --disable-gpu \
    "--screenshot=$B/figures/2x/$1.png" \
    --window-size=$2 \
    --force-device-scale-factor=2 \
    --default-background-color=00000000 \
    --hide-scrollbars \
    "file:///$B/src/$1.html" 2>&1 | tail -1
done
