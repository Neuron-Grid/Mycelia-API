import { BadRequestException, InternalServerErrorException } from '@nestjs/common'

export class EmbeddingBatchException extends InternalServerErrorException {
    constructor(message: string, userId?: string) {
        super(`Embedding batch processing failed${userId ? ` for user ${userId}` : ''}: ${message}`)
    }
}

export class InvalidTableTypeException extends BadRequestException {
    constructor(tableType: string) {
        super(`Invalid table type: ${tableType}`)
    }
}

export class EmbeddingGenerationException extends InternalServerErrorException {
    constructor(message: string) {
        super(`Embedding generation failed: ${message}`)
    }
}

export class BatchDataNotFoundException extends BadRequestException {
    constructor(userId: string, tableType: string) {
        super(`No data found for batch processing: user ${userId}, table ${tableType}`)
    }
}
