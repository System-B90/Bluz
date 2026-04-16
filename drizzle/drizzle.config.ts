import
{
  defineConfig
} from "drizzle-kit";

export defineConfig({
  schema: "./ui/src/api-server/curriculum/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    password: process.env.POSTGRES_PASSWORD!,
  },
});
