import { GqlAuthGuard } from '@/auth/guards/gql-auth.guard';
import { IsCreatorGuard } from '@/auth/guards/is-creator.guard';
import { IsVerifiedGuard } from '@/auth/guards/is-verified.guard';
import CurrentUser from '@/decorators/current-user.decorator';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { TemplateService } from '../templates/template.service';
import { User } from '../users/models/user';
import PostTemplateVersionDTO from './dto/post-template-version.dto';
import { TemplateVersion } from './models/template-version';
import { TemplateVersionService } from './template-version.service';

@Resolver(() => TemplateVersion)
export class TemplateVersionResolver {
  constructor(
    private readonly templateService: TemplateService,
    private readonly versionService: TemplateVersionService,
  ) {}

  @Query(() => TemplateVersion, { nullable: true })
  @UseGuards(GqlAuthGuard, IsVerifiedGuard)
  async getTemplateVersion(
    @CurrentUser() user: User,
    @Args('templateId') templateId: string,
    @Args('versionId') versionId: string,
  ): Promise<TemplateVersion | null> {
    await this.versionService.ensureCanAccess(templateId, user.profileId);
    return await this.versionService.getTemplateVersion(templateId, versionId);
  }

  @Query(() => TemplateVersion, { nullable: true })
  @UseGuards(GqlAuthGuard, IsVerifiedGuard)
  async getLastTemplateVersion(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<TemplateVersion | null> {
    await this.versionService.ensureCanAccess(id, user.profileId);
    const template = await this.templateService.getTemplateById(id);

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const versionId = template.lastVersionId;
    return await this.versionService.getTemplateVersion(
      template._id,
      versionId,
    );
  }

  @Mutation(() => TemplateVersion)
  @UseGuards(GqlAuthGuard, IsCreatorGuard, IsVerifiedGuard)
  async postTemplateVersion(
    @CurrentUser() user: User,
    @Args('id') templateId: string,
    @Args('payload') payload: PostTemplateVersionDTO,
  ) {
    return await this.versionService.postTemplateVersion(
      user.profileId,
      templateId,
      payload,
    );
  }
}
