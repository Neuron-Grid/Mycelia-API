// @file ヘルスチェックAPIのレスポンスDTO定義
import { ApiProperty } from '@nestjs/swagger'

// @class JobCountsDto
// @public
// @since 1.0.0
export class JobCountsDto {
    // @property
    // @type {number}
    // @example 0
    @ApiProperty({ example: 0 })
    waiting: number

    // @property
    // @type {number}
    // @example 0
    @ApiProperty({ example: 0 })
    active: number

    // @property
    // @type {number}
    // @example 10
    @ApiProperty({ example: 10 })
    completed: number

    // @property
    // @type {number}
    // @example 0
    @ApiProperty({ example: 0 })
    failed: number

    // @property
    // @type {number}
    // @example 0
    @ApiProperty({ example: 0 })
    delayed: number
}

// @class BullQueueDto
// @public
// @since 1.0.0
export class BullQueueDto {
    // @property
    // @type {string}
    // @example 'OK'
    @ApiProperty({ example: 'OK' })
    status: string

    // @property
    // @type {JobCountsDto}
    // @see JobCountsDto
    @ApiProperty({ type: JobCountsDto })
    jobCounts: JobCountsDto
}

// @class HealthCheckResponseDto
// @public
// @since 1.0.0
export class HealthCheckResponseDto {
    // @property
    // @type {string}
    // @example 'OK'
    @ApiProperty({ example: 'OK', description: 'Overall system status' })
    status: string

    // @property
    // @type {string}
    // @example 'OK'
    @ApiProperty({ example: 'OK', description: 'DB connection status' })
    db: string

    // @property
    // @type {BullQueueDto}
    // @see BullQueueDto
    @ApiProperty({ type: BullQueueDto })
    bullQueue: BullQueueDto

    // @property
    // @type {string}
    // @example 'OK'
    @ApiProperty({
        example: 'OK',
        description: 'Status of Redis connectivity (OK or NG: <error-message>)',
    })
    redis: string
}
