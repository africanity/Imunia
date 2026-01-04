const request = require("supertest");
const app = require("../../src/app");
const prisma = require("../../src/config/prismaClient");

describe("DB integration - User", () => {
  beforeAll(async () => {
    // Nettoie les tables (adapté si tu as des FK)
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE;');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("Doit insérer un user en DB (via Prisma direct)", async () => {
    const u = await prisma.user.create({
      data: {
        firstName: "Test",
        lastName: "User",
        email: "test.user@example.com",
        emailVerified: true,
        password: "hash",
        phone: "+221000000000",
        role: "NATIONAL",
        isActive: true,
      },
    });

    expect(u.email).toBe("test.user@example.com");
  });
});
