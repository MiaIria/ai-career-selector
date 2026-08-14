import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  console.log(JSON.stringify({
    userCount: await prisma.user.count(),
    profileCount: await prisma.studentProfile.count(),
    decisionSupportCacheCount: await prisma.decisionSupportCache.count(),
    simulationSnapshotCount: await prisma.pathSimulationSnapshot.count(),
    decisionCount: await prisma.decisionRecord.count(),
    stagePlanCount: await prisma.stagePlan.count(),
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
