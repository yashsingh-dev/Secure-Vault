import { describe, it, expect, vi, beforeEach } from 'vitest';
import userService from '../../../src/services/v1/user.service.js';
import userModel from '../../../src/models/user.model.js';

describe('Unit: user.service', () => {
    const mockUserId = '64f1a2b3c4d5e6f7a8b9c0d1';

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('getProfile', () => {
        it('should return sanitized user profile', async () => {
            vi.spyOn(userModel, 'findById').mockReturnValue({
                select: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue({
                        _id: mockUserId,
                        name: 'John Doe',
                        email: 'john@example.com',
                        isVerified: true,
                        googleLogin: false,
                        settings: { alwaysRequireOtp: false }
                    })
                })
            });

            const profile = await userService.getProfile(mockUserId);

            expect(profile.id).toBe(mockUserId);
            expect(profile.name).toBe('John Doe');
            expect(profile.email).toBe('john@example.com');
            expect(profile).not.toHaveProperty('password');
        });

        it('should throw 404 if user is not found', async () => {
            vi.spyOn(userModel, 'findById').mockReturnValue({
                select: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue(null)
                })
            });

            await expect(userService.getProfile(mockUserId))
                .rejects.toThrow('User account no longer exists.');
        });
    });

    describe('updateProfile', () => {
        it('should update name and return updated profile', async () => {
            vi.spyOn(userModel, 'findByIdAndUpdate').mockReturnValue({
                select: vi.fn().mockReturnValue({
                    lean: vi.fn().mockResolvedValue({
                        _id: mockUserId,
                        name: 'Jane Doe',
                        email: 'jane@example.com',
                        settings: { alwaysRequireOtp: true }
                    })
                })
            });

            const updated = await userService.updateProfile(mockUserId, { name: 'Jane Doe' });

            expect(updated.name).toBe('Jane Doe');
        });

        it('should throw 400 if no valid fields provided', async () => {
            await expect(userService.updateProfile(mockUserId, { invalidField: 123 }))
                .rejects.toThrow('No valid fields provided for update.');
        });
    });
});
