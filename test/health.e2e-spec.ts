// test/health.e2e-spec.ts

import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'

describe('HealthController (e2e)', () => {
    let app: INestApplication

    beforeAll(async () => {
        // AppModule をコンパイルしてNestアプリケーションを起動
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile()

        app = moduleFixture.createNestApplication()
        // グローバルプレフィックスやバージョニングが設定される前に init() しないよう注意
        await app.init()
    })

    afterAll(async () => {
        // テスト後はアプリケーションを閉じる
        await app.close()
    })

    it('/health (GET) should return 200 & valid JSON', async () => {
        // main.ts で globalPrefix('api') + versioning('v1') を有効化しているなら
        // 実際のルートは /api/v1/health になる
        const url = '/api/v1/health'

        const response = await request(app.getHttpServer()).get(url)
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('status', 'OK')
        expect(response.body).toHaveProperty('db', 'OK')
        expect(response.body).toHaveProperty('bullQueue')
        expect(response.body.bullQueue).toHaveProperty('status', 'OK')
        expect(typeof response.body.bullQueue.jobCounts).toBe('object')
    })
})
