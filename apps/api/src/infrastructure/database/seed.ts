import { db } from "./db";
import { businessVerticals, roles, users } from "@atlasmed/database";
import { eq, or } from "drizzle-orm";
import { hash } from "argon2";
import { ROLE_PRIORITY_BY_NAME } from "../../modules/access/application/constants/role-priority.constants";
import { syncPriorityFacilityServices } from "../../modules/facility/application/services/priority-facility-services.sync";

interface SeedConfig {
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
  adminFirstName?: string;
  adminLastName?: string;
}

interface OpsUserConfig {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/** Ensure catalog verticals exist on fresh local seeds (migrations are source of truth in shared envs). */
async function ensureBusinessVerticals() {
  console.log("\n🏷️  Ensuring business verticals...");

  // Adjective form ("linha ortopédica") — distinct from clinic specialty nouns.
  const defs = [
    { id: "bv_ortopedia_p0", code: "ORTOPEDIA", name: "Ortopédica" },
    { id: "bv_dermatologia_p1", code: "DERMATOLOGIA", name: "Dermatológica" },
  ] as const;

  for (const def of defs) {
    const existing = await db
      .select({ id: businessVerticals.id, name: businessVerticals.name })
      .from(businessVerticals)
      .where(eq(businessVerticals.code, def.code))
      .limit(1);
    if (existing[0]) {
      if (existing[0].name !== def.name) {
        await db
          .update(businessVerticals)
          .set({ name: def.name, updatedAt: new Date() })
          .where(eq(businessVerticals.id, existing[0].id));
        console.log(
          `   ✓ Vertical "${def.code}" renamed → ${def.name}`,
        );
      } else {
        console.log(`   ✓ Vertical "${def.code}" already present`);
      }
      continue;
    }
    await db.insert(businessVerticals).values({
      id: def.id,
      code: def.code,
      name: def.name,
      isActive: true,
    });
    console.log(`   ✓ Created vertical "${def.code}" (${def.name})`);
  }
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
      description: "Can manage facilities, territories, and users within their scope",
      priority: ROLE_PRIORITY_BY_NAME.MANAGER,
    },
    {
      name: "OPS",
      description: "Operations team — read access to facilities and registry data",
      priority: ROLE_PRIORITY_BY_NAME.OPS,
    },
    {
      name: "REP",
      description: "Field representative — can view assigned facilities and log visits",
      priority: ROLE_PRIORITY_BY_NAME.REP,
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

async function createOpsUser(config: OpsUserConfig) {
  console.log("\n👤 Creating OPS seed user...");

  const existingOps = await db.query.users.findFirst({
    where: or(eq(users.email, config.email), eq(users.username, config.username)),
  });

  if (existingOps) {
    console.log(`   ⚠️  OPS user already exists`);
    console.log(`      Email: ${existingOps.email}`);
    console.log(`      Username: ${existingOps.username}`);
    return;
  }

  const opsRole = await db.query.roles.findFirst({
    where: eq(roles.name, "OPS"),
  });

  if (!opsRole) {
    throw new Error("OPS role not found. Run createRoles first.");
  }

  const passwordHash = await hash(config.password);

  const [ops] = await db
    .insert(users)
    .values({
      email: config.email,
      username: config.username,
      passwordHash,
      firstName: config.firstName ?? null,
      lastName: config.lastName ?? null,
      roleId: opsRole.id,
      status: "ACTIVE",
      emailVerified: true,
    })
    .returning();

  console.log("   ✓ Created OPS seed user:");
  console.log(`      Email: ${ops!.email}`);
  console.log(`      Username: ${ops!.username}`);
  console.log(`      Role: ${opsRole.name}`);
}

async function seed() {
  try {
    console.log("\n🌱 Starting database seed...\n");

    await createRoles();
    await ensureBusinessVerticals();

    console.log("\n🏥 Syncing priority specialty services…");
    const specialtySync = await syncPriorityFacilityServices(db);
    console.log(
      `   ✓ services=${specialtySync.servicesUpserted} links=${specialtySync.linksInserted} removed=${specialtySync.linksRemoved}`,
    );

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

    if (process.env.NODE_ENV !== "production") {
      const opsConfig: OpsUserConfig = {
        email: process.env.SEED_OPS_EMAIL || "ops@atlasmed.com",
        username: process.env.SEED_OPS_USERNAME || "ops",
        password: process.env.SEED_OPS_PASSWORD || "ops123456",
        firstName: process.env.SEED_OPS_FIRST_NAME || "Ops",
        lastName: process.env.SEED_OPS_LAST_NAME || "User",
      };

      await createOpsUser(opsConfig);
    }

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
