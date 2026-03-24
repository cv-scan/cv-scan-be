-- CreateEnum
CREATE TYPE "CandidateClassification" AS ENUM ('PASS', 'WAITLIST', 'FAIL');

-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "classification" "CandidateClassification";
