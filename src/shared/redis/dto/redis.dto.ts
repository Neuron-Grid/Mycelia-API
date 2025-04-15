import { ApiProperty } from '@nestjs/swagger'

// Redisの設定情報を扱うためのDTO
export class RedisConfigDto {
    @ApiProperty({
        example: '127.0.0.1',
        description: 'Redisホスト名（またはIPアドレス）',
    })
    host: string

    @ApiProperty({
        example: 6379,
        description: 'Redisのポート番号',
    })
    port: number

    @ApiProperty({
        example: '',
        description: 'Redisのパスワード（ない場合は空）',
        required: false,
    })
    password?: string
}

// RedisへのPING結果など、ヘルスチェック情報を扱うためのDTO
export class RedisHealthDto {
    @ApiProperty({
        example: 'OK',
        description: 'Redis接続ステータス（OK / NGなど）',
    })
    status: string

    @ApiProperty({
        example: 'PONG',
        description: 'PINGコマンドの結果',
        required: false,
    })
    pingResult?: string

    @ApiProperty({
        example: 'Error message if any',
        description: 'Redis接続が失敗した場合などのエラー内容',
        required: false,
    })
    errorMessage?: string
}
