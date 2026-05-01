require("dotenv").config({ path: ".env.local" });
const AdmZip = require("adm-zip");
const path = require("path");

const zip = new AdmZip(path.join(process.cwd(), "mix_8m57s.docx"));
const doc = zip.readAsText("word/document.xml");
const text = doc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
console.log(text);
