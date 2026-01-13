// src/routers/upload.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadController } from '../controllers/uploadController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../public/avatars'));
    },
    filename: (req, file, cb) => {
        // Generate unique filename: accountId_timestamp.ext
        const uniqueSuffix = Date.now();
        const ext = path.extname(file.originalname);
        const filename = `${req.user?.aid}_${uniqueSuffix}${ext}`;
        cb(null, filename);
    }
});

// File filter: only accept images
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = allowedTypes.test(file.mimetype);
    const extName = allowedTypes.test(ext);

    if (mimeType && extName) {
        return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif)'));
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024 // 2MB max
    },
    fileFilter: fileFilter
});

// Routes
router.post('/avatar', authMiddleware.verifyToken, upload.single('avatar'), uploadController.uploadAvatar);

export default router;
