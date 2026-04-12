import { authOptions } from "@/api-server/hive/sso";
import NextAuth from "next-auth";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
