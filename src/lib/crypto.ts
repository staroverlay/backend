import crypto from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

// Derive a stable 32-byte key from any-length input using SHA-256.
// This prevents silent key truncation when OAUTH_ENCRYPTION_KEY > 32 chars.
const encryptionKey = crypto
    .createHash("sha256")
    .update(env.OAUTH_ENCRYPTION_KEY)
    .digest();

/**
 * Handles AES-256-GCM encryption/decryption of OAuth tokens.
 */
export function encrypt(text: string | null): string | null {
    if (!text) return null;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);

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

        const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    } catch (err) {
        logger.error({ err }, "Failed to decrypt token");
        return null;
    }
}
