import { Injectable } from '@nestjs/common';
import { Axios } from 'axios';

import IResourceData from './interfaces/resource-data';
import IResourceUpload from './interfaces/resource-upload';

import { validateStatus } from '../../utils/error';

@Injectable()
export class R2Service {
  private readonly client: Axios;

  constructor() {
    const { R2_BASE_URL, R2_TOKEN } = process.env;
    this.client = new Axios({
      baseURL: R2_BASE_URL,
      headers: {
        Authorization: 'Bearer ' + R2_TOKEN,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    });
  }

  public async createResource(
    contentType: string,
    size: number,
  ): Promise<IResourceUpload> {
    const payload = { contentType, size };
    const { status, data } = await this.client.post('/', payload);
    validateStatus(status, data);
    return data as IResourceUpload;
  }

  public async completeResource(id: string, uploadId: string, parts: any[]) {
    const payload = { uploadId, parts };
    const { status, data } = await this.client.post(`/${id}/complete`, payload);
    validateStatus(status, data);
    return data as IResourceData;
  }

  public async deleteResource(id: string) {
    const { status, data } = await this.client.delete('/' + id);
    validateStatus(status, data);
    return data as IResourceData;
  }

  public async abortResource(id: string, uploadId: string) {
    const { status, data } = await this.client.delete(`/${id}/abort`, {
      data: {
        uploadId,
      },
    });
    validateStatus(status, data);
    return data as IResourceData;
  }
}
