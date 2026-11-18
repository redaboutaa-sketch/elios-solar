import "dotenv/config";
if (process.env.DATABASE_URL_TEST) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.MAIL_PROVIDER = "log";
process.env.DEMO_PAYMENT_WEBHOOK_SECRET = process.env.DEMO_PAYMENT_WEBHOOK_SECRET || "test-secret";
