const { writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { NestFactory } = require("@nestjs/core");
const { DocumentBuilder, SwaggerModule } = require("@nestjs/swagger");
const yaml = require("js-yaml");
const { AppModule } = require("../dist/app.module.js");

(async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  const config = new DocumentBuilder()
    .setTitle("API Documentation")
    .setDescription("API Documentation")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, config);
  const out = resolve(process.cwd(), "swagger.nestjs.yaml");
  writeFileSync(out, yaml.dump(doc), { encoding: "utf8" });
  await app.close();
  // eslint-disable-next-line no-console
  console.log("Wrote:", out);
})().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

