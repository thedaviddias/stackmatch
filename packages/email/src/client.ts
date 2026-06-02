import { type CreateEmailOptions, Resend } from "resend";
import { EMAIL_DEFAULTS } from "./keys";
import type { SendEmailOptions, SendEmailResult } from "./types";

let resendClient: Resend | null = null;
let resendContactsClient: Resend | null = null;

type ResendReactNode = Extract<CreateEmailOptions, { react: unknown }>["react"];
type ResendTopicSubscription = "opt_in" | "opt_out";
type ResendContactProperties = Record<string, string | number | null>;
type SenderAddressField = "from" | "replyTo";

const NO_REPLY_ADDRESS_PATTERN = /(^|[^a-z0-9])no[-_.\s]?reply([^a-z0-9]|$)/i;

export interface SubscribeContactToTopicOptions {
  email: string;
  topicId: string;
  firstName?: string;
  lastName?: string;
  properties?: ResendContactProperties;
  subscription?: ResendTopicSubscription;
}

export interface SubscribeContactToTopicResult {
  success: boolean;
  id?: string;
  error?: string;
}

function toResendReactNode(react: React.ReactElement): ResendReactNode {
  // Bridge ReactNode type mismatches from transitive @types/react versions.
  return react as unknown as ResendReactNode;
}

function getClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      resendClient = new Resend(apiKey);
    } else {
      throw new Error("Email client not initialized. Set RESEND_API_KEY environment variable.");
    }
  }
  return resendClient;
}

function getContactsClient(): Resend {
  if (!resendContactsClient) {
    const apiKey = process.env.RESEND_CONTACTS_API_KEY ?? process.env.RESEND_API_KEY;
    if (apiKey) {
      resendContactsClient = new Resend(apiKey);
    } else {
      throw new Error(
        "Email contacts client not initialized. Set RESEND_CONTACTS_API_KEY or RESEND_API_KEY environment variable."
      );
    }
  }
  return resendContactsClient;
}

function validateSenderAddress(field: SenderAddressField, value: string): SendEmailResult | null {
  if (!NO_REPLY_ADDRESS_PATTERN.test(value)) {
    return null;
  }

  return {
    success: false,
    error: `Email ${field} address must not use a no-reply mailbox.`,
  };
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const {
    to,
    subject,
    react,
    from = EMAIL_DEFAULTS.from,
    replyTo = EMAIL_DEFAULTS.replyTo,
    cc,
    bcc,
    tags,
    scheduledAt,
  } = options;

  const fromValidation = validateSenderAddress("from", from);
  if (fromValidation) return fromValidation;

  const replyToValidation = validateSenderAddress("replyTo", replyTo);
  if (replyToValidation) return replyToValidation;

  const client = getClient();

  try {
    const { data, error } = await client.emails.send({
      bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
      cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
      from,
      react: toResendReactNode(react),
      replyTo,
      scheduledAt: scheduledAt?.toISOString(),
      subject,
      tags,
      to: Array.isArray(to) ? to : [to],
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function sendBatchEmails(emails: SendEmailOptions[]): Promise<SendEmailResult[]> {
  return await Promise.all(emails.map(sendEmail));
}

export async function subscribeContactToTopic(
  options: SubscribeContactToTopicOptions
): Promise<SubscribeContactToTopicResult> {
  const client = getContactsClient();
  const email = options.email.trim().toLowerCase();
  const topic = {
    id: options.topicId,
    subscription: options.subscription ?? ("opt_in" as const),
  };

  try {
    const createResult = await client.contacts.create({
      email,
      firstName: options.firstName,
      lastName: options.lastName,
      properties: options.properties,
      topics: [topic],
    });

    if (!createResult.error) {
      return { success: true, id: createResult.data?.id };
    }

    const updateResult = await client.contacts.update({
      email,
      firstName: options.firstName,
      lastName: options.lastName,
      properties: options.properties,
    });

    if (updateResult.error) {
      return { success: false, error: updateResult.error.message };
    }

    const topicResult = await client.contacts.topics.update({
      email,
      topics: [topic],
    });

    if (topicResult.error) {
      return { success: false, error: topicResult.error.message };
    }

    return { success: true, id: topicResult.data?.id ?? updateResult.data?.id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function previewEmail(react: React.ReactElement): Promise<string> {
  const { render } = await import("@react-email/render");
  return render(react);
}
