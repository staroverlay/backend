import { Module } from '@nestjs/common';

import { OAuthResolver } from './oauth.resolver';
import { IntegrationModule } from '../integration/integration.module';
import { TwitchModule } from '../twitch/twitch.module';

@Module({
  imports: [IntegrationModule, TwitchModule],
  providers: [OAuthResolver],
})
export class OAuthModule {}
