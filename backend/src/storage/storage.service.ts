import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  private readonly bucket = process.env.SUPABASE_BUCKET ?? 'lsg-files';

  /** Uploads to object storage. Only the key and URL are saved in the database. */
  async upload(key: string, data: Buffer, contentType: string) {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, data, { contentType, upsert: false });
    if (error) throw new InternalServerErrorException('File upload failed');
    return {
      key,
      url: `${process.env.SUPABASE_URL}/storage/v1/object/${this.bucket}/${key}`,
    };
  }

  /** The bucket is private, so files are opened through short-lived signed links. */
  async signedUrl(key: string, seconds = 300) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(key, seconds);
    if (error || !data) {
      throw new InternalServerErrorException('Could not create a download link');
    }
    return data.signedUrl;
  }

  async remove(key: string) {
    await this.client.storage.from(this.bucket).remove([key]);
  }
}