const textDecoder = new TextDecoder('utf-8', { fatal: false });

function unfold(value) {
  return value.replace(/\r?\n[ \t]+/g, ' ');
}

function parseHeaders(raw) {
  const headers = new Map();
  for (const line of unfold(raw).split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    const values = headers.get(name) ?? [];
    values.push(value);
    headers.set(name, values);
  }
  return headers;
}

function header(headers, name) {
  return headers.get(name.toLowerCase())?.[0] ?? '';
}

function splitHeader(value) {
  const [main, ...parameters] = value.split(';');
  const parsed = { value: main.trim().toLowerCase(), parameters: {} };
  for (const parameter of parameters) {
    const separator = parameter.indexOf('=');
    if (separator <= 0) continue;
    const key = parameter.slice(0, separator).trim().toLowerCase();
    let parameterValue = parameter.slice(separator + 1).trim();
    if (parameterValue.startsWith('"') && parameterValue.endsWith('"')) {
      parameterValue = parameterValue.slice(1, -1);
    }
    parsed.parameters[key] = parameterValue;
  }
  return parsed;
}

function decodeTransfer(value, encoding) {
  const normalized = value.replace(/\r?\n/g, '');
  if (encoding === 'base64') return Buffer.from(normalized, 'base64').toString('utf8');
  if (encoding === 'quoted-printable') {
    return normalized
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
  }
  return value;
}

function splitMessage(raw) {
  const separator = raw.search(/\r?\n\r?\n/);
  if (separator < 0) return { headers: parseHeaders(raw), body: '' };
  const match = raw.slice(separator).match(/^\r?\n\r?\n/);
  const bodyStart = separator + (match?.[0].length ?? 4);
  return { headers: parseHeaders(raw.slice(0, separator)), body: raw.slice(bodyStart) };
}

function parsePart(raw, result) {
  const part = splitMessage(raw);
  const contentType = splitHeader(header(part.headers, 'content-type'));
  const disposition = splitHeader(header(part.headers, 'content-disposition'));
  const boundary = contentType.parameters.boundary;
  if (
    contentType.value === 'multipart/mixed' ||
    contentType.value === 'multipart/alternative' ||
    contentType.value === 'multipart/related'
  ) {
    if (!boundary) return;
    const delimiter = `--${boundary}`;
    for (const child of part.body.split(delimiter).slice(1)) {
      if (child.startsWith('--')) break;
      parsePart(child.replace(/^\r?\n/, ''), result);
    }
    return;
  }

  const content = decodeTransfer(
    part.body,
    header(part.headers, 'content-transfer-encoding').toLowerCase(),
  ).replace(/\r?\n$/, '');
  const attachment = disposition.value === 'attachment' || Boolean(disposition.parameters.filename);
  if (attachment) {
    result.attachments.push({
      filename: disposition.parameters.filename ?? contentType.parameters.name ?? null,
      contentType: contentType.value || 'application/octet-stream',
      size: Buffer.byteLength(content),
      contentId: header(part.headers, 'content-id') || null,
    });
    return;
  }
  if (contentType.value === 'text/html') result.htmlBody ||= content;
  else if (contentType.value === 'text/plain' || !contentType.value) result.textBody ||= content;
}

export function parseMimeMessage(raw) {
  const message = splitMessage(raw);
  const result = {
    messageId: header(message.headers, 'message-id') || null,
    from: header(message.headers, 'from') || null,
    to: header(message.headers, 'to') || null,
    cc: header(message.headers, 'cc') || null,
    subject: header(message.headers, 'subject') || null,
    date: header(message.headers, 'date') || null,
    inReplyTo: header(message.headers, 'in-reply-to') || null,
    references: header(message.headers, 'references') || null,
    textBody: '',
    htmlBody: '',
    attachments: [],
  };
  parsePart(raw, result);
  return result;
}

function eventRecords(event) {
  if (Array.isArray(event?.Records)) return event.Records;
  return event ? [event] : [];
}

async function bodyToBuffer(body) {
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body?.transformToByteArray) return Buffer.from(await body.transformToByteArray());
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function createHandler({ getObject, logger = console, bucket = process.env.INBOX_BUCKET }) {
  return async function handle(event) {
    const records = eventRecords(event);
    for (const record of records) {
      const ses = record.ses ?? {};
      const receipt = ses.receipt ?? {};
      const action = receipt.action ?? {};
      const sesMessageId = ses.mail?.messageId ?? null;
      const objectKey = action.objectKey ?? sesMessageId;
      const recipient = receipt.recipients?.[0] ?? null;
      if (!objectKey) throw new Error('SES record has no S3 object key');

      try {
        const object = await getObject({ Bucket: bucket, Key: objectKey });
        const parsed = parseMimeMessage((await bodyToBuffer(object.Body)).toString('utf8'));
        logger.info(
          JSON.stringify({
            event: 'email_processed',
            sesMessageId,
            recipient,
            sender: parsed.from,
            subject: parsed.subject,
            objectKey,
            attachmentCount: parsed.attachments.length,
          }),
        );
      } catch (error) {
        logger.error(
          JSON.stringify({
            event: 'email_processing_failed',
            sesMessageId,
            recipient,
            objectKey,
            error: error instanceof Error ? error.name : 'UnknownError',
          }),
        );
        throw error;
      }
    }
  };
}

export async function handler(event) {
  const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({});
  return createHandler({
    getObject: ({ Bucket, Key }) => s3.send(new GetObjectCommand({ Bucket, Key })),
  })(event);
}
