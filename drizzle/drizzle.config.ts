import
  {
    defineConfig
  } from "drizzle-kit";

export default defineConfig({
  schema: "./ui/src/api-server/gantt/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    password: process.env.POSTGRES_PASSWORD!,
  },
});
