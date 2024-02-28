import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { IntegrationModule } from '../integration/integration.module';
import { Profile, ProfileSchema } from './models/profile';
import { ProfileResolver } from './profile.resolver';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Profile.name,
        schema: ProfileSchema,
      },
    ]),
    IntegrationModule,
  ],
  providers: [ProfileService, ProfileResolver],
  exports: [ProfileService],
})
export class ProfileModule {}
