import { Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRequestService } from '../../supabase-request.service';
import type { Database } from '../../types/schema';

@Injectable()
export class SummaryRepository {
    constructor(private readonly supabaseRequestService: SupabaseRequestService) {}

    async save(userId: string, dto: { sourceName: string; summaryMd: string }): Promise<number> {
        const supabase =
            this.supabaseRequestService.getClient() as unknown as SupabaseClient<Database>;

        const { data, error } = await supabase
            .from('daily_summaries')
            .insert({
                user_id: userId,
                summary_title: dto.sourceName,
                markdown: dto.summaryMd,
                summary_date: new Date().toISOString().split('T')[0],
            })
            .select('id')
            .single();

        if (error || !data) {
            throw new Error(error?.message ?? 'insert failed');
        }

        return data.id;
    }
}
