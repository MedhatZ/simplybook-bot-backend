const app = require("./app");

// Validate required environment variables on startup
const requiredEnvVars = [
  "SIMPLYBOOK_BASE_URL",
  "SIMPLYBOOK_COMPANY",
  "SIMPLYBOOK_API_KEY"
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(
    `FATAL: Missing required environment variables:\n${missingVars.map(v => `  - ${v}`).join("\n")}\n\n` +
    `Please define these in your .env file or environment.`
  );
  process.exit(1);
}

// Optional timezone variable with fallback
if (!process.env.SALON_TIMEZONE) {
  console.warn("WARN: SALON_TIMEZONE not set, defaulting to Asia/Singapore");
}

if (!process.env.SALON_UTC_OFFSET_MINUTES) {
  console.warn("WARN: SALON_UTC_OFFSET_MINUTES not set, defaulting to 480 (UTC+8)");
}

if (!process.env.MIN_RESCHEDULE_HOURS) {
  console.warn("WARN: MIN_RESCHEDULE_HOURS not set, defaulting to 24 hours");
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});