import fs from 'fs';
import path from 'path';

const transactionResponseFile = path.join(__dirname, '..', 'example', 'transaction_response.json');
const transactionReceiptFile = path.join(__dirname, '..', 'example', 'transaction_receipt.json');

function writeToFile(path: string, data: string) {
    const options: fs.WriteFileOptions = { encoding: 'utf8' };
    fs.writeFileSync(path, data, options);
  }
  
function readFile(path: string) {
const data = fs.readFileSync(path, { encoding: 'utf8' })
if (data.length === 0) {
    return [];
}
return JSON.parse(data);
}