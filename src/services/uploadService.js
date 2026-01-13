// src/services/uploadService.js
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadService = {
    /**
     * Update user avatar URL in database
     */
    updateAvatar: async (accountId, avatarUrl) => {
        try {
            const updated = await prisma.account.update({
                where: { A_ID: accountId },
                data: { Avatar: avatarUrl },
                select: {
                    A_ID: true,
                    UserName: true,
                    Avatar: true,
                    Email: true,
                    R_ID: true,
                    Member: {
                        select: {
                            M_ID: true,
                            FullName: true,
                            D_ID: true,
                            Department: {
                                select: {
                                    D_ID: true,
                                    D_Name: true
                                }
                            }
                        }
                    },
                    Role: {
                        select: {
                            R_ID: true,
                            R_Name: true
                        }
                    }
                }
            });

            return {
                ok: true,
                data: updated
            };
        } catch (error) {
            console.error('uploadService.updateAvatar error:', error);
            return {
                ok: false,
                message: 'Cập nhật avatar thất bại'
            };
        }
    },

    /**
     * Delete old avatar file if exists
     */
    deleteOldAvatar: async (avatarUrl) => {
        if (!avatarUrl) return;

        try {
            // Extract filename from URL (e.g., /avatars/xxx.jpg -> xxx.jpg)
            const filename = avatarUrl.split('/').pop();
            const filePath = path.join(__dirname, '../../public/avatars', filename);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error('Error deleting old avatar:', error);
            // Don't throw error, just log it
        }
    }
};
