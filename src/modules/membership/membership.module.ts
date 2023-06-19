import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MembershipResolver } from './membership.resolver';
import { MembershipService } from './membership.service';
import { Membership, MembershipSchema } from './models/membership';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Membership.name,
        schema: MembershipSchema,
      },
    ]),
  ],
  providers: [MembershipService, MembershipResolver],
  exports: [MembershipService],
})
export class MembershipModule {}
