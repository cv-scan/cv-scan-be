import { AppError } from '../../utils/errors';
import { parseDocx } from './docx.parser';
import { parsePdf } from './pdf.parser';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

export async function parseFile(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    return parsePdf(buffer);
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return parseDocx(buffer);
  }
  throw new AppError(`Unsupported file type: ${mimeType}`, 400, 'UNSUPPORTED_FILE_TYPE');
}
