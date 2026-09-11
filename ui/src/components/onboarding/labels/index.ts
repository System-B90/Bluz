import { OnboardingLabels } from "@/components/onboarding/types";

type LabelOverrides = Partial<Omit<OnboardingLabels, "help">> & {
    help?: Partial<OnboardingLabels["help"]>;
};

/**
 * Re-words individual strings without restating a whole table — the one place
 * a host app's voice differs from the package's default phrasing.
 */
export function withLabelOverrides(
    base: OnboardingLabels,
    overrides: LabelOverrides,
): OnboardingLabels {
    return {
        ...base,
        ...overrides,
        help: { ...base.help, ...overrides.help },
    };
}
