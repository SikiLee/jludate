import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { identityPool } from 'lib/db';
import { normalizeEmail } from 'lib/identityLink';

const ALLOWED_SCREENSHOT_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SCREENSHOT_BYTES = 1024 * 1024;
const EXCEPTION_UPLOAD_DIR = process.env.EMAIL_EXCEPTION_UPLOAD_DIR?.trim()
  || path.join(process.cwd(), 'uploads', 'email-exception');

function normalizeLocalEmail(rawValue) {
  return normalizeEmail(rawValue);
}

export function isValidBackupEmail(rawValue) {
  const email = normalizeLocalEmail(rawValue);
  if (!email) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function computeEmailHash(email) {
  return crypto.createHash('sha256').update(normalizeLocalEmail(email)).digest('hex');
}

export async function ensureEmailExceptionUploadDir() {
  await fs.mkdir(EXCEPTION_UPLOAD_DIR, { recursive: true });
  return EXCEPTION_UPLOAD_DIR;
}

function resolveScreenshotExtension(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  return 'webp';
}

async function compressImageBufferIfNeeded(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length <= MAX_SCREENSHOT_BYTES) {
    return buffer;
  }

  const compressed = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  if (compressed.length <= MAX_SCREENSHOT_BYTES) {
    return compressed;
  }

  const smaller = await sharp(buffer)
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .jpeg({ quality: 72 })
    .toBuffer();
  return smaller;
}

export async function saveExceptionScreenshot(file) {
  if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') {
    return { ok: false, msg: '请上传邮箱登录截图' };
  }

  if (!ALLOWED_SCREENSHOT_MIME.has(file.type)) {
    return { ok: false, msg: '截图仅支持 jpg/jpeg/png/webp' };
  }

  await ensureEmailExceptionUploadDir();
  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const outputBuffer = await compressImageBufferIfNeeded(sourceBuffer);

  if (outputBuffer.length > MAX_SCREENSHOT_BYTES) {
    return { ok: false, msg: '截图压缩后仍超过 1MB，请上传更清晰且更小的截图' };
  }

  const extension = resolveScreenshotExtension(file.type);
  const fileName = `exception-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
  const filePath = path.join(EXCEPTION_UPLOAD_DIR, fileName);
  await fs.writeFile(filePath, outputBuffer);

  return {
    ok: true,
    data: {
      screenshot_path: fileName
    }
  };
}

function safeScreenshotPath(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return null;
  }
  const normalized = path.basename(fileName.trim());
  if (normalized !== fileName.trim()) {
    return null;
  }
  return path.join(EXCEPTION_UPLOAD_DIR, normalized);
}

export async function removeExceptionScreenshot(fileName) {
  const screenshotPath = safeScreenshotPath(fileName);
  if (!screenshotPath) {
    return;
  }
  await fs.unlink(screenshotPath);
}

export function generateVerificationCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function resolvePreferredEmailTargetByCampusEmail(rawCampusEmail) {
  const schoolEmail = normalizeLocalEmail(rawCampusEmail);
  if (!schoolEmail) {
    return null;
  }
  const schoolEmailHash = computeEmailHash(schoolEmail);
  const result = await identityPool.query(
    `
    SELECT backup_email
    FROM unidate_app.email_exception_mappings
    WHERE school_email_hash = $1
    LIMIT 1
    `,
    [schoolEmailHash]
  );

  if (result.rowCount === 0) {
    const pendingResult = await identityPool.query(
      `
      SELECT backup_email
      FROM unidate_app.email_exception_applications
      WHERE school_email_hash = $1
        AND status = 'pending'
        AND backup_email_verified = TRUE
        AND screenshot_path IS NOT NULL
        AND BTRIM(screenshot_path) <> ''
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [schoolEmailHash]
    );
    if (pendingResult.rowCount === 0) {
      return null;
    }
    const pendingBackup = normalizeLocalEmail(pendingResult.rows[0].backup_email);
    if (!pendingBackup) {
      return null;
    }
    return {
      school_email: schoolEmail,
      delivery_email: pendingBackup,
      uses_backup_email: true,
      pending_review: true
    };
  }

  const backupEmail = normalizeLocalEmail(result.rows[0].backup_email);
  if (!backupEmail) {
    return null;
  }

  return {
    school_email: schoolEmail,
    delivery_email: backupEmail,
    uses_backup_email: true,
    pending_review: false
  };
}

export async function readExceptionScreenshot(fileName) {
  const screenshotPath = safeScreenshotPath(fileName);
  if (!screenshotPath) {
    return null;
  }
  try {
    return await fs.readFile(screenshotPath);
  } catch {
    return null;
  }
}
