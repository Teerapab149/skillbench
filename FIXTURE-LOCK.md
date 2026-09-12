# ล็อก fixture ข้ามโปรเซส

เครื่องมือหลายตัวใช้ fixture เดียวกันและสั่ง `git reset --hard`, `git checkout -- .`
หรือ `git clean -fd` ก่อนทำงาน ถ้ารันชนกัน ตัวหนึ่งลบงานของอีกตัวได้โดยทั้งคู่ยังจบ
ด้วย exit code 0 ทำให้ run ถูกให้คะแนนจากหลักฐานที่หายไปอย่างเงียบ ๆ

`tests/fixture-lock.test.mjs` มี reproduction ด้วย git repo ชั่วคราว: กรณีไม่มีล็อก
ไฟล์ของ runner หายจริง และกรณีมีล็อก checker ถูกปฏิเสธด้วย exit code 4

## protocol ปัจจุบัน

`src/fixture-lock.mjs` ใช้ **directory ownership + immutable retirement tombstone**:

1. ผู้ขอยึดเขียน `owner.json` ให้ครบใน staging directory ชื่อ UUID ของตัวเอง
2. publish ด้วย `rename(staging, lock)` ไปยัง path ที่ยังไม่มีอยู่ ซึ่งเป็นการเปลี่ยนสถานะ
   แบบ atomic; ไม่มีช่วงที่คนอื่นอ่าน owner record ครึ่งไฟล์
3. ทุกทางที่เอา owner ออก—release ปกติ, auto-reclaim, `--break`, และ `--force`—
   ย้าย lock directory ไปยัง retirement path ที่คำนวณจาก token ของ owner ที่อ่านไว้
4. retirement directory **ไม่ถูกลบ** เพราะมันเป็น tombstone ของ owner นั้น ถ้า reclaimer
   ที่อ่าน owner เก่าไว้ช้ากว่าคนอื่น และมี owner ใหม่ publish เข้ามาแล้ว การ rename ของ
   ตัวที่ช้าจะชน tombstone เก่าที่มีข้อมูลอยู่และล้ม แทนที่จะย้าย owner ใหม่ออก

ไม่มี `.breaker` หรือ coordinator lock อีกชั้นที่ตายแล้วต้องหา lock มาครอบเพื่อกู้มัน
ถ้า reclaimer ถูก kill ก่อน rename ล็อกเก่ายังอยู่; ถ้าถูก kill หลัง rename lock path ว่าง
และ owner ใหม่ publish ได้ทันที ส่วน staging ที่ค้างและ tombstone เป็นชื่อ UUID/token
เฉพาะตัวและไม่ขวาง lock path

### identity และการตรวจเจ้าของ

lock key มาจาก `realpath` พร้อม `dev`/`ino` ของ fixture และเก็บใน
`os.tmpdir()/skillbench-fixture-locks-v2` ไม่ได้ผูกกับตำแหน่งของโมดูลที่ import
ดังนั้นโมดูลคนละ copy/worktree ที่รับ fixture จริงอันเดียวกันจะชน lock เดียวกัน และ
path alias ที่ resolve ไป directory เดียวกันไม่สร้าง lock แยก

owner record เก็บ canonical fixture identity ซ้ำไว้บนดิสก์ `inspectLock()` จะยอมใช้ pid
ตัดสิน stale ต่อเมื่อ schema, token ที่เป็น UUID และ identity ตรงทั้งหมด
`isFixtureLockHeld()` และ
`assertFixtureLockHeld()` ก็อ่าน owner บนดิสก์และเทียบทั้ง token, fixture identity และ
disk identity (`dev`/`ino`/birth time) ของ lock directory จริง ไม่เชื่อเพียง held map
ในหน่วยความจำ และไม่ยอมรับ directory ใหม่ที่ copy token เก่ามาใส่

owner ที่ hostname เดียวกันและ pid ยังอยู่ **ไม่หมดอายุด้วยเวลา** ไม่ว่า run จะนานเท่าไร
`EPERM` จากการ probe pid นับว่ายังอยู่ ล็อกจากเครื่องอื่นหรือข้อมูลที่พิสูจน์ไม่ได้จะ
fail closed

## ทางเข้าที่ต่อล็อกแล้ว

| ทางเข้า | ขอบเขตการถือ |
|---|---|
| `src/runner.mjs` | ยึดทุก fixture ของ scenario ก่อน snapshot/validation และถือต่อจนเขียน artifacts, graded, `latest.json`, CSV เสร็จ; ปลดใน `finally` |
| `src/adapters/claude-cli.mjs` | ยึดซ้อนรอบ run ตั้งแต่ก่อนติดตั้ง arm ถึงหลังเก็บ artifact |
| `src/check-arms.mjs` | ทั้งโปรเซส |
| `scripts/check-acceptance*.mjs` | ทั้งโปรเซส |
| `scripts/dump-arm.mjs`, `scripts/make-arms-explained.mjs`, `scripts/probe-runtime.mjs` | ทั้งโปรเซส |
| `scripts/setup-fixtures.mjs` | ทีละ fixture ใน loop |

`resetToBaseline()` ใน `src/install-arm.mjs` เป็นด่านล่างสุดและโยน error ก่อนลบอะไร
ถ้าผู้เรียกไม่ได้เป็น owner จริงบนดิสก์ การยึดซ้อนในโปรเซสเดียวกันรองรับ runner ชั้นนอก
กับ adapter ชั้นใน โดยปลด lock จริงเมื่อ depth สุดท้ายจบเท่านั้น

## คำสั่ง

```text
npm run lock                       # ดู owner ของ fixtures/gpu-booking
npm run lock:break                 # แกะเมื่อ owner บนเครื่องนี้ตายแล้วเท่านั้น
node scripts/fixture-lock.mjs --break --force
                                   # ข้าม liveness แต่ยังผูกการย้ายกับ owner token ที่อ่านไว้
```

`--force` มีไว้ให้คนตัดสินใจกรณี pid ถูก reuse, lock ข้ามเครื่อง หรือ metadata เสีย
มันไม่ใช่ “unlink path ปัจจุบัน”: แม้ใช้ force ถ้า owner ถูกแทนระหว่างตรวจ คำสั่งจะ
ปฏิเสธและไม่แตะ replacement owner

## ข้อจำกัดและ recovery boundary

- Node core ไม่มี portable compare-and-unlink และไม่มี advisory file lock API ที่ใช้ได้
  เหมือนกันบน Windows/POSIX จึงต้องเก็บ tombstone เล็ก ๆ ไว้เพื่อปิด replacement race
  ไม่ควรลบ `.retired-*` ระหว่างที่อาจมี process รุ่นเก่ายังค้างอยู่
- staging directory ของ process ที่ถูก kill และ tombstone จะสะสมใน temp directory
  แต่ไม่ขวางการยึด การ cleanup เป็นงานบำรุงรักษาแบบ offline หลังยืนยันว่าไม่มี process
  SkillBench ทำงานอยู่ ไม่ใช่ส่วนหนึ่งของ recovery อัตโนมัติ
- lock **ไฟล์** schema รุ่นเก่า fail closed เพราะไม่มี non-empty directory tombstone
  ที่รับประกัน conditional rename ได้อย่าง portable ต้องหยุด process รุ่นเก่าทั้งหมดและ
  เอาไฟล์เก่าออกใน maintenance window ก่อนใช้ protocol รุ่นนี้; คำสั่ง `--break` จะไม่
  แกล้งอ้างว่าแกะรูปแบบเก่าได้อย่างปลอดภัย
- ตอนเริ่มยึด v2 จะตรวจ path รุ่นเก่าที่ checkout ปัจจุบันเคยใช้
  (`ROOT/.locks/<slug>-<hash-8>.lock`) และปฏิเสธพร้อมข้อความ maintenance window
  ไม่ว่าไฟล์นั้นจะสมบูรณ์, เสีย, pid ยังอยู่ หรือตายแล้ว แต่ rolling upgrade ยังต้องทำ
  แบบ offline: **หยุด process รุ่นเก่าทั้งหมดก่อน** เพราะโค้ดเก่ามองไม่เห็น lock v2 และ
  เราป้องกัน process รุ่นเก่าที่ถูกเปิดขึ้น *ภายหลัง* จากฝั่ง v2 ไม่ได้ นอกจากนี้รุ่นเก่า
  ผูก lock root กับ checkout ของโมดูล จึงไม่เคย coordinate ข้าม worktree ได้อยู่แล้ว
- อ่านสถานะ lock แล้วได้ error อื่นนอกจาก `ENOENT` จะ fail closed; permission/I/O error
  ไม่ถูกแปลว่า “ว่าง” และ rename ที่ล้มทุกกรณีจะอ่าน current lock กับ tombstone ซ้ำ
  รายงาน state แล้วหยุด invocation นั้น ไม่ retry snapshot เก่า
- hostname อื่นตรวจ pid ไม่ได้ การ break ปกติจึงไม่แกะ ต้องยืนยันนอกระบบว่าไม่มี owner
  แล้วจึงใช้ `--force`
- การยึดซ้อนกันได้เฉพาะโค้ด synchronous/serial ใน process เดียว ถ้า runner เปลี่ยนเป็น
  รันหลาย fixture task ขนานใน process เดียว ต้องแยก ownership context แทน depth map
