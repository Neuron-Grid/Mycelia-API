export class EnrollTotpResponseDto {
    /** Factor id issued by provider */
    factorId!: string;
    /** otpauth URI */
    otpauthUri!: string;
}
