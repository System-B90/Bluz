import React from 'react';

export default async function ScheduleLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="schedule-layout">
            {children}
        </div>
    );
}

