// src/routers/upload.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { uploadController } from '../controllers/uploadController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure attachments folder exists
const attachmentsDir = path.join(__dirname, '../../public/attachments');
if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
}

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../public/avatars'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now();
        const ext = path.extname(file.originalname);
        const filename = `${req.user?.aid}_${uniqueSuffix}${ext}`;
        cb(null, filename);
    }
});

// Configure multer for attachment uploads
const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, attachmentsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now();
        // Decode UTF-8 filename properly
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const ext = path.extname(originalName);
        const baseName = path.basename(originalName, ext);
        // Create safe filename but keep extension
        const safeBaseName = baseName.replace(/[<>:"/\\|?*]/g, '_');
        const filename = `${uniqueSuffix}_${safeBaseName}${ext}`;
        // Store original name in request for later use
        req.originalFileName = originalName;
        cb(null, filename);
    }
});

// File filter for avatars: only accept images
const imageFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = allowedTypes.test(file.mimetype);
    const extName = allowedTypes.test(ext);

    if (mimeType && extName) {
        return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif)'));
};

// File filter for attachments: accept images, PDFs, docs
const attachmentFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip|rar/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.test(ext)) {
        return cb(null, true);
    }
    cb(new Error('Định dạng file không được hỗ trợ'));
};

const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: imageFilter
});

const uploadAttachment = multer({
    storage: attachmentStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: attachmentFilter
});

// Routes
router.post('/avatar', authMiddleware.verifyToken, uploadAvatar.single('avatar'), uploadController.uploadAvatar);
router.post('/attachment', authMiddleware.verifyToken, uploadAttachment.single('file'), uploadController.uploadAttachment);

export default router;

