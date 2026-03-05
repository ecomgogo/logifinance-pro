-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "payable_amount" DECIMAL(15,4),
ADD COLUMN     "receivable_amount" DECIMAL(15,4),
ADD COLUMN     "remark" TEXT;
