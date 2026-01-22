type TimeParts = {
    hour: number;
    minute: number;
};

const DEFAULT_JITTER_MAX_MINUTES = 4;

const hashToRange = (key: string, min: number, max: number): number => {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
        h = (h * 31 + key.charCodeAt(i)) >>> 0;
    }
    const span = max - min + 1;
    return min + (h % span);
};

export const parseTimeWithStableJitter = (
    time: string,
    userId: string,
    jitterMaxMinutes = DEFAULT_JITTER_MAX_MINUTES,
): TimeParts => {
    const [hh, mm] = time.split(":").map((v) => Number.parseInt(v, 10));
    const jitter = hashToRange(userId, 0, jitterMaxMinutes);
    const minute = (mm + jitter) % 60;
    const hour = (hh + Math.floor((mm + jitter) / 60)) % 24;
    return { hour, minute };
};

export const addOffsetMinutes = (
    hour: number,
    minute: number,
    addMinutes: number,
): TimeParts => {
    const total = hour * 60 + minute + addMinutes;
    const nextHour = Math.floor((total % (24 * 60)) / 60);
    const nextMinute = total % 60;
    return { hour: nextHour, minute: nextMinute };
};
