import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import { AppModule } from './app/app.module';

const expressApp = express();
let nestAppInitialized = false;

async function createNestApp() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://localhost:5000',
      'https://weekly-arcade.web.app',
      'https://weekly-arcade.firebaseapp.com',
    ],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  await app.init();
  nestAppInitialized = true;

  return app;
}

// For Cloud Functions deployment
export const api = async (req: express.Request, res: express.Response) => {
  if (!nestAppInitialized) {
    await createNestApp();
  }
  expressApp(req, res);
};

// For local development
async function bootstrap() {
  const app = await createNestApp();
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(`🚀 API running on: http://localhost:${port}/api`);
}

// Run locally if not in Cloud Functions environment
if (process.env.K_SERVICE === undefined) {
  bootstrap();
}
