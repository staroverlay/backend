import AuthToken from '@/decorators/auth-token.decorator';
import {
    BadRequestException,
    Body,
    Controller,
    Param,
    Post,
    UnauthorizedException
} from '@nestjs/common';
import { ProfileService } from '../profiles/profile.service';
import { SessionsService } from '../sessions/sessions.service';
import PostTemplateVersionDTO from './dto/post-template-version.dto';
import { TemplateVersionService } from './template-version.service';

@Controller('/templates')
export class TemplateVersionController {
  constructor(
    private sessionService: SessionsService,
    private versionService: TemplateVersionService,
    private profileService: ProfileService,
  ) {}

  @Post('[id]')
  async publishNewVersion(
    @AuthToken() token: string,
    @Param('templateId') id: string,
    @Body() version: PostTemplateVersionDTO,
  ) {
    let sess = await this.sessionService.getByToken(token);

    if (!sess)
      throw new UnauthorizedException('The token could not be validated.');

    let profile = await this.profileService.getByUserID(sess.userId);

    if (!profile) throw new BadRequestException('');

    return await this.versionService.postTemplateVersion(
      profile._id,
      id,
      version,
    );
  }
}
