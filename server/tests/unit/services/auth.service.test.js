import { describe, it, expect, vi, beforeEach } from 'vitest';
import authService from '../../../src/services/v1/auth.service.js';
import userModel from '../../../src/models/user.model.js';
import refreshTokenModel from '../../../src/models/refreshToken.model.js';
import { safeRedis } from '../../../src/db/redis.js';
import * as bcryptUtils from '../../../src/utils/bcrypt.utils.js';
import * as authCoreUtils from '../../../src/utils/authCore.utils.js';
import jwt from 'jsonwebtoken';
import emailNotificationService from '../../../src/services/notification/email/index.js';

describe('Unit: auth.service Business Logic', () => {
    const mockUserId = '64f1a2b3c4d5e6f7a8b9c0d1';
    const mockEmail = 'test@example.com';
    const mockPassword = 'password123';
    const mockHashedPassword = '$2a$10$abcdefghijklmnopqrstuvwxyz123456';

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(safeRedis, 'get').mockResolvedValue(null);
        vi.spyOn(safeRedis, 'getJson').mockResolvedValue(null);
        vi.spyOn(safeRedis, 'set').mockResolvedValue(true);
        vi.spyOn(safeRedis, 'setJson').mockResolvedValue(true);
        vi.spyOn(safeRedis, 'del').mockResolvedValue(1);
    });

    describe('login', () => {
        it('should throw 401 if user email does not exist in DB', async () => {
            vi.spyOn(userModel, 'findOne').mockReturnValue({
                select: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue(null)
                })
            });

            await expect(authService.login(mockEmail, mockPassword))
                .rejects.toThrow('Incorrect email or password');
        });

        it('should throw 403 if account was registered using Google OAuth', async () => {
            vi.spyOn(userModel, 'findOne').mockReturnValue({
                select: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue({
                        _id: mockUserId,
                        email: mockEmail,
                        googleLogin: true
                    })
                })
            });
            vi.spyOn(authCoreUtils, 'checkUserBlock').mockResolvedValue({
                _id: mockUserId,
                email: mockEmail,
                googleLogin: true
            });

            await expect(authService.login(mockEmail, mockPassword))
                .rejects.toThrow('This account was registered using Google');
        });

        it('should throw 401 if password does not match hash', async () => {
            vi.spyOn(userModel, 'findOne').mockReturnValue({
                select: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue({
                        _id: mockUserId,
                        email: mockEmail,
                        password: mockHashedPassword,
                        googleLogin: false
                    })
                })
            });
            vi.spyOn(authCoreUtils, 'checkUserBlock').mockResolvedValue({
                _id: mockUserId,
                email: mockEmail,
                password: mockHashedPassword,
                googleLogin: false
            });
            vi.spyOn(bcryptUtils, 'verifyHash').mockResolvedValue(false);

            await expect(authService.login(mockEmail, 'wrongpass'))
                .rejects.toThrow('Incorrect email or password');
        });

        it('should return user and is2FAEnabled: false if verified and 2FA not forced', async () => {
            const mockUser = {
                _id: mockUserId,
                email: mockEmail,
                password: mockHashedPassword,
                googleLogin: false,
                isVerified: true,
                settings: { alwaysRequireOtp: false }
            };

            vi.spyOn(userModel, 'findOne').mockReturnValue({
                select: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue(mockUser)
                })
            });
            vi.spyOn(authCoreUtils, 'checkUserBlock').mockResolvedValue(mockUser);
            vi.spyOn(bcryptUtils, 'verifyHash').mockResolvedValue(true);
            vi.spyOn(userModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

            const result = await authService.login(mockEmail, mockPassword);

            expect(result.user.email).toBe(mockEmail);
            expect(result.is2FAEnabled).toBe(false);
        });
    });

    describe('refreshToken', () => {
        it('should throw 403 on refresh token reuse attack detected after grace period', async () => {
            const secret = process.env.JWT_REFRESH_KEY || 'default-key';
            const oldToken = jwt.sign({ _id: mockUserId, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) }, secret);

            const rotatedPast = new Date(Date.now() - 30000); // 30 seconds ago (grace period is 15s)
            vi.spyOn(refreshTokenModel, 'findOne').mockReturnValue({
                lean: vi.fn().mockResolvedValue({
                    userId: mockUserId,
                    familyId: 'fam-123',
                    isRotated: true,
                    rotatedAt: rotatedPast
                })
            });
            vi.spyOn(userModel, 'findById').mockReturnValue({
                select: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue({ _id: mockUserId, isBlocked: false })
                })
            });
            vi.spyOn(authCoreUtils, 'checkUserBlock').mockResolvedValue({ _id: mockUserId, isBlocked: false });
            vi.spyOn(refreshTokenModel, 'deleteMany').mockResolvedValue({ deletedCount: 2 });

            await expect(authService.refreshToken(oldToken))
                .rejects.toThrow('Compromised token detected. Please sign in again.');
        });
    });

    describe('logout', () => {
        it('should delete session family and blacklist access token', async () => {
            vi.spyOn(refreshTokenModel, 'findOne').mockReturnValue({
                select: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue({ familyId: 'fam-789' })
                })
            });
            const deleteManySpy = vi.spyOn(refreshTokenModel, 'deleteMany').mockResolvedValue({ deletedCount: 1 });

            const result = await authService.logout('fake-access-token', 'fake-refresh-token');

            expect(result).toBe(true);
            expect(deleteManySpy).toHaveBeenCalledWith({ familyId: 'fam-789' });
        });
    });

    describe('verifyOTP', () => {
        it('should mark isNewUser: true when previous user document isVerified was false', async () => {
            vi.spyOn(safeRedis, 'get').mockImplementation(async (key) => {
                if (key.includes('email:to:id')) return mockUserId;
                return null;
            });
            vi.spyOn(safeRedis, 'getJson').mockResolvedValue({
                otp: 123456,
                otpAttempts: 0
            });

            vi.spyOn(userModel, 'findOneAndUpdate').mockReturnValue({
                lean: vi.fn().mockResolvedValue({
                    _id: mockUserId,
                    name: 'Newbie',
                    email: mockEmail,
                    isVerified: false,
                    settings: { notifyOnLogin: true }
                })
            });

            const result = await authService.verifyOTP(mockEmail, '123456');
            expect(result.isNewUser).toBe(true);
            expect(result.user.isVerified).toBe(true);
        });

        it('should mark isNewUser: false when previous user document was already verified', async () => {
            vi.spyOn(safeRedis, 'get').mockImplementation(async (key) => {
                if (key.includes('email:to:id')) return mockUserId;
                return null;
            });
            vi.spyOn(safeRedis, 'getJson').mockResolvedValue({
                otp: 123456,
                otpAttempts: 0
            });

            vi.spyOn(userModel, 'findOneAndUpdate').mockReturnValue({
                lean: vi.fn().mockResolvedValue({
                    _id: mockUserId,
                    name: 'Existing User',
                    email: mockEmail,
                    isVerified: true,
                    settings: { notifyOnLogin: true }
                })
            });

            const result = await authService.verifyOTP(mockEmail, '123456');
            expect(result.isNewUser).toBe(false);
            expect(result.user.isVerified).toBe(true);
        });
    });

    describe('verifyResetOtp', () => {
        it('should successfully verify reset OTP, burn it, generate resetToken and not send any emails', async () => {
            vi.spyOn(safeRedis, 'get').mockImplementation(async (key) => {
                if (key.includes('email:to:id')) return mockUserId;
                return null;
            });
            vi.spyOn(safeRedis, 'getJson').mockResolvedValue({
                otp: 123456,
                otpAttempts: 0
            });

            vi.spyOn(userModel, 'findOneAndUpdate').mockReturnValue({
                lean: vi.fn().mockResolvedValue({
                    _id: mockUserId,
                    name: 'Existing User',
                    email: mockEmail,
                    isVerified: true
                })
            });

            const updateOneSpy = vi.spyOn(userModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
            const emailSpy = vi.spyOn(emailNotificationService, 'addEmailJob').mockResolvedValue({ success: true });

            const result = await authService.verifyResetOtp(mockEmail, '123456');

            expect(result.token).toBeDefined();
            expect(result.user._id).toBe(mockUserId);
            expect(result.user.resetToken).toBe(result.token);
            expect(updateOneSpy).toHaveBeenCalled();
            expect(emailSpy).not.toHaveBeenCalled();
        });

        it('should throw 401 when verification code has already been burned or expired', async () => {
            vi.spyOn(safeRedis, 'get').mockImplementation(async (key) => {
                if (key.includes('email:to:id')) return mockUserId;
                return null;
            });
            vi.spyOn(safeRedis, 'getJson').mockResolvedValue({
                otp: 123456,
                otpAttempts: 0
            });

            vi.spyOn(userModel, 'findOneAndUpdate').mockReturnValue({
                lean: vi.fn().mockResolvedValue(null)
            });

            await expect(authService.verifyResetOtp(mockEmail, '123456'))
                .rejects.toThrow('Verification code has already been used or expired.');
        });
    });
});
