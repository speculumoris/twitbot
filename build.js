import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories
const EXT_DIR = path.join(__dirname, 'extension');
const BUILD_DIR = path.join(__dirname, 'build_extension');

// Configuration for Obfuscator (High Performance but Hard to Read)
const OBFUSCATE_OPTIONS = {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 1,
    debugProtection: true,
    disableConsoleOutput: true, // Disable console.log in prod
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    renameGlobals: false,
    rotateStringArray: true,
    selfDefending: true,
    stringArray: true,
    stringArrayEncoding: ['rc4'],
    stringArrayThreshold: 1,
    target: 'browser'
};

// Files to obfuscate
const JS_FILES = ['background.js', 'popup.js', 'crawler_content.js'];

// Files to copy as-is
const STATIC_FILES = ['manifest.json', 'popup.html', 'icon.png'];

// 1. Clean & Create Build Dir
if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
}
fs.mkdirSync(BUILD_DIR);

console.log('🔒 Building and Obfuscating Extension...');

// 2. Process JS Files
for (const file of JS_FILES) {
    const srcPath = path.join(EXT_DIR, file);
    const destPath = path.join(BUILD_DIR, file);

    if (fs.existsSync(srcPath)) {
        console.log(`   - Obfuscating ${file}...`);
        const code = fs.readFileSync(srcPath, 'utf8');

        const obfuscationResult = JavaScriptObfuscator.obfuscate(code, OBFUSCATE_OPTIONS);

        fs.writeFileSync(destPath, obfuscationResult.getObfuscatedCode());
    }
}

// 3. Copy Static Files
for (const file of STATIC_FILES) {
    const srcPath = path.join(EXT_DIR, file);
    const destPath = path.join(BUILD_DIR, file);

    if (fs.existsSync(srcPath)) {
        console.log(`   - Copying ${file}...`);
        fs.copyFileSync(srcPath, destPath);
    }
}

// 4. Create ZIP
console.log('📦 Creating secure-extension.zip...');
// Using system zip command
exec(`cd ${path.dirname(BUILD_DIR)} && zip -r secure-extension.zip build_extension`, (error, stdout, stderr) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }
    console.log('✅ DONE! "secure-extension.zip" is ready for distribution.');
});
