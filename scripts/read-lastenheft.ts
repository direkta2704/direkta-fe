const AdmZip = require("adm-zip");
const path = require("path");
const fs = require("fs");

for (const file of ["Direkta_Lastenheft_Pflichtenheft_v1_1.docx", "Direkta_Lastenheft_Pflichtenheft_v1_2.docx"]) {
  console.log("=== " + file + " ===\n");
  const zip = new AdmZip(path.join(process.cwd(), file));
  const doc = zip.readAsText("word/document.xml");
  const text = doc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // Save to a text file for easier reading
  const outFile = file.replace(".docx", ".txt");
  fs.writeFileSync(outFile, text);
  console.log("Saved to:", outFile, "(" + text.length + " chars)");
  console.log(text.slice(0, 3000));
  console.log("\n...\n");
}
