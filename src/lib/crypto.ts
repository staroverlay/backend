import crypto from "node:crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Handles AES-256-GCM encryption/decryption of OAuth tokens.
 * A 32-byte key is required in the environment.
 */
export function encrypt(text: string | null): string | null {
    if (!text) return null;

    const iv = crypto.randomBytes(IV_LENGTH);
    const key = Buffer.from(env.OAUTH_ENCRYPTION_KEY, "utf8").slice(0, 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag().toString("hex");

    // Format: iv:authTag:encrypted
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string | null): string | null {
    if (!encryptedText) return null;

    try {
        const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
        if (!ivHex || !authTagHex || !encrypted) return null;

        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");
        const key = Buffer.from(env.OAUTH_ENCRYPTION_KEY, "utf8").slice(0, 32);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (err) {
        console.error("Failed to decrypt token:", err);
        return null;
    }
}
