import { TypedBody, TypedParam, TypedQuery, TypedRoute } from "@nestia/core";
import {
    Body,
    Controller,
    HttpException,
    HttpStatus,
    UseGuards,
} from "@nestjs/common";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "@/auth/user-id.decorator";
import { buildResponse, SuccessResponse } from "@/common/utils/response.util";
import { parseUInt32 } from "@/common/utils/typed-param";
import { FeedItemDto } from "@/feed/application/dto/feed-item.dto";
import { FeedItemMapper } from "@/feed/application/feed-item.mapper";
import { SubscriptionMapper } from "@/feed/application/subscription.mapper";
import { AttachTagDto } from "./dto/attach-tag.dto";
import { BulkTagDto } from "./dto/bulk-tag.dto";
import { CreateHierarchicalTagDto } from "./dto/create-hierarchical-tag.dto";
import { CreateTagDto } from "./dto/create-tag.dto";
import { TagDto } from "./dto/tag.dto";
import {
    MoveTagDto,
    TagHierarchyDto,
    TagWithPathDto,
} from "./dto/tag-hierarchy.dto";
import { UpdateTagDto } from "./dto/update-tag.dto";
import { HierarchicalTagService } from "./hierarchical-tag.service";
import { TagMapper } from "./tag.mapper";
import { TagService } from "./tag.service";
import { TagHierarchyMapper } from "./tag-hierarchy.mapper";

@Controller({
    path: "tags",
    version: "1",
})
@UseGuards(SupabaseAuthGuard)
export class TagController {
    constructor(
        private readonly tagService: TagService,
        private readonly hierarchicalTagService: HierarchicalTagService,
    ) {}

    /**
     * Get all tags for current user.
     * - 認証ユーザーの全タグ一覧を返します。
     */
    @TypedRoute.Get("")
    async getAllTags(
        @UserId() userId: string,
    ): Promise<SuccessResponse<TagDto[]>> {
        const tags = await this.tagService.getAllTagsForUser(userId);
        return buildResponse("Tag list fetched", TagMapper.listToDto(tags));
    }

    /**
     * Create a new tag.
     * - `tagName`は必須、`parentTagId`は任意。
     */
    @TypedRoute.Post("")
    async createTag(
        @UserId() userId: string,
        @TypedBody() dto: CreateTagDto,
    ): Promise<SuccessResponse<TagDto>> {
        if (!dto.tagName) {
            throw new HttpException(
                "tagName is required",
                HttpStatus.BAD_REQUEST,
            );
        }
        const result = await this.tagService.createTagForUser(
            userId,
            dto.tagName,
            dto.parentTagId ?? null,
        );
        return buildResponse("Tag created", TagMapper.rowToDto(result));
    }

    /**
     * Update a tag.
     * - 指定IDのタグ名や親タグを変更します。
     */
    @TypedRoute.Patch(":tagId")
    async updateTag(
        @UserId() userId: string,
        @TypedParam("tagId", parseUInt32) tagId: number,
        @TypedBody() dto: UpdateTagDto,
    ): Promise<SuccessResponse<TagDto>> {
        const updated = await this.tagService.updateTagForUser(
            userId,
            tagId,
            dto.newName,
            dto.newParentTagId,
        );
        return buildResponse("Tag updated", TagMapper.rowToDto(updated));
    }

    /**
     * Delete a tag.
     * - 指定IDのタグを削除します。
     */
    @TypedRoute.Delete(":tagId")
    async deleteTag(
        @UserId() userId: string,
        @TypedParam("tagId", parseUInt32) tagId: number,
    ): Promise<SuccessResponse<null>> {
        await this.tagService.deleteTagForUser(userId, tagId);
        return buildResponse("Tag deleted", null);
    }

    // FeedItemとの紐付け
    /**
     * Get tags for a feed item.
     * - 指定フィードアイテムに付与されたタグ一覧。
     */
    @TypedRoute.Get("feed-items/:feedItemId")
    async getFeedItemTags(
        @UserId() userId: string,
        @TypedParam("feedItemId", parseUInt32)
        feedItemId: number,
    ): Promise<SuccessResponse<TagDto[]>> {
        const result = await this.tagService.getTagsByFeedItem(
            userId,
            feedItemId,
        );
        return buildResponse(
            "Tags for feed item",
            TagMapper.fromFeedItemJoin(result),
        );
    }

    /**
     * Attach a tag to a feed item.
     * - 指定フィードアイテムにタグを付与します。
     */
    @TypedRoute.Post("feed-items/:feedItemId")
    async attachTagToFeedItem(
        @UserId() userId: string,
        @TypedParam("feedItemId", parseUInt32)
        feedItemId: number,
        @TypedBody() body: AttachTagDto,
    ): Promise<SuccessResponse<null>> {
        if (!body.tagId) {
            throw new HttpException(
                "tagId is required",
                HttpStatus.BAD_REQUEST,
            );
        }
        await this.tagService.attachTagToFeedItem(
            userId,
            feedItemId,
            body.tagId,
        );
        return buildResponse("Tag attached to feed item", null);
    }

    /**
     * Detach a tag from a feed item.
     * - クエリ`tagId`で分離対象タグを指定。
     */
    @TypedRoute.Delete("feed-items/:feedItemId")
    async detachTagFromFeedItem(
        @UserId() userId: string,
        @TypedParam("feedItemId", parseUInt32)
        feedItemId: number,
        @TypedQuery<{ tagId: number }>() query: { tagId: number },
    ): Promise<SuccessResponse<null>> {
        const tagId = query?.tagId;
        if (!tagId && tagId !== 0) {
            throw new HttpException(
                "tagId is required as query",
                HttpStatus.BAD_REQUEST,
            );
        }
        await this.tagService.detachTagFromFeedItem(userId, feedItemId, tagId);
        return buildResponse("Tag detached from feed item", null);
    }

    // UserSubscriptionとの紐付け
    /**
     * Get tags for a subscription.
     * - 指定購読に付与されたタグ一覧。
     */
    @TypedRoute.Get("subscriptions/:subscriptionId")
    async getSubscriptionTags(
        @UserId() userId: string,
        @TypedParam("subscriptionId", parseUInt32)
        subscriptionId: number,
    ): Promise<SuccessResponse<TagDto[]>> {
        const result = await this.tagService.getTagsBySubscription(
            userId,
            subscriptionId,
        );
        return buildResponse(
            "Tags for subscription",
            TagMapper.fromSubscriptionJoin(result),
        );
    }

    /**
     * Attach a tag to a subscription.
     */
    @TypedRoute.Post("subscriptions/:subscriptionId")
    async attachTagToSubscription(
        @UserId() userId: string,
        @TypedParam("subscriptionId", parseUInt32)
        subscriptionId: number,
        @TypedBody() body: AttachTagDto,
    ): Promise<SuccessResponse<null>> {
        if (!body.tagId) {
            throw new HttpException(
                "tagId is required",
                HttpStatus.BAD_REQUEST,
            );
        }
        await this.tagService.attachTagToSubscription(
            userId,
            subscriptionId,
            body.tagId,
        );
        return buildResponse("Tag attached to subscription", null);
    }

    /**
     * Detach a tag from a subscription.
     */
    @TypedRoute.Delete("subscriptions/:subscriptionId")
    async detachTagFromSubscription(
        @UserId() userId: string,
        @TypedParam("subscriptionId", parseUInt32)
        subscriptionId: number,
        @TypedQuery<{ tagId: number }>() query: { tagId: number },
    ): Promise<SuccessResponse<null>> {
        const tagId = query?.tagId;
        if (!tagId && tagId !== 0) {
            throw new HttpException(
                "tagId is required as query",
                HttpStatus.BAD_REQUEST,
            );
        }
        await this.tagService.detachTagFromSubscription(
            userId,
            subscriptionId,
            tagId,
        );
        return buildResponse("Tag detached from subscription", null);
    }

    // 階層化タグの高度な機能

    @TypedRoute.Post("hierarchical")
    async createHierarchicalTag(
        @UserId() userId: string,
        @Body() dto: CreateHierarchicalTagDto,
    ): Promise<SuccessResponse<TagDto>> {
        const result = await this.hierarchicalTagService.createHierarchicalTag(
            userId,
            dto,
        );
        return buildResponse(
            "Hierarchical tag created",
            TagMapper.entityToDto(result),
        );
    }

    @TypedRoute.Get("hierarchy")
    async getTagHierarchy(
        @UserId() userId: string,
    ): Promise<SuccessResponse<TagHierarchyDto[]>> {
        const hierarchy =
            await this.hierarchicalTagService.getTagHierarchy(userId);
        return buildResponse(
            "Tag hierarchy fetched",
            TagHierarchyMapper.toDtoList(hierarchy),
        );
    }

    @TypedRoute.Get(":tagId/subtree")
    async getTagSubtree(
        @UserId() userId: string,
        @TypedParam("tagId", parseUInt32) tagId: number,
    ): Promise<SuccessResponse<TagHierarchyDto | null>> {
        const subtree = await this.hierarchicalTagService.getTagSubtree(
            userId,
            tagId,
        );
        if (!subtree) {
            throw new HttpException("Tag not found", HttpStatus.NOT_FOUND);
        }
        return buildResponse(
            "Tag subtree fetched",
            subtree ? TagHierarchyMapper.toDto(subtree) : null,
        );
    }

    @TypedRoute.Get(":tagId/path")
    async getTagPath(
        @UserId() userId: string,
        @TypedParam("tagId", parseUInt32) tagId: number,
    ): Promise<SuccessResponse<TagWithPathDto>> {
        const path = await this.hierarchicalTagService.getTagPath(
            userId,
            tagId,
        );
        if (!path) {
            throw new HttpException("Tag not found", HttpStatus.NOT_FOUND);
        }
        return buildResponse(
            "Tag path fetched",
            TagHierarchyMapper.pathToDto(path),
        );
    }

    @TypedRoute.Patch(":tagId/move")
    async moveTag(
        @UserId() userId: string,
        @TypedParam("tagId", parseUInt32) tagId: number,
        @TypedBody() dto: MoveTagDto,
    ): Promise<SuccessResponse<TagDto>> {
        const result = await this.hierarchicalTagService.moveTag(
            userId,
            tagId,
            dto.newParentId ?? null,
        );
        return buildResponse("Tag moved", TagMapper.entityToDto(result));
    }

    /**
     * Get feed items filtered by tag.
     * - `includeChildren=true`で子孫タグも含めます。
     */
    @TypedRoute.Get(":tagId/feed-items")
    async getFeedItemsByTag(
        @UserId() userId: string,
        @TypedParam("tagId", parseUInt32) tagId: number,
        @TypedQuery<{ includeChildren?: boolean }>()
        query: { includeChildren?: boolean },
    ): Promise<SuccessResponse<FeedItemDto[]>> {
        const includeChildrenBool = query?.includeChildren === true;
        const feedItems = await this.hierarchicalTagService.getFeedItemsByTag(
            userId,
            tagId,
            includeChildrenBool,
        );
        // feedItems: Array<feed_item_tags & { feed_item: feed_items }>
        type FeedItemRow =
            import("@/types/schema").Database["public"]["Tables"]["feed_items"]["Row"];
        const dtos = (feedItems as Array<{ feed_item?: FeedItemRow | null }>)
            .map((r) => r.feed_item ?? null)
            .filter((r): r is FeedItemRow => r !== null)
            .map((row) =>
                FeedItemMapper.rowToDto(row, { isFavorite: false, tags: [] }),
            );
        return buildResponse("Feed items by tag fetched", dtos);
    }

    /**
     * Get subscriptions filtered by tag.
     * - `includeChildren=true`で子孫タグも含めます。
     */
    @TypedRoute.Get(":tagId/subscriptions")
    async getSubscriptionsByTag(
        @UserId() userId: string,
        @TypedParam("tagId", parseUInt32) tagId: number,
        @TypedQuery<{ includeChildren?: boolean }>()
        query: { includeChildren?: boolean },
    ): Promise<
        SuccessResponse<
            import("@/feed/application/dto/subscription.dto").SubscriptionDto[]
        >
    > {
        const includeChildrenBool = query?.includeChildren === true;
        const subscriptions =
            await this.hierarchicalTagService.getSubscriptionsByTag(
                userId,
                tagId,
                includeChildrenBool,
            );
        // subscriptions: Array<user_subscription_tags & { subscription: user_subscriptions }>
        type SubRow =
            import("@/types/schema").Database["public"]["Tables"]["user_subscriptions"]["Row"];
        const dtos = (subscriptions as Array<{ subscription?: SubRow | null }>)
            .map((r) => r.subscription ?? null)
            .filter((r): r is SubRow => r !== null)
            .map((row) => SubscriptionMapper.rowToDto(row));
        return buildResponse("Subscriptions by tag fetched", dtos);
    }

    /**
     * Tag feed item with multiple tags.
     */
    @TypedRoute.Post("feed-items/:feedItemId/bulk")
    async tagFeedItem(
        @UserId() userId: string,
        @TypedParam("feedItemId", parseUInt32)
        feedItemId: number,
        @TypedBody() body: BulkTagDto,
    ): Promise<SuccessResponse<null>> {
        if (!body.tagIds || !Array.isArray(body.tagIds)) {
            throw new HttpException(
                "tagIds array is required",
                HttpStatus.BAD_REQUEST,
            );
        }
        await this.hierarchicalTagService.tagFeedItem(
            userId,
            feedItemId,
            body.tagIds,
        );
        return buildResponse("Feed item tagged with multiple tags", null);
    }

    /**
     * Tag subscription with multiple tags.
     */
    @TypedRoute.Post("subscriptions/:subscriptionId/bulk")
    async tagSubscription(
        @UserId() userId: string,
        @TypedParam("subscriptionId", parseUInt32)
        subscriptionId: number,
        @TypedBody() body: BulkTagDto,
    ): Promise<SuccessResponse<null>> {
        if (!body.tagIds || !Array.isArray(body.tagIds)) {
            throw new HttpException(
                "tagIds array is required",
                HttpStatus.BAD_REQUEST,
            );
        }
        await this.hierarchicalTagService.tagSubscription(
            userId,
            subscriptionId,
            body.tagIds,
        );
        return buildResponse("Subscription tagged with multiple tags", null);
    }
}
