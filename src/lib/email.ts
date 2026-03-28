import nodemailer from "nodemailer";

import { env } from "./env";

const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
        env.SMTP_USER && env.SMTP_PASS
            ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
            : undefined,
});

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
    if (!env.SMTP_HOST) {
        // Dev mode: just log
        console.log(`[EMAIL DEV] Verification code for ${email}: ${code}`);
        return;
    }

    await transporter.sendMail({
        from: env.EMAIL_FROM,
        to: email,
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
}

export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
    if (!env.SMTP_HOST) {
        console.log(`[EMAIL DEV] Password reset code for ${email}: ${code}`);
        return;
    }

    await transporter.sendMail({
        from: env.EMAIL_FROM,
        to: email,
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
}