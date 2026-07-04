import "dotenv/config";
import { hash } from "bcryptjs";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_EMAIL;
  const password = process.env.SEED_PASSWORD;
  const name = process.env.SEED_NAME ?? "Talal";

  if (!email || !password) {
    throw new Error("SEED_EMAIL and SEED_PASSWORD must be set in .env");
  }

  const hashed = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, password: hashed, name },
    update: { password: hashed, name },
  });

  console.log(`✓ User seeded: ${user.email} (${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
