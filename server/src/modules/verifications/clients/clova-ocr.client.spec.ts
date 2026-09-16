import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClovaOcrClient } from './clova-ocr.client.js';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function respondWith(body: unknown, status = 200) {
  fetchMock.mockResolvedValue({ ok: status === 200, status, json: async () => body });
}

const successfulBody = {
  images: [
    {
      uid: 'img-1',
      name: 'license.jpg',
      inferResult: 'SUCCESS',
      message: 'SUCCESS',
      businessLicense: {
        result: {
          businessName: { text: '주식회사 세모챌', boundingPoly: {} },
          businessNumber: { text: '123-45-67890', boundingPoly: {} },
        },
      },
    },
  ],
};

describe('ClovaOcrClient', () => {
  afterEach(() => fetchMock.mockReset());

  it('extracts the business name and registration number from the template result', async () => {
    respondWith(successfulBody);
    const client = new ClovaOcrClient();
    const result = await client.recognizeBusinessLicense('https://cdn.test/private/license.jpg');

    expect(result.businessName).toBe('주식회사 세모챌');
    expect(result.registrationNumber).toBe('123-45-67890');
    expect(result.raw).toEqual(successfulBody.images[0]!.businessLicense!.result);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBeTruthy();
    const body = JSON.parse(String(init.body));
    expect(body.images[0]).toMatchObject({ format: 'jpg', name: 'license.jpg' });
    expect(init.headers['X-OCR-SECRET']).toBeTruthy();
  });

  it('falls back to a registration-number regex when fields are missing', async () => {
    respondWith({
      images: [
        {
          inferResult: 'SUCCESS',
          businessLicense: { result: { rawText: { text: '사업자등록번호 987-65-43210' } } },
        },
      ],
    });
    const client = new ClovaOcrClient();
    const result = await client.recognizeBusinessLicense('https://cdn.test/doc.png');
    expect(result.registrationNumber).toBe('987-65-43210');
  });

  it('throws when OCR cannot read the document', async () => {
    respondWith({ images: [{ inferResult: 'FAILURE', message: 'Unable to recognize' }] });
    const client = new ClovaOcrClient();
    await expect(client.recognizeBusinessLicense('https://cdn.test/doc.jpg')).rejects.toThrow(
      'Unable to recognize',
    );
  });
});
