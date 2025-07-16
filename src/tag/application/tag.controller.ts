import {
    Body,
    Controller,
    Delete,
    Get,
    HttpException,
    HttpStatus,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard';
import { UserId } from 'src/auth/user-id.decorator';
import { CreateHierarchicalTagDto } from './dto/create-hierarchical-tag.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { MoveTagDto, TagHierarchyDto, TagWithPathDto } from './dto/tag-hierarchy.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { HierarchicalTagService } from './hierarchical-tag.service';
import { buildResponse } from './response.util';
import { TagService } from './tag.service';

@ApiTags('Tags')
@ApiBearerAuth()
@Controller({
    path: 'tags',
    version: '1',
})
@UseGuards(SupabaseAuthGuard)
export class TagController {
    constructor(
        private readonly tagService: TagService,
        private readonly hierarchicalTagService: HierarchicalTagService,
    ) {}

    @ApiOperation({ summary: 'Get all tags for current user' })
    @ApiResponse({ status: 200, description: 'Returns all tags for the user' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Get()
    async getAllTags(@UserId() userId: string) {
        const tags = await this.tagService.getAllTagsForUser(userId);
        return buildResponse('Tag list fetched', tags);
    }

    @ApiOperation({ summary: 'Create a new tag' })
    @ApiResponse({ status: 201, description: 'Tag created successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Post()
    async createTag(@UserId() userId: string, @Body() dto: CreateTagDto) {
        if (!dto.tagName) {
            throw new HttpException('tagName is required', HttpStatus.BAD_REQUEST);
        }
        const result = await this.tagService.createTagForUser(
            userId,
            dto.tagName,
            dto.parentTagId ?? null,
        );
        return buildResponse('Tag created', result);
    }

    @ApiOperation({ summary: 'Update a tag' })
    @ApiParam({ name: 'tagId', description: 'ID of the tag to update' })
    @ApiResponse({ status: 200, description: 'Tag updated successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Patch(':tagId')
    async updateTag(
        @UserId() userId: string,
        @Param('tagId', ParseIntPipe) tagId: number,
        @Body() dto: UpdateTagDto,
    ) {
        const updated = await this.tagService.updateTagForUser(
            userId,
            tagId,
            dto.newName,
            dto.newParentTagId,
        );
        return buildResponse('Tag updated', updated);
    }

    @ApiOperation({ summary: 'Delete a tag' })
    @ApiParam({ name: 'tagId', description: 'ID of the tag to delete' })
    @ApiResponse({ status: 200, description: 'Tag deleted successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Delete(':tagId')
    async deleteTag(@UserId() userId: string, @Param('tagId', ParseIntPipe) tagId: number) {
        await this.tagService.deleteTagForUser(userId, tagId);
        return buildResponse('Tag deleted');
    }

    // FeedItemとの紐付け
    @ApiOperation({ summary: 'Get tags for a feed item' })
    @ApiParam({ name: 'feedItemId', description: 'ID of the feed item' })
    @ApiResponse({
        status: 200,
        description: 'Returns tags associated with the feed item',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Get('feed-items/:feedItemId')
    async getFeedItemTags(
        @UserId() userId: string,
        @Param('feedItemId', ParseIntPipe) feedItemId: number,
    ) {
        const result = await this.tagService.getTagsByFeedItem(userId, feedItemId);
        return buildResponse('Tags for feed item', result);
    }

    @ApiOperation({ summary: 'Attach a tag to a feed item' })
    @ApiParam({ name: 'feedItemId', description: 'ID of the feed item' })
    @ApiResponse({ status: 200, description: 'Tag attached to feed item' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Post('feed-items/:feedItemId')
    async attachTagToFeedItem(
        @UserId() userId: string,
        @Param('feedItemId', ParseIntPipe) feedItemId: number,
        @Body() body: { tagId: number },
    ) {
        if (!body.tagId) {
            throw new HttpException('tagId is required', HttpStatus.BAD_REQUEST);
        }
        await this.tagService.attachTagToFeedItem(userId, feedItemId, body.tagId);
        return buildResponse('Tag attached to feed item');
    }

    @ApiOperation({ summary: 'Detach a tag from a feed item' })
    @ApiParam({ name: 'feedItemId', description: 'ID of the feed item' })
    @ApiQuery({ name: 'tagId', description: 'ID of the tag to detach' })
    @ApiResponse({ status: 200, description: 'Tag detached from feed item' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Delete('feed-items/:feedItemId')
    async detachTagFromFeedItem(
        @UserId() userId: string,
        @Param('feedItemId', ParseIntPipe) feedItemId: number,
        @Query('tagId') tagId?: string,
    ) {
        if (!tagId) {
            throw new HttpException('tagId is required as query', HttpStatus.BAD_REQUEST);
        }
        const parsedTagId = Number.parseInt(tagId, 10);
        await this.tagService.detachTagFromFeedItem(userId, feedItemId, parsedTagId);
        return buildResponse('Tag detached from feed item');
    }

    // UserSubscriptionとの紐付け
    @ApiOperation({ summary: 'Get tags for a subscription' })
    @ApiParam({ name: 'subscriptionId', description: 'ID of the subscription' })
    @ApiResponse({
        status: 200,
        description: 'Returns tags associated with the subscription',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Get('subscriptions/:subscriptionId')
    async getSubscriptionTags(
        @UserId() userId: string,
        @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
    ) {
        const result = await this.tagService.getTagsBySubscription(userId, subscriptionId);
        return buildResponse('Tags for subscription', result);
    }

    @ApiOperation({ summary: 'Attach a tag to a subscription' })
    @ApiParam({ name: 'subscriptionId', description: 'ID of the subscription' })
    @ApiResponse({ status: 200, description: 'Tag attached to subscription' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Post('subscriptions/:subscriptionId')
    async attachTagToSubscription(
        @UserId() userId: string,
        @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
        @Body() body: { tagId: number },
    ) {
        if (!body.tagId) {
            throw new HttpException('tagId is required', HttpStatus.BAD_REQUEST);
        }
        await this.tagService.attachTagToSubscription(userId, subscriptionId, body.tagId);
        return buildResponse('Tag attached to subscription');
    }

    @ApiOperation({ summary: 'Detach a tag from a subscription' })
    @ApiParam({ name: 'subscriptionId', description: 'ID of the subscription' })
    @ApiQuery({ name: 'tagId', description: 'ID of the tag to detach' })
    @ApiResponse({ status: 200, description: 'Tag detached from subscription' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Delete('subscriptions/:subscriptionId')
    async detachTagFromSubscription(
        @UserId() userId: string,
        @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
        @Query('tagId') tagId?: string,
    ) {
        if (!tagId) {
            throw new HttpException('tagId is required as query', HttpStatus.BAD_REQUEST);
        }
        const parsedTagId = Number.parseInt(tagId, 10);
        await this.tagService.detachTagFromSubscription(userId, subscriptionId, parsedTagId);
        return buildResponse('Tag detached from subscription');
    }

    // 階層化タグの高度な機能

    @ApiOperation({
        summary: 'Create a hierarchical tag with advanced features',
    })
    @ApiResponse({
        status: 201,
        description: 'Hierarchical tag created successfully',
        type: Object,
    })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Post('hierarchical')
    async createHierarchicalTag(@UserId() userId: string, @Body() dto: CreateHierarchicalTagDto) {
        const result = await this.hierarchicalTagService.createHierarchicalTag(userId, dto);
        return buildResponse('Hierarchical tag created', result);
    }

    @ApiOperation({ summary: 'Get all tags in hierarchical structure' })
    @ApiResponse({
        status: 200,
        description: 'Returns tag hierarchy',
        type: [TagHierarchyDto],
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Get('hierarchy')
    async getTagHierarchy(@UserId() userId: string) {
        const hierarchy = await this.hierarchicalTagService.getTagHierarchy(userId);
        return buildResponse('Tag hierarchy fetched', hierarchy);
    }

    @ApiOperation({ summary: 'Get tag subtree (tag and all its descendants)' })
    @ApiParam({ name: 'tagId', description: 'ID of the root tag' })
    @ApiResponse({
        status: 200,
        description: 'Returns tag subtree',
        type: TagHierarchyDto,
    })
    @ApiResponse({ status: 404, description: 'Tag not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Get(':tagId/subtree')
    async getTagSubtree(@UserId() userId: string, @Param('tagId', ParseIntPipe) tagId: number) {
        const subtree = await this.hierarchicalTagService.getTagSubtree(userId, tagId);
        if (!subtree) {
            throw new HttpException('Tag not found', HttpStatus.NOT_FOUND);
        }
        return buildResponse('Tag subtree fetched', subtree);
    }

    @ApiOperation({ summary: 'Get tag path from root to specified tag' })
    @ApiParam({ name: 'tagId', description: 'ID of the tag' })
    @ApiResponse({
        status: 200,
        description: 'Returns tag path',
        type: TagWithPathDto,
    })
    @ApiResponse({ status: 404, description: 'Tag not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Get(':tagId/path')
    async getTagPath(@UserId() userId: string, @Param('tagId', ParseIntPipe) tagId: number) {
        const path = await this.hierarchicalTagService.getTagPath(userId, tagId);
        if (!path) {
            throw new HttpException('Tag not found', HttpStatus.NOT_FOUND);
        }
        return buildResponse('Tag path fetched', path);
    }

    @ApiOperation({ summary: 'Move tag to a new parent (change hierarchy)' })
    @ApiParam({ name: 'tagId', description: 'ID of the tag to move' })
    @ApiResponse({ status: 200, description: 'Tag moved successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 404, description: 'Tag not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Patch(':tagId/move')
    async moveTag(
        @UserId() userId: string,
        @Param('tagId', ParseIntPipe) tagId: number,
        @Body() dto: MoveTagDto,
    ) {
        const result = await this.hierarchicalTagService.moveTag(
            userId,
            tagId,
            dto.new_parent_id ?? null,
        );
        return buildResponse('Tag moved', result);
    }

    @ApiOperation({
        summary: 'Get feed items filtered by tag (with optional child inclusion)',
    })
    @ApiParam({ name: 'tagId', description: 'ID of the tag' })
    @ApiQuery({
        name: 'includeChildren',
        required: false,
        description: 'Include child tags in filter',
        type: Boolean,
    })
    @ApiResponse({ status: 200, description: 'Returns filtered feed items' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Get(':tagId/feed-items')
    async getFeedItemsByTag(
        @UserId() userId: string,
        @Param('tagId', ParseIntPipe) tagId: number,
        @Query('includeChildren') includeChildren?: string,
    ) {
        const includeChildrenBool = includeChildren === 'true';
        const feedItems = await this.hierarchicalTagService.getFeedItemsByTag(
            userId,
            tagId,
            includeChildrenBool,
        );
        return buildResponse('Feed items by tag fetched', feedItems);
    }

    @ApiOperation({
        summary: 'Get subscriptions filtered by tag (with optional child inclusion)',
    })
    @ApiParam({ name: 'tagId', description: 'ID of the tag' })
    @ApiQuery({
        name: 'includeChildren',
        required: false,
        description: 'Include child tags in filter',
        type: Boolean,
    })
    @ApiResponse({ status: 200, description: 'Returns filtered subscriptions' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Get(':tagId/subscriptions')
    async getSubscriptionsByTag(
        @UserId() userId: string,
        @Param('tagId', ParseIntPipe) tagId: number,
        @Query('includeChildren') includeChildren?: string,
    ) {
        const includeChildrenBool = includeChildren === 'true';
        const subscriptions = await this.hierarchicalTagService.getSubscriptionsByTag(
            userId,
            tagId,
            includeChildrenBool,
        );
        return buildResponse('Subscriptions by tag fetched', subscriptions);
    }

    @ApiOperation({ summary: 'Tag multiple feed items with multiple tags' })
    @ApiParam({ name: 'feedItemId', description: 'ID of the feed item' })
    @ApiResponse({ status: 200, description: 'Feed item tagged successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Post('feed-items/:feedItemId/bulk')
    async tagFeedItem(
        @UserId() userId: string,
        @Param('feedItemId', ParseIntPipe) feedItemId: number,
        @Body() body: { tagIds: number[] },
    ) {
        if (!body.tagIds || !Array.isArray(body.tagIds)) {
            throw new HttpException('tagIds array is required', HttpStatus.BAD_REQUEST);
        }
        await this.hierarchicalTagService.tagFeedItem(userId, feedItemId, body.tagIds);
        return buildResponse('Feed item tagged with multiple tags');
    }

    @ApiOperation({ summary: 'Tag subscription with multiple tags' })
    @ApiParam({ name: 'subscriptionId', description: 'ID of the subscription' })
    @ApiResponse({
        status: 200,
        description: 'Subscription tagged successfully',
    })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @Post('subscriptions/:subscriptionId/bulk')
    async tagSubscription(
        @UserId() userId: string,
        @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
        @Body() body: { tagIds: number[] },
    ) {
        if (!body.tagIds || !Array.isArray(body.tagIds)) {
            throw new HttpException('tagIds array is required', HttpStatus.BAD_REQUEST);
        }
        await this.hierarchicalTagService.tagSubscription(userId, subscriptionId, body.tagIds);
        return buildResponse('Subscription tagged with multiple tags');
    }
}
