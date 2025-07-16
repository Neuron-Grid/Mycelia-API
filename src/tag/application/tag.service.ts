import { Injectable } from '@nestjs/common';
import { Database } from 'src/types/schema';
import { TagRepository } from '../infrastructure/tag.repository';

type TagsUpdate = Database['public']['Tables']['tags']['Update'];

@Injectable()
export class TagService {
    constructor(private readonly tagRepo: TagRepository) {}

    async getAllTagsForUser(userId: string) {
        return await this.tagRepo.findAllTagsByUserId(userId);
    }

    async createTagForUser(userId: string, tagName: string, parentTagId?: number | null) {
        return await this.tagRepo.createTag(userId, tagName, parentTagId);
    }

    async updateTagForUser(
        userId: string,
        tagId: number,
        newName?: string,
        newParentTagId?: number | null,
    ) {
        type UpdateFields = Pick<TagsUpdate, 'tag_name' | 'parent_tag_id'>;
        type PartialUpdateFields = Partial<UpdateFields>;
        const fields: PartialUpdateFields = {};

        if (typeof newName !== 'undefined') {
            fields.tag_name = newName;
        }
        if (typeof newParentTagId !== 'undefined') {
            fields.parent_tag_id = newParentTagId;
        }
        return await this.tagRepo.updateTag(userId, tagId, fields);
    }

    async deleteTagForUser(userId: string, tagId: number) {
        return await this.tagRepo.deleteTag(userId, tagId);
    }

    // FeedItemにタグ付与/削除
    async attachTagToFeedItem(userId: string, feedItemId: number, tagId: number) {
        return await this.tagRepo.attachTagToFeedItem(userId, feedItemId, tagId);
    }

    async detachTagFromFeedItem(userId: string, feedItemId: number, tagId: number) {
        return await this.tagRepo.detachTagFromFeedItem(userId, feedItemId, tagId);
    }

    async getTagsByFeedItem(userId: string, feedItemId: number) {
        return await this.tagRepo.findTagsByFeedItem(userId, feedItemId);
    }

    // 購読(UserSubscription)にタグ付与/削除
    async attachTagToSubscription(userId: string, subscriptionId: number, tagId: number) {
        return await this.tagRepo.attachTagToSubscription(userId, subscriptionId, tagId);
    }

    async detachTagFromSubscription(userId: string, subscriptionId: number, tagId: number) {
        return await this.tagRepo.detachTagFromSubscription(userId, subscriptionId, tagId);
    }

    async getTagsBySubscription(userId: string, subscriptionId: number) {
        return await this.tagRepo.findTagsBySubscription(userId, subscriptionId);
    }
}
