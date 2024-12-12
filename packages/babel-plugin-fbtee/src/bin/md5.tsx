import crypto from 'node:crypto';

export default function md5(text: string, description: string): string {
  return crypto
    .createHash('md5')
    .update(text + description)
    .digest('base64');
}
