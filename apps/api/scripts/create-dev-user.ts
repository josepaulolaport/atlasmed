import "dotenv/config";
import { hash } from "argon2";
import { prisma } from "../src/infrastructure/database/prisma.client";

const email = process.argv[2] ?? "jlaport592@gmail.com";
const password = process.argv[3] ?? "abc12345";
const username = email.split("@")[0] ?? "jlaport";

async function main() {
  const role = await prisma.role.findUnique({ where: { name: "USER" } });
  if (!role) {
    throw new Error("USER role not found. Run db seed first.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: await hash(password),
        status: "ACTIVE",
        emailVerified: true,
      },
    });
    console.log(`Updated existing user ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      username,
      passwordHash: await hash(password),
      firstName: "Jose",
      lastName: "Laport",
      roleId: role.id,
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  console.log(`Created user ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
