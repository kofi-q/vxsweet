import { MockDocument, MockPage, setMockPdfNumPages } from './react_pdf_mocks';

jest.mock('react-pdf', (): typeof import('react-pdf') => {
  const original = jest.requireActual('react-pdf');
  return {
    ...original,
    pdfjs: { GlobalWorkerOptions: { workerSrc: '/mock', workerPort: 3000 } },
    Document: MockDocument,
    Page: MockPage,
  };
});

afterEach(() => {
  setMockPdfNumPages(1);
});
