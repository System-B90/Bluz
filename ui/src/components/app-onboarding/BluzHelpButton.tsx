"use client";
import { HelpButton, useTourAnchor } from "@system-b90/onboarding";

import { APP_ANCHORS } from "@/components/app-onboarding/anchors";

/**
 * The app bar's "?" — the package's button, plus the anchor that lets a tour
 * point at it and say "this is how you get back here".
 */
export function BluzHelpButton() {
    return (
        <HelpButton
            className="transition-all duration-200 hover:scale-110 active:scale-95"
            ref={useTourAnchor<HTMLButtonElement>(APP_ANCHORS.help)}
        />
    );
}
