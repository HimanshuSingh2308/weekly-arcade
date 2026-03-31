import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://localhost:4201',
      'http://localhost:5000',
      'https://weeklyarcade.games',
      'https://www.weeklyarcade.games',
      'https://weekly-arcade.web.app',
      'https://weekly-arcade.firebaseapp.com',
      'https://loyal-curve-425715-h6.web.app',
      'https://loyal-curve-425715-h6.firebaseapp.com',
    ],
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  Logger.log(`⚡ Realtime service running on port ${port}`);
}

bootstrap();
