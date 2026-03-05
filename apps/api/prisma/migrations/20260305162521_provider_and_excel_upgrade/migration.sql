/*
  Warnings:

  - A unique constraint covering the columns `[tenant_id,reference_no]` on the table `shipments` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ExternalProvider" AS ENUM ('LOGTT');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('LOGTT', 'DHL', 'FEDEX', 'UPS', 'CUSTOM');

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "charge_weight" DECIMAL(15,3),
ADD COLUMN     "gross_weight" DECIMAL(15,3),
ADD COLUMN     "reference_no" TEXT,
ADD COLUMN     "shipping_method_code" TEXT,
ADD COLUMN     "volume_weight" DECIMAL(15,3);

-- CreateTable
CREATE TABLE "tenant_api_credentials" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "app_token" TEXT NOT NULL,
    "app_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_api_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logistics_providers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL,
    "is_builtin" BOOLEAN NOT NULL DEFAULT false,
    "app_token" TEXT,
    "app_key" TEXT,
    "webhook_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logistics_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_api_credentials_tenant_id_provider_is_active_idx" ON "tenant_api_credentials"("tenant_id", "provider", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_api_credentials_tenant_id_provider_key" ON "tenant_api_credentials"("tenant_id", "provider");

-- CreateIndex
CREATE INDEX "logistics_providers_tenant_id_type_is_active_idx" ON "logistics_providers"("tenant_id", "type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_providers_tenant_id_code_key" ON "logistics_providers"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "shipments_tenant_id_mbl_number_idx" ON "shipments"("tenant_id", "mbl_number");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_tenant_id_reference_no_key" ON "shipments"("tenant_id", "reference_no");

-- AddForeignKey
ALTER TABLE "tenant_api_credentials" ADD CONSTRAINT "tenant_api_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_providers" ADD CONSTRAINT "logistics_providers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
