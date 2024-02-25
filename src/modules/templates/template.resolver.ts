import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import { IsCreatorGuard } from 'src/auth/guards/is-creator.guard';
import { IsVerifiedGuard } from 'src/auth/guards/is-verified.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import { User } from '../users/models/user';
import CreateTemplateDTO from './dto/create-template.dto';
import UpdateTemplateDTO from './dto/update-template.dto';
import { Template } from './models/template';
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
    return await this.templateService.createTemplate(user._id, payload);
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
    return await this.templateService.getTemplatesByAuthor(user._id);
  }

  @Query(() => Template, { nullable: true })
  async getTemplateById(
    @Args('id') id: string,
    @CurrentUser() user: User,
  ): Promise<Template | null> {
    const template = await this.templateService.getTemplateById(id);
    if (template?.visibility == 'private') {
      if (!user || user._id != template.authorId) {
        return null;
      }
    }

    return template;
  }

  @Query(() => [Template])
  async getTemplatesByAuthor(
    @Args('authorId') authorId: string,
  ): Promise<Template[]> {
    const templates = await this.templateService.getTemplatesByAuthor(authorId);
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
