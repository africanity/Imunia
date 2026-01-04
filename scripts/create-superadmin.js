require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prismaClient");

const SALT_ROUNDS = 10;

async function createSuperAdmin() {
  const args = process.argv.slice(2);
  
  if (args.length < 4) {
    console.error("Usage: node scripts/create-superadmin.js <firstName> <lastName> <email> <password> [phone]");
    console.error("Example: node scripts/create-superadmin.js Admin Super admin@example.com password123 +221771234567");
    process.exit(1);
  }

  const [firstName, lastName, email, password, phone = "+221771234567"] = args;

  try {
    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.error(`❌ Erreur: Un utilisateur avec l'email ${email} existe déjà.`);
      process.exit(1);
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Créer l'utilisateur superadmin
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        password: hashedPassword,
        role: "SUPERADMIN",
        isActive: true,
        emailVerified: true,
      },
    });

    console.log("✅ Superadmin créé avec succès !");
    console.log(`   ID: ${user.id}`);
    console.log(`   Nom: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Rôle: ${user.role}`);
    console.log(`   Actif: ${user.isActive}`);
    console.log(`\n   Vous pouvez maintenant vous connecter avec:`);
    console.log(`   Email: ${email}`);
    console.log(`   Mot de passe: ${password}`);
  } catch (error) {
    console.error("❌ Erreur lors de la création du superadmin:", error.message);
    if (error.code === "P2002") {
      console.error("   Un utilisateur avec cet email ou ce téléphone existe déjà.");
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();

