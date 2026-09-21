#!/usr/bin/env bash
# เรนเดอร์ภาพประกอบทั้งชุดลง slides-images/figures/
# ต้องรันจากรากโปรเจกต์ · ต้องใช้ path เต็ม ไม่งั้น Chrome ตอบ Access is denied
set -e
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
B="E:/Seminar/skillbench/slides-images"

node "$B/src/fig-runs.gen.mjs"

for spec in \
  "fig-arms 1520,560" \
  "fig-how-we-measure 1600,455" \
  "fig-same-rule 1460,640" \
  "fig-fixture 1420,470" \
  "fig-retro-impact 1360,468" \
  "fig-scenarios 1500,690" \
  "fig-scenario-diff 1140,530" \
  "fig-p-floor 1270,330" \
  "fig-tradeoff 1420,400" \
  "fig-runs-map 1420,340" \
  "fig-effort 1340,130"
do
  set -- $spec
  "$CH" --headless --disable-gpu \
    "--screenshot=$B/figures/$1.png" \
    --window-size=$2 \
    --default-background-color=00000000 \
    --hide-scrollbars \
    "file:///$B/src/$1.html" 2>&1 | tail -1
done
