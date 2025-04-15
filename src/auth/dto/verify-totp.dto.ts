import { IsNotEmpty, IsString } from 'class-validator'

export class VerifyTotpDto {
    @IsString()
    @IsNotEmpty()
    factorId: string

    @IsString()
    @IsNotEmpty()
    code: string
}
