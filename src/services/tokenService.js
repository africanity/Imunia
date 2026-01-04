const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "7d";
const ACTIVATION_TTL = 60 * 60 * 24; // 24h
const EMAIL_CODE_TTL = 60 * 10; // 10 minutes

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const signAccessToken = (payload) =>
  jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

const verifyAccessToken = (token) =>
  jwt.verify(token, ACCESS_TOKEN_SECRET);

const signRefreshToken = (payload) =>
  jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

const verifyRefreshToken = (token) =>
  jwt.verify(token, REFRESH_TOKEN_SECRET);

const generateActivationToken = () => ({
  token: crypto.randomUUID(),
  expiresAt: new Date(Date.now() + ACTIVATION_TTL * 1000),
});

const generateEmailCode = () => ({
  code: String(Math.floor(100000 + Math.random() * 900000)),
  expiresAt: new Date(Date.now() + EMAIL_CODE_TTL * 1000),
});

const decodeAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch (error) {
    // Token expiré, signature invalide, format incorrect, etc.
    throw new Error("Token invalide");
  }
};

const PASSWORD_RESET_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
const PASSWORD_RESET_TOKEN_TTL = "15m"; // 15 minutes

const generatePasswordResetToken = (userId) => {
  return jwt.sign({ userId, type: "password-reset" }, PASSWORD_RESET_TOKEN_SECRET, {
    expiresIn: PASSWORD_RESET_TOKEN_TTL,
  });
};

const verifyPasswordResetToken = (token) => {
  try {
    const decoded = jwt.verify(token, PASSWORD_RESET_TOKEN_SECRET);
    if (decoded.type !== "password-reset") {
      throw new Error("Token invalide");
    }
    return decoded;
  } catch (error) {
    throw new Error("Token invalide ou expiré");
  }
};

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateActivationToken,
  generateEmailCode,
  decodeAccessToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
};