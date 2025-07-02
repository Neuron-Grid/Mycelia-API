import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { User } from '@supabase/supabase-js'

// コントローラの引数で「@SupabaseUser() user: User」を受け取れる
export const SupabaseUser = createParamDecorator((ctx: ExecutionContext): User | undefined => {
    const request = ctx.switchToHttp().getRequest()
    return request.user
})
