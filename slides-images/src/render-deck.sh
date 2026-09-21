#!/usr/bin/env bash
# เรนเดอร์เด็คนำเสนอรอบที่ 2 เป็น PDF
# ข้อความในเด็คคัดจาก progress2/สไลด์รอบ2.md · ภาพจาก slides-images/figures/
set -e
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
B="E:/Seminar/skillbench"

"$CH" --headless --disable-gpu \
  "--print-to-pdf=$B/progress2/canva/deck-round2.pdf" \
  --print-to-pdf-no-header \
  --no-pdf-header-footer \
  --virtual-time-budget=10000 \
  "file:///$B/slides-images/src/deck-round2.html" 2>&1 | tail -1
