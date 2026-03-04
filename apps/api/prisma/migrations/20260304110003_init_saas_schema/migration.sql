-- CreateEnum
CREATE TYPE "partner_type" AS ENUM ('Customer', 'Vendor', 'Agent');

-- CreateEnum
CREATE TYPE "ar_ap_type" AS ENUM ('AR', 'AP');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('BOSS', 'SALES');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "base_currency" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "commission_rate" DECIMAL(15,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_partners" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "partner_type" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "internal_no" TEXT NOT NULL,
    "mbl_number" TEXT,
    "hbl_number" TEXT,
    "type" TEXT NOT NULL,
    "sales_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charges" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "shipment_id" UUID,
    "partner_id" UUID NOT NULL,
    "ar_ap_type" "ar_ap_type" NOT NULL,
    "fee_code" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(15,4) NOT NULL,
    "exchange_rate" DECIMAL(15,6) NOT NULL,
    "base_amount" DECIMAL(15,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "paid_amount" DECIMAL(15,4) NOT NULL,
    "payment_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "shipments_tenant_id_sales_id_idx" ON "shipments"("tenant_id", "sales_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_tenant_id_internal_no_key" ON "shipments"("tenant_id", "internal_no");

-- CreateIndex
CREATE INDEX "charges_tenant_id_shipment_id_idx" ON "charges"("tenant_id", "shipment_id");

-- CreateIndex
CREATE INDEX "charges_tenant_id_partner_id_idx" ON "charges"("tenant_id", "partner_id");

-- CreateIndex
CREATE INDEX "settlements_tenant_id_charge_id_idx" ON "settlements"("tenant_id", "charge_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_partners" ADD CONSTRAINT "business_partners_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "business_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
