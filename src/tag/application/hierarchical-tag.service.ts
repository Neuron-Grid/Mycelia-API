import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EmbeddingService } from '../../search/infrastructure/services/embedding.service';
import { TagEntity } from '../domain/tag.entity';
import { TagRepository } from '../infrastructure/tag.repository';
import { CreateHierarchicalTagDto } from './dto/create-hierarchical-tag.dto';

export interface TagHierarchy {
    id: number;
    tag_name: string;
    parent_tag_id: number | null;
    description?: string;
    color?: string;
    children: TagHierarchy[];
    path: string[];
    level: number;
    feed_count?: number;
}

export interface TagWithPath {
    id: number;
    tag_name: string;
    parent_tag_id: number | null;
    full_path: string;
    path_array: string[];
    level: number;
}

@Injectable()
export class HierarchicalTagService {
    private readonly logger = new Logger(HierarchicalTagService.name);

    constructor(
        private readonly tagRepository: TagRepository,
        private readonly embeddingService: EmbeddingService,
    ) {}

    // 階層構造でタグを作成
    async createHierarchicalTag(userId: string, dto: CreateHierarchicalTagDto): Promise<TagEntity> {
        // 親タグの検証
        if (dto.parent_tag_id) {
            const parentTag = await this.tagRepository.findById(dto.parent_tag_id, userId);
            if (!parentTag) {
                throw new NotFoundException('Parent tag not found');
            }

            // 循環参照のチェック
            const isCircular = await this.wouldCreateCircularReference(
                userId,
                dto.parent_tag_id,
                dto.tag_name,
            );
            if (isCircular) {
                throw new BadRequestException(
                    'Creating this tag would create a circular reference',
                );
            }

            // 深度制限のチェック（最大5階層）
            const depth = await this.getTagDepth(userId, dto.parent_tag_id);
            if (depth >= 4) {
                // 0-indexed なので4が最大（5階層）
                throw new BadRequestException('Maximum tag hierarchy depth (5 levels) exceeded');
            }
        }

        // 同一親の下でのタグ名重複チェック
        const duplicateTag = await this.tagRepository.findByNameAndParent(
            userId,
            dto.tag_name,
            dto.parent_tag_id || null,
        );
        if (duplicateTag) {
            throw new BadRequestException(
                'Tag with this name already exists under the same parent',
            );
        }

        // タグのベクトル埋め込み生成
        let tagEmbedding: number[] | undefined;
        try {
            const tagText = dto.description ? `${dto.tag_name} ${dto.description}` : dto.tag_name;
            tagEmbedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(tagText),
            );
        } catch (error) {
            this.logger.warn(`Failed to generate embedding for tag: ${error.message}`);
        }

        // タグ作成
        const tag = await this.tagRepository.create(userId, {
            tag_name: dto.tag_name,
            parent_tag_id: dto.parent_tag_id || null,
            description: dto.description,
            color: dto.color,
            tag_embedding: tagEmbedding,
        });

        this.logger.log(`Created hierarchical tag: ${dto.tag_name} for user ${userId}`);
        return tag;
    }

    // ユーザーの全タグを階層構造で取得
    async getTagHierarchy(userId: string): Promise<TagHierarchy[]> {
        const allTags = await this.tagRepository.findByUser(userId);
        return this.buildHierarchy(allTags);
    }

    // 特定のタグとその子孫を取得
    async getTagSubtree(userId: string, tagId: number): Promise<TagHierarchy | null> {
        const rootTag = await this.tagRepository.findById(tagId, userId);
        if (!rootTag) {
            return null;
        }

        const allTags = await this.tagRepository.findByUser(userId);
        const hierarchy = this.buildHierarchy(allTags);

        return this.findTagInHierarchy(hierarchy, tagId);
    }

    // タグのパス（ルートからのパス）を取得
    async getTagPath(userId: string, tagId: number): Promise<TagWithPath | null> {
        const tag = await this.tagRepository.findById(tagId, userId);
        if (!tag) {
            return null;
        }

        const pathArray = await this.buildTagPath(userId, tagId);

        return {
            id: tag.id,
            tag_name: tag.tag_name,
            parent_tag_id: tag.parent_tag_id,
            full_path: pathArray.join(' > '),
            path_array: pathArray,
            level: pathArray.length - 1,
        };
    }

    // タグを移動（親を変更）
    async moveTag(userId: string, tagId: number, newParentId: number | null): Promise<TagEntity> {
        const tag = await this.tagRepository.findById(tagId, userId);
        if (!tag) {
            throw new NotFoundException('Tag not found');
        }

        // 新しい親タグの検証
        if (newParentId) {
            const newParent = await this.tagRepository.findById(newParentId, userId);
            if (!newParent) {
                throw new NotFoundException('New parent tag not found');
            }

            // 自分自身の子孫に移動しようとしていないかチェック
            const descendants = await this.getTagDescendants(userId, tagId);
            if (descendants.some((d) => d.id === newParentId)) {
                throw new BadRequestException('Cannot move tag to its own descendant');
            }

            // 移動後の深度チェック
            const newDepth = await this.getTagDepth(userId, newParentId);
            const subtreeDepth = await this.getSubtreeDepth(userId, tagId);
            if (newDepth + subtreeDepth >= 5) {
                throw new BadRequestException('Moving this tag would exceed maximum depth');
            }
        }

        return await this.tagRepository.update(tagId, userId, {
            parent_tag_id: newParentId,
        });
    }

    // RSSフィードをタグに関連付け
    async tagSubscription(userId: string, subscriptionId: number, tagIds: number[]): Promise<void> {
        // タグの存在確認
        for (const tagId of tagIds) {
            const tag = await this.tagRepository.findById(tagId, userId);
            if (!tag) {
                throw new NotFoundException(`Tag ${tagId} not found`);
            }
        }

        await this.tagRepository.tagSubscription(userId, subscriptionId, tagIds);
    }

    // フィードアイテムをタグに関連付け
    async tagFeedItem(userId: string, feedItemId: number, tagIds: number[]): Promise<void> {
        // タグの存在確認
        for (const tagId of tagIds) {
            const tag = await this.tagRepository.findById(tagId, userId);
            if (!tag) {
                throw new NotFoundException(`Tag ${tagId} not found`);
            }
        }

        await this.tagRepository.tagFeedItem(userId, feedItemId, tagIds);
    }

    // タグで絞り込んだフィードアイテムを取得
    async getFeedItemsByTag(userId: string, tagId: number, includeChildren = false) {
        const tagIds = includeChildren
            ? [tagId, ...(await this.getTagDescendants(userId, tagId)).map((t) => t.id)]
            : [tagId];

        return await this.tagRepository.getFeedItemsByTags(userId, tagIds);
    }

    // タグで絞り込んだサブスクリプションを取得
    async getSubscriptionsByTag(userId: string, tagId: number, includeChildren = false) {
        const tagIds = includeChildren
            ? [tagId, ...(await this.getTagDescendants(userId, tagId)).map((t) => t.id)]
            : [tagId];

        return await this.tagRepository.getSubscriptionsByTags(userId, tagIds);
    }

    // プライベートメソッド: 階層構造を構築
    private buildHierarchy(tags: TagEntity[]): TagHierarchy[] {
        const tagMap = new Map<number, TagHierarchy>();
        const rootTags: TagHierarchy[] = [];

        // 初期化
        for (const tag of tags) {
            tagMap.set(tag.id, {
                id: tag.id,
                tag_name: tag.tag_name,
                parent_tag_id: tag.parent_tag_id,
                children: [],
                path: [],
                level: 0,
            });
        }

        // 階層構築
        for (const tag of tags) {
            const tagHierarchy = tagMap.get(tag.id);
            if (!tagHierarchy) {
                continue; // マップに存在しない場合はスキップ
            }

            if (tag.parent_tag_id === null) {
                rootTags.push(tagHierarchy);
                tagHierarchy.path = [tag.tag_name];
                tagHierarchy.level = 0;
            } else {
                const parent = tagMap.get(tag.parent_tag_id);
                if (parent) {
                    parent.children.push(tagHierarchy);
                    tagHierarchy.path = [...parent.path, tag.tag_name];
                    tagHierarchy.level = parent.level + 1;
                }
            }
        }

        return rootTags;
    }

    // プライベートメソッド: 階層から特定のタグを検索
    private findTagInHierarchy(hierarchy: TagHierarchy[], tagId: number): TagHierarchy | null {
        for (const tag of hierarchy) {
            if (tag.id === tagId) {
                return tag;
            }
            const found = this.findTagInHierarchy(tag.children, tagId);
            if (found) {
                return found;
            }
        }
        return null;
    }

    // プライベートメソッド: タグのパス配列を構築
    private async buildTagPath(userId: string, tagId: number): Promise<string[]> {
        const path: string[] = [];
        let currentId = tagId;

        while (currentId) {
            const tag = await this.tagRepository.findById(currentId, userId);
            if (!tag) break;

            path.unshift(tag.tag_name);
            currentId = tag.parent_tag_id || 0;
        }

        return path;
    }

    // プライベートメソッド: 循環参照チェック
    private wouldCreateCircularReference(
        _userId: string,
        _parentId: number,
        _tagName: string,
    ): Promise<boolean> {
        // 簡略化: 実際は既存タグのIDで循環参照をチェック
        // 新規作成時は循環参照は発生しない
        return Promise.resolve(false);
    }

    // プライベートメソッド: タグの深度を取得
    private async getTagDepth(userId: string, tagId: number): Promise<number> {
        let depth = 0;
        let currentId = tagId;

        while (currentId && depth < 10) {
            // 無限ループ防止
            const tag = await this.tagRepository.findById(currentId, userId);
            if (!tag || !tag.parent_tag_id) break;

            currentId = tag.parent_tag_id;
            depth++;
        }

        return depth;
    }

    // プライベートメソッド: タグの子孫を取得
    private async getTagDescendants(userId: string, tagId: number): Promise<TagEntity[]> {
        const allTags = await this.tagRepository.findByUser(userId);
        const descendants: TagEntity[] = [];

        const findDescendants = (parentId: number) => {
            for (const tag of allTags) {
                if (tag.parent_tag_id === parentId) {
                    descendants.push(tag);
                    findDescendants(tag.id);
                }
            }
        };

        findDescendants(tagId);
        return descendants;
    }

    // プライベートメソッド: サブツリーの最大深度を取得
    private async getSubtreeDepth(userId: string, tagId: number): Promise<number> {
        const descendants = await this.getTagDescendants(userId, tagId);

        if (descendants.length === 0) {
            return 0;
        }

        let maxDepth = 0;
        const calculateDepth = (currentId: number, currentDepth: number) => {
            maxDepth = Math.max(maxDepth, currentDepth);

            for (const descendant of descendants) {
                if (descendant.parent_tag_id === currentId) {
                    calculateDepth(descendant.id, currentDepth + 1);
                }
            }
        };

        calculateDepth(tagId, 0);
        return maxDepth;
    }
}
