'use client';

import React from 'react';
import { AuthProvider } from '@/components/auth/auth-provider';

export default function PostAuthLayout({ children }: { children: React.ReactNode; })
{
    return (
        <AuthProvider>
            { children }
        </AuthProvider>
    );
}
