import { Injectable, Logger } from "@nestjs/common";

type ZonedDateParts = {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
};

@Injectable()
export class JstDateService {
    private readonly formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    now(): Date {
        return this.fromParts(this.extractParts(new Date()));
    }

    setTime(base: Date, hour: number, minute: number): Date {
        const parts = this.extractParts(base);
        return this.fromParts({
            ...parts,
            hour: this.pad(hour),
            minute: this.pad(minute),
            second: "00",
        });
    }

    addDays(date: Date, days: number): Date {
        const next = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
        return this.fromParts(this.extractParts(next));
    }

    formatDate(date: Date): string {
        const parts = this.extractParts(date);
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    getParts(date: Date): ZonedDateParts {
        return this.extractParts(date);
    }

    warnIfTimezoneMismatch(logger: Logger): void {
        const offsetMinutes = -new Date().getTimezoneOffset();
        if (offsetMinutes !== 540) {
            logger.warn(
                `Host timezone offset is ${offsetMinutes} minutes; expected 540 (Asia/Tokyo). Verify NTP and TZ configuration.`,
            );
        }
    }

    private extractParts(date: Date): ZonedDateParts {
        const parts: Partial<ZonedDateParts> = {};
        for (const part of this.formatter.formatToParts(date)) {
            if (part.type === "literal") continue;
            parts[part.type as keyof ZonedDateParts] = part.value;
        }
        return {
            year: parts.year ?? "1970",
            month: parts.month ?? "01",
            day: parts.day ?? "01",
            hour: parts.hour ?? "00",
            minute: parts.minute ?? "00",
            second: parts.second ?? "00",
        };
    }

    private fromParts(parts: ZonedDateParts): Date {
        const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000+09:00`;
        return new Date(iso);
    }

    private pad(value: number): string {
        return value.toString().padStart(2, "0");
    }
}
