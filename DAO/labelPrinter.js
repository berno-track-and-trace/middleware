import { exec } from 'child_process';
import bwipjs from 'bwip-js';

// Function to get a list of printers
const getPrinters = () => {
    return new Promise((resolve, reject) => {
        exec('lpstat -p -d', (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            if (stderr) {
                reject(stderr);
                return;
            }
            const printers = stdout.split('\n').map(line => {
                const match = line.match(/^printer (.*) .*$/);
                return match ? match[1] : null;
            }).filter(Boolean);
            resolve(printers);
        });
    });
};

// Example usage
getPrinters()
    .then(printers => {
        console.log('Printers:', printers);
    })
    .catch(error => {
        console.error('Error getting printers:', error);
    });



// Function to generate barcode image
const generateBarcodeImage = (barcodeContent) => {
    return new Promise((resolve, reject) => {
        bwipjs.toBuffer({
            bcid: 'qrcode', // Type of barcode (QR Code in this case)
            text: barcodeContent,
            scale: 3, // Adjust scale as needed
            includetext: false, // Set to true to include text below barcode
            textxalign: 'center', // Text alignment
            textsize: 12 // Text size
        }, (err, png) => {
            if (err) {
                reject(err);
            } else {
                resolve(png);
            }
        });
    });
};

// Function to print barcode
const printBarcode = async (barcodeContent, printerName) => {
    try {
        const png = await generateBarcodeImage(barcodeContent);

        // Command to send PNG data to printer using lpr command (CUPS)
        const command = `lpr -P ${printerName} -o raw`;

        // Execute the command
        const child = exec(command);
        child.stdin.write(png);
        child.stdin.end();

        child.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        child.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        child.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });
    } catch (error) {
        console.error(`Error printing barcode: ${error}`);
    }
};

// Example usage
const barcodeContent = "Your barcode content goes here...";
const printerName = "Your printer name";

printBarcode(barcodeContent, printerName);