'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage()
{
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-xl ring-1 ring-gray-900/5">

                {/* Header Section */ }
                <div className="text-center">
                    {/* Optional: Add a logo here */ }
                    <div className="mx-auto h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center">
                        <span className="text-white font-bold text-xl">H</span>
                    </div>
                    <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
                        Welcome to Bluz
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Sign in to access the course's calendar
                    </p>
                </div>

                {/* Login Button Section */ }
                <div className="mt-8 space-y-6">
                    <button
                        // 2. Trigger the Hive SSO flow. 
                        // callbackUrl dictates where they go after a successful login.
                        onClick={ () => signIn('hive', { callbackUrl: '/' }) }
                        className="group relative flex w-full justify-center rounded-md bg-indigo-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all duration-200"
                    >
                        Sign in with Hive
                    </button>
                </div>

            </div>
        </div>
    );
}
