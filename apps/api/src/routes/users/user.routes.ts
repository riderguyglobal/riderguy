import { Router } from 'express';
import { authenticate, requireRole, validate } from '../../middleware';
import { asyncHandler } from '../../lib/async-handler';
import { prisma } from '@riderguy/database';
import { UserRole } from '@riderguy/types';
import { updateProfileSchema, changePasswordSchema } from '@riderguy/validators';
import { AuthService } from '../../services/auth.service';
import { PushService } from '../../services/push.service';
import { StatusCodes } from 'http-status-codes';
import multer from 'multer';
import type { Request } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Avatar upload — Multer config
// In production this would be S3/CloudFront; for now we store in local
// `uploads/avatars` folder and serve statically.
// ---------------------------------------------------------------------------
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, UPLOAD_DIR),
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpg, .jpeg, .png, .webp images are allowed'));
    }
  },
});

const router = Router();

// All user routes are protected
router.use(authenticate);

/** GET /users/profile */
router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        riderProfile: true,
        clientProfile: true,
        partnerProfile: true,
        wallet: { select: { id: true, balance: true, currency: true } },
      },
    });

    res.status(StatusCodes.OK).json({ success: true, data: user });
  })
);

/** PATCH /users/profile */
router.patch(
  '/profile',
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const { firstName, lastName, email, avatarUrl } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        ...(avatarUrl && { avatarUrl }),
      },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        status: true,
      },
    });

    res.status(StatusCodes.OK).json({ success: true, data: user });
  })
);

/** GET /users (admin only) — supports search, role filter, status filter */
router.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const page = parseInt(String(req.query.page ?? '1')) || 1;
    const limit = Math.min(parseInt(String(req.query.limit ?? '20')) || 20, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search) : undefined;
    const role = req.query.role ? String(req.query.role) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    const where: Record<string, unknown> = {};

    if (role) where.role = role;
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phone: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          avatarUrl: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { ordersAsClient: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  })
);

/** POST /users/avatar — upload or replace avatar image */
router.post(
  '/avatar',
  avatarUpload.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'No image file provided' },
      });
      return;
    }

    // Build the public URL (in prod this would be a CDN URL)
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Delete previous avatar file if it was a local upload
    const existing = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { avatarUrl: true },
    });

    if (existing?.avatarUrl?.startsWith('/uploads/avatars/')) {
      const oldPath = path.join(process.cwd(), existing.avatarUrl);
      fs.unlink(oldPath, () => {
        /* ignore errors for missing files */
      });
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { avatarUrl },
      select: {
        id: true,
        avatarUrl: true,
      },
    });

    res.status(StatusCodes.OK).json({ success: true, data: user });
  })
);

/** POST /users/change-password */
router.post(
  '/change-password',
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await AuthService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  })
);

// ============================================================
// Push Token Management
// ============================================================

/** POST /users/push-token — register a push notification token */
router.post(
  '/push-token',
  asyncHandler(async (req, res) => {
    const { token, platform, deviceId } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'token is required' },
      });
      return;
    }
    if (token.length > 500) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'token exceeds maximum length' },
      });
      return;
    }
    const allowedPlatforms = ['web', 'android', 'ios'];
    const safePlatform = allowedPlatforms.includes(platform) ? platform : 'web';

    const pushToken = await PushService.registerToken(
      req.user!.userId,
      token,
      safePlatform,
      deviceId,
    );
    res.status(StatusCodes.CREATED).json({ success: true, data: pushToken });
  })
);

/** POST /users/push-token/remove — deactivate a push notification token */
router.post(
  '/push-token/remove',
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'token is required' },
      });
      return;
    }
    await PushService.removeToken(req.user!.userId, token);
    res.status(StatusCodes.OK).json({ success: true, data: { message: 'Token removed' } });
  })
);

export { router as userRouter };
