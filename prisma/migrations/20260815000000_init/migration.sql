-- Baseline schema for Neon PostgreSQL production deployments.
-- The first Neon instance was initialized before Prisma migrations existed;
-- it is marked as applied after its empty schema is aligned with this file.

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DecisionSupportCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "profileFingerprint" TEXT NOT NULL,
    "simulations" JSONB NOT NULL,
    "generationMode" TEXT NOT NULL,
    "decisionSupport" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionSupportCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PathSimulationSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "simulations" JSONB NOT NULL,
    "generationMode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PathSimulationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "school" TEXT,
    "major" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "academicStanding" TEXT,
    "interests" JSONB NOT NULL,
    "skills" JSONB NOT NULL,
    "experiences" JSONB NOT NULL,
    "values" JSONB NOT NULL,
    "targetCities" JSONB NOT NULL,
    "weeklyHours" INTEGER NOT NULL,
    "monthlyBudget" INTEGER NOT NULL,
    "constraints" JSONB NOT NULL,
    "selfStatements" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "initialClarityScore" INTEGER,
    "contradictions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DecisionRecord" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedTrack" TEXT NOT NULL,
    "selectedSubtrack" TEXT NOT NULL,
    "aiRanking" JSONB NOT NULL,
    "comparison" JSONB NOT NULL,
    "userReason" TEXT,
    "clarityScoreAfter" INTEGER,
    "committedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StagePlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mainPath" TEXT NOT NULL,
    "sidePath" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StagePlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "DecisionSupportCache_userId_key" ON "DecisionSupportCache"("userId");
CREATE UNIQUE INDEX "PathSimulationSnapshot_userId_key" ON "PathSimulationSnapshot"("userId");
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");
CREATE UNIQUE INDEX "DecisionRecord_requestId_key" ON "DecisionRecord"("requestId");
CREATE UNIQUE INDEX "DecisionRecord_userId_key" ON "DecisionRecord"("userId");
CREATE UNIQUE INDEX "StagePlan_userId_key" ON "StagePlan"("userId");

ALTER TABLE "DecisionSupportCache" ADD CONSTRAINT "DecisionSupportCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PathSimulationSnapshot" ADD CONSTRAINT "PathSimulationSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DecisionRecord" ADD CONSTRAINT "DecisionRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StagePlan" ADD CONSTRAINT "StagePlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
