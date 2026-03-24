/*
  Warnings:

  - You are about to drop the column `department` on the `job_descriptions` table. All the data in the column will be lost.
  - You are about to drop the column `employment_type` on the `job_descriptions` table. All the data in the column will be lost.
  - The `experience_level` column on the `job_descriptions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('INTERN', 'JUNIOR', 'MID_LEVEL', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR');

-- AlterTable
ALTER TABLE "job_descriptions" DROP COLUMN "department",
DROP COLUMN "employment_type",
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "employment_types" "EmploymentType"[],
DROP COLUMN "experience_level",
ADD COLUMN     "experience_level" "ExperienceLevel";

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
