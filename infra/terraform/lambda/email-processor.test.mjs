import assert from 'node:assert/strict';
import test from 'node:test';
import { createHandler, parseMimeMessage } from './email-processor.mjs';

const mime = [
  'Message-ID: <customer-1@example.com>',
  'From: customer@example.com',
  'To: help@semochall.com',
  'Cc: copy@example.com',
  'Subject: 문의',
  'In-Reply-To: <previous@semochall.com>',
  'References: <previous@semochall.com>',
  'Content-Type: multipart/mixed; boundary="b"',
  '',
  '--b',
  'Content-Type: text/plain; charset=utf-8',
  '',
  '본문',
  '--b',
  'Content-Type: application/pdf',
  'Content-Disposition: attachment; filename="receipt.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('pdf').toString('base64'),
  '--b--',
].join('\r\n');

test('parses headers, bodies, threading headers, and attachment metadata', () => {
  assert.deepEqual(parseMimeMessage(mime), {
    messageId: '<customer-1@example.com>',
    from: 'customer@example.com',
    to: 'help@semochall.com',
    cc: 'copy@example.com',
    subject: '문의',
    date: null,
    inReplyTo: '<previous@semochall.com>',
    references: '<previous@semochall.com>',
    textBody: '본문',
    htmlBody: '',
    attachments: [
      { filename: 'receipt.pdf', contentType: 'application/pdf', size: 3, contentId: null },
    ],
  });
});

test('decodes UTF-8 Base64 and quoted-printable encoded-word headers', () => {
  const encoded = [
    'From: =?UTF-8?B?7Zmp7KeA7JiB?= <customer@example.com>',
    'To: =?UTF-8?Q?=EA=B3=A0=EA=B0=9D?= <help@semochall.com>',
    'Subject: =?UTF-8?B?64KY64qUIA==?= =?UTF-8?Q?=EB=AC=B8=EC=9D=98?=',
    '',
    '본문',
  ].join('\r\n');

  assert.deepEqual(parseMimeMessage(encoded), {
    messageId: null,
    from: '황지영 <customer@example.com>',
    to: '고객 <help@semochall.com>',
    cc: null,
    subject: '나는 문의',
    date: null,
    inReplyTo: null,
    references: null,
    textBody: '본문',
    htmlBody: '',
    attachments: [],
  });
});

test('keeps malformed or unsupported encoded headers without rejecting inbound mail', () => {
  const encoded = [
    'From: =?ISO-8859-1?Q?Andr=E9?= <customer@example.com>',
    'Subject: =?UTF-8?B?Y?=',
    '',
    '본문',
  ].join('\r\n');
  const parsed = parseMimeMessage(encoded);

  assert.equal(parsed.from, '=?ISO-8859-1?Q?Andr=E9?= <customer@example.com>');
  assert.equal(parsed.subject, '=?UTF-8?B?Y?=');
});

test('decodes address display names without changing an angle-bracket address', () => {
  const parsed = parseMimeMessage(
    ['From: =?UTF-8?B?7Zmp7KeA7JiB?= <=?UTF-8?B?YWJj?=@example.com>', '', '본문'].join('\r\n'),
  );

  assert.equal(parsed.from, '황지영 <=?UTF-8?B?YWJj?=@example.com>');
});

test('publishes decoded headers while preserving recipient addresses', async () => {
  const payloads = [];
  const encoded = [
    'Message-ID: <encoded-1@example.com>',
    'From: =?UTF-8?B?7Zmp7KeA7JiB?= <customer@example.com>',
    'To: =?UTF-8?Q?=EA=B3=A0=EA=B0=9D?= <help@semochall.com>',
    'Subject: =?UTF-8?B?64KY64qUIA==?= =?UTF-8?Q?=EB=AC=B8=EC=9D=98?=',
    '',
    '본문',
  ].join('\r\n');
  const handler = createHandler({
    bucket: 'inbox',
    getObject: async () => ({ Body: { transformToByteArray: async () => Buffer.from(encoded) } }),
    publish: async (payload) => payloads.push(payload),
    logger: { info: () => {}, error: () => {} },
  });

  await handler({
    ses: {
      mail: { messageId: 'ses-encoded-1' },
      receipt: {
        recipients: ['help@semochall.com'],
        action: { objectKey: 'inbound/ses-encoded-1' },
      },
    },
  });

  assert.equal(payloads[0].from, '황지영 <customer@example.com>');
  assert.equal(payloads[0].to, '고객 <help@semochall.com>');
  assert.equal(payloads[0].subject, '나는 문의');
});

test('logs metadata only and rethrows an S3 processing error', async () => {
  const logs = [];
  const handler = createHandler({
    bucket: 'inbox',
    getObject: async ({ Bucket, Key }) => {
      assert.deepEqual({ Bucket, Key }, { Bucket: 'inbox', Key: 'inbound/ses-1' });
      return { Body: { transformToByteArray: async () => Buffer.from(mime) } };
    },
    logger: { info: (message) => logs.push(message), error: () => {} },
  });

  await handler({
    Records: [
      {
        ses: {
          mail: { messageId: 'ses-1' },
          receipt: { recipients: ['help@semochall.com'], action: { objectKey: 'inbound/ses-1' } },
        },
      },
    ],
  });
  assert.equal(logs[0].includes('본문'), false);
  assert.equal(logs[0].includes('receipt.pdf'), false);
  assert.equal(logs[0].includes('ses-1'), true);
});

test('adds the configured S3 prefix when SES provides only the object name', async () => {
  const handler = createHandler({
    bucket: 'inbox',
    objectKeyPrefix: 'inbound/',
    getObject: async ({ Key }) => {
      assert.equal(Key, 'inbound/ses-2');
      return { Body: { transformToByteArray: async () => Buffer.from(mime) } };
    },
    logger: { info: () => {}, error: () => {} },
  });

  await handler({
    ses: {
      mail: { messageId: 'ses-2' },
      receipt: { recipients: ['help@semochall.com'], action: { objectKey: 'ses-2' } },
    },
  });
});

test('does not duplicate the configured S3 prefix', async () => {
  const handler = createHandler({
    bucket: 'inbox',
    objectKeyPrefix: 'inbound/',
    getObject: async ({ Key }) => {
      assert.equal(Key, 'inbound/ses-3');
      return { Body: { transformToByteArray: async () => Buffer.from(mime) } };
    },
    logger: { info: () => {}, error: () => {} },
  });

  await handler({
    ses: {
      mail: { messageId: 'ses-3' },
      receipt: { recipients: ['help@semochall.com'], action: { objectKey: 'inbound/ses-3' } },
    },
  });
});

test('uses SES envelope metadata when MIME address headers are missing', async () => {
  const payloads = [];
  const headerlessMime = ['Subject: 문의', 'Content-Type: text/plain', '', '본문'].join('\r\n');
  const handler = createHandler({
    bucket: 'inbox',
    getObject: async () => ({
      Body: { transformToByteArray: async () => Buffer.from(headerlessMime) },
    }),
    publish: async (payload) => payloads.push(payload),
    logger: { info: () => {}, error: () => {} },
  });

  await handler({
    ses: {
      mail: {
        messageId: 'ses-envelope-id',
        source: 'customer@example.com',
        destination: ['help@semochall.com'],
      },
      receipt: {
        recipients: ['help@semochall.com'],
        action: { objectKey: 'inbound/ses-envelope-id' },
      },
    },
  });

  assert.deepEqual(payloads[0], {
    messageId: 'ses-envelope-id',
    from: 'customer@example.com',
    to: 'help@semochall.com',
    subject: '문의',
    inReplyTo: undefined,
    references: [],
    text: '본문',
    html: undefined,
    sentAt: payloads[0].sentAt,
    attachments: [],
  });
});
