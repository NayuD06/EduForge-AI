import { Controller, Get, Module, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser, CurrentUser, Roles } from '../../common/auth.js';
import { ExamsModule } from '../exams/exams.module.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('analytics')
@ApiBearerAuth()
@Roles('INSTRUCTOR')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.analytics.overview(user);
  }

  @Get('exams/:id')
  exam(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.analytics.exam(id, user);
  }
}

@Module({
  imports: [ExamsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
