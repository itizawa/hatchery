-- Migration: add channel goal output contract (#284 / ADR-0016)
-- Adds goalType (AI output kind) and goalInstructions (optional prompt instructions) to Channel.
-- Existing rows are mapped: planning -> issue, others -> chat.

-- CreateEnum
CREATE TYPE "ChannelGoalType" AS ENUM ('chat', 'issue');

-- AlterTable: add goalType with default=chat, then update planning->issue
ALTER TABLE "Channel" ADD COLUMN "goalType" "ChannelGoalType" NOT NULL DEFAULT 'chat';
ALTER TABLE "Channel" ADD COLUMN "goalInstructions" TEXT;

-- Migrate existing planning channels to goal=issue
UPDATE "Channel" SET "goalType" = 'issue' WHERE "type" = 'planning';
