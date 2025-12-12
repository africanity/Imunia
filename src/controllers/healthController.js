const prisma = require("../config/prismaClient");

const check = async (req, res, next) => {
  const client = req.prisma || prisma;
  try {
    await client.$queryRaw`SELECT 1`;
    res.json({ status: "healthy" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  check,
};

