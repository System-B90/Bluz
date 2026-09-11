import { TourAnchorId } from "@/components/onboarding/types";

type AnchorListener = () => void;

/**
 * The live map of anchor id → mounted element.
 *
 * Components register themselves as they mount (`useTourAnchor`), so a tour can
 * ask "where is `gantt.tabs` right now?" without ever touching a selector or
 * reaching across the component tree. Registering an id that is already taken
 * wins — the newest mount is the one on screen.
 */
export class AnchorRegistry {
    private readonly elements = new Map<TourAnchorId, HTMLElement>();
    private readonly listeners = new Set<AnchorListener>();

    /** Returns the un-register callback, so it can be a ref cleanup directly. */
    register(id: TourAnchorId, element: HTMLElement): () => void {
        this.elements.set(id, element);
        this.notify();

        return () => {
            // Only drop it if a newer mount has not already replaced it.
            if (this.elements.get(id) === element) {
                this.elements.delete(id);
                this.notify();
            }
        };
    }

    get(id: TourAnchorId): HTMLElement | undefined {
        const element = this.elements.get(id);

        // A registered element can still be torn out of the document by a
        // parent that never ran our cleanup (portals, error boundaries).
        if (element && !element.isConnected) {
            this.elements.delete(id);
            return undefined;
        }

        return element;
    }

    has(id: TourAnchorId): boolean {
        return this.get(id) !== undefined;
    }

    subscribe(listener: AnchorListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notify() {
        for (const listener of this.listeners) listener();
    }
}
