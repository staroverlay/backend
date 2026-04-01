import { Resend } from "resend";

import { env } from "./env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  if (!resend) {
    // Dev mode: just log
    console.log(`[EMAIL DEV] Verification code for ${email}: ${code}`);
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
        <p>This code expires in 15 minutes.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send verification email:", error);
  }
}

export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  if (!resend) {
    console.log(`[EMAIL DEV] Password reset code for ${email}: ${code}`);
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
        <p>This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send password reset email:", error);
  }
}