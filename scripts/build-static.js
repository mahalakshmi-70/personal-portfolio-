const fs = require("node:fs");
const path = require("node:path");

const projectDir = path.resolve(__dirname, "..");
const outputDir = path.join(projectDir, "dist");
const publicFiles = [
  "about.html",
  "admin.html",
  "auth.js",
  "contact.html",
  "education.html",
  "Golamari Mahalakshmi Resume 1.pdf",
  "index.html",
  "login.html",
  "profile.png",
  "project.html",
  "register.html",
  "script.js",
  "skills.html",
  "style.css",
];

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const file of publicFiles) {
  fs.copyFileSync(path.join(projectDir, file), path.join(outputDir, file));
}

console.log(`Prepared ${publicFiles.length} public files in dist/.`);
