import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
    Scope,
} from "@nestjs/common";
import { RequestUserContextService } from "@/auth/application/request-user-context.service";
import { EmbeddingQueueService } from "@/embedding/queue/embedding-queue.service";
import { EmbeddingService } from "../../search/infrastructure/services/embedding.service";
import { TagEntity } from "../domain/tag.entity";
import { TagRepository } from "../infrastructure/tag.repository";
import { CreateHierarchicalTagDto } from "./dto/create-hierarchical-tag.dto";

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

type TagHierarchyPayload = {
    id: number;
    tag_name: string;
    parent_tag_id: number | null;
    description?: string | null;
    color?: string | null;
    children: TagHierarchyPayload[];
    path: string[];
    level: number;
    feed_count?: number | null;
};

type TagPathPayload = {
    id: number;
    tag_name: string;
    parent_tag_id: number | null;
    full_path: string;
    path_array: string[];
    level: number;
};

type TagIndex = {
    byId: Map<number, TagEntity>;
    childrenByParent: Map<number, TagEntity[]>;
};

@Injectable({ scope: Scope.REQUEST })
export class HierarchicalTagService {
    private readonly logger = new Logger(HierarchicalTagService.name);

    constructor(
        private readonly tagRepository: TagRepository,
        private readonly embeddingService: EmbeddingService,
        private readonly embeddingQueueService: EmbeddingQueueService,
        private readonly userContextService: RequestUserContextService,
    ) {}

    // 階層構造でタグを作成
    async createHierarchicalTag(
        userId: string,
        dto: CreateHierarchicalTagDto,
    ): Promise<TagEntity> {
        this.userContextService.assertSameUser(userId);
        // 親タグの検証
        if (dto.parentTagId) {
            const parentTag = await this.tagRepository.findById(
                dto.parentTagId,
                userId,
            );
            if (!parentTag) {
                throw new NotFoundException("Parent tag not found");
            }

            // 深度制限のチェック（最大5階層）
            const tagIndex = await this.loadTagIndex(userId);
            const depth = this.getTagDepthFromIndex(tagIndex, dto.parentTagId);
            if (depth >= 4) {
                // 0-indexed なので4が最大（5階層）
                throw new BadRequestException(
                    "Maximum tag hierarchy depth (5 levels) exceeded",
                );
            }
        }

        // 同一親の下でのタグ名重複チェック
        const duplicateTag = await this.tagRepository.findByNameAndParent(
            userId,
            dto.tagName,
            dto.parentTagId || null,
        );
        if (duplicateTag) {
            throw new BadRequestException(
                "Tag with this name already exists under the same parent",
            );
        }

        // タグのベクトル埋め込み生成
        let tagEmbedding: number[] | undefined;
        try {
            const tagText = dto.description
                ? `${dto.tagName} ${dto.description}`
                : dto.tagName;
            tagEmbedding = await this.embeddingService.generateEmbedding(
                this.embeddingService.preprocessText(tagText),
            );
        } catch (error) {
            this.logger.warn(
                `Failed to generate embedding for tag: ${error.message}`,
            );
        }

        // タグ作成
        const tag = await this.tagRepository.create(userId, {
            tag_name: dto.tagName,
            parent_tag_id: dto.parentTagId || null,
            description: dto.description,
            color: dto.color,
            tag_emb: tagEmbedding,
        });

        this.logger.log(
            `Created hierarchical tag: ${dto.tagName} for user ${userId}`,
        );
        // バックグラウンドでも最新埋め込みを維持（DBトリガーや将来の仕様変更に対応）
        await this.embeddingQueueService.addSingleEmbeddingJob(
            userId,
            tag.id,
            "tags",
        );
        return tag;
    }

    // ユーザーの全タグを階層構造で取得
    async getTagHierarchy(userId: string): Promise<TagHierarchy[]> {
        this.userContextService.assertSameUser(userId);
        const hierarchy = await this.tagRepository.getTagHierarchy();
        return this.normalizeHierarchyList(hierarchy ?? []);
    }

    // 特定のタグとその子孫を取得
    async getTagSubtree(
        userId: string,
        tagId: number,
    ): Promise<TagHierarchy | null> {
        this.userContextService.assertSameUser(userId);
        const subtree = await this.tagRepository.getTagSubtree(tagId);
        if (!subtree) {
            return null;
        }

        return this.normalizeHierarchyNode(subtree);
    }

    // タグのパス（ルートからのパス）を取得
    async getTagPath(
        userId: string,
        tagId: number,
    ): Promise<TagWithPath | null> {
        this.userContextService.assertSameUser(userId);
        const pathResult = await this.tagRepository.getTagPath(tagId);
        if (!pathResult) {
            return null;
        }

        const normalized = pathResult as TagPathPayload;
        return {
            id: normalized.id,
            tag_name: normalized.tag_name,
            parent_tag_id: normalized.parent_tag_id,
            full_path: normalized.full_path,
            path_array: normalized.path_array ?? [],
            level: normalized.level ?? 0,
        };
    }

    // タグを移動（親を変更）
    async moveTag(
        userId: string,
        tagId: number,
        newParentId: number | null,
    ): Promise<TagEntity> {
        this.userContextService.assertSameUser(userId);
        const tag = await this.tagRepository.findById(tagId, userId);
        if (!tag) {
            throw new NotFoundException("Tag not found");
        }

        // 新しい親タグの検証
        if (newParentId) {
            const newParent = await this.tagRepository.findById(
                newParentId,
                userId,
            );
            if (!newParent) {
                throw new NotFoundException("New parent tag not found");
            }

            const tagIndex = await this.loadTagIndex(userId);
            const descendants = this.getDescendantsFromIndex(tagIndex, tagId);
            const descendantIds = new Set(descendants.map((d) => d.id));

            // 自分自身の子孫に移動しようとしていないかチェック
            if (descendantIds.has(newParentId)) {
                throw new BadRequestException(
                    "Cannot move tag to its own descendant",
                );
            }

            const wouldCycle = this.wouldCreateCircularReference(
                tagIndex,
                newParentId,
                tagId,
            );
            if (wouldCycle) {
                throw new BadRequestException(
                    "Cannot create tag cycle by assigning this parent",
                );
            }

            // 移動後の深度チェック
            const newDepth = this.getTagDepthFromIndex(tagIndex, newParentId);
            const subtreeDepth = this.getSubtreeDepthFromIndex(tagIndex, tagId);
            if (newDepth + subtreeDepth >= 5) {
                throw new BadRequestException(
                    "Moving this tag would exceed maximum depth",
                );
            }
        }

        const updated = await this.tagRepository.update(tagId, userId, {
            parent_tag_id: newParentId,
        });
        // バックグラウンドで埋め込み更新
        await this.embeddingQueueService.addSingleEmbeddingJob(
            userId,
            updated.id,
            "tags",
        );
        return updated;
    }

    // RSSフィードをタグに関連付け
    async tagSubscription(
        userId: string,
        subscriptionId: number,
        tagIds: number[],
    ): Promise<void> {
        this.userContextService.assertSameUser(userId);
        // タグの存在確認
        for (const tagId of tagIds) {
            const tag = await this.tagRepository.findById(tagId, userId);
            if (!tag) {
                throw new NotFoundException(`Tag ${tagId} not found`);
            }
        }

        await this.tagRepository.tagSubscription(
            userId,
            subscriptionId,
            tagIds,
        );
    }

    // フィードアイテムをタグに関連付け
    async tagFeedItem(
        userId: string,
        feedItemId: number,
        tagIds: number[],
    ): Promise<void> {
        this.userContextService.assertSameUser(userId);
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
    async getFeedItemsByTag(
        userId: string,
        tagId: number,
        includeChildren = false,
    ) {
        this.userContextService.assertSameUser(userId);
        const tagIds = includeChildren
            ? [
                  tagId,
                  ...(await this.getTagDescendants(userId, tagId)).map(
                      (t) => t.id,
                  ),
              ]
            : [tagId];

        return await this.tagRepository.getFeedItemsByTags(userId, tagIds);
    }

    // タグで絞り込んだサブスクリプションを取得
    async getSubscriptionsByTag(
        userId: string,
        tagId: number,
        includeChildren = false,
    ) {
        this.userContextService.assertSameUser(userId);
        const tagIds = includeChildren
            ? [
                  tagId,
                  ...(await this.getTagDescendants(userId, tagId)).map(
                      (t) => t.id,
                  ),
              ]
            : [tagId];

        return await this.tagRepository.getSubscriptionsByTags(userId, tagIds);
    }

    // プライベートメソッド: 循環参照チェック
    private wouldCreateCircularReference(
        tagIndex: TagIndex,
        candidateParentId: number | null,
        movingTagId: number | null,
    ): boolean {
        if (!candidateParentId || !movingTagId) {
            return false;
        }

        if (candidateParentId === movingTagId) {
            return true;
        }

        const visited = new Set<number>();
        let currentId: number | null = candidateParentId;

        while (currentId) {
            if (visited.has(currentId)) {
                // 既存のループを検出
                return true;
            }
            visited.add(currentId);

            if (currentId === movingTagId) {
                return true;
            }

            const parent = tagIndex.byId.get(currentId);

            if (!parent) {
                break;
            }

            currentId = parent.parent_tag_id ?? null;
        }

        return false;
    }

    // プライベートメソッド: タグの深度を取得
    private getTagDepthFromIndex(tagIndex: TagIndex, tagId: number): number {
        let depth = 0;
        let current = tagIndex.byId.get(tagId);
        const visited = new Set<number>();

        while (current && current.parent_tag_id !== null) {
            if (visited.has(current.id)) {
                break;
            }
            visited.add(current.id);

            const parent = tagIndex.byId.get(current.parent_tag_id);
            if (!parent) break;

            current = parent;
            depth++;
        }

        return depth;
    }

    // プライベートメソッド: タグの子孫を取得
    private async getTagDescendants(
        userId: string,
        tagId: number,
    ): Promise<TagEntity[]> {
        const tagIndex = await this.loadTagIndex(userId);
        return this.getDescendantsFromIndex(tagIndex, tagId);
    }

    private getDescendantsFromIndex(
        tagIndex: TagIndex,
        tagId: number,
    ): TagEntity[] {
        const descendants: TagEntity[] = [];
        const visited = new Set<number>([tagId]);
        const stack = [...(tagIndex.childrenByParent.get(tagId) ?? [])];

        while (stack.length > 0) {
            const current = stack.pop();
            if (!current) continue;
            if (visited.has(current.id)) continue;
            visited.add(current.id);
            descendants.push(current);
            const children = tagIndex.childrenByParent.get(current.id) ?? [];
            stack.push(...children);
        }

        return descendants;
    }

    // プライベートメソッド: サブツリーの最大深度を取得
    private getSubtreeDepthFromIndex(
        tagIndex: TagIndex,
        tagId: number,
    ): number {
        let maxDepth = 0;
        const visited = new Set<number>();
        const stack: Array<{ id: number; depth: number }> = [
            { id: tagId, depth: 0 },
        ];

        while (stack.length > 0) {
            const current = stack.pop();
            if (!current) continue;
            if (visited.has(current.id)) continue;
            visited.add(current.id);
            maxDepth = Math.max(maxDepth, current.depth);
            const children = tagIndex.childrenByParent.get(current.id) ?? [];
            for (const child of children) {
                stack.push({ id: child.id, depth: current.depth + 1 });
            }
        }

        return maxDepth;
    }

    private async loadTagIndex(userId: string): Promise<TagIndex> {
        const tags = await this.tagRepository.findByUser(userId);
        return this.buildTagIndex(tags);
    }

    private buildTagIndex(tags: TagEntity[]): TagIndex {
        const byId = new Map<number, TagEntity>();
        const childrenByParent = new Map<number, TagEntity[]>();

        for (const tag of tags) {
            byId.set(tag.id, tag);
            if (tag.parent_tag_id === null) continue;
            const list = childrenByParent.get(tag.parent_tag_id);
            if (list) {
                list.push(tag);
            } else {
                childrenByParent.set(tag.parent_tag_id, [tag]);
            }
        }

        return { byId, childrenByParent };
    }

    private normalizeHierarchyList(
        nodes: TagHierarchyPayload[],
    ): TagHierarchy[] {
        return nodes.map((node) => this.normalizeHierarchyNode(node));
    }

    private normalizeHierarchyNode(node: TagHierarchyPayload): TagHierarchy {
        return {
            id: node.id,
            tag_name: node.tag_name,
            parent_tag_id: node.parent_tag_id,
            description: node.description ?? undefined,
            color: node.color ?? undefined,
            path: node.path ?? [],
            level: node.level ?? 0,
            feed_count: node.feed_count ?? undefined,
            children: Array.isArray(node.children)
                ? node.children.map((child) =>
                      this.normalizeHierarchyNode(child),
                  )
                : [],
        };
    }
}
