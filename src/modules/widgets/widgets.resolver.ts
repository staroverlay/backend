import {
  NotFoundException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from 'src/auth/guards/gql-auth.guard';
import { IsVerifiedGuard } from 'src/auth/guards/is-verified.guard';
import CurrentUser from 'src/decorators/current-user.decorator';

import CreateWidgetDTO from './dto/create-widget.dto';
import UpdateWidgetDTO from './dto/update-widget-dto';
import { Widget } from './models/widget';
import { WidgetsService } from './widgets.service';
import { User } from '../users/models/user';

@Resolver(() => Widget)
export class WidgetsResolver {
  constructor(private readonly widgetsService: WidgetsService) {}

  @Mutation(() => Widget)
  @UseGuards(GqlAuthGuard, IsVerifiedGuard)
  async createWidget(
    @CurrentUser() user: User,
    @Args('payload') payload: CreateWidgetDTO,
  ): Promise<Widget> {
    return this.widgetsService.createWidget(user._id, payload);
  }

  @Query(() => [Widget])
  @UseGuards(GqlAuthGuard)
  async getWidgets(@CurrentUser() user: User) {
    return this.widgetsService.getWidgetsByUser(user._id);
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
    @Args('userId') userId: string,
  ): Promise<Widget[]> {
    // TODO: Check if user is editor of the other user.
    if (user._id != userId) {
      throw new UnauthorizedException("You can't access other user's widgets");
    }

    return this.widgetsService.getWidgetsByUser(userId);
  }

  @Query(() => Widget)
  @UseGuards(GqlAuthGuard)
  async getWidgetById(
    @CurrentUser() user: User,
    @Args('id') id: string,
  ): Promise<Widget | null> {
    const widget = await this.widgetsService.getWidgetById(id);
    if (!widget || widget.userId != user._id) {
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
    // TODO: Check if user is editor of the other user.
    return await this.widgetsService.updateWidget(user._id, widgetId, payload);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteWidget(@CurrentUser() user: User, @Args('id') widgetId: string) {
    // TODO: Check if user is editor of the other user.
    return this.widgetsService.deleteWidget(user._id, widgetId);
  }
}
