const SibApiV3Sdk = require('sib-api-v3-sdk');

function ensureApiKey() {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error('BREVO_API_KEY not set in environment');
  const defaultClient = (SibApiV3Sdk && SibApiV3Sdk.ApiClient && SibApiV3Sdk.ApiClient.instance) ? SibApiV3Sdk.ApiClient.instance : null;
  let configured = false;

  if (defaultClient && defaultClient.authentications && typeof defaultClient.authentications === 'object') {
    // Try common authentication key names used by different sdk versions
    const candidates = ['apiKey', 'api-key', 'api_key', 'x-api-key'];
    for (const name of candidates) {
      if (defaultClient.authentications[name]) {
        try {
          defaultClient.authentications[name].apiKey = key;
          configured = true;
          break;
        } catch (e) {
          // ignore and continue
        }
      }
    }
  }

  // Last-resort: try to set a minimal authentications object
  if (!configured && defaultClient) {
    try {
      defaultClient.authentications = defaultClient.authentications || {};
      defaultClient.authentications['apiKey'] = { apiKey: key };
      configured = true;
    } catch (e) {
      // ignore
    }
  }

  if (!configured) {
    // Some versions expose Configuration; try that
    if (SibApiV3Sdk.Configuration) {
      try {
        const conf = SibApiV3Sdk.Configuration && SibApiV3Sdk.Configuration.default ? SibApiV3Sdk.Configuration.default : new SibApiV3Sdk.Configuration();
        if (conf) {
          // If apiKey is a map/function, set directly when possible
          if (conf.apiKey && typeof conf.apiKey === 'object') {
            conf.apiKey['apiKey'] = key;
            configured = true;
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }

  if (!configured) throw new Error('Failed to configure Brevo API key on sib-api-v3-sdk client (auth object missing)');

  return new SibApiV3Sdk.TransactionalEmailsApi();
}

/**
 * Send an email via Brevo (Sendinblue)
 * @param {string} to Recipient email
 * @param {string} subject Email subject
 * @param {string} html HTML body
 * @param {Array<{name:string,content:string}>} attachments Optional attachments as { name, content(base64) }
 */
async function sendResultsEmail(to, subject, html, attachments = []) {
  if (!to) throw new Error('Recipient (to) is required');
  const apiInstance = ensureApiKey();

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  // Set sender with optional friendly name
  sendSmtpEmail.sender = {
    email: process.env.EMAIL_FROM || process.env.DEFAULT_SENDER || 'no-reply@example.com',
    name: process.env.EMAIL_FROM_NAME || 'Recruiting Team'
  };

  // Flexible recipient handling: accept string, object {email,name}, or array
  let toList = [];
  if (typeof to === 'string') {
    toList = [{ email: to }];
  } else if (Array.isArray(to)) {
    toList = to.map(t => (typeof t === 'string') ? { email: t } : { email: t.email, name: t.name });
  } else if (typeof to === 'object' && to !== null) {
    toList = [{ email: to.email, name: to.name }];
  }
  sendSmtpEmail.to = toList;

  // Optional reply-to
  if (process.env.EMAIL_REPLY_TO) {
    const parts = process.env.EMAIL_REPLY_TO.split(',').map(p => p.trim());
    sendSmtpEmail.replyTo = { email: parts[0], name: parts[1] || undefined };
  }
  sendSmtpEmail.subject = subject || 'Shortlist Notification';
  sendSmtpEmail.htmlContent = html || '<p>Your resume has been shortlisted.</p>';

  if (Array.isArray(attachments) && attachments.length > 0) {
    // Attachments should be objects with { name, content } where content is base64 encoded
    sendSmtpEmail.attachment = attachments.map(a => ({ name: a.name, content: a.content }));
  }

  try {
    const resp = await apiInstance.sendTransacEmail(sendSmtpEmail);
    // Log the raw response for debugging delivery issues
    try { console.log('Brevo sendTransacEmail response:', JSON.stringify(resp)); } catch (e) { console.log('Brevo response (non-serializable):', resp); }
    return resp;
  } catch (err) {
    // Normalize the error
    const message = err && err.response && err.response.body ? JSON.stringify(err.response.body) : (err && err.message ? err.message : String(err));
    try { console.error('Brevo send error details:', err && err.response ? err.response : err); } catch (e) { console.error('Brevo send error (non-serializable):', err); }
    throw new Error(`Brevo send failed: ${message}`);
  }
}

module.exports = { sendResultsEmail };
