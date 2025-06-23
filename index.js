const express = require("express");
const { google } = require("googleapis");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const key = require("./service-account.json");

const auth = new google.auth.GoogleAuth({
  credentials: key,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.array("attachments"), async (req, res) => {
  try {
    const authClient = await auth.getClient();
    const drive = google.drive({ version: "v3", auth: authClient });

    const projectTitle = req.body.projectTitle || "مذكرة بدون عنوان";

    // 🗂️ إنشاء مجلد باسم المشروع في Google Drive
    const folderMetadata = {
      name: projectTitle,
      mimeType: "application/vnd.google-apps.folder",
      parents: [process.env.FOLDER_ID],
    };

    const folderResponse = await drive.files.create({
      resource: folderMetadata,
      fields: "id",
    });

    const folderId = folderResponse.data.id;

    // رفع جميع الملفات داخل المجلد الجديد
    const uploadedFiles = [];

    for (const file of req.files) {
      const fileMetadata = {
        name: file.originalname,
        parents: [folderId],
      };

      const media = {
        mimeType: file.mimetype,
        body: fs.createReadStream(file.path),
      };

      const fileResponse = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: "id",
      });

      // حذف الملف المحلي
      fs.unlinkSync(file.path);

      uploadedFiles.push({
        name: file.originalname,
        fileId: fileResponse.data.id,
      });
    }

    res.status(200).json({
      success: true,
      folderId,
      folderLink: `https://drive.google.com/drive/folders/${folderId}`,
      uploadedFiles,
    });

  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({ error: "Upload failed", detail: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
