const prisma = require("../config/prismaClient");

const prismaMiddleware = (req, _res, next) => {
  req.prisma = prisma;
  next();
};

module.exports = prismaMiddleware;












