-- AlterTable
ALTER TABLE `Booking` ADD COLUMN `freeCancel` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `LoginCode` ADD COLUMN `purpose` VARCHAR(191) NOT NULL DEFAULT 'login';
