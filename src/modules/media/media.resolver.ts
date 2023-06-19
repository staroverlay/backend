import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import CurrentUser from 'src/decorators/current-user.decorator';

import CompleteMediaDTO from './dto/complete-media.dto';
import CreateMediaDTO from './dto/create-media.dto';
import { MediaService } from './media.service';
import { Media } from './models/media';
import { GqlAuthGuard } from '../../auth/guards/gql-auth.guard';
import { User } from '../users/models/user';

@Resolver(() => Media)
export class MediaResolver {
  constructor(private mediaService: MediaService) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Media)
  public async createMedia(
    @CurrentUser() user: User,
    @Args('payload') payload: CreateMediaDTO,
  ) {
    const media = await this.mediaService.createMedia(user.id, payload);
    return media;
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Media)
  public async completeMedia(
    @CurrentUser() user: User,
    @Args('payload') payload: CompleteMediaDTO,
  ) {
    const media = await this.mediaService.completeResource(
      user.id,
      payload.id,
      payload.parts,
    );
    return media;
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [Media])
  public async getAllMedia(@CurrentUser() user: User) {
    const medias = await this.mediaService.getMediaByUser(user.id);
    return medias;
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => Number)
  public async getMediaQuota(@CurrentUser() user: User) {
    const medias = await this.mediaService.getMediaQuota(user.id);
    return medias;
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => Boolean)
  public async deleteMedia(@CurrentUser() user: User, @Args('id') id: string) {
    const deleted = await this.mediaService.deleteMedia(user.id, id);
    return deleted;
  }
}
