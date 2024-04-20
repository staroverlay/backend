import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import { IsCreatorGuard } from 'src/auth/guards/is-creator.guard';
import { IsVerifiedGuard } from 'src/auth/guards/is-verified.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import { User } from '../users/models/user';
import CreateTemplateDTO from './dto/create-template.dto';
import PostTemplateVersionDTO from './dto/post-template-version.dto';
import UpdateTemplateDTO from './dto/update-template.dto';
import { Template } from './models/template';
import { TemplateVersion } from './models/template-version';
import { TemplateService } from './template.service';

@Resolver(() => Template)
export class TemplateResolver {
  constructor(private templateService: TemplateService) {}

  @Mutation(() => Template)
  @UseGuards(GqlAuthGuard, IsCreatorGuard, IsVerifiedGuard)
  async createTemplate(
    @CurrentUser() user: User,
    @Args('payload') payload: CreateTemplateDTO,
  ): Promise<Template> {
    return await this.templateService.createTemplate(user, payload);
  }

  @Query(() => TemplateVersion, { nullable: true })
  async getLastTemplateVersion(
    @Args('id') id: string,
  ): Promise<TemplateVersion | null> {
    const template = await this.templateService.getTemplateById(id);

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const version = await this.templateService.getVersion(
      template.lastVersionId,
    );
    return version;
  }

  @Mutation(() => TemplateVersion)
  @UseGuards(GqlAuthGuard, IsCreatorGuard, IsVerifiedGuard)
  async postTemplateVersion(
    @CurrentUser() user: User,
    @Args('id') templateId: string,
    @Args('payload') payload: PostTemplateVersionDTO,
  ) {
    return await this.templateService.postTemplateVersion(
      user.profileId,
      templateId,
      payload,
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard, IsCreatorGuard, IsVerifiedGuard)
  async deleteTemplate(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<boolean> {
    return await this.templateService.deleteTemplate(user._id, id);
  }

  @Query(() => [Template])
  @UseGuards(GqlAuthGuard, IsCreatorGuard)
  async getMyTemplates(@CurrentUser() user: User): Promise<Template[]> {
    if (!user.profileId) {
      return [];
    }

    return await this.templateService.getTemplatesByCreator(user.profileId);
  }

  @Query(() => Template, { nullable: true })
  async getTemplateById(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Template | null> {
    const template = await this.templateService.getTemplateById(id);
    if (template?.visibility == 'private') {
      if (!user || user.profileId != template.creatorId) {
        return null;
      }
    }

    return template;
  }

  @Query(() => [Template])
  async getTemplatesByCreator(
    @Args('creatorId') creatorId: string,
  ): Promise<Template[]> {
    const templates = await this.templateService.getTemplatesByCreator(
      creatorId,
    );
    return templates.filter((template) => template.visibility == 'public');
  }

  @Mutation(() => Template)
  @UseGuards(GqlAuthGuard, IsCreatorGuard, IsVerifiedGuard)
  async updateTemplate(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('payload') payload: UpdateTemplateDTO,
  ): Promise<Template> {
    return await this.templateService.updateTemplate(user._id, id, payload);
  }
}
