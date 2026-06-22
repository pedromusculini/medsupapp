import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { PORTFOLIO_BUCKET } from '@/lib/portfolio';

const MAX_WIDTH = 1200;
const WEBP_QUALITY = 82;

export async function processPortfolioImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

export function portfolioStoragePath(
  ownerEmail: string,
  portfolioId: string,
  slot: number,
): string {
  const owner = ownerEmail.toLowerCase().trim();
  return `${owner}/${portfolioId}/${slot}-${randomUUID().slice(0, 8)}.webp`;
}

export async function uploadPortfolioFoto(
  path: string,
  webpBuffer: Buffer,
): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(PORTFOLIO_BUCKET)
    .upload(path, webpBuffer, {
      contentType: 'image/webp',
      upsert: true,
    });
  if (error) throw error;
}

export async function deletePortfolioFoto(path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(PORTFOLIO_BUCKET).remove([path]);
  if (error) throw error;
}
