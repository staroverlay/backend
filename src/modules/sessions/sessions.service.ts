import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';

import { Session, SessionDocument } from './schema/session';
import { SessionWithToken } from './schema/session-with-token';
import { IntegrationType } from '../integration/models/integration';

@Injectable()
export class SessionsService {
  public static WRONG_CREDENTIALS = new UnauthorizedException(
    'WRONG_CREDENTIALS',
    'Email or Password are invalid.',
  );
  public static INVALID_SESSION = new UnauthorizedException(
    'INVALID_SESSION',
    'This session is invalid or has expired',
  );

  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    private readonly jwtService: JwtService,
  ) {}

  public getByID(id: string): Promise<Session | undefined> {
    if (!isValidObjectId(id)) {
      return null;
    }
    return this.sessionModel.findById(id).exec();
  }

  public getByToken(token: string): Promise<Session | undefined> {
    return this.sessionModel.findOne({ token }).exec();
  }

  public getByUser(userId: string): Promise<Session[]> {
    return this.sessionModel.find({ userId }).exec();
  }

  public deleteByID(id: string): Promise<any> {
    if (!isValidObjectId(id)) {
      return null;
    }
    return this.sessionModel.findByIdAndDelete(id).exec();
  }

  public async deleteByUserAndID(id: string, user: string): Promise<boolean> {
    if (!isValidObjectId(id)) {
      return false;
    }

    const result = await this.sessionModel
      .findOneAndDelete({ _id: id, userId: user })
      .exec();

    return result?._id != null;
  }

  public async deleteByToken(token: string): Promise<boolean> {
    const result = await this.sessionModel.findOneAndDelete({ token }).exec();
    return result?._id != null;
  }

  public async deleteByUser(userId: string): Promise<boolean> {
    const result = await this.sessionModel.deleteMany({ userId }).exec();
    return result.deletedCount > 0;
  }

  public async createSession(
    userId: string,
    address: string,
    device: string,
    method?: IntegrationType,
  ): Promise<SessionWithToken> {
    const session = new this.sessionModel({
      address,
      device: device || 'unknown',
      userId,
      method,
    });

    const payload = { id: session._id };
    const secret = process.env['JWT_SECRET'];
    const token = this.jwtService.sign(payload, { secret });
    session.token = token;
    await session.save();

    return session as SessionWithToken;
  }
}
