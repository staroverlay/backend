import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';

import { User } from 'src/modules/users/models/user';

@Injectable()
export class IsCreator implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;
    const user = req.user as User;
    return user?.isCreator === true;
  }
}
