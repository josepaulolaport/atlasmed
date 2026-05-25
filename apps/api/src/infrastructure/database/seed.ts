import { prisma } from "./prisma.client";
import { hash } from "argon2";

interface SeedConfig {
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
  adminFirstName?: string;
  adminLastName?: string;
}

async function createRoles() {
  const roles = [
    {
      name: "ADMIN",
      description: "Full system access - can manage all resources and users",
    },
    {
      name: "MANAGER",
      description: "Can manage clinics, visits, and view users",
    },
    {
      name: "USER",
      description: "Basic access - can view clinics and visits",
    },
  ];

  console.log("📦 Creating roles...");

  for (const role of roles) {
    const existing = await prisma.role.findUnique({
      where: { name: role.name },
    });

    if (existing) {
      console.log(`   ✓ Role "${role.name}" already exists`);
    } else {
      await prisma.role.create({ data: role });
      console.log(`   ✓ Created role "${role.name}"`);
    }
  }
}

async function createInitialAdmin(config: SeedConfig) {
  console.log("\n👤 Creating initial admin user...");

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: config.adminEmail },
        { username: config.adminUsername },
      ],
    },
  });

  if (existingAdmin) {
    console.log(`   ⚠️  User already exists with email/username`);
    console.log(`      Email: ${existingAdmin.email}`);
    console.log(`      Username: ${existingAdmin.username}`);
    console.log(`      Status: ${existingAdmin.status}`);
    return;
  }

  // Get ADMIN role
  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN" },
  });

  if (!adminRole) {
    throw new Error("ADMIN role not found. Run createRoles first.");
  }

  // Hash password
  const passwordHash = await hash(config.adminPassword);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: config.adminEmail,
      username: config.adminUsername,
      passwordHash,
      firstName: config.adminFirstName || null,
      lastName: config.adminLastName || null,
      roleId: adminRole.id,
      status: "ACTIVE",
      emailVerified: true, // Bootstrap admin is pre-verified
    },
    include: {
      role: true,
    },
  });

  console.log("   ✓ Created initial admin user:");
  console.log(`      Email: ${admin.email}`);
  console.log(`      Username: ${admin.username}`);
  console.log(`      Role: ${admin.role.name}`);
  console.log(`      Status: ${admin.status}`);
}

async function seed() {
  try {
    console.log("\n🌱 Starting database seed...\n");

    // 1. Create roles
    await createRoles();

    // 2. Create initial admin from environment variables
    const adminConfig: SeedConfig = {
      adminEmail: process.env.SEED_ADMIN_EMAIL || "admin@atlasmed.com",
      adminUsername: process.env.SEED_ADMIN_USERNAME || "admin",
      adminPassword: process.env.SEED_ADMIN_PASSWORD || "admin123456",
      adminFirstName: process.env.SEED_ADMIN_FIRST_NAME || "System",
      adminLastName: process.env.SEED_ADMIN_LAST_NAME || "Administrator",
    };

    // Validate required fields
    if (
      !adminConfig.adminEmail ||
      !adminConfig.adminUsername ||
      !adminConfig.adminPassword
    ) {
      throw new Error(
        "Missing required environment variables: SEED_ADMIN_EMAIL, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD"
      );
    }

    // Warn about default password in production
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
    await prisma.$disconnect();
  }
}

// Run seed
seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
