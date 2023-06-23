import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import { IsCreator } from 'src/auth/guards/is-creator.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import CreateTemplateDTO from './dto/create-template.dto';
import UpdateTemplateDTO from './dto/update-template.dto';
import { Template } from './models/template';
import { TemplateService } from './template.service';
import { User } from '../users/models/user';

@Resolver(() => Template)
export class TemplateResolver {
  constructor(private templateService: TemplateService) {}

  @Mutation(() => Template)
  @UseGuards(GqlAuthGuard, IsCreator)
  async createTemplate(
    @CurrentUser() user: User,
    @Args('payload') payload: CreateTemplateDTO,
  ): Promise<Template> {
    return await this.templateService.createTemplate(user.id, payload);
  }

  @Mutation(() => Template)
  @UseGuards(GqlAuthGuard, IsCreator)
  async updateTemplate(
    @CurrentUser() user: User,
    @Args('id') id: string,
    @Args('payload') payload: UpdateTemplateDTO,
  ): Promise<Template> {
    return await this.templateService.updateTemplate(user.id, id, payload);
  }

  @Query(() => [Template])
  @UseGuards(GqlAuthGuard, IsCreator)
  async getMyTemplates(@CurrentUser() user: User): Promise<Template[]> {
    if (!user.isCreator) {
      throw new ForbiddenException('You must be a creator.');
    }

    return await this.templateService.getTemplatesByAuthor(user.id);
  }

  @Query(() => Template, { nullable: true })
  async getTemplateById(
    id: string,
    @CurrentUser() user: User,
  ): Promise<Template | null> {
    const template = await this.templateService.getTemplateById(id);
    if (template?.visibility == 'private') {
      if (!user || user.id != template.author) {
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
}
