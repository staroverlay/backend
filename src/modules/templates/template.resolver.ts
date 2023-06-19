import { Query, Resolver } from '@nestjs/graphql';

import { Template } from './models/template';
import { TemplateService } from './template.service';

@Resolver(() => Template)
export class TemplateResolver {
  constructor(private templateService: TemplateService) {}

  @Query(() => Template, { nullable: true })
  async getTemplateById(id: string): Promise<Template | null> {
    return await this.templateService.getTemplateById(id);
  }

  @Query(() => [Template])
  async getTemplatesByAuthor(authorId: string): Promise<Template[]> {
    return await this.templateService.getTemplatesByAuthor(authorId);
  }
}
