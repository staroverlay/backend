import { GqlAuthGuard } from "@/auth/guards/gql-auth.guard";
import { IsVerifiedGuard } from "@/auth/guards/is-verified.guard";
import CurrentUser from "@/decorators/current-user.decorator";
import { UseGuards } from "@nestjs/common/decorators";
import { Args, Mutation, Resolver } from "@nestjs/graphql";
import Topic from "../shared/Topics";
import { User } from "../users/models/user";
import { EventsService } from "./events.service";
import { ProfileService } from "../profiles/profile.service";
import { randomItem, randomNumber } from "@/utils/randomUtils";

@Resolver()
export class EventsResolver {

    constructor(private eventsService: EventsService, private profileService: ProfileService) { }

    @UseGuards(GqlAuthGuard, IsVerifiedGuard)
    @Mutation(() => Boolean)
    public async emitDebugEvent(
        @CurrentUser() user: User,
        @Args('widgetId') widgetId: string,
        @Args('eventName') topic: Topic,
    ) {
        this.eventsService.emitWidget(user.profileId, widgetId, topic, await this.getEventData(topic, user));
        return true;
    }

    async getEventData(topic: Topic, user: User) {
        // TODO: Implement all other topics.

        const profile = await this.profileService.getByID(user.profileId);

        console.log(topic)

        const common = {
            user_id: user._id,
            user_login: user._id,
            user_name: profile.displayName,
            broadcaster_user_id: user._id,
            broadcaster_user_login: user._id,
            broadcaster_user_name: profile.displayName,
        }

        switch (topic) {
            case "twitch:follow": {
                return {
                    ...common,
                    followed_at: new Date().toISOString()
                }
            }
            case "twitch:cheer": {
                return {
                    ...common,
                    is_anonymous: true,
                    message: "Green, green, what is your problem green?? 🟩",
                    bits: 69,
                }
            }
            case "twitch:redemption": {
                return {
                    id: "1",
                    ...common,
                    user_input: "👍",
                    status: randomItem(["unfulfilled", "unknown", 'fulfilled', 'canceled']),
                    reward: {
                        id: "string",
                        title: "string",
                        cost: randomNumber(1, 1000),
                        prompt: "string",
                    },
                    redeemed_at: new Date().toISOString()
                }
            }

        }
    }

}