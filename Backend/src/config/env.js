import dotenv from "dotenv";

dotenv.config();

const required = ["MONGO_URI", "JWT_SECRET", "GOOGLE_API_KEY"];

const missing = required.filter((element) => !process.env[element]);

if (missing.length) {
  console.error(`Missing .env variables: ${missing.join(", ")}`);
  process.exit(1);
}

const env = {
  port: Number(process.env.PORT) || 5000,
  expiry: process.env.JWT_EXPIRES_IN || "7d",
  geminiApiKey: process.env.GOOGLE_API_KEY,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  // jwtExpiresIn: process.env.JWT_SECRET,
  nodeEnv: process.env.NODE_ENV || "development",
  isPro: process.env.NODE_ENV === "production",
  cookieName: process.env.COOKIE_NAME,
};

export default env;
