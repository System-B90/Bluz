import NextAuth from "next-auth";

import { authOptions } from "@/api-server/hive/sso";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
