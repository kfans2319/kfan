-- Create BankType enum
CREATE TYPE "BankType" AS ENUM ('DOMESTIC', 'INTERNATIONAL');

-- Alter table bank_information to add new fields for international banks
ALTER TABLE "bank_information" ADD COLUMN "bankType" "BankType" NOT NULL DEFAULT 'DOMESTIC';
ALTER TABLE "bank_information" ALTER COLUMN "routingNumber" DROP NOT NULL;

-- Add international bank fields
ALTER TABLE "bank_information" ADD COLUMN "swiftCode" TEXT;
ALTER TABLE "bank_information" ADD COLUMN "iban" TEXT;
ALTER TABLE "bank_information" ADD COLUMN "bankAddress" TEXT;
ALTER TABLE "bank_information" ADD COLUMN "accountHolderAddress" TEXT;
ALTER TABLE "bank_information" ADD COLUMN "intermediaryBankName" TEXT;
ALTER TABLE "bank_information" ADD COLUMN "intermediaryBankSwiftCode" TEXT; 