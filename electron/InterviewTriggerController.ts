// electron/InterviewTriggerController.ts
// Watches the system audio (interviewer) capture for 1.5s of silence,
// then fires a callback. New audio data cancels the pending timer.
// Only attached to the system audio channel — never the microphone.

import { EventEmitter } from 'events';

export class InterviewTriggerController {
    private silenceTimer: NodeJS.Timeout | null = null;
    private readonly silenceThresholdMs: number;
    private readonly onTrigger: () => void;
    private readonly capture: EventEmitter;
    private attached = false;

    private readonly speechEndedHandler = () => {
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
            this.silenceTimer = null;
            this.onTrigger();
        }, this.silenceThresholdMs);
    };

    private readonly dataHandler = () => {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    };

    constructor(capture: EventEmitter, onTrigger: () => void, silenceThresholdMs = 1500) {
        this.capture = capture;
        this.onTrigger = onTrigger;
        this.silenceThresholdMs = silenceThresholdMs;
    }

    attach(): void {
        if (this.attached) return;
        this.capture.on('speech_ended', this.speechEndedHandler);
        this.capture.on('data', this.dataHandler);
        this.attached = true;
    }

    detach(): void {
        if (!this.attached) return;
        this.capture.off('speech_ended', this.speechEndedHandler);
        this.capture.off('data', this.dataHandler);
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        this.attached = false;
    }

    cancel(): void {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }
}
