import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { GenericSmtpEmailSender } from '../../src/email/smtp.js';

describe('generic SMTP adapter', () => {
  it('maps the structural nodemailer transport without leaking extra headers', async () => {
    let sent: unknown;
    const sender = new GenericSmtpEmailSender({
      from: 'Tchê Agro <nao-responda@example.test>',
      transport: {
        async sendMail(message) {
          sent = message;
          return { messageId: 'provider-1' };
        },
      },
    });

    const receipt = await sender.send({
      to: 'user@example.test',
      subject: 'Assunto',
      text: 'Corpo',
    });

    assert.deepEqual(receipt, { providerMessageId: 'provider-1' });
    assert.deepEqual(sent, {
      from: 'Tchê Agro <nao-responda@example.test>',
      to: 'user@example.test',
      subject: 'Assunto',
      text: 'Corpo',
    });
  });

  it('rejects CRLF header injection before calling the transport', async () => {
    let calls = 0;
    const sender = new GenericSmtpEmailSender({
      from: 'sender@example.test',
      transport: {
        async sendMail() {
          calls += 1;
          return {};
        },
      },
    });

    await assert.rejects(
      () =>
        sender.send({
          to: 'victim@example.test\r\nBcc: attacker@example.test',
          subject: 'Subject',
          text: 'Text',
        }),
      TypeError,
    );
    assert.equal(calls, 0);
  });
});
