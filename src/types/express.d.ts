import { User } from '@supabase/supabase-js';

// expressモジュールからインポートする場合のために追加
declare module 'express' {
    interface Request {
        user?: User;
    }
}
