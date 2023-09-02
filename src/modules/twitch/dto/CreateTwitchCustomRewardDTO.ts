import { Field, InputType } from '@nestjs/graphql';

@InputType()
export default class CreateTwitchCustomRewardDTO {
  @Field(() => String)
  title: string;

  @Field(() => Number)
  cost: number;

  @Field(() => String, { nullable: true })
  prompt?: string;

  @Field(() => Boolean, { nullable: true })
  is_enabled?: boolean;

  @Field(() => String, { nullable: true })
  background_color?: string;

  @Field(() => Boolean, { nullable: true })
  is_user_input_required?: boolean;

  @Field(() => Boolean, { nullable: true })
  is_max_per_stream_enabled?: boolean;

  @Field(() => Number)
  max_per_stream: number;

  @Field(() => Boolean, { nullable: true })
  is_max_per_user_per_stream_enabled?: boolean;

  @Field(() => Number)
  max_per_user_per_stream: number;

  @Field(() => Boolean, { nullable: true })
  is_global_cooldown_enabled?: boolean;

  @Field(() => Number, { nullable: true })
  global_cooldown_seconds?: number;

  @Field(() => Boolean, { nullable: true })
  should_redemptions_skip_request_queue?: boolean;
}
