// src/controllers/uploadController.js
import { uploadService } from '../services/uploadService.js';

export const uploadController = {
    /**
     * POST /api/v1/upload/avatar
     * Upload avatar image and update user profile
     */
    uploadAvatar: async (req, res) => {
        try {
            // Check if file exists
            if (!req.file) {
                return res.status(400).json({
                    ok: false,
                    message: 'Vui lòng chọn file ảnh'
                });
            }

            const accountId = req.user?.aid;
            if (!accountId) {
                return res.status(401).json({
                    ok: false,
                    message: 'Unauthorized'
                });
            }

            // Generate avatar URL (accessible via http://localhost:3069/avatars/filename.jpg)
            const avatarUrl = `/avatars/${req.file.filename}`;

            // Update database
            const result = await uploadService.updateAvatar(accountId, avatarUrl);

            if (!result.ok) {
                return res.status(500).json(result);
            }

            return res.status(200).json({
                ok: true,
                message: 'Cập nhật ảnh đại diện thành công',
                data: {
                    avatar: avatarUrl,
                    user: result.data
                }
            });
        } catch (error) {
            console.error('uploadAvatar error:', error);
            return res.status(500).json({
                ok: false,
                message: 'Lỗi server khi tải ảnh lên'
            });
        }
    }
};
