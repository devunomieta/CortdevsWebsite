import path from 'path';
import { pathToFileURL } from 'url';

async function check() {
    const filePath = path.resolve('api/test-smtp.ts');
    const fileUrl = pathToFileURL(filePath).href;
    console.log(`Checking ${fileUrl}...`);
    try {
        const module = await import(fileUrl);
        console.log('Successfully imported module');
        console.log('Default export:', typeof module.default);
    } catch (e) {
        console.error('Import failed:');
        console.error(e);
    }
}

check();
