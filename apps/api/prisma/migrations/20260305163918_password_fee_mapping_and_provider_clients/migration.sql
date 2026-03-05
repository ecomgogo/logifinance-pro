-- CreateTable
CREATE TABLE "logistics_fee_code_mappings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "external_fee_code" TEXT NOT NULL,
    "internal_fee_code" TEXT NOT NULL,
    "default_ar_ap_type" "ar_ap_type" NOT NULL DEFAULT 'AP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logistics_fee_code_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logistics_fee_code_mappings_tenant_id_provider_id_idx" ON "logistics_fee_code_mappings"("tenant_id", "provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "logistics_fee_code_mappings_tenant_id_provider_id_external__key" ON "logistics_fee_code_mappings"("tenant_id", "provider_id", "external_fee_code");

-- AddForeignKey
ALTER TABLE "logistics_fee_code_mappings" ADD CONSTRAINT "logistics_fee_code_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logistics_fee_code_mappings" ADD CONSTRAINT "logistics_fee_code_mappings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "logistics_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
