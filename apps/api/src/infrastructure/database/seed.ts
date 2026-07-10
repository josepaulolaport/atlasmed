import { db } from "./db";
import { roles, users } from "@atlasmed/database";
import { eq, or } from "drizzle-orm";
import { hash } from "argon2";
import { ROLE_PRIORITY_BY_NAME } from "../../modules/access/application/constants/role-priority.constants";

interface SeedConfig {
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
  adminFirstName?: string;
  adminLastName?: string;
}

async function createRoles() {
  const roleDefs = [
    {
      name: "ADMIN",
      description: "Full system access - can manage all resources and users",
      priority: ROLE_PRIORITY_BY_NAME.ADMIN,
    },
    {
      name: "MANAGER",
      description: "Can manage clinics, visits, and view users",
      priority: ROLE_PRIORITY_BY_NAME.MANAGER,
    },
    {
      name: "USER",
      description: "Basic access - can view clinics and visits",
      priority: ROLE_PRIORITY_BY_NAME.USER,
    },
  ];

  console.log("📦 Creating roles...");

  for (const role of roleDefs) {
    await db
      .insert(roles)
      .values(role)
      .onConflictDoUpdate({
        target: roles.name,
        set: { description: role.description, priority: role.priority, updatedAt: new Date() },
      });
    console.log(`   ✓ Role "${role.name}" (priority ${role.priority})`);
  }
}

async function createInitialAdmin(config: SeedConfig) {
  console.log("\n👤 Creating initial admin user...");

  const existingAdmin = await db.query.users.findFirst({
    where: or(eq(users.email, config.adminEmail), eq(users.username, config.adminUsername)),
  });

  if (existingAdmin) {
    console.log(`   ⚠️  User already exists with email/username`);
    console.log(`      Email: ${existingAdmin.email}`);
    console.log(`      Username: ${existingAdmin.username}`);
    console.log(`      Status: ${existingAdmin.status}`);
    return;
  }

  const adminRole = await db.query.roles.findFirst({
    where: eq(roles.name, "ADMIN"),
  });

  if (!adminRole) {
    throw new Error("ADMIN role not found. Run createRoles first.");
  }

  const passwordHash = await hash(config.adminPassword);

  const [admin] = await db
    .insert(users)
    .values({
      email: config.adminEmail,
      username: config.adminUsername,
      passwordHash,
      firstName: config.adminFirstName || null,
      lastName: config.adminLastName || null,
      roleId: adminRole.id,
      status: "ACTIVE",
      emailVerified: true,
    })
    .returning();

  console.log("   ✓ Created initial admin user:");
  console.log(`      Email: ${admin!.email}`);
  console.log(`      Username: ${admin!.username}`);
  console.log(`      Role: ${adminRole.name}`);
  console.log(`      Status: ${admin!.status}`);
}

async function seed() {
  try {
    console.log("\n🌱 Starting database seed...\n");

    await createRoles();

    const adminConfig: SeedConfig = {
      adminEmail: process.env.SEED_ADMIN_EMAIL || "admin@atlasmed.com",
      adminUsername: process.env.SEED_ADMIN_USERNAME || "admin",
      adminPassword: process.env.SEED_ADMIN_PASSWORD || "admin123456",
      adminFirstName: process.env.SEED_ADMIN_FIRST_NAME || "System",
      adminLastName: process.env.SEED_ADMIN_LAST_NAME || "Administrator",
    };

    if (
      !adminConfig.adminEmail ||
      !adminConfig.adminUsername ||
      !adminConfig.adminPassword
    ) {
      throw new Error(
        "Missing required environment variables: SEED_ADMIN_EMAIL, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD"
      );
    }

    if (
      process.env.NODE_ENV === "production" &&
      adminConfig.adminPassword === "admin123456"
    ) {
      console.warn(
        "\n⚠️  WARNING: Using default password in production! Set SEED_ADMIN_PASSWORD environment variable.\n"
      );
    }

    await createInitialAdmin(adminConfig);

    console.log("\n✅ Database seed completed successfully!\n");
    console.log("📝 Next steps:");
    console.log("   1. Login with the admin credentials");
    console.log("   2. Create invites for other users");
    console.log("   3. Change the admin password immediately!\n");
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  } finally {
    await db.$client.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
