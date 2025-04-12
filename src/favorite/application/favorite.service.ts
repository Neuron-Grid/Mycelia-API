import { Injectable } from '@nestjs/common'
import { FavoriteRepository } from '../infrastructure/favorite.repository'

@Injectable()
export class FavoriteService {
    constructor(private readonly favRepo: FavoriteRepository) {}

    async getUserFavorites(userId: string) {
        return await this.favRepo.findAllByUserId(userId)
    }

    async favoriteFeedItem(userId: string, feedItemId: number) {
        return await this.favRepo.addFavorite(userId, feedItemId)
    }

    async unfavoriteFeedItem(userId: string, feedItemId: number) {
        return await this.favRepo.removeFavorite(userId, feedItemId)
    }

    async isFavorited(userId: string, feedItemId: number) {
        return await this.favRepo.isFavorited(userId, feedItemId)
    }
}
