import { execFile } from '../command_line/exec';

/**
 * Convert a PDF file to text.
 */
export async function pdfToText(pdfPath: string): Promise<string> {
  const { stdout } = await execFile('pdftotext', [pdfPath, '-raw', '-']);
  return stdout;
}
