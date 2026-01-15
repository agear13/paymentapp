/**
 * Logo Upload API Endpoint
 * POST /api/merchant-settings/upload-logo
 * Handles image file uploads for organization logos
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth/session';
import { apiError } from '@/lib/api/middleware';
import { log } from '@/lib/logger';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'logos');

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('logo') as File;
    const organizationId = formData.get('organizationId') as string;

    // Log for debugging
    log.info({ 
      hasFile: !!file, 
      organizationId,
      userId: user.id 
    }, 'Logo upload request received');

    if (!file) {
      return apiError('No file provided', 400);
    }

    if (!organizationId) {
      log.error({ userId: user.id }, 'Organization ID missing in upload request');
      return apiError('Organization ID is required', 400);
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError(
        'Invalid file type. Allowed types: PNG, JPG, JPEG, WEBP',
        400
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return apiError(
        'File too large. Maximum size is 2MB',
        400
      );
    }

    // Create upload directory if it doesn't exist
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name);
    const timestamp = Date.now();
    const sanitizedOrgId = organizationId.replace(/[^a-zA-Z0-9]/g, '');
    const filename = `${sanitizedOrgId}-${timestamp}${fileExtension}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    // Convert file to buffer and write to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Generate public URL
    const publicUrl = `/uploads/logos/${filename}`;

    log.info(
      {
        userId: user.id,
        organizationId,
        filename,
        fileSize: file.size,
        fileType: file.type,
      },
      'Logo uploaded successfully'
    );

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
    });
  } catch (error: any) {
    log.error({ error: error.message }, 'Failed to upload logo');
    return apiError('Failed to upload logo', 500);
  }
}

