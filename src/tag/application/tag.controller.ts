import { TypedRoute } from "@nestia/core";
import {
    Body,
    Controller,
    HttpException,
    HttpStatus,
    Param,
    ParseIntPipe,
    Query,
    UseGuards,
} from "@nestjs/common";
import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiBody,
    ApiCreatedResponse,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
    ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { SupabaseAuthGuard } from "@/auth/supabase-auth.guard";
import { UserId } from "@/auth/user-id.decorator";
import { ErrorResponseDto } from "@/common/dto/error-response.dto";
import { buildResponse, SuccessResponse } from "@/common/utils/response.util";
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

@ApiTags("Tags")
@ApiBearerAuth()
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

    @ApiOperation({ summary: "Get all tags for current user" })
    @ApiOkResponse({
        description: "Returns { message, data: Tag[] }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "array", items: { type: "object" } },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Get()
    async getAllTags(
        @UserId() userId: string,
    ): Promise<SuccessResponse<TagDto[]>> {
        const tags = await this.tagService.getAllTagsForUser(userId);
        return buildResponse("Tag list fetched", TagMapper.listToDto(tags));
    }

    @ApiOperation({ summary: "Create a new tag" })
    @ApiCreatedResponse({
        description: "Returns { message, data: Tag }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "object" },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Post()
    async createTag(
        @UserId() userId: string,
        @Body() dto: CreateTagDto,
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

    @ApiOperation({ summary: "Update a tag" })
    @ApiParam({ name: "tagId", description: "ID of the tag to update" })
    @ApiOkResponse({
        description: "Returns { message, data: Tag }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "object" },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Patch(":tagId")
    async updateTag(
        @UserId() userId: string,
        @Param("tagId", ParseIntPipe) tagId: number,
        @Body() dto: UpdateTagDto,
    ): Promise<SuccessResponse<TagDto>> {
        const updated = await this.tagService.updateTagForUser(
            userId,
            tagId,
            dto.newName,
            dto.newParentTagId,
        );
        return buildResponse("Tag updated", TagMapper.rowToDto(updated));
    }

    @ApiOperation({ summary: "Delete a tag" })
    @ApiParam({ name: "tagId", description: "ID of the tag to delete" })
    @ApiOkResponse({
        description: "Returns { message, data: null }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "null", nullable: true },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Delete(":tagId")
    async deleteTag(
        @UserId() userId: string,
        @Param("tagId", ParseIntPipe) tagId: number,
    ): Promise<SuccessResponse<null>> {
        await this.tagService.deleteTagForUser(userId, tagId);
        return buildResponse("Tag deleted", null);
    }

    // FeedItemとの紐付け
    @ApiOperation({ summary: "Get tags for a feed item" })
    @ApiParam({ name: "feedItemId", description: "ID of the feed item" })
    @ApiOkResponse({
        description: "Returns { message, data: Tag[] }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "array", items: { type: "object" } },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Get("feed-items/:feedItemId")
    async getFeedItemTags(
        @UserId() userId: string,
        @Param("feedItemId", ParseIntPipe) feedItemId: number,
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

    @ApiOperation({ summary: "Attach a tag to a feed item" })
    @ApiParam({ name: "feedItemId", description: "ID of the feed item" })
    @ApiOkResponse({
        description: "Returns { message, data: null }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "null", nullable: true },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Post("feed-items/:feedItemId")
    @ApiBody({ type: AttachTagDto })
    async attachTagToFeedItem(
        @UserId() userId: string,
        @Param("feedItemId", ParseIntPipe) feedItemId: number,
        @Body() body: AttachTagDto,
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

    @ApiOperation({ summary: "Detach a tag from a feed item" })
    @ApiParam({ name: "feedItemId", description: "ID of the feed item" })
    @ApiQuery({
        name: "tagId",
        description: "ID of the tag to detach",
        type: Number,
        required: true,
    })
    @ApiOkResponse({
        description: "Returns { message, data: null }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "null", nullable: true },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Delete("feed-items/:feedItemId")
    async detachTagFromFeedItem(
        @UserId() userId: string,
        @Param("feedItemId", ParseIntPipe) feedItemId: number,
        @Query("tagId") tagId: string,
    ): Promise<SuccessResponse<null>> {
        if (!tagId) {
            throw new HttpException(
                "tagId is required as query",
                HttpStatus.BAD_REQUEST,
            );
        }
        const parsedTagId = Number.parseInt(tagId, 10);
        await this.tagService.detachTagFromFeedItem(
            userId,
            feedItemId,
            parsedTagId,
        );
        return buildResponse("Tag detached from feed item", null);
    }

    // UserSubscriptionとの紐付け
    @ApiOperation({ summary: "Get tags for a subscription" })
    @ApiParam({ name: "subscriptionId", description: "ID of the subscription" })
    @ApiOkResponse({
        description: "Returns { message, data: Tag[] }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "array", items: { type: "object" } },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Get("subscriptions/:subscriptionId")
    async getSubscriptionTags(
        @UserId() userId: string,
        @Param("subscriptionId", ParseIntPipe) subscriptionId: number,
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

    @ApiOperation({ summary: "Attach a tag to a subscription" })
    @ApiParam({ name: "subscriptionId", description: "ID of the subscription" })
    @ApiOkResponse({
        description: "Returns { message, data: null }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "null", nullable: true },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Post("subscriptions/:subscriptionId")
    @ApiBody({ type: AttachTagDto })
    async attachTagToSubscription(
        @UserId() userId: string,
        @Param("subscriptionId", ParseIntPipe) subscriptionId: number,
        @Body() body: AttachTagDto,
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

    @ApiOperation({ summary: "Detach a tag from a subscription" })
    @ApiParam({ name: "subscriptionId", description: "ID of the subscription" })
    @ApiQuery({
        name: "tagId",
        description: "ID of the tag to detach",
        type: Number,
        required: true,
    })
    @ApiOkResponse({
        description: "Returns { message, data: null }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "null", nullable: true },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Delete("subscriptions/:subscriptionId")
    async detachTagFromSubscription(
        @UserId() userId: string,
        @Param("subscriptionId", ParseIntPipe) subscriptionId: number,
        @Query("tagId") tagId: string,
    ): Promise<SuccessResponse<null>> {
        if (!tagId) {
            throw new HttpException(
                "tagId is required as query",
                HttpStatus.BAD_REQUEST,
            );
        }
        const parsedTagId = Number.parseInt(tagId, 10);
        await this.tagService.detachTagFromSubscription(
            userId,
            subscriptionId,
            parsedTagId,
        );
        return buildResponse("Tag detached from subscription", null);
    }

    // 階層化タグの高度な機能

    @ApiOperation({
        summary: "Create a hierarchical tag with advanced features",
    })
    @ApiCreatedResponse({
        description: "Returns { message, data }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "object" },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
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

    @ApiOperation({ summary: "Get all tags in hierarchical structure" })
    @ApiOkResponse({
        description: "Returns { message, data: TagHierarchyDto[] }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/TagHierarchyDto" },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
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

    @ApiOperation({ summary: "Get tag subtree (tag and all its descendants)" })
    @ApiParam({ name: "tagId", description: "ID of the root tag" })
    @ApiOkResponse({
        description: "Returns { message, data: TagHierarchyDto }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { $ref: "#/components/schemas/TagHierarchyDto" },
            },
        },
    })
    @ApiNotFoundResponse({
        description: "Tag not found",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Get(":tagId/subtree")
    async getTagSubtree(
        @UserId() userId: string,
        @Param("tagId", ParseIntPipe) tagId: number,
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

    @ApiOperation({ summary: "Get tag path from root to specified tag" })
    @ApiParam({ name: "tagId", description: "ID of the tag" })
    @ApiOkResponse({
        description: "Returns { message, data: TagWithPathDto }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { $ref: "#/components/schemas/TagWithPathDto" },
            },
        },
    })
    @ApiNotFoundResponse({
        description: "Tag not found",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Get(":tagId/path")
    async getTagPath(
        @UserId() userId: string,
        @Param("tagId", ParseIntPipe) tagId: number,
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

    @ApiOperation({ summary: "Move tag to a new parent (change hierarchy)" })
    @ApiParam({ name: "tagId", description: "ID of the tag to move" })
    @ApiOkResponse({
        description: "Returns { message, data }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "object" },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiNotFoundResponse({
        description: "Tag not found",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Patch(":tagId/move")
    async moveTag(
        @UserId() userId: string,
        @Param("tagId", ParseIntPipe) tagId: number,
        @Body() dto: MoveTagDto,
    ): Promise<SuccessResponse<TagDto>> {
        const result = await this.hierarchicalTagService.moveTag(
            userId,
            tagId,
            dto.newParentId ?? null,
        );
        return buildResponse("Tag moved", TagMapper.entityToDto(result));
    }

    @ApiOperation({
        summary:
            "Get feed items filtered by tag (with optional child inclusion)",
    })
    @ApiParam({ name: "tagId", description: "ID of the tag" })
    @ApiQuery({
        name: "includeChildren",
        required: false,
        description: "Include child tags in filter",
        type: Boolean,
    })
    @ApiOkResponse({
        description: "Returns { message, data: FeedItem[] }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "array", items: { type: "object" } },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Get(":tagId/feed-items")
    async getFeedItemsByTag(
        @UserId() userId: string,
        @Param("tagId", ParseIntPipe) tagId: number,
        @Query("includeChildren") includeChildren?: boolean,
    ): Promise<SuccessResponse<FeedItemDto[]>> {
        const includeChildrenBool = includeChildren === true;
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

    @ApiOperation({
        summary:
            "Get subscriptions filtered by tag (with optional child inclusion)",
    })
    @ApiParam({ name: "tagId", description: "ID of the tag" })
    @ApiQuery({
        name: "includeChildren",
        required: false,
        description: "Include child tags in filter",
        type: Boolean,
    })
    @ApiOkResponse({
        description: "Returns { message, data: Subscription[] }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "array", items: { type: "object" } },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Get(":tagId/subscriptions")
    async getSubscriptionsByTag(
        @UserId() userId: string,
        @Param("tagId", ParseIntPipe) tagId: number,
        @Query("includeChildren") includeChildren?: boolean,
    ): Promise<
        SuccessResponse<
            import("@/feed/application/dto/subscription.dto").SubscriptionDto[]
        >
    > {
        const includeChildrenBool = includeChildren === true;
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

    @ApiOperation({ summary: "Tag multiple feed items with multiple tags" })
    @ApiParam({ name: "feedItemId", description: "ID of the feed item" })
    @ApiOkResponse({
        description: "Returns { message, data: null }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "null", nullable: true },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Post("feed-items/:feedItemId/bulk")
    @ApiBody({ type: BulkTagDto })
    async tagFeedItem(
        @UserId() userId: string,
        @Param("feedItemId", ParseIntPipe) feedItemId: number,
        @Body() body: BulkTagDto,
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

    @ApiOperation({ summary: "Tag subscription with multiple tags" })
    @ApiParam({ name: "subscriptionId", description: "ID of the subscription" })
    @ApiOkResponse({
        description: "Returns { message, data: null }",
        schema: {
            type: "object",
            properties: {
                message: { type: "string" },
                data: { type: "null", nullable: true },
            },
        },
    })
    @ApiBadRequestResponse({
        description: "Bad request",
        type: ErrorResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: "Unauthorized",
        type: ErrorResponseDto,
    })
    @TypedRoute.Post("subscriptions/:subscriptionId/bulk")
    @ApiBody({ type: BulkTagDto })
    async tagSubscription(
        @UserId() userId: string,
        @Param("subscriptionId", ParseIntPipe) subscriptionId: number,
        @Body() body: BulkTagDto,
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
