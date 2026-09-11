export { AnchorRegistry } from "@/components/onboarding/core/anchors";
export {
    DEFAULT_SPOTLIGHT_PADDING,
    areRectsEqual,
    toPopperPlacement,
    toSpotlightRect,
    type SpotlightRect,
} from "@/components/onboarding/core/spotlight";
export {
    findShowableStep,
    stepProgress,
    type StepDirection,
} from "@/components/onboarding/core/steps";
export {
    browserStorage,
    completionsKey,
    isTourCompleted,
    readCompletions,
    writeCompletions,
    type CompletionMap,
    type TourCompletion,
} from "@/components/onboarding/core/storage";
