import { ApiProperty } from '@nestjs/swagger'

export class JobCountsDto {
    @ApiProperty({ example: 0 })
    waiting: number

    @ApiProperty({ example: 0 })
    active: number

    @ApiProperty({ example: 10 })
    completed: number

    @ApiProperty({ example: 0 })
    failed: number

    @ApiProperty({ example: 0 })
    delayed: number
}

export class BullQueueDto {
    @ApiProperty({ example: 'OK' })
    status: string

    @ApiProperty({ type: JobCountsDto })
    jobCounts: JobCountsDto
}

export class HealthCheckResponseDto {
    @ApiProperty({ example: 'OK', description: 'Overall system status' })
    status: string

    @ApiProperty({ example: 'OK', description: 'DB connection status' })
    db: string

    @ApiProperty({ type: BullQueueDto })
    bullQueue: BullQueueDto

    @ApiProperty({
        example: 'OK',
        description: 'Status of Redis connectivity (OK or NG: <error-message>)',
    })
    redis: string
}
