jest.mock('./exec');

import { mockOf } from '@vx/libs/test-utils/src';
import { pdfToText } from './pdf_to_text';
import { execFile } from './exec';


const execFileMock = mockOf(execFile);

test('pdfToText', async () => {
  execFileMock.mockResolvedValueOnce({ stdout: 'pdf contents', stderr: '' });
  expect(await pdfToText('test.pdf')).toEqual('pdf contents');
  expect(execFileMock).toHaveBeenCalledWith('pdftotext', [
    'test.pdf',
    '-raw',
    '-',
  ]);
});
