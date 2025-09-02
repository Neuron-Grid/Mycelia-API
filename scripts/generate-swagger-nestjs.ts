import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import yaml from "js-yaml";
import { AppModule } from "@/app.module";

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  const swaggerConfig = new DocumentBuilder()
    .setTitle("API Documentation")
    .setDescription("API Documentation")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const doc = SwaggerModule.createDocument(app, swaggerConfig);
  const out = resolve(process.cwd(), "swagger.nestjs.yaml");
  writeFileSync(out, yaml.dump(doc), { encoding: "utf8" });
  await app.close();
  // eslint-disable-next-line no-console
  console.log("Wrote:", out);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

