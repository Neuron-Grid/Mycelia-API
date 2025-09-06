export class CreateSummaryResponseDto {
    /** Generated summary markdown */
    summary!: string;
    /** Saved row id (optional when save=false) */
    id?: number;
}
