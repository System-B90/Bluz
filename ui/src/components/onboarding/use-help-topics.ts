"use client";
import { useEffect } from "react";

import { useOnboardingContext } from "@/components/onboarding/OnboardingContext";
import { HelpTopic } from "@/components/onboarding/types";

/**
 * Contributes entries to the help panel. Same contract as `useTour`: the array
 * must be referentially stable, and the topics live exactly as long as the
 * component that registered them.
 */
export function useHelpTopics(topics: ReadonlyArray<HelpTopic>): void {
    const { registerTopics } = useOnboardingContext();

    useEffect(() => registerTopics(topics), [registerTopics, topics]);
}
