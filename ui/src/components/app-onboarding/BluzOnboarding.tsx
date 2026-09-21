"use client";
import { OnboardingProvider } from "@system-b90/onboarding";
import { ReactNode } from "react";

import { ONBOARDING_LABELS } from "@/components/app-onboarding/labels";

/**
 * Bluz's onboarding. Wraps the generic engine with this app's copy.
 *
 * Must be mounted above everything that registers a tour, a help topic or an
 * anchor — in practice the post-auth layout, alongside the command palette.
 */
export function BluzOnboarding({ children }: { children: ReactNode }) {
    return (
        <OnboardingProvider labels={ONBOARDING_LABELS} storageNamespace="bluz">
            {children}
        </OnboardingProvider>
    );
}
