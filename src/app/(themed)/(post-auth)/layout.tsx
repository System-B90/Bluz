import { AuthProvider } from "@/components/auth-provider";
import { headers } from "next/headers";

export default async function PostAuthLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    const headersList = await headers();
    const username = headersList.get('x-authenticated-user') || 'Guest';

    return (
        <AuthProvider username={ username }>
            { children }
        </AuthProvider>
    );
}

