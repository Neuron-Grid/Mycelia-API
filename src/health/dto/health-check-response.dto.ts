// @file ヘルスチェックAPIのレスポンスDTO定義
/** DTOs for health check responses */

// @class JobCountsDto
// @public
// @since 1.0.0
export class JobCountsDto {
    // @property
    // @type {number}
    // @example 0
    /** waiting jobs count */
    waiting: number;

    // @property
    // @type {number}
    // @example 0
    /** active jobs count */
    active: number;

    // @property
    // @type {number}
    // @example 10
    /** completed jobs count */
    completed: number;

    // @property
    // @type {number}
    // @example 0
    /** failed jobs count */
    failed: number;

    // @property
    // @type {number}
    // @example 0
    /** delayed jobs count */
    delayed: number;
}

// @class BullQueueDto
// @public
// @since 1.0.0
export class BullQueueDto {
    // @property
    // @type {string}
    // @example 'OK'
    /** queue status */
    status: string;

    // @property
    // @type {JobCountsDto}
    // @see JobCountsDto
    /** job counts */
    jobCounts: JobCountsDto;
}

// @class HealthCheckResponseDto
// @public
// @since 1.0.0
export class HealthCheckResponseDto {
    // @property
    // @type {string}
    // @example 'OK'
    /** Overall system status */
    status: string;

    // @property
    // @type {string}
    // @example 'OK'
    /** DB connection status */
    db: string;

    // @property
    // @type {BullQueueDto}
    // @see BullQueueDto
    /** bull queue status */
    bullQueue: BullQueueDto;

    // @property
    // @type {string}
    // @example 'OK'
    /** Status of Redis connectivity (OK or NG: <error-message>) */
    redis: string;
}
