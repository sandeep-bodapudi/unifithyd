-- AlterTable
ALTER TABLE `booking` ADD COLUMN `freeCancel` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `logincode` ADD COLUMN `purpose` VARCHAR(191) NOT NULL DEFAULT 'login';
