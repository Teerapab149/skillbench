-- migration ที่ deploy ไป production แล้ว (มีข้อมูลลูกค้าจริงอยู่ข้างใน)
-- ห้ามลบ ห้าม reset — ต้องสร้าง migration ใหม่ต่อท้ายเท่านั้น
CREATE TABLE "User" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "name"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Order" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "total"     DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
