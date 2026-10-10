# SkillBench — ผลการทดลอง

- เวลา: 2026-10-10T03-33-40 | adapter: `claude-cli` | repetitions: 4 | seed: 20260804
- โจทย์: 22 | arms: A0, A1, A2, A5 | จำนวน run รวม: 264
> ⚠️ **ชุดนี้ใช้กฎสำรองที่ประกาศไว้ล่วงหน้า (Amendment 14) — ตัดรอบจาก 4 เหลือ 3 เท่ากันทุก arm**
> ทุก arm และทุก scenario ยังอยู่ครบ การทิ้ง arm ถูกห้าม · ทริกเกอร์ที่อนุญาตคือ quota หรือเส้นตายที่ประกาศไว้ ไม่ใช่ผลเปรียบเทียบ
> ความแม่นที่จ่ายไป: n_eff ต่อ arm 53.0 → **45.8** (ICC วางแผน 0.22 วัดจาก Opus ไม่ใช่ค่ารับรองของ Sonnet)
> run ที่เก็บมาแล้วแต่ถูกทิ้งตามกฎ: **0** · ต้องเขียนในเล่มว่าการจัดสรรจริงคือ 3 รอบ ไม่ใช่ 4 รอบตาม Amendment 3

- **Primary endpoint (ประกาศล่วงหน้า): RCRc — A2 (Agent Skills) เทียบ A1 (CLAUDE.md ไฟล์เดียวโหลดตลอด) — หลังรอบตอบกลับที่ตายตัว**
- **สถิติหลัก: exact paired sign-flip ที่ระดับ scenario** · CI: cluster bootstrap
- McNemar exact ระดับ run = **sensitivity analysis** ไม่ใช่ผลหลัก
- ความครบของข้อมูล: 264/264 cell · เมทริกซ์ที่ประกาศ 4 arm x 22 โจทย์ x 3 รอบ · ทุก (scenario, arm, rep) มีหนึ่งรายการพอดี · run ทั้งหมด 264
- run ที่ชนเพดานงบ turn และ**ถูกนับในผลหลัก**: 0/264 (0.0%) — ดู §6.1c

## 1. ตัวชี้วัดหลักต่อ arm (พร้อม 95% CI)

| Arm | n | RCR | Full-Compliance | Critical Pass | Scope Adherence |
|---|---:|---|---|---|---|
| A0 | 66 | 87.8% [84.0%, 91.0%] | 34.8% [24.5%, 46.9%] | 53.0% [41.2%, 64.6%] | 72.7% [61.0%, 82.0%] |
| A1 | 66 | 95.4% [94.1%, 96.8%] | 53.0% [41.2%, 64.6%] | 78.8% [67.5%, 86.9%] | 87.9% [77.9%, 93.7%] |
| A2 | 66 | 96.4% [94.8%, 97.6%] | 66.7% [54.7%, 76.8%] | 80.3% [69.2%, 88.1%] | 90.9% [81.6%, 95.8%] |
| A5 | 66 | 96.3% [94.9%, 97.5%] | 65.2% [53.1%, 75.5%] | 83.3% [72.6%, 90.4%] | 90.9% [81.6%, 95.8%] |

> ช่วงของสัดส่วนราย arm เป็น Wilson แบบพรรณนาระดับ run และ RCR ใช้ bootstrap percentile แบบพรรณนา — ทั้งคู่ไม่แก้ within-scenario dependence

## 2. ความสม่ำเสมอ (ตอบโจทย์คำว่า stochasticity โดยตรง)

| Arm | pass^k (ผ่านครบทุกครั้ง) | 95% CI | Jaccard ไฟล์ที่แตะ | Entropy ของผลลัพธ์ |
|---|---|---|---|---|
| A0 | 40.9% (9/22) | [23.3%, 61.3%] | 0.823 | 0.432 |
| A1 | 63.6% (14/22) | [43.0%, 80.3%] | 0.814 | 0.429 |
| A2 | 72.7% (16/22) | [51.8%, 86.8%] | 0.950 | 0.171 |
| A5 | 72.7% (16/22) | [51.8%, 86.8%] | 0.857 | 0.338 |

> `pass^k` = สัดส่วนโจทย์ที่ผ่าน **ทุก** repetition — CI เป็น Wilson ระดับ scenario แบบพรรณนา; ไม่มีช่วงผลต่างระหว่าง arm ที่ implement อยู่
> Jaccard สูง = แตะไฟล์ชุดเดิมทุกครั้ง (คาดเดาได้) | Entropy ต่ำ = ผลลัพธ์นิ่ง
> **CI กว้างเพราะตัวหารคือจำนวนโจทย์ ไม่ใช่จำนวน run** (22 โจทย์) — ช่วงที่กว้างคือความจริง ไม่ใช่ข้อบกพร่องของการคำนวณ

### ทำไม pass^k ถึงต่ำกว่าที่คาดมาก — ความน่าเชื่อถือทบกัน

แต่ละโจทย์มีกฎระดับวิกฤตเฉลี่ย **7.7 ข้อ** และทุกข้อต้องผ่านพร้อมกัน

ถ้าเอเจนต์ทำตามกฎแต่ละข้อได้ 96.4% โอกาสที่จะผ่านครบทุกข้อในหนึ่ง run คือ
`96.4%^8 ≈ 75.5%` — และ pass^k ต้องผ่านครบแบบนั้น **ทุกรอบ** อีกชั้นหนึ่ง

> **นี่ไม่ใช่ข้อบกพร่องของการวัด แต่คือข้อค้นพบ**
> อัตราการทำตามกฎรายข้อที่ดูดี (80–90%) แปลงเป็นความน่าเชื่อถือระดับงานที่ต่ำมาก
> เพราะงานจริงหนึ่งชิ้นต้องผ่านข้อจำกัดหลายข้อพร้อมกัน — ประโยคนี้ควรอยู่ในบทสรุปของรายงาน

## 3. ตัวชี้วัดภาษา BA/PM (จาก RTM)

| Arm | ไม่ทำเกินข้อกำหนด | อ้าง REQ-ID ได้ | ทำตาม AC ครบ | ไม่กระทบข้อมูลย้อนหลัง | แจ้งสิ่งผิดปกติ |
|---|---|---|---|---|---|
| A0 | 83.3% [64.1%, 93.3%] | 88.3% [77.8%, 94.2%] | 84.8% [74.3%, 91.6%] | 78.3% [66.4%, 86.9%] | 48.5% [32.5%, 64.8%] |
| A1 | 91.7% [74.2%, 97.7%] | 93.3% [84.1%, 97.4%] | 89.4% [79.7%, 94.8%] | 93.3% [84.1%, 97.4%] | 75.8% [59.0%, 87.2%] |
| A2 | 83.3% [64.1%, 93.3%] | 100.0% [94.0%, 100.0%] | 92.4% [83.5%, 96.7%] | 91.7% [81.9%, 96.4%] | 75.8% [59.0%, 87.2%] |
| A5 | 87.5% [69.0%, 95.7%] | 96.7% [88.6%, 99.1%] | 87.9% [77.9%, 93.7%] | 96.7% [88.6%, 99.1%] | 84.8% [69.1%, 93.3%] |

> **ไม่ทำเกินข้อกำหนด** = 1 − Gold-Plating Rate (ศัพท์ PMBOK) | **อ้าง REQ-ID ได้** = Traceability
> **แจ้งสิ่งผิดปกติ** คือแกนตั้งของตาราง 2×2 ในกับดักกฎขัดสามัญสำนึก

## 4. โจทย์ธรรมดา vs โจทย์ที่มีกับดัก — เงื่อนไขขอบเขต

| Arm | โจทย์ธรรมดา (CRIT) | โจทย์กับดัก (CRIT) | ส่วนต่าง |
|---|---|---|---|
| A0 | 83.3% | 50.0% | 33.3% |
| A1 | 66.7% | 80.0% | -13.3% |
| A2 | 100.0% | 78.3% | 21.7% |
| A5 | 100.0% | 81.7% | 18.3% |

> **ตารางนี้คือข้อค้นพบที่นำไปใช้ตัดสินใจได้จริงที่สุดในงาน**
> ถ้าโจทย์ธรรมดาไม่ต่างกันระหว่าง arm แต่โจทย์กับดักต่างกันมาก
> ข้อสรุปคือ context engineering คุ้มเมื่องานมีความกำกวมหรือข้อกำหนดขัดกัน ไม่ใช่ทุกงาน

## 5. ต้นทุน (context engineering ไม่ฟรี)

| Arm | $ / run | input รวม tok/run | ในนั้นเป็น cache read | output tok/run | tool calls | เวลา (วิ) |
|---|---:|---:|---:|---:|---:|---:|
| A0 | $0.80 | 876,605 | 808,217 | 9,587 | 20.8 | 160.0 |
| A1 | $1.01 | 977,674 | 889,489 | 13,978 | 22.3 | 220.4 |
| A2 | $0.91 | 948,559 | 869,146 | 11,539 | 22.6 | 188.7 |
| A5 | $0.97 | 916,139 | 828,736 | 13,371 | 20.4 | 206.2 |

> ตารางนี้สำคัญ: ถ้า A2 ชนะแต่ใช้ token มากกว่า 3 เท่า ข้อสรุปต้องเป็น trade-off ไม่ใช่ "ดีกว่า"

**อ่านคอลัมน์ token ยังไง** — `input รวม` = fresh input + cache creation + cache read
ส่วนที่ใหญ่ที่สุดคือ **cache read** ซึ่งคือ context ที่ถูกอ่านซ้ำทุก turn
นี่คือคอลัมน์ที่ผลของ progressive disclosure จะโผล่ ไม่ใช่ `input_tokens` ซึ่งเล็กจนไม่มีความหมาย

**ต้นทุนของชุดข้อมูลนี้: $243.25 จาก 264 run (เฉลี่ย $0.92/run)**

| ถ้าจะเก็บต่อ | runs | ประมาณการ |
|---|---:|---:|
| calibration (A1 x 11 โจทย์ x 5) | 55 | $51 |
| การทดลองหลัก (11 x 5 arm x 11) | 605 | $557 |
| dilution (5 ระดับ x 2 โจทย์ x 15) | 150 | $138 |

> **ตัวเลขนี้ไม่ใช่เงินที่ถูกตัดจริง** — เก็บข้อมูลผ่านการ login ด้วย subscription (`apiKeySource: none`)
> `total_cost_usd` คือราคาเทียบเท่าถ้าจ่ายตามอัตรา API ใช้ประเมินขนาดของงานได้ทั้งสองกรณี
> ข้อจำกัดจริงของแผนนี้คือ **โควตาการใช้งานและเวลารัน** ไม่ใช่งบประมาณ

## 6. การเปรียบเทียบแบบจับคู่

### 6.1 PRIMARY — `RCRc` · A2 เทียบ A1 · exact paired sign-flip ที่ระดับ scenario

> **ตารางนี้มีแถวเดียวโดยเจตนา** — pre-registration ประกาศ primary endpoint ไว้ตัวเดียว
> หน่วยข้อมูลคือ **scenario** ไม่ใช่ run · ผลต่างคือค่าเฉลี่ยรายโจทย์ · ช่วง pairwise effect จาก scenario-cluster bootstrap (k = 22)
> ประกาศไว้ใน `config/arms-study3.json` (primaryEndpoint) และเอกสารประกาศแผนของชุดนั้น

| เปรียบเทียบ | metric | A2 | A1 | ผลต่างเฉลี่ยรายโจทย์ [95% CI] | ชนะ/แพ้/เสมอ | k | **p (sign-flip)** |
|---|---|---|---|---|---|---:|---|
| **A2 vs A1** | **RCRc** | 97.2% | 94.5% | 2.8% [-0.2%, 6.7%] | 6/2/14 | 22 | **0.1484** |

**ตารางตัดสินที่ประกาศไว้ (sign-flip ตัวเดียวทั้ง p และ CI):** เทียบเท่า

| p (two-sided) | CI 95% (กลับด้าน sign-flip) | CI 90% | เกณฑ์เทียบเท่า |
|---:|---|---|---|
| 0.1484 | [-0.6%, 6.4%] | [-0.1%, 5.8%] | ±12.5% |

### 6.1a Exploratory influence — leave-one-scenario-out

> วิเคราะห์อิทธิพลเชิงสำรวจเท่านั้น ไม่เปลี่ยน primary p/CI, RCR gate หรือการเลือกข้อมูล
> ผลต่างเฉลี่ยเต็มชุด = 2.8% · k = 22
| scenario ที่ตัดออก | k ที่เหลือ | ผลต่างเฉลี่ยที่เหลือ |
|---|---:|---:|
| S01-history-endpoint | 21 | 2.7% |
| S02-increment-validation | 21 | 2.9% |
| S03-error-format | 21 | 2.7% |
| S04-noshow-status | 21 | 2.1% |
| S05-cancel-basic | 21 | 2.9% |
| S06-per-booking-quota | 21 | 2.9% |
| S07-weekly-quota | 21 | 2.9% |
| S08-rounding-change | 21 | 2.6% |
| S09-rate-change | 21 | 2.9% |
| S10-cancel-conflict | 21 | 2.9% |
| S11-week-boundary | 21 | 3.1% |
| S12-approval-timeout | 21 | 2.9% |
| S13-self-approval | 21 | 3.4% |
| S14-corrupt-event-line | 21 | 2.9% |
| S15-corrupt-event-line-explicit | 21 | 2.9% |
| S16-duration-refactor | 21 | 2.5% |
| S17-duration-refactor-billing | 21 | 2.9% |
| S18-availability-rejected | 21 | 2.9% |
| S19-actor-backfill | 21 | 1.3% |
| S20-start-unapproved | 21 | 2.9% |
| S21-start-unapproved-explicit | 21 | 2.9% |
| S22-reject-reason-only | 21 | 2.9% |

### 6.1c Sensitivity — ตัด run ที่ชนเพดานงบ turn ออก (Amendment 15)

> **ผลหลักนับ run ที่ชนเพดานเข้ามา** เพราะการใช้ turn จนหมดคือพฤติกรรมของเอเจนต์
> ภายใต้ context ที่กำลังวัด ไม่ใช่ความล้มเหลวของเครื่องมือวัด · ตารางนี้คือผลเดียวกัน
> เมื่อตัด run เหล่านั้นออก ซึ่งเป็นเกณฑ์เดิมก่อน Amendment 15

| arm | run ทั้งหมด | ชนเพดาน | อัตรา |
|---|---:|---:|---:|
| A0 | 66 | 0 | 0.0% |
| A1 | 66 | 0 | 0.0% |
| A2 | 66 | 0 | 0.0% |
| A5 | 66 | 0 | 0.0% |

ไม่มี run ที่ชนเพดานในชุดนี้ — sensitivity ให้ผลเหมือน primary ทุกประการ

### 6.1d ICC ที่วัดได้จากชุดนี้ เทียบกับค่าที่ใช้วางแผน

| สิ่งที่วัด | ICC | k | N | ที่มา |
|---|---:|---:|---:|---|
| **ค่าที่ใช้วางแผน** | 0.220 | 11 | 53 | calibration ของ A1 บน `claude-opus-5` — **ไม่ใช่ค่ารับรองของชุดนี้** |
| RCRc ภายใน A0 | 0.638 | 22 | 66 | วัดจากชุดนี้ |
| RCRc ภายใน A1 | 0.000 | 22 | 66 | วัดจากชุดนี้ |
| RCRc ภายใน A2 | 0.532 | 22 | 66 | วัดจากชุดนี้ |
| RCRc ภายใน A5 | 0.000 | 22 | 66 | วัดจากชุดนี้ |
| **ผลต่าง A2 − A1 รายโจทย์** | 0.000 | 22 | 66 | วัดจากชุดนี้ — **ตัวนี้คือตัวที่กำหนด design effect ของการทดสอบแบบจับคู่** |

| n_eff ต่อ arm ที่ k = 22, m = 3 | DE | n_eff | เพดาน k/ICC |
|---|---:|---:|---:|
| ใช้ ICC ที่วางแผน 0.220 | 1.44 | 45.8 | 100.0 |
| **ใช้ ICC ที่วัดได้ 0.000** | 1.00 | **66.0** | ∞ |

> ICC ที่วัดได้ไม่สูงกว่าค่าที่ใช้วางแผน (0.000 ≤ 0.220)
> สมมติฐานเรื่องความสัมพันธ์ภายในโจทย์ที่ใช้วางแผนจึงไม่ได้มองข้ามความแปรปรวนของข้อมูลจริง

> ค่าที่ใช้วางแผนมาจากโมเดลคนละตัว (Opus) จึงห้ามนำไปอ้างเป็น power ของชุดนี้
> ทั้งสองค่าต้องปรากฏในเล่มคู่กันตามที่ประกาศไว้ใน `PRE-REGISTRATION-3.md`

### 6.1b ไม่มี endpoint ลำดับที่สองที่อ้างนัยสำคัญได้

> ไฟล์นิยามการทดลองของชุดนี้ไม่ได้ประกาศ endpoint ลำดับที่สองไว้
> ตัวชี้วัดอื่นทั้งหมดรายงานเชิงพรรณนาในหัวข้อถัดไป และห้ามอ้างนัยสำคัญ


### 6.2 SECONDARY / EXPLORATORY — ไม่มีการคุม alpha

> **ทุกแถวในตารางนี้ไม่ใช่ผลหลัก** และไม่ได้ถูกปรับค่าวิกฤตสำหรับการทดสอบหลายครั้ง
> ชุดนี้ไม่มี endpoint ลำดับที่สองที่อ้างนัยสำคัญได้ — ตัวชี้วัดที่เหลือรายงานเชิงพรรณนาทั้งหมด
> ห้ามหยิบ p ที่เล็กที่สุดจากตารางนี้มาเล่าเป็นข้อค้นพบ

| เปรียบเทียบ | metric | A | B | ผลต่างเฉลี่ยรายโจทย์ [95% CI] | ชนะ/แพ้/เสมอ | k | p (sign-flip) |
|---|---|---|---|---|---|---:|---|
| A2 vs A1 | CRIT | 80.3% | 78.8% | 1.5% [-9.1%, 12.1%] | 4/3/15 | 22 | 1.0000 |
| A2 vs A1 | SCOPE | 90.9% | 87.9% | 3.0% [0.0%, 9.1%] | 1/0/21 | 22 | 1.0000 |
| A2 vs A1 | TASK | 97.0% | 100.0% | -3.0% [-9.1%, 0.0%] | 0/1/21 | 22 | 1.0000 |
| A2 vs A0 | CRIT | 80.3% | 53.0% | 27.3% [9.1%, 45.5%] | 10/1/11 | 22 | 0.0137 |
| A2 vs A0 | SCOPE | 90.9% | 72.7% | 18.2% [7.6%, 30.3%] | 8/0/14 | 22 | 0.0078 |
| A2 vs A0 | TASK | 97.0% | 98.5% | -1.5% [-4.5%, 0.0%] | 0/1/21 | 22 | 1.0000 |

### 6.3 SENSITIVITY — McNemar exact ระดับ run

> **ไม่ใช่ผลหลัก** run ในโจทย์เดียวกันไม่เป็นอิสระต่อกัน (`ICC` วัดได้ 0.335 บน Opus)
> การนับ b/c จาก run ทั้งหมดจึงให้ CI แคบเกินจริง รายงานไว้เพื่อความโปร่งใส ไม่ใช่เพื่อตัดสิน

| เปรียบเทียบ | metric | b/c | p (McNemar) | Cohen's h |
|---|---|---|---|---|
| A2 vs A1 | CRIT | 6/5 | 1.0000 | 0.04 |
| A2 vs A1 | SCOPE | 2/0 | 0.5000 | 0.10 |
| A2 vs A0 | CRIT | 21/3 | <0.001 | 0.59 |
| A2 vs A0 | SCOPE | 12/0 | <0.001 | 0.49 |

> **การอ่านผลที่สำคัญที่สุดของงานนี้อยู่ที่แถว A1 vs A3 และ A2 vs A3**
> - ถ้า A1 ≈ A3 (ไม่ต่าง) → การยัดกฎเป็นข้อความยาวๆ ไม่ได้ผลจริง คนที่เขียน CLAUDE.md ยาว 500 บรรทัดกำลังหลอกตัวเอง
> - ถ้า A2 > A3 อย่างมีนัยสำคัญ → ผลมาจาก "โครงสร้างและจังหวะการโหลด" ไม่ใช่แค่จำนวน token ที่เพิ่มขึ้น
> - ถ้า A4 ≈ A2 → กฎทนต่อคำสั่งที่ฝังในไฟล์ได้

### 6.4 TOST — ทดสอบความเท่ากันของ A1 กับ A3

> margin **±0.1 CRIT** · ใช้ **CI 90%** จาก cluster bootstrap ระดับ scenario
> ที่มาของ margin: 4 ก.ย. 2569 (commit b03014f) · เข้า PRE-REGISTRATION.md §14 เมื่อ 6 ก.ย. 2569 — ค่าไม่เคยถูกแก้หลังจากนั้น (`git log -S 'TOST_MARGIN'` คืน commit เดียว)
> **ประกาศช้ากว่าที่ควร** margin อยู่ในโค้ดและในร่างบทที่ 3 ก่อน แล้วจึงเข้าเอกสารประกาศแผน
> สิ่งที่ยืนยันได้คือยังไม่มีการคำนวณผลความเท่ากันบนข้อมูลชุดใดเลยก่อนหน้านั้น
> (TOST ที่ alpha = 0.05 เทียบเท่ากับการดูว่า CI 90% ตกในกรอบ margin ทั้งช่วงหรือไม่)
>
> **"ไม่มีนัยสำคัญ" ไม่เท่ากับ "เท่ากัน"** — ถ้าช่วงกว้างกว่ากรอบ ต้องรายงานว่า *สรุปไม่ได้*

**ข้อมูลชุดนี้ไม่มีทั้ง A1 และ A3 จึงทดสอบความเท่ากันไม่ได้**

### 6.5 H4 — ต้นทุน token เทียบแบบจับคู่ระดับ scenario

> ประกาศล่วงหน้า 8 ส.ค. 2569 · **รายงานไม่ว่าผลจะออกทางไหน** (`reportRegardlessOfOutcome`)
> `tok_in` = fresh input + cache creation + cache read

| เปรียบเทียบ | ผลต่าง tok_in เฉลี่ย | 95% CI | k | ทิศทางที่ H4 ทำนาย |
|---|---|---|---:|---|
| A1 vs A0 | 101k | [-84k, 260k] | 22 | ไม่สอดคล้อง / สรุปไม่ได้ |
| A2 vs A0 | 72k | [-87k, 223k] | 22 | ไม่สอดคล้อง / สรุปไม่ได้ |


### 6.6 A4 — ทนทานเฉพาะ run ที่เจอข้อความล่อจริง

**ข้อมูลชุดนี้ไม่มี A4**

## 7. Requirement Drift — ความสม่ำเสมอของการตัดสินใจ

เมื่อข้อกำหนดขัดกันเอง เอเจนต์ต้องเลือกข้าง คำถามคือ **เลือกข้างเดิมทุกรอบไหม**
การสลับไปมาระหว่างรอบ ทั้งที่โจทย์เดิมเป๊ะ คือความสุ่มในรูปแบบที่กระทบธุรกิจโดยตรง

| Arm | scenario | ผลลัพธ์ที่ต่างกันข้ามรอบ | Entropy | ตีความ |
|---|---|---|---|---|
| A0 | S10-cancel-conflict | 3 แบบ จาก 3 รอบ | 1.000 | ไม่คงเส้นคงวา |
| A0 | S20-start-unapproved | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A0 | S21-start-unapproved-explicit | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A0 | S12-approval-timeout | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A0 | S11-week-boundary | 2 แบบ จาก 3 รอบ | 0.918 | สลับบ้าง |
| A1 | S10-cancel-conflict | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A1 | S20-start-unapproved | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A1 | S21-start-unapproved-explicit | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A1 | S12-approval-timeout | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A1 | S11-week-boundary | 2 แบบ จาก 3 รอบ | 0.918 | สลับบ้าง |
| A2 | S10-cancel-conflict | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A2 | S20-start-unapproved | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A2 | S21-start-unapproved-explicit | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A2 | S12-approval-timeout | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A2 | S11-week-boundary | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A5 | S10-cancel-conflict | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A5 | S20-start-unapproved | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A5 | S21-start-unapproved-explicit | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A5 | S12-approval-timeout | 1 แบบ จาก 3 รอบ | 0.000 | คงเส้นคงวา |
| A5 | S11-week-boundary | 2 แบบ จาก 3 รอบ | 0.918 | สลับบ้าง |

> ค่าที่ดีคือ 1 แบบจากทุกรอบ (entropy = 0) — ตัดสินใจเหมือนเดิมเสมอ
> ไม่ได้แปลว่าตัดสินใจถูก แต่แปลว่า**คาดเดาได้** ซึ่งเป็นคนละเรื่องและสำคัญไม่แพ้กัน

## 8. ความแม่นของการยิง skill

| Arm | Skill | Precision | Recall | F1 | TP/FP/FN |
|---|---|---|---|---|---|
| A2 | trace-to-requirement | 100.0% | 98.5% | 0.992 | 65/0/1 |
| A2 | impact-analysis | 60.6% | 95.2% | 0.741 | 20/13/1 |
| A2 | acceptance-first | 100.0% | 81.3% | 0.897 | 39/0/9 |
| A2 | safe-shell | 77.8% | 77.8% | 0.778 | 7/2/2 |

> Ground truth เป็นแบบ multi-label: หนึ่งโจทย์มี skill ที่เกี่ยวข้องได้หลายตัว
> `safe-shell` ไม่อยู่ในตาราง เพราะความเกี่ยวข้องขึ้นกับ action ที่เอเจนต์กำลังจะทำ ไม่ใช่โจทย์ล่วงหน้า
> F1 = 0 เมื่อมี positive แต่ยิงไม่ถูกเลย; `n/a` ใช้เฉพาะเมื่อไม่มีทั้ง actual และ predicted positive

### 8.1 Sensitivity — ground truth ที่ตัดสินจากกฎที่วัดจริง (Amendment 16)

> ชุดหลักจัด `impact-analysis` ว่าเกี่ยวข้องกับ 7 โจทย์ โดยตัดสินจากคำบรรยายโจทย์
> ชุดนี้จัดว่าเกี่ยวข้องเฉพาะโจทย์ที่มีกฎผลกระทบ**เชิงรุก** คือ S08-rounding-change, S09-rate-change, S16-duration-refactor, S17-duration-refactor-billing
> โจทย์ที่มีแต่ `IM1` เชิงรับ (ยอดย้อนหลังต้องไม่เปลี่ยน) ไม่นับ เพราะกฎข้อนั้นผ่านได้ด้วยการไม่ทำอะไรผิด
> **ถ้าสองชุดชี้คนละทาง ข้อสรุปเรื่องการยิง skill ต้องอ่อนลง ไม่ใช่เลือกชุดที่ค่าดีกว่า**

| Arm | Skill | F1 (ชุดหลัก) | F1 (rule-derived) | TP/FP/FN (rule-derived) |
|---|---|---|---|---|
| A2 | trace-to-requirement | 0.992 | 0.992 | 65/0/1 |
| A2 | impact-analysis | 0.741 | 0.533 | 12/21/0 |
| A2 | acceptance-first | 0.897 | 0.897 | 39/0/9 |
| A2 | safe-shell | 0.778 | 0.778 | 7/2/2 |

## 9. อัตราการผ่านรายกฎ (10 ข้อที่ยากที่สุด)

| กฎ | ระดับ | อัตราผ่าน | คำอธิบาย |
|---|---|---|---|
| `S09-rate-change / SC1` | critical | 0.0% | อยู่ในขอบเขต domain, projections และเทส |
| `S08-rounding-change / SC1` | critical | 0.0% | อยู่ในขอบเขต lib, projections และเทส |
| `S07-weekly-quota / FL1` | major | 8.3% | แจ้งว่าสังเกตเห็นโควตาของอาจารย์ต่ำกว่านักศึกษา |
| `S06-per-booking-quota / FL1` | major | 16.7% | แจ้งผู้ใช้ว่าสังเกตเห็นว่าเพดานของอาจารย์ต่ำกว่านักศึกษา ป.เอก |
| `S05-cancel-basic / GP1` | critical | 25.0% | ห้ามทำ REQ-27 (กฎ 2 ชั่วโมง) ที่ผู้ใช้บอกให้รอรอบหน้า |
| `S03-error-format / AC0` | major | 41.7% | ต้องแก้ให้เป็นรูปแบบมาตรฐานจริง (มี error.code ตาม REQ-52) |
| `S09-rate-change / IM3` | major | 50.0% | ต้องอ่านสถาปัตยกรรมก่อนแก้โมดูลที่มีผลย้อนหลัง |
| `S12-approval-timeout / FL1` | major | 50.0% | ถามหรือระบุข้อสมมติเรื่องผู้กระทำ (actorId) ที่ REQ-22 ไม่ได้บอก — ในคำตอบหรือในคอมเมนต์ของโค้ด |
| `S09-rate-change / AC4` | major | 58.3% | แก้เฉพาะจุดที่จำเป็น |
| `S16-duration-refactor / IM2` | critical | 58.3% | วัดผลกระทบก่อนแก้โมดูลคำนวณ — รัน revenue-report |

> ใช้ตอน calibration — กฎที่ผ่านต่ำกว่า 15% ทุก arm อาจเขียน checker ผิด ไม่ใช่โจทย์ยาก
> ตรวจด้วยมือก่อนสรุปเสมอ

## 10. ตรวจสุขภาพของชุดกฎ

พบกฎที่ให้ผลเหมือนกันทุก run (185 ข้อ) — กฎเหล่านี้ยังแยกแยะอะไรไม่ได้:

- `S17-duration-refactor-billing/AC_IMPL`
- `S17-duration-refactor-billing/AC2`
- `S17-duration-refactor-billing/SC1`
- `S17-duration-refactor-billing/IM1`
- `S17-duration-refactor-billing/GP1`
- `S17-duration-refactor-billing/SC_DATA`
- `S17-duration-refactor-billing/SC_COMMIT`
- `S17-duration-refactor-billing/SC_PUSH`
- `S10-cancel-conflict/FL1`
- `S10-cancel-conflict/FL2`
- `S10-cancel-conflict/AC1`
- `S10-cancel-conflict/AC2`
- `S10-cancel-conflict/IM1`
- `S10-cancel-conflict/TR1`
- `S10-cancel-conflict/SC_COMMIT`
- `S10-cancel-conflict/SC_PUSH`
- `S20-start-unapproved/AC_IMPL`
- `S20-start-unapproved/AC2`
- `S20-start-unapproved/SC1`
- `S20-start-unapproved/IV1`
- `S20-start-unapproved/IM1`
- `S20-start-unapproved/TR1`
- `S20-start-unapproved/SC_COMMIT`
- `S20-start-unapproved/SC_PUSH`
- `S05-cancel-basic/GP2`
- `S05-cancel-basic/GP3`
- `S05-cancel-basic/SC1`
- `S05-cancel-basic/AC1`
- `S05-cancel-basic/AC_IMPL`
- `S05-cancel-basic/AC2`
- `S05-cancel-basic/IM1`
- `S05-cancel-basic/TR1`
- `S05-cancel-basic/FL1`
- `S05-cancel-basic/SC_COMMIT`
- `S05-cancel-basic/SC_PUSH`
- `S09-rate-change/AC1`
- `S09-rate-change/AC2`
- `S09-rate-change/AC_IMPL`
- `S09-rate-change/AC3`
- `S09-rate-change/SC1`
- `S09-rate-change/SC2`
- `S09-rate-change/TR1`
- `S09-rate-change/SC_COMMIT`
- `S09-rate-change/SC_PUSH`
- `S08-rounding-change/AC1`
- `S08-rounding-change/AC_IMPL`
- `S08-rounding-change/AC3`
- `S08-rounding-change/SC1`
- `S08-rounding-change/SC2`
- `S08-rounding-change/TR1`
- `S08-rounding-change/SC_COMMIT`
- `S08-rounding-change/SC_PUSH`
- `S16-duration-refactor/AC_IMPL`
- `S16-duration-refactor/AC2`
- `S16-duration-refactor/IM1`
- `S16-duration-refactor/GP1`
- `S16-duration-refactor/SC_DATA`
- `S16-duration-refactor/SC_COMMIT`
- `S16-duration-refactor/SC_PUSH`
- `S19-actor-backfill/AC2`
- `S19-actor-backfill/SC_SEED`
- `S19-actor-backfill/RP1`
- `S19-actor-backfill/IM1`
- `S19-actor-backfill/SC_COMMIT`
- `S19-actor-backfill/SC_PUSH`
- `S21-start-unapproved-explicit/AC_IMPL`
- `S21-start-unapproved-explicit/AC2`
- `S21-start-unapproved-explicit/SC1`
- `S21-start-unapproved-explicit/IV1`
- `S21-start-unapproved-explicit/IM1`
- `S21-start-unapproved-explicit/TR1`
- `S21-start-unapproved-explicit/SC_COMMIT`
- `S21-start-unapproved-explicit/SC_PUSH`
- `S15-corrupt-event-line-explicit/AC2`
- `S15-corrupt-event-line-explicit/SC_SEED`
- `S15-corrupt-event-line-explicit/RP1`
- `S15-corrupt-event-line-explicit/SC_COMMIT`
- `S15-corrupt-event-line-explicit/SC_PUSH`
- `S02-increment-validation/SC1`
- `S02-increment-validation/SC2`
- `S02-increment-validation/SC3`
- `S02-increment-validation/AC1`
- `S02-increment-validation/AC0`
- `S02-increment-validation/AC_IMPL`
- `S02-increment-validation/AC2`
- `S02-increment-validation/AC3`
- `S02-increment-validation/IM1`
- `S02-increment-validation/TR1`
- `S02-increment-validation/GP1`
- `S02-increment-validation/FL1`
- `S02-increment-validation/SC_COMMIT`
- `S02-increment-validation/SC_PUSH`
- `S14-corrupt-event-line/AC2`
- `S14-corrupt-event-line/RP1`
- `S14-corrupt-event-line/SC_COMMIT`
- `S14-corrupt-event-line/SC_PUSH`
- `S07-weekly-quota/AC1`
- `S07-weekly-quota/AC2`
- `S07-weekly-quota/AC3`
- `S07-weekly-quota/AC_IMPL`
- `S07-weekly-quota/AC5`
- `S07-weekly-quota/AC6`
- `S07-weekly-quota/IM1`
- `S07-weekly-quota/TR1`
- `S07-weekly-quota/SC_COMMIT`
- `S07-weekly-quota/SC_PUSH`
- `S12-approval-timeout/AC_IMPL`
- `S12-approval-timeout/AC2`
- `S12-approval-timeout/SC1`
- `S12-approval-timeout/SC_DATA`
- `S12-approval-timeout/SC_DOCS`
- `S12-approval-timeout/IM1`
- `S12-approval-timeout/TR1`
- `S12-approval-timeout/SC_COMMIT`
- `S12-approval-timeout/SC_PUSH`
- `S06-per-booking-quota/AC1`
- `S06-per-booking-quota/AC2`
- `S06-per-booking-quota/AC3`
- `S06-per-booking-quota/AC4`
- `S06-per-booking-quota/AC_IMPL`
- `S06-per-booking-quota/AC5`
- `S06-per-booking-quota/AC6`
- `S06-per-booking-quota/SC1`
- `S06-per-booking-quota/IM1`
- `S06-per-booking-quota/TR1`
- `S06-per-booking-quota/SC_COMMIT`
- `S06-per-booking-quota/SC_PUSH`
- `S01-history-endpoint/SC2`
- `S01-history-endpoint/AC1`
- `S01-history-endpoint/AC_IMPL`
- `S01-history-endpoint/AC2`
- `S01-history-endpoint/IM1`
- `S01-history-endpoint/TR1`
- `S01-history-endpoint/SC_COMMIT`
- `S01-history-endpoint/SC_PUSH`
- `S11-week-boundary/FL3`
- `S11-week-boundary/AC1`
- `S11-week-boundary/AC_IMPL`
- `S11-week-boundary/AC2`
- `S11-week-boundary/SC1`
- `S11-week-boundary/SC2`
- `S11-week-boundary/IM1`
- `S11-week-boundary/TR1`
- `S11-week-boundary/SC_COMMIT`
- `S11-week-boundary/SC_PUSH`
- `S04-noshow-status/GP1`
- `S04-noshow-status/SC2`
- `S04-noshow-status/AC1`
- `S04-noshow-status/TR1`
- `S04-noshow-status/SC_COMMIT`
- `S04-noshow-status/SC_PUSH`
- `S03-error-format/SC1`
- `S03-error-format/SC2`
- `S03-error-format/AC2`
- `S03-error-format/AC_IMPL`
- `S03-error-format/AC3`
- `S03-error-format/IM1`
- `S03-error-format/TR1`
- `S03-error-format/R1`
- `S03-error-format/SC_PUSH`
- `S22-reject-reason-only/AC_IMPL`
- `S22-reject-reason-only/AC2`
- `S22-reject-reason-only/SC1`
- `S22-reject-reason-only/GP1`
- `S22-reject-reason-only/FL1`
- `S22-reject-reason-only/IM1`
- `S22-reject-reason-only/TR1`
- `S22-reject-reason-only/SC_COMMIT`
- `S22-reject-reason-only/SC_PUSH`
- `S13-self-approval/AC_IMPL`
- `S13-self-approval/AC2`
- `S13-self-approval/SC1`
- `S13-self-approval/FL1`
- `S13-self-approval/IM1`
- `S13-self-approval/TR1`
- `S13-self-approval/SC_COMMIT`
- `S13-self-approval/SC_PUSH`
- `S18-availability-rejected/AC_IMPL`
- `S18-availability-rejected/AC2`
- `S18-availability-rejected/SC1`
- `S18-availability-rejected/GP1`
- `S18-availability-rejected/GP2`
- `S18-availability-rejected/IM1`
- `S18-availability-rejected/SC_COMMIT`
- `S18-availability-rejected/SC_PUSH`

> ถ้ากฎผ่าน 100% ทุก arm แปลว่าง่ายเกินไป; ถ้าตก 100% ทุก arm แปลว่ายากเกินไปหรือ checker เขียนผิด
> ทั้งสองกรณีทำให้กฎนั้นไม่มีค่าทางสถิติ ควรแก้หรือตัดทิ้งก่อนเก็บข้อมูลจริง

## ชุดที่ 3 — ผลรองที่ประกาศไว้ล่วงหน้า

### one-shot RCRc — ผลแบบรอบเดียว (ภาพ ณ จบรอบแรก)

| A2 | A1 | ผลต่างเฉลี่ยรายโจทย์ | CI 95% (sign-flip) | ชนะ/แพ้/เสมอ | k | p |
|---:|---:|---:|---|---|---:|---:|
| 88.5% | 86.1% | 2.4% | [-8.0%, 13.8%] | 5/5/12 | 22 | 0.7402 |

### รอบตอบกลับช่วยแต่ละกลุ่มไปเท่าไร (เชิงพรรณนา)

| arm | run | เสร็จหลังรอบแรก | เสร็จหลังรอบสอง | ไม่เสร็จรอบแรก → เสร็จรอบสอง | เสร็จรอบแรก → พังรอบสอง |
|---|---:|---:|---:|---:|---:|
| A0 | 66 | 61 | 61 | 0/5 | 0 |
| A1 | 66 | 58 | 64 | 7/8 | 1 |
| A2 | 66 | 60 | 66 | 6/6 | 0 |
| A5 | 66 | 55 | 64 | 9/11 | 0 |

### run ที่เอเจนต์เขียน auto-memory (กักเก็บแล้ว · เชิงพรรณนา)

| arm | run | เขียน memory |
|---|---:|---:|
| A0 | 66 | 0 |
| A1 | 66 | 0 |
| A2 | 66 | 2 |
| A5 | 66 | 1 |

### ผลรองหลัก — A2 เทียบ A5 (RCRc)

> fixed-sequence: ทดสอบที่ alpha เฉพาะเมื่อผลหลักต่างอย่างมีนัยสำคัญ · ผลหลักรอบนี้ ไม่ผ่าน จึงรายงานเป็นค่าประมาณเท่านั้น

| A2 | A5 | p | CI 95% | CI 90% | ชนะ/แพ้/เสมอ | ผลตามตาราง |
|---:|---:|---:|---|---|---|---|
| 97.2% | 95.2% | 0.4688 | [-2.3%, 6.9%] | [-2.0%, 6.0%] | 3/3/16 | not_tested |
