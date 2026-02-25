import type { Request, Response } from 'express';
import { AuthService } from '../../services/auth.service';
import { StatusCodes } from 'http-status-codes';

// ============================================================
// Auth Controller — thin handlers that delegate to AuthService
// and format the HTTP response.
// ============================================================

export class AuthController {
  /** POST /auth/otp/request */
  static async requestOtp(req: Request, res: Response) {
    const { phone, purpose } = req.body;
    await AuthService.createOtp(phone, purpose);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: 'OTP sent successfully' },
    });
  }

  /** POST /auth/otp/verify */
  static async verifyOtp(req: Request, res: Response) {
    const { phone, otp, purpose } = req.body;
    await AuthService.verifyOtp(phone, otp, purpose);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: 'OTP verified successfully', verified: true },
    });
  }

  /** POST /auth/register */
  static async register(req: Request, res: Response) {
    const result = await AuthService.register(req.body);
    res.status(StatusCodes.CREATED).json({
      success: true,
      data: result,
    });
  }

  /** POST /auth/login */
  static async loginWithOtp(req: Request, res: Response) {
    const { phone, otp } = req.body;

    const result = await AuthService.loginWithOtp(phone, otp);
    res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    });
  }

  /** POST /auth/refresh */
  static async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body;
    const result = await AuthService.refreshTokens(refreshToken);
    res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    });
  }

  /** POST /auth/logout */
  static async logout(req: Request, res: Response) {
    if (req.user?.sessionId) {
      await AuthService.logout(req.user.sessionId);
    }
    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  }

  /** GET /auth/me */
  static async me(req: Request, res: Response) {
    const { prisma } = await import('@riderguy/database');
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
      return;
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: user,
    });
  }

  /** POST /auth/login/password */
  static async loginWithPassword(req: Request, res: Response) {
    const { email, password } = req.body;
    const deviceInfo = req.headers['user-agent'] ?? undefined;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      undefined;

    const result = await AuthService.loginWithPassword(email, password, deviceInfo, ipAddress);
    res.status(StatusCodes.OK).json({
      success: true,
      data: result,
    });
  }

  /** GET /auth/sessions */
  static async listSessions(req: Request, res: Response) {
    const sessions = await AuthService.listSessions(req.user!.userId);
    res.status(StatusCodes.OK).json({
      success: true,
      data: sessions,
    });
  }

  /** DELETE /auth/sessions/:id */
  static async revokeSession(req: Request, res: Response) {
    const sessionId = req.params.id as string;
    await AuthService.revokeSession(req.user!.userId, sessionId);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: 'Session revoked' },
    });
  }

  /** DELETE /auth/sessions */
  static async revokeAllSessions(req: Request, res: Response) {
    const count = await AuthService.revokeAllSessions(
      req.user!.userId,
      req.user?.sessionId ?? undefined
    );
    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: `${count} session(s) revoked` },
    });
  }

  /** POST /auth/change-password */
  static async changePassword(req: Request, res: Response) {
    const { currentPassword, newPassword } = req.body;
    await AuthService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.status(StatusCodes.OK).json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  }
}
