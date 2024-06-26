import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import { IsVerifiedGuard } from 'src/auth/guards/is-verified.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import { SettingsScopes } from '../shared/SettingsScope';
import { User } from '../users/models/user';
import CreateWidgetDTO from './dto/create-widget.dto';
import UpdateWidgetDTO from './dto/update-widget-dto';
import { Widget } from './models/widget';
import { WidgetsService } from './widgets.service';

@Resolver(() => Widget)
export class WidgetsResolver {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Mutation(() => Widget)
  @UseGuards(GqlAuthGuard, IsVerifiedGuard)
  async createWidget(
    @CurrentUser() user: User,
    @Args('payload') payload: CreateWidgetDTO,
  ): Promise<Widget> {
    return this.widgetsService.createWidget(user.profileId, payload);
  }

  @Query(() => [Widget])
  @UseGuards(GqlAuthGuard)
  async getWidgets(@CurrentUser() user: User) {
    return this.widgetsService.getWidgetsByUser(user.profileId);
  }

  @Query(() => Widget)
  async getWidgetByToken(@Args('token') token: string): Promise<Widget | null> {
    const widget = await this.widgetsService.getWidgetByToken(token);
    if (!widget) {
      throw new NotFoundException('Widget not found');
    }
    return widget;
  }

  @Query(() => [Widget])
  @UseGuards(GqlAuthGuard)
  async getWidgetsByUser(
    @CurrentUser() user: User,
    @Args('profileId') profileId: string,
  ): Promise<Widget[]> {
    // TODO: Check if user is editor of the other user.
    if (user.profileId != profileId) {
      throw new UnauthorizedException("You can't access other user's widgets");
    }

    return this.widgetsService.getWidgetsByUser(profileId);
  }

  @Query(() => Widget)
  @UseGuards(GqlAuthGuard)
  async getWidgetById(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<Widget | null> {
    const widget = await this.widgetsService.getWidgetById(id);
    if (!widget || widget.ownerId != user.profileId) {
      throw new NotFoundException('Widget not found');
    }

    return widget;
  }

  @Mutation(() => Widget)
  @UseGuards(GqlAuthGuard)
  async updateWidget(
    @CurrentUser() user: User,
    @Args('id') widgetId: string,
    @Args('payload') payload: UpdateWidgetDTO,
  ) {
    // Check if payload.scopes are valid scopes.
    if (payload.scopes) {
      for (const scope of payload.scopes) {
        if (!SettingsScopes.includes(scope)) {
          throw new BadRequestException(`Invalid scope: ${scope}`);
        }
      }
    }

    // TODO: Check if user is editor of the other user.
    return await this.widgetsService.updateWidget(
      user.profileId,
      widgetId,
      payload,
    );
  }

  @Mutation(() => Widget)
  @UseGuards(GqlAuthGuard)
  async resetWidgetToken(
    @CurrentUser() user: User,
    @Args('id') widgetId: string,
  ) {
    return await this.widgetsService.resetWidgetToken(user.profileId, widgetId);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteWidget(@CurrentUser() user: User, @Args('id') widgetId: string) {
    // TODO: Check if user is editor of the other user.
    return this.widgetsService.deleteWidget(user.profileId, widgetId);
  }
}
