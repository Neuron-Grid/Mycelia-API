declare module "@nestjs/bull-shared" {
    export const JOB_REF: "REQUEST";
    export function getQueueToken(name?: string): string;
}
