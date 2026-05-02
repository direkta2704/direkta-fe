const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

async function test() {
  const input = path.join(process.cwd(), "public/uploads/cmojjb6jj0027j0iw38kjgdtl/d05f8078-fa60-4767-aae5-2c6c28b502ae.JPG");
  const buf = fs.readFileSync(input);
  console.log("Original:", (buf.length / 1024).toFixed(0), "KB");

  const enhanced = await sharp(buf)
    .normalize()
    .sharpen({ sigma: 0.8 })
    .modulate({ brightness: 1.02 })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  console.log("Enhanced:", (enhanced.length / 1024).toFixed(0), "KB");
  console.log("Pipeline: normalize (white balance) + sharpen + brightness +2%");
}
test();
