import { Module } from '@nestjs/common';

import { TwitchResolver } from './twitch.resolver';
import { TwitchService } from './twitch.service';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [IntegrationModule],
  providers: [TwitchResolver, TwitchService],
  exports: [TwitchService],
})
export class TwitchModule {}
