import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get()
  getData() {
    return this.appService.getData();
  }
}
