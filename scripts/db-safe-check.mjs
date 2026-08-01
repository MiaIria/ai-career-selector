import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const users = await prisma.user.findMany({
    select: { accessToken: true, refreshToken: true, tokenExpiresAt: true },
  });
  const encrypted = (value) =>
    typeof value === "string" &&
    value.split(".").length === 3 &&
    !value.includes("Bearer ");

  console.log(JSON.stringify({
    userCount: users.length,
    exactlyOneUser: users.length === 1,
    accessTokenPresent: users.every((user) => Boolean(user.accessToken)),
    accessTokenEncryptedFormat: users.every((user) => encrypted(user.accessToken)),
    refreshTokenEncryptedOrAbsent: users.every(
      (user) => !user.refreshToken || encrypted(user.refreshToken),
    ),
    tokenExpiryPresent: users.every((user) => Boolean(user.tokenExpiresAt)),
    profileCount: await prisma.studentProfile.count(),
    simulationCount: await prisma.pathSimulation.count(),
    decisionCount: await prisma.decisionRecord.count(),
    planCount: await prisma.monthlyPlan.count(),
    taskCount: await prisma.task.count(),
    reviewCount: await prisma.weeklyReview.count(),
    feishuResourceCount: await prisma.feishuResource.count(),
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
