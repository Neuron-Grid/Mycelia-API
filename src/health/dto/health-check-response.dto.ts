// @file ヘルスチェックAPIのレスポンスDTO定義
/** DTOs for health check responses */

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
    // @type {string}
    // @example 'OK'
    /** Status of Redis connectivity (OK or NG: <error-message>) */
    redis: string;
}
