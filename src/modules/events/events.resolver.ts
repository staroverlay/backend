import { UnauthorizedException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { GqlAuthGuard } from '@/src/auth/guards/gql-auth.guard';
import CurrentUser from '@/src/decorators/current-user.decorator';

import { EventsService } from './events.service';
import { User } from '../users/models/user';
import { WidgetsService } from '../widgets/widgets.service';

@Resolver(() => Boolean)
export class EventsResolver {
  constructor(
    private readonly eventsService: EventsService,
    private readonly widgetService: WidgetsService,
  ) {}

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async emitDebugEvent(
    @CurrentUser() user: User,
    @Args('widgetId') widgetId: string,
    @Args('eventName') eventName: string,
  ) {
    const widget = await this.widgetService.getWidgetById(widgetId);
    if (widget.userId !== user._id) {
      throw new UnauthorizedException("You don't have access to this widget");
    }

    await this.eventsService.emitDebugEvent(widget._id, eventName, {});
    return true;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async emitSettingsUpdate(
    @CurrentUser() user: User,
    @Args('widgetId') widgetId: string,
    @Args('settings') settings: string,
  ) {
    const widget = await this.widgetService.getWidgetById(widgetId);

    if (widget.userId !== user._id) {
      throw new UnauthorizedException("You don't have access to this widget");
    }

    await this.eventsService.emitSettingsUpdate(
      widget._id,
      JSON.parse(settings),
    );
    return true;
  }
}
