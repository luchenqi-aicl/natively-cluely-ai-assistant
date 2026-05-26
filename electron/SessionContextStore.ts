// electron/SessionContextStore.ts
// In-memory store for the active interview session's parsed resume + JD context.
// Loaded once by ResumeJDParser at session start; cleared when the session ends.

import { SessionContext } from './llm/types';

export class SessionContextStore {
    private context: SessionContext | null = null;

    /**
     * Load (or replace) the session context.
     * Calling this a second time overwrites the previous context.
     */
    load(context: SessionContext): void {
        this.context = context;
    }

    /**
     * Returns the current session context, or null if none has been loaded.
     */
    get(): SessionContext | null {
        return this.context;
    }

    /**
     * Clear the session context. Called when the interview session ends.
     */
    clear(): void {
        this.context = null;
    }
}

export const sessionContextStore = new SessionContextStore();
