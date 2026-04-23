import { Resend } from "resend";

import { env } from "./env";
import { logger } from "@/logger";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  if (!resend) {
    // Dev mode: just log
    logger.debug(`[EMAIL DEV] Verification code for ${email}: ${code}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: `StarOverlay <noreply@${env.RESEND_MAIL_DOMAIN}>`,
    to: [email],
    subject: "Verify your email address",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Verify your email</h2>
        <p>Your verification code is:</p>
        <h1 style="letter-spacing:8px;font-size:36px;color:#4f46e5">${code}</h1>
        <p>This code expires in 1 hour.</p>
      </div>
    `,
  });

  if (error) {
    logger.error({ err: error }, "Failed to send verification email");
    throw new Error(`Email delivery failed: ${error.message}`);
  }
}

export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  if (!resend) {
    logger.debug(`[EMAIL DEV] Password reset code for ${email}: ${code}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: `StarOverlay <noreply@${env.RESEND_MAIL_DOMAIN}>`,
    to: [email],
    subject: "Reset your password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2>Reset your password</h2>
        <p>Your password reset code is:</p>
        <h1 style="letter-spacing:8px;font-size:36px;color:#4f46e5">${code}</h1>
        <p>This code expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    logger.error({ err: error }, "Failed to send password reset email");
    throw new Error(`Email delivery failed: ${error.message}`);
  }
}