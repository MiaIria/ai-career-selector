-- The initial baseline was registered before the Feishu token fields were removed.
-- IF EXISTS keeps this forward migration safe for the already-clean Neon database
-- while ensuring newly initialized databases match the current Prisma schema.
ALTER TABLE "User"
    DROP COLUMN IF EXISTS "accessToken",
    DROP COLUMN IF EXISTS "refreshToken",
    DROP COLUMN IF EXISTS "tokenExpiresAt";
