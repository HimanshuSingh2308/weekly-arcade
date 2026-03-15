import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://localhost:5000',
      'https://weekly-arcade.web.app',
      'https://weekly-arcade.firebaseapp.com',
      'https://himanshuSingh2308.github.io',
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

  // Cloud Functions Gen2/Cloud Run uses PORT env var
  const port = process.env.PORT || 8080;
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 API running on port ${port}`);
}

bootstrap();
