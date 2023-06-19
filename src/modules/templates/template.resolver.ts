import { UseGuards } from '@nestjs/common';
import { Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import { IsCreator } from 'src/auth/guards/is-creator.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import CreateTemplateDTO from './dto/create-template.dto';
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
    payload: CreateTemplateDTO,
  ): Promise<Template> {
    return await this.templateService.createTemplate(user.id, payload);
  }

  @Query(() => Template, { nullable: true })
  async getTemplateById(id: string): Promise<Template | null> {
    return await this.templateService.getTemplateById(id);
  }

  @Query(() => [Template])
  async getTemplatesByAuthor(authorId: string): Promise<Template[]> {
    return await this.templateService.getTemplatesByAuthor(authorId);
  }
}
