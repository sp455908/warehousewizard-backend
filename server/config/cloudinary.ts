import { v2 as cloudinary } from "cloudinary";

if (!process.env.CLOUDINARY_URL) {
  console.warn(
    "[Cloudinary] CLOUDINARY_URL is not set. File upload endpoint will return 500 responses."
  );
}

cloudinary.config({
  secure: true,
});

export { cloudinary };

