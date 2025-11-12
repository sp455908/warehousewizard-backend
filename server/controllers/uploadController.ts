import { Request, Response } from "express";
import { cloudinary } from "../config/cloudinary";

class UploadController {
  async uploadFile(req: Request, res: Response) {
    try {
      const { file, folder } = req.body as { file?: string; folder?: string };

      if (!file) {
        return res.status(400).json({ message: "File payload is required" });
      }

      const uploadResponse = await cloudinary.uploader.upload(file, {
        folder: folder || "warehousewizard/uploads",
        resource_type: "auto",
      });

      return res.json({
        url: uploadResponse.secure_url,
        publicId: uploadResponse.public_id,
        bytes: uploadResponse.bytes,
      });
    } catch (error) {
      console.error("[UploadController] Failed to upload file:", error);
      return res.status(500).json({ message: "Failed to upload file" });
    }
  }
}

export const uploadController = new UploadController();

