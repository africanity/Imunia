-- CreateTable
CREATE TABLE "StockNATIONAL" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "StockNATIONAL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockREGIONAL" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "StockREGIONAL_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockDISTRICT" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "StockDISTRICT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockHEALTHCENTER" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "StockHEALTHCENTER_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockNATIONAL_vaccineId_key" ON "StockNATIONAL"("vaccineId");

-- CreateIndex
CREATE UNIQUE INDEX "StockREGIONAL_vaccineId_key" ON "StockREGIONAL"("vaccineId");

-- CreateIndex
CREATE UNIQUE INDEX "StockDISTRICT_vaccineId_key" ON "StockDISTRICT"("vaccineId");

-- CreateIndex
CREATE UNIQUE INDEX "StockHEALTHCENTER_vaccineId_key" ON "StockHEALTHCENTER"("vaccineId");

-- AddForeignKey
ALTER TABLE "StockNATIONAL" ADD CONSTRAINT "StockNATIONAL_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockREGIONAL" ADD CONSTRAINT "StockREGIONAL_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDISTRICT" ADD CONSTRAINT "StockDISTRICT_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockHEALTHCENTER" ADD CONSTRAINT "StockHEALTHCENTER_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "Vaccine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
