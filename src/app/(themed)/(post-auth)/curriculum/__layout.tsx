import React from 'react';

export default async function CurriculumLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (
        { children }
    );
}
