import { NextResponse } from 'next/server';
import { validateApiAuth, unauthorizedResponse } from '@/lib/auth';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  const auth = validateApiAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const customFilename = (formData.get('filename') as string | null) || '';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No image file provided in form data.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate safe clean filename ending in .webp
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sanitizedBase = customFilename
      ? customFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
      : `prod_${timestamp}_${randomSuffix}`;
    const fileName = `${sanitizedBase}.webp`;

    // 1. Try Supabase Storage (Online Object Storage / CDN)
    const supabase = getSupabaseAdmin();
    if (supabase && isSupabaseConfigured()) {
      try {
        const bucketName = 'products';

        // Check if bucket exists, create if not present
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some((b) => b.name === bucketName);

        if (!bucketExists) {
          await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/webp', 'image/jpeg', 'image/png'],
          });
        }

        const filePath = `catalog/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(filePath, buffer, {
            contentType: 'image/webp',
            cacheControl: '31536000', // 1 year CDN cache
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

          return NextResponse.json({
            success: true,
            storage: 'supabase_storage_cdn',
            url: publicUrlData.publicUrl,
            fileName,
            size: buffer.length,
            format: 'webp',
          });
        } else {
          console.warn('Supabase storage upload error, falling back to local static storage:', uploadError);
        }
      } catch (storageErr) {
        console.warn('Supabase storage exception, falling back to local static storage:', storageErr);
      }
    }

    // 2. Fallback to Local Public Directory (`/public/uploads/products/`) for Offline & Local Dev
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const localFilePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(localFilePath, buffer);

    const relativePublicUrl = `/uploads/products/${fileName}`;

    return NextResponse.json({
      success: true,
      storage: 'local_public_storage',
      url: relativePublicUrl,
      fileName,
      size: buffer.length,
      format: 'webp',
    });
  } catch (err: unknown) {
    console.error('Upload processing error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to process image upload',
      },
      { status: 500 }
    );
  }
}

